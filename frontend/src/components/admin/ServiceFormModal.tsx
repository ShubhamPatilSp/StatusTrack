import { FC, useState, useEffect, FormEvent } from 'react';
import { Service, Organization, ServiceStatus } from '@/types';

// Use Omit to create a type for new service data, as `id` and dates are backend-generated.
export type ServiceFormData = Omit<Service, 'id' | 'created_at' | 'updated_at'>;

interface ServiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (service: ServiceFormData | (ServiceFormData & { id: string })) => void;
  isSaving: boolean;
  serviceToEdit?: Service | null;
  organizations: Organization[];
}

const ServiceFormModal: FC<ServiceFormModalProps> = ({ isOpen, onClose, onSave, isSaving, serviceToEdit, organizations }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ServiceStatus>('Operational');
  const [organizationId, setOrganizationId] = useState<string>('');

  useEffect(() => {
    if (serviceToEdit) {
      setName(serviceToEdit.name);
      setDescription(serviceToEdit.description);
      setStatus(serviceToEdit.status);
      setOrganizationId(serviceToEdit.organization_id);
    } else {
      // Reset form when adding a new service
      setName('');
      setDescription('');
      setStatus('Operational');
      setOrganizationId(organizations[0]?.id || '');
    }
  }, [serviceToEdit, isOpen, organizations]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const serviceData = { name, description, status, organization_id: organizationId };
    if (serviceToEdit?.id) {
      onSave({ ...serviceData, id: serviceToEdit.id });
    } else {
      onSave(serviceData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg m-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {serviceToEdit ? 'Edit Service' : 'Add New Service'}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Service Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ServiceStatus)}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Operational">Operational</option>
                <option value="Degraded Performance">Degraded Performance</option>
                <option value="Partial Outage">Partial Outage</option>
                <option value="Major Outage">Major Outage</option>
                <option value="Under Maintenance">Under Maintenance</option>
                <option value="Minor Outage">Minor Outage</option>
              </select>
            </div>
            <div>
              <label htmlFor="organization" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Organization</label>
              <select
                id="organization"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                disabled={!!serviceToEdit} // Prevent changing organization on edit
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600"
              >
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white dark:bg-gray-600 dark:text-gray-200 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceFormModal;
