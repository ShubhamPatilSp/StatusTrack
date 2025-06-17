"use client";

import { PlusCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Organization, Service, Incident, IncidentStatusEnum } from '@/types';
import { AddIncidentModal } from '@/components/admin/AddIncidentModal';
import { EditIncidentModal } from '@/components/admin/EditIncidentModal';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/hooks/useAdmin';

const statusColor = (status: string) => {
  switch (status) {
    case 'INVESTIGATING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
    case 'IDENTIFIED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
    case 'MONITORING': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300';
    case 'RESOLVED': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
};

const IncidentsPage: FC = () => {
  const { selectedOrganization, loading: orgLoading, error: orgError } = useAdmin();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddIncidentModalOpen, setAddIncidentModalOpen] = useState(false);
  const [isEditIncidentModalOpen, setEditIncidentModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const fetchIncidentsAndServices = useCallback(async () => {
    if (!selectedOrganization) return;

    setLoading(true);
    setError(null);
    try {
      const [incidentsRes, servicesRes] = await Promise.all([
        fetch(`/api/incidents?organization_id=${selectedOrganization.id}`),
        fetch(`/api/services?organization_id=${selectedOrganization.id}`)
      ]);

      if (!incidentsRes.ok) throw new Error(`Failed to fetch incidents: ${incidentsRes.statusText}`);
      const incidentsData = await incidentsRes.json();
      setIncidents(incidentsData);

      if (!servicesRes.ok) throw new Error(`Failed to fetch services: ${servicesRes.statusText}`);
      const servicesData = await servicesRes.json();
      setServices(servicesData);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedOrganization]);

  useEffect(() => {
    if (selectedOrganization) {
      fetchIncidentsAndServices();
    }
  }, [selectedOrganization, fetchIncidentsAndServices]);

  const handleIncidentAdded = () => {
    fetchIncidentsAndServices();
  };

  const handleIncidentUpdated = () => {
    fetchIncidentsAndServices();
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

      fetchIncidentsAndServices();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (orgLoading) {
    return <div>Loading organizations...</div>;
  }

  if (orgError) {
    return <div className="text-red-500">Error loading organization: {orgError}</div>;
  }

  if (!selectedOrganization) {
    return <div>Please select an organization to view incidents.</div>;
  }

  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Incident Management</h2>
        <Button onClick={() => setAddIncidentModalOpen(true)}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Create Incident
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
        {loading ? (
          <p>Loading incidents...</p>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : incidents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {incidents.map(incident => (
                  <tr key={incident.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{incident.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor(incident.status)}`}>
                        {incident.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(incident.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => openEditModal(incident)} className="text-blue-600 hover:text-blue-800">Edit</button>
                      <button onClick={() => handleDeleteIncident(incident.id)} className="text-red-600 hover:red-blue-800 ml-4">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <ShieldCheck className="h-12 w-12 mx-auto text-gray-400" />
            <h4 className="mt-4 font-semibold text-gray-700 dark:text-gray-200">No Incidents Found</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">This organization has not had any incidents.</p>
          </div>
        )}
      </div>

      <AddIncidentModal 
        isOpen={isAddIncidentModalOpen} 
        onClose={() => setAddIncidentModalOpen(false)} 
        onIncidentAdded={handleIncidentAdded}
        organizationId={selectedOrganization.id}
        services={services}
      />

      <EditIncidentModal
        isOpen={isEditIncidentModalOpen}
        onClose={() => setEditIncidentModalOpen(false)}
        onIncidentUpdated={handleIncidentUpdated}
        incident={selectedIncident}
      />
    </>
  );
};

export default IncidentsPage;
