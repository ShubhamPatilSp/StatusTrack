"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Building, PlusCircle } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  // State for the create organization modal
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDescription, setNewOrgDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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

  const handleCreateOrganization = async () => {
    if (!newOrgName) {
      setCreateError("Organization name is required.");
      return;
    }
    setIsCreating(true);
    setCreateError(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error("Authentication failed.");
      }

      const response = await fetch(`${API_URL}/api/v1/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newOrgName, description: newOrgDescription }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create organization.');
      }

      // Success
      setCreateModalOpen(false);
      setNewOrgName("");
      setNewOrgDescription("");
      await fetchOrganizations(); // Refresh the list
    } catch (error: any) {
      setCreateError(error.message);
    } finally {
      setIsCreating(false);
    }
  };

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
          <DialogTrigger asChild>
            <Button className="mt-4">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Organization
            </Button>
          </DialogTrigger>
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
                <TableCell className="text-right">
                  {/* Action buttons can go here in the future */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Dialog open={isCreateModalOpen} onOpenChange={(isOpen) => {
      setCreateModalOpen(isOpen);
      if (!isOpen) {
        setCreateError(null);
        setNewOrgName("");
        setNewOrgDescription("");
      }
    }}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Organizations</h1>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> Create Organization
            </Button>
          </DialogTrigger>
        </div>

        {renderMainContent()}

      </div>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogDescription>
            Give your new organization a name and an optional description.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              className="col-span-3"
              placeholder="Acme Corporation"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Input
              id="description"
              value={newOrgDescription}
              onChange={(e) => setNewOrgDescription(e.target.value)}
              className="col-span-3"
              placeholder="The best company in the world."
            />
          </div>
          {createError && (
            <p className="col-span-4 text-sm text-red-500 text-center">{createError}</p>
          )}
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleCreateOrganization} disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Organization
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
