"use client";

import ServicesClientPage from '@/components/admin/ServicesClientPage';
import { Suspense, useState, useEffect } from 'react';
import { Organization } from '@/types/index';

export default function ManageServicesPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await fetch('/api/organizations');
        if (!response.ok) throw new Error('Failed to fetch organizations');
        const data = await response.json();
        setOrganizations(data);
        if (data.length > 0) {
          setSelectedOrganization(data[0]);
        }
      } catch (e: any) {
        console.error('Error fetching organizations:', e);
      }
    };

    fetchOrganizations();
  }, []);

  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading Page...</div>}>
      <ServicesClientPage 
        organizations={organizations} 
        selectedOrganization={selectedOrganization} 
        setSelectedOrganization={setSelectedOrganization} 
      />
    </Suspense>
  );
}

