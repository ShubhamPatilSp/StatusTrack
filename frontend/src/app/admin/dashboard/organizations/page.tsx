"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Building } from "lucide-react";
import { Organization } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Helper to get the token
const getAuthToken = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/auth/token'); // Relative path to Next.js API route
    if (!response.ok) {
      throw new Error('Failed to fetch auth token');
    }
    const data = await response.json();
    return data.accessToken;
  } catch (error) {
    console.error('Authentication Error:', error);
    return null;
  }
};

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAuthToken();
      if (!token) {
        setError("Authentication failed. Please log in again.");
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/v1/organizations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.detail || 'Failed to fetch organizations.');
        } catch (e) {
            throw new Error(`An error occurred: ${errorText}`);
        }
      }
      const data = await response.json();
      setOrganizations(data);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  // --- RENDER LOGIC ---
  const renderMainContent = () => {
    if (loading) {
      return (
        <div className="border rounded-lg p-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 border-b last:border-b-0">
              <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4"></div>
              <div className="h-8 w-8 bg-gray-200 rounded-md animate-pulse ml-auto"></div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/20 rounded-lg">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-lg font-medium text-red-600 dark:text-red-400">An error occurred</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <Button onClick={fetchOrganizations} className="mt-4">Try again</Button>
        </div>
      );
    }

    if (organizations.length === 0) {
      return (
        <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/20 rounded-lg">
          <Building className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">No organizations</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating your first organization.</p>
        </div>
      );
    }

    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50%]">Organization Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.map((org) => (
              <TableRow key={org.id}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400">{org.slug}</TableCell>

              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Organizations</h1>
      </div>

      {renderMainContent()}

    </div>
  );
}
