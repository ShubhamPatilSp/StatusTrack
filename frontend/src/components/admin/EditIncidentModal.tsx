import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, X } from 'lucide-react';
import { Incident, IncidentStatusEnum, IncidentSeverityEnum } from '@/types';

const incidentUpdateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  status: z.nativeEnum(IncidentStatusEnum),
  severity: z.nativeEnum(IncidentSeverityEnum),
  message: z.string().min(1, 'An update message is required to save changes.'),
});

type IncidentUpdateFormData = z.infer<typeof incidentUpdateSchema>;



interface EditIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIncidentUpdated: () => void;
  incident: Incident | null;
}

export const EditIncidentModal = ({ isOpen, onClose, onIncidentUpdated, incident }: EditIncidentModalProps) => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<IncidentUpdateFormData>({
    resolver: zodResolver(incidentUpdateSchema),
  });

    useEffect(() => {
    if (incident) {
      reset({
        title: incident.title,
        status: incident.status,
        severity: incident.severity,
        message: '',
      });
    } else {
        reset();
    }
  }, [incident, reset]);

  const onSubmit = async (data: IncidentUpdateFormData) => {
    if (!incident) return;

    try {
      const response = await fetch(`/api/incidents/${incident.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update incident');
      }
      
      onIncidentUpdated();
      onClose();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (!isOpen || !incident) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-bold mb-4">Edit Incident</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium">Title</label>
            <input id="title" {...register('title')} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700" />
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="status" className="block text-sm font-medium">Status</label>
              <select id="status" {...register('status')} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700">
                {Object.values(IncidentStatusEnum).map(status => (
                  <option key={status} value={status}>{status.charAt(0) + status.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="severity" className="block text-sm font-medium">Severity</label>
              <select id="severity" {...register('severity')} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700">
                {Object.values(IncidentSeverityEnum).map(severity => (
                  <option key={severity} value={severity}>{severity.charAt(0) + severity.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="message" className="block text-sm font-medium">Update Message</label>
            <textarea id="message" {...register('message')} rows={4} className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700" placeholder="What's the latest?" />
            {errors.message && <p className="text-red-500 text-sm mt-1">{errors.message.message}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400">
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
