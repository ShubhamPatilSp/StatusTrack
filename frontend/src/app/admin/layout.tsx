"use client";

import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Server,
  AlertTriangle,
  LogOut,
  ChevronDown,
  Menu,
  X,
  PlusCircle,
} from 'lucide-react';
import AddOrganizationModal from '@/components/admin/AddOrganizationModal';
import { Organization } from '@/types';
import { useState, useEffect } from 'react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

// --- Reusable Components ---





const Header = ({ user, onAddOrganization }: { user: any; onAddOrganization: () => void; }) => {
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm px-4 md:px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Admin Panel</h1>
      </div>

      <div className="flex items-center gap-4">
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link href="/admin/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50 transition-colors">Dashboard</Link>
          <Link href="/admin/dashboard/services" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50 transition-colors">Services</Link>
          <Link href="/admin/dashboard/incidents" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50 transition-colors">Incidents</Link>
          <Link href="/admin/dashboard/organizations" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50 transition-colors">Organizations</Link>
        </nav>
        {/* <button
            onClick={onAddOrganization}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 focus:outline-none"
          >
            <PlusCircle className="h-5 w-5" />
            <span className="hidden sm:inline">Add Organization</span>
        </button> */}

        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="User menu"
          >
            <img
              src={user.picture || `https://avatar.vercel.sh/${user.email}.png`}
              alt={user.name || 'User Avatar'}
              className="h-9 w-9 rounded-full border-2 border-transparent hover:border-blue-500 transition-all"
            />
            <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg py-2 z-50 border dark:border-gray-700/50">
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{user.name || 'User'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
              </div>
              <div className="py-1">
                <Link href="#" className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Account Settings</Link>
                <Link href="#" className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Help Center</Link>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700"></div>
              <a
                href="/api/auth/logout"
                className="flex items-center w-full px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="h-5 w-5 mr-3" />
                Logout
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};



// --- Main Layout ---

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, error, isLoading } = useUser();
  const router = useRouter();
  const [isAddOrgModalOpen, setIsAddOrgModalOpen] = useState(false);

  const handleAddOrganization = (newOrg: Organization) => {
    // TODO: Implement organization addition logic
    console.log('Adding organization:', newOrg);
    setIsAddOrgModalOpen(false);
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/api/auth/login?returnTo=/admin/dashboard');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><div>Loading...</div></div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen"><div>{error.message}</div></div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <div className="flex flex-col w-full">
        <Header user={user} onAddOrganization={() => setIsAddOrgModalOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 md:p-8 bg-gray-50 dark:bg-gray-950/50">
          {children}
        </main>
      </div>
      <AddOrganizationModal
        isOpen={isAddOrgModalOpen}
        onClose={() => setIsAddOrgModalOpen(false)}
        onAdd={handleAddOrganization}
      />
    </div>
  );
}