"use client";

import { FC, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Service, ServiceStatus, ServiceFormData } from '@/types/index';
import { Organization } from '@/types/index';

import StatusBadge from './StatusBadge';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import ServiceFormModal from './ServiceFormModal';

// This is the main client component for the page
interface ServicesClientPageProps {
  organizations: Organization[];
  selectedOrganization: Organization | null;
  setSelectedOrganization: (org: Organization | null) => void;
}

export const ServicesClientPage: React.FC<ServicesClientPageProps> = ({ organizations, selectedOrganization, setSelectedOrganization }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<Service | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);

  // Fetch services when selected organization changes
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setIsLoading(true);
        setError(null);
        if (!selectedOrganization) {
          setServices([]);
          setIsLoading(false);
          return;
        }

                        const response = await fetch(`/api/services?organization_id=${selectedOrganization.id}`);
        if (!response.ok) throw new Error('Failed to fetch services');
        const data = await response.json();
        setServices(data);
        setIsLoading(false);
      } catch (e: any) {
        setError(e.message);
        setIsLoading(false);
      }
    };
    fetchServices();
  }, [selectedOrganization]);

  const handleOpenAddModal = () => {
    setServiceToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (service: Service) => {
    setServiceToEdit(service);
    setIsFormModalOpen(true);
  };

  const handleOpenDeleteModal = (service: Service) => {
    setServiceToDelete(service);
    setIsDeleteModalOpen(true);
  };

  const handleSaveService = async (serviceData: ServiceFormData & { id?: string }) => {
    setIsSaving(true);
    const isEditing = !!serviceData.id;
    const endpoint = isEditing
      ? `/api/services/${serviceData.id}`
      : '/api/services';
    const method = isEditing ? 'PATCH' : 'POST';

    const payload: any = { ...serviceData };
    if (!isEditing) {
      if (!selectedOrganization) {
        setError('No organization selected. Cannot create service.');
        setIsSaving(false);
        return;
      }
      payload.organization_id = selectedOrganization.id;
    }

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save service' }));
        throw new Error(errorData.detail || errorData.message);
      }
      
      const savedService = await response.json();
      
      if (isEditing) {
        setServices(services.map(s => s.id === savedService.id ? savedService : s));
      } else {
        setServices([...services, savedService]);
      }
      setIsFormModalOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };
    
  const handleDeleteService = async () => {
    if (!serviceToDelete) return;
    setIsDeleting(true);
    try {
            const response = await fetch(`/api/services/${serviceToDelete.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete service' }));
        throw new Error(errorData.detail || errorData.message);
      }
      
      setServices(services.filter(s => s.id !== serviceToDelete.id));
      setIsDeleteModalOpen(false);
      setServiceToDelete(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Services</h1>
        <button
          onClick={handleOpenAddModal}
          disabled={!selectedOrganization}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:opacity-50"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          Add Service
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Last Updated</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {services.length > 0 ? services.map(service => (
                <tr key={service.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{service.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{service.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={service.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {service.updated_at ? format(new Date(service.updated_at), 'dd MMM yyyy, HH:mm') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-3">
                      <button onClick={() => handleOpenEditModal(service)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <Edit className="h-5 w-5" />
                      </button>
                      <button onClick={() => handleOpenDeleteModal(service)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-500">
                    {organizations.length === 0 ? 'You must create an organization before you can add services.' : 'No services found for this organization.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {isFormModalOpen && (
        <ServiceFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSave={handleSaveService}
          isSaving={isSaving}
          serviceToEdit={serviceToEdit}
          organizations={organizations}
        />
      )}
      
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteService}
        isDeleting={isDeleting}
        itemName={serviceToDelete?.name || ''}
      />
    </div>
  );
};

export default ServicesClientPage;
