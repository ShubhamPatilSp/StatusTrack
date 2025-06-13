'use client';

import { FC, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Loader2 } from 'lucide-react';
import { Service, IncidentStatusEnum, IncidentSeverityEnum } from '@/types';

const incidentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  status: z.nativeEnum(IncidentStatusEnum),
  severity: z.nativeEnum(IncidentSeverityEnum),
  initial_update_message: z.string().min(1, 'An initial update message is required'),
  affected_services: z.array(z.string()).optional(),
});

type IncidentFormData = z.infer<typeof incidentSchema>;

interface AddIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIncidentAdded: () => void;
  organizationId: string;
  services: Service[];
}

export const AddIncidentModal: FC<AddIncidentModalProps> = ({ isOpen, onClose, onIncidentAdded, organizationId, services }) => {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IncidentFormData>({
    resolver: zodResolver(incidentSchema),
        defaultValues: {
        title: '',
        status: IncidentStatusEnum.INVESTIGATING,
        severity: IncidentSeverityEnum.MAJOR,
        initial_update_message: '',
        affected_services: [],
    },
  });

  useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

    const onSubmit = async (data: IncidentFormData) => {
    try {
      const payload = {
          title: data.title,
          status: data.status,
          severity: data.severity,
          message: data.initial_update_message,
          affected_services: data.affected_services,
          organization_id: organizationId
      }
      const response = await fetch('/api/incidents_proxy_route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create incident');
      }

      onIncidentAdded();
      onClose();
    } catch (error: any) {
      console.error('Submission error:', error);
      alert(`Error: ${error.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 md:p-8 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Create New Incident</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-grow overflow-y-auto pr-2">
          <div className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
              <input {...register('title')} id="title" className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                                <select {...register('status')} id="status" className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                  {Object.values(IncidentStatusEnum).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
                            <div>
                <label htmlFor="severity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Severity</label>
                <select {...register('severity')} id="severity" className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                  {Object.values(IncidentSeverityEnum).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
                <label htmlFor="initial_update_message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Initial Update</label>
                <textarea {...register('initial_update_message')} id="initial_update_message" rows={4} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
                {errors.initial_update_message && <p className="text-red-500 text-sm mt-1">{errors.initial_update_message.message}</p>}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Affected Services</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border rounded-md max-h-48 overflow-y-auto">
                {services.length > 0 ? services.map(service => (
                  <label key={service.id} className="flex items-center space-x-2">
                    <input type="checkbox" {...register('affected_services')} value={service.id} className="h-4 w-4 rounded" />
                    <span>{service.name}</span>
                  </label>
                )) : <p className='col-span-full text-center text-gray-500'>No services available.</p>}
              </div>
            </div>
          </div>
        </form>
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</button>
          <button type="submit" onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
            {isSubmitting ? 'Creating...' : 'Create Incident'}
          </button>
        </div>
      </div>
    </div>
  );
};
