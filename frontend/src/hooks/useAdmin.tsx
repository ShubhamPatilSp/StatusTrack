"use client";

import { createContext, useContext, useState, useEffect, ReactNode, FC } from 'react';
import { Organization } from '@/types';

interface AdminContextType {
  organizations: Organization[];
  selectedOrganization: Organization | null;
  setSelectedOrganization: (org: Organization | null) => void;
  loading: boolean;
  error: string | null;
  addOrganization: (org: Organization) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrganizations = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/organizations');
        if (!response.ok) {
          throw new Error(`Failed to fetch organizations: ${response.statusText}`);
        }
        const data = await response.json();
        setOrganizations(data);
        if (data.length > 0 && !selectedOrganization) {
          setSelectedOrganization(data[0]);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchOrganizations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addOrganization = (newOrg: Organization) => {
    setOrganizations(prev => [...prev, newOrg]);
    setSelectedOrganization(newOrg);
  };

  const value = {
    organizations,
    selectedOrganization,
    setSelectedOrganization,
    loading,
    error,
    addOrganization
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
