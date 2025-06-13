"use client";

import { PlusCircle, ShieldCheck, ShieldAlert, ShieldX, BarChart2, AlertTriangle, ChevronsUpDown, type LucideIcon } from 'lucide-react';
import type { FC } from 'react';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { Organization, Service, Incident, IncidentStatusEnum } from '@/types';
import { AddServiceModal } from '@/components/AddServiceModal';
import AddOrganizationModal from '@/components/admin/AddOrganizationModal';
import { AddIncidentModal } from '@/components/admin/AddIncidentModal';
import { EditIncidentModal } from '@/components/admin/EditIncidentModal';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandSeparator } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// --- Reusable Components ---

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  colorClass?: string;
}

const StatCard: FC<StatCardProps> = ({ title, value, icon: Icon, colorClass = 'text-blue-600' }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-300 flex items-start h-full">
    <div className={`p-3 rounded-full mr-4 ${colorClass.replace('text', 'bg').replace('600', '100')} dark:${colorClass.replace('text', 'bg').replace('600', '900/50')}`}>
      <Icon className={`w-6 h-6 ${colorClass}`} />
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-2xl font-semibold text-gray-800 dark:text-gray-100">{value}</p>
    </div>
  </div>
);

const StatCardSkeleton: FC = () => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm flex items-start h-full animate-pulse">
        <div className="p-3 rounded-full mr-4 bg-gray-200 dark:bg-gray-700">
            <div className="w-6 h-6"></div>
        </div>
        <div>
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="mt-2 h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
    </div>
);

const WidgetSkeleton: FC<{className?: string}> = ({className}) => (
    <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm animate-pulse ${className}`}>
        <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
        <div className="space-y-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        </div>
    </div>
);

// --- Main Dashboard Page Component ---
export default function AdminDashboardPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddServiceModalOpen, setAddServiceModalOpen] = useState(false);
  const [isAddOrgModalOpen, setIsAddOrgModalOpen] = useState(false);
  const [isAddIncidentModalOpen, setAddIncidentModalOpen] = useState(false);
  const [isEditIncidentModalOpen, setEditIncidentModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [open, setOpen] = useState(false);

  const statusColor = (status: string) => {
    switch (status) {
      case 'INVESTIGATING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'IDENTIFIED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'MONITORING': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300';
      case 'RESOLVED': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const fetchServicesAndIncidents = useCallback(async () => {
    if (!selectedOrganization) return;

    setLoading(l => l || true);
    setError(null);
    try {
      const [servicesRes, incidentsRes] = await Promise.all([
        fetch(`/api/services_proxy_route?organization_id=${selectedOrganization.id}`),
        fetch(`/api/incidents_proxy_route/organization/${selectedOrganization.id}`)
      ]);

      if (!servicesRes.ok) throw new Error(`Failed to fetch services: ${servicesRes.statusText}`);
      const servicesData = await servicesRes.json();
      setServices(servicesData);

      if (!incidentsRes.ok) throw new Error(`Failed to fetch incidents: ${incidentsRes.statusText}`);
      const incidentsData = await incidentsRes.json();
      setIncidents(incidentsData);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedOrganization]);

  useEffect(() => {
    const fetchOrganizations = async () => {
      setLoading(true);
      setError(null);
      try {
                const response = await fetch('/api/organizations');
        if (!response.ok) throw new Error(`Failed to fetch organizations: ${response.statusText}`);
        const data = await response.json();
        setOrganizations(data);
        if (data.length > 0) {
          setSelectedOrganization(data[0]);
        } else {
          setLoading(false);
        }
      } catch (e: any) {
        setError(e.message);
        setLoading(false);
      }
    };
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrganization) {
      fetchServicesAndIncidents();
    }
  }, [selectedOrganization, fetchServicesAndIncidents]);

  const handleAddOrganization = (newOrg: Organization) => {
    setOrganizations(prev => [...prev, newOrg]);
    setSelectedOrganization(newOrg);
  };

  const handleOrganizationChange = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
        setSelectedOrganization(org);
    }
  };

  const handleIncidentAdded = () => {
    fetchServicesAndIncidents();
  };

  const handleIncidentUpdated = () => {
    fetchServicesAndIncidents();
  };

  const openEditModal = (incident: Incident) => {
    setSelectedIncident(incident);
    setEditIncidentModalOpen(true);
  };

  const handleDeleteIncident = async (incidentId: string) => {
    if (!window.confirm('Are you sure you want to delete this incident? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/incidents/${incidentId}`, {
        method: 'DELETE',
      });

      if (response.status !== 204) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete incident');
      }

      fetchServicesAndIncidents();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const servicesSummary = {
    operational: services.filter(s => s.status === 'Operational').length,
    degraded: services.filter(s => s.status === 'Degraded Performance').length,
    outage: services.filter(s => s.status === 'Major Outage').length,
  };

  const quickStats = {
    totalServices: services.length,
    activeIncidents: incidents.filter(inc => inc.status !== IncidentStatusEnum.RESOLVED).length,
    uptime: '99.95%',
  };

  if (error && !loading) {
    return (
      <div className="p-4 md:p-8 bg-gray-50 dark:bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-semibold text-red-600">Failed to Load Dashboard Data</h2>
            <p className="text-gray-500 max-w-md mt-2">{error}</p>
            <p className="text-gray-400 text-sm mt-4">Please check your connection or try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full">
        <AddOrganizationModal
          isOpen={isAddOrgModalOpen}
          onClose={() => setIsAddOrgModalOpen(false)}
          onAdd={handleAddOrganization}
        />

        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h2>
          <div className="flex items-center gap-4">
            {loading && !selectedOrganization ? (
                <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-md h-10 w-48"></div>
            ) : (
                <Popover onOpenChange={setOpen} open={open}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="w-[200px] justify-between"
                        >
                            {selectedOrganization
                                ? organizations.find((org) => org.id === selectedOrganization.id)?.name
                                : "Select organization..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0">
                        <Command>
                            <CommandInput placeholder="Search organization..." />
                            <CommandEmpty>No organization found.</CommandEmpty>
                            <CommandGroup>
                                {organizations.map((org) => (
                                    <CommandItem
                                        key={org.id}
                                        value={org.id}
                                        onSelect={(currentValue) => {
                                            handleOrganizationChange(currentValue)
                                            setOpen(false)
                                        }}
                                    >
                                        {org.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup>
                              <CommandItem onSelect={() => { setIsAddOrgModalOpen(true); setOpen(false); }}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Organization
                              </CommandItem>
                            </CommandGroup>
                        </Command>
                    </PopoverContent>
                </Popover>
            )}
            {selectedOrganization && (
                <Link href={`/status/${selectedOrganization.slug}`} passHref legacyBehavior>
                  <a target="_blank" className="flex items-center px-3 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-lg shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition">
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    View Public Page
                  </a>
                </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {loading ? (
              <><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></>
          ) : (
              <>
                  <StatCard title="Total Services" value={quickStats.totalServices} icon={BarChart2} />
                  <StatCard title="Active Incidents" value={quickStats.activeIncidents} icon={AlertTriangle} colorClass="text-red-500" />
                  <StatCard title="90-Day Uptime" value={quickStats.uptime} icon={ShieldCheck} colorClass="text-green-500" />
              </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {loading ? (
                <>
                    <WidgetSkeleton className="lg:col-span-1" />
                    <WidgetSkeleton className="lg:col-span-2" />
                </>
            ) : (
                <>
                    <Link href="/admin/dashboard/services" className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-300 block col-span-1 lg:col-span-1 h-full">
                        <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-gray-100">Services Status</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center text-gray-600 dark:text-gray-300"><ShieldCheck className="w-5 h-5 mr-2 text-green-500" /> Operational</span>
                                <span className="font-semibold text-gray-800 dark:text-gray-100">{servicesSummary.operational}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center text-gray-600 dark:text-gray-300"><ShieldAlert className="w-5 h-5 mr-2 text-yellow-500" /> Degraded</span>
                                <span className="font-semibold text-gray-800 dark:text-gray-100">{servicesSummary.degraded}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center text-gray-600 dark:text-gray-300"><ShieldX className="w-5 h-5 mr-2 text-red-500" /> Outage</span>
                                <span className="font-semibold text-gray-800 dark:text-gray-100">{servicesSummary.outage}</span>
                            </div>
                        </div>
                    </Link>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm col-span-1 lg:col-span-2 h-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100">Active Incidents</h3>
                            <button
                                onClick={(e) => { e.preventDefault(); setAddIncidentModalOpen(true); }}
                                className="flex items-center px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
                            >
                                <PlusCircle className="w-4 h-4 mr-2" />
                                Create Incident
                            </button>
                        </div>

                        {incidents.length > 0 ? (
                            <div className="space-y-3">
                                {incidents.map(incident => (
                                    <div key={incident.id} className="flex items-start p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                        <div className="flex-shrink-0 bg-yellow-100 dark:bg-yellow-800 p-2 rounded-full mr-4">
                                            <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
                                        </div>
                                        <div className="flex-grow">
                                            <h4 className="font-semibold text-gray-800 dark:text-gray-100">{incident.title}</h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                                {incident.updates[incident.updates.length - 1]?.message || 'No update message available.'}
                                            </p>
                                            <div className="flex items-center gap-4 text-sm">
                                                <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor(incident.status)}`}>
                                                    {incident.status}
                                                </span>
                                                <button onClick={() => openEditModal(incident)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                                                <button onClick={() => handleDeleteIncident(incident.id)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <ShieldCheck className="h-12 w-12 mx-auto text-gray-400" />
                                <h4 className="mt-4 font-semibold text-gray-700 dark:text-gray-200">No Active Incidents</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">All systems are currently operational.</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
      </div>

      {selectedOrganization && (
        <AddServiceModal
          isOpen={isAddServiceModalOpen}
          onClose={() => setAddServiceModalOpen(false)}
          onServiceAdded={fetchServicesAndIncidents}
          organizationId={selectedOrganization.id}
        />
      )}

      {selectedOrganization && (
        <AddIncidentModal 
          isOpen={isAddIncidentModalOpen} 
          onClose={() => setAddIncidentModalOpen(false)} 
          onIncidentAdded={handleIncidentAdded}
          organizationId={selectedOrganization.id}
          services={services}
        />
      )}

      {selectedOrganization && (
        <EditIncidentModal
          isOpen={isEditIncidentModalOpen}
          onClose={() => setEditIncidentModalOpen(false)}
          onIncidentUpdated={handleIncidentUpdated}
          incident={selectedIncident}
        />
      )}
    </>
  );
}
