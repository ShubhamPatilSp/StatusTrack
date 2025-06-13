'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Organization, Incident, Service, IncidentSeverityEnum, IncidentStatusEnum } from '@/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MultiSelect } from '@/components/ui/multi-select';
import { toast } from 'sonner';

// Schema for creating a new incident
const incidentCreateSchema = z.object({
  organization_id: z.string().min(1, 'Organization is required'),
  title: z.string().trim().min(1, 'Title is required'),
  severity: z.nativeEnum(IncidentSeverityEnum),
  initial_update_message: z.string().trim().min(1, 'Initial update message is required'),
  affected_services: z.array(z.string()).min(1, 'At least one service must be affected'),
});

// Schema for updating an existing incident
const incidentUpdateSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  severity: z.nativeEnum(IncidentSeverityEnum),
  status: z.nativeEnum(IncidentStatusEnum),
  affected_services: z.array(z.string()).min(1, 'At least one service must be affected'),
  message: z.string().trim().optional(), // A new update message is optional
});

type IncidentCreateForm = z.infer<typeof incidentCreateSchema>;
type IncidentUpdateForm = z.infer<typeof incidentUpdateSchema>;

const IncidentsClientPage = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for modals
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isUpdateModalOpen, setUpdateModalOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);

  const createForm = useForm<IncidentCreateForm>({
    resolver: zodResolver(incidentCreateSchema),
    defaultValues: {
      organization_id: '',
      title: '',
      severity: IncidentSeverityEnum.MINOR,
      initial_update_message: '',
      affected_services: [],
    },
  });

  const updateForm = useForm<IncidentUpdateForm>({
    resolver: zodResolver(incidentUpdateSchema),
  });

  useEffect(() => {
    if (isCreateModalOpen) {
      createForm.reset();
    }
  }, [isCreateModalOpen, createForm]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [orgsRes, servicesRes] = await Promise.all([
                    fetch('/api/organizations'),
          fetch('/api/services_proxy_route'),
        ]);

        if (!orgsRes.ok) throw new Error('Failed to fetch organizations');
        if (!servicesRes.ok) throw new Error('Failed to fetch services');

        const orgsData: Organization[] = await orgsRes.json();
        const servicesData: Service[] = await servicesRes.json();

        setOrganizations(orgsData);
        setServices(servicesData);

        if (orgsData.length > 0) {
          const incidentsPromises = orgsData.map(org =>
            fetch(`/api/incidents_proxy_route/organization/${org.id}`).then(res => {
              if (res.ok) {
                return res.json();
              }
              if (res.status === 404) {
                return [];
              }
              throw new Error(`Failed to fetch incidents for ${org.name}`);
            })
          );

          const incidentsByOrg = await Promise.all(incidentsPromises);
          const allIncidents = incidentsByOrg.flat();
          setIncidents(allIncidents);
        } else {
          setIncidents([]);
        }
      } catch (e: any) {
        setError(e.message);
        toast.error(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Handler for creating an incident
  const handleCreateIncident = async (data: IncidentCreateForm) => {
    try {
      const payload = {
        ...data,
        status: IncidentStatusEnum.INVESTIGATING, // Default status
      };

      const response = await fetch('/api/incidents_proxy_route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create incident');
      }

      const newIncident = await response.json();
      setIncidents(prevIncidents => [newIncident, ...prevIncidents]);
      setCreateModalOpen(false);
      toast.success('Incident created successfully!');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Handler for opening the update modal
  const openUpdateModal = (incident: Incident) => {
    setEditingIncident(incident);
    updateForm.reset({
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      affected_services: incident.affected_services,
      message: '',
    });
    setUpdateModalOpen(true);
  };

  // Handler for updating an incident
  const handleUpdateIncident = async (data: IncidentUpdateForm) => {
    if (!editingIncident) return;

    const payload: Partial<IncidentUpdateForm> = { ...data };
    if (!payload.message || payload.message.trim() === '') {
      delete payload.message;
    }

    try {
      const incidentId = (editingIncident as any).id || (editingIncident as any)._id;
      if (!incidentId) {
        throw new Error('Incident ID is missing, cannot update.');
      }

      const res = await fetch(`/api/incidents_proxy_route/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          const errorMessage = errorData.detail?.[0]?.msg || errorData.detail || errorData.message || 'Failed to update incident';
          throw new Error(errorMessage);
        } catch (e) {
          throw new Error(errorText || 'Failed to update incident');
        }
      }

      const updatedIncident = await res.json();
      setIncidents(prev => prev.map(inc => ((inc.id || (inc as any)._id) === incidentId ? updatedIncident : inc)));

      setUpdateModalOpen(false);
      toast.success('Incident updated successfully!');
    } catch (error: any) {
      console.error('Update error:', error);
      toast.error(`Update failed: ${error.message}`);
    }
  };

  const getServiceOptionsForOrg = (orgId: string) => {
    return services
      .filter(s => s.organization_id === orgId)
      .map(s => ({ label: s.name, value: s.id }));
  };

  const createFormOrgId = createForm.watch('organization_id');
  const createServiceOptions = createFormOrgId ? getServiceOptionsForOrg(createFormOrgId) : [];

  const updateServiceOptions = editingIncident ? getServiceOptionsForOrg(editingIncident.organization_id) : [];

  useEffect(() => {
    if (createFormOrgId) {
      createForm.setValue('affected_services', []);
    }
  }, [createFormOrgId, createForm]);

  return (
    <div className="p-6 h-full flex flex-col">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Incidents</h1>
        <Dialog open={isCreateModalOpen} onOpenChange={setCreateModalOpen}>
          <DialogTrigger asChild><Button>Create New Incident</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader><DialogTitle>Create New Incident</DialogTitle></DialogHeader>
            <form onSubmit={createForm.handleSubmit(handleCreateIncident)} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Organization</Label>
                <Controller
                  control={createForm.control}
                  name="organization_id"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger><SelectValue placeholder="Select an organization..." /></SelectTrigger>
                      <SelectContent>
                        {organizations.map(org => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {createForm.formState.errors.organization_id && <p className="text-red-500 text-sm">{createForm.formState.errors.organization_id.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Controller name="title" control={createForm.control} render={({ field }) => <Input id="title" {...field} />} />
                {createForm.formState.errors.title && <p className="text-red-500 text-sm">{createForm.formState.errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Controller control={createForm.control} name="severity" render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Select severity..." /></SelectTrigger>
                    <SelectContent>{Object.values(IncidentSeverityEnum).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
                {createForm.formState.errors.severity && <p className="text-red-500 text-sm">{createForm.formState.errors.severity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Affected Services</Label>
                <Controller control={createForm.control} name="affected_services" render={({ field }) => (
                  <MultiSelect 
                    options={createServiceOptions} 
                    onValueChange={field.onChange} 
                    defaultValue={field.value} 
                    placeholder="Select affected services..."
                    className="w-full"
                    disabled={!createFormOrgId}
                  />
                )} />
                {createForm.formState.errors.affected_services && <p className="text-red-500 text-sm">{createForm.formState.errors.affected_services.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="initial_update_message">Initial Update Message</Label>
                <Controller name="initial_update_message" control={createForm.control} render={({ field }) => <Textarea id="initial_update_message" {...field} placeholder="A brief description of the issue..." />} />
                {createForm.formState.errors.initial_update_message && <p className="text-red-500 text-sm">{createForm.formState.errors.initial_update_message.message}</p>}
              </div>
              <DialogFooter><Button type="submit">Create Incident</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {error && <p className="text-red-500 py-2">Error: {error}</p>}

      <div className="border rounded-md flex-grow overflow-y-auto">
        {isLoading ? <p className="text-center p-4">Loading incidents...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.length > 0 ? incidents.map(incident => (
                <TableRow key={incident.id}>
                  <TableCell className="font-medium">{incident.title}</TableCell>
                  <TableCell>{incident.severity}</TableCell>
                  <TableCell>{incident.status}</TableCell>
                  <TableCell>{new Date(incident.created_at).toLocaleString()}</TableCell>
                  <TableCell><Button variant="outline" size="sm" onClick={() => openUpdateModal(incident)}>Update</Button></TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} className="text-center">No incidents found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Update Incident Modal */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setUpdateModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader><DialogTitle>Update Incident: {editingIncident?.title}</DialogTitle></DialogHeader>
          <form onSubmit={updateForm.handleSubmit(handleUpdateIncident)} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="update-title">Title</Label>
              <Controller name="title" control={updateForm.control} render={({ field }) => <Input id="update-title" {...field} />} />
              {updateForm.formState.errors.title && <p className="text-red-500 text-sm">{updateForm.formState.errors.title.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Severity</Label>
                <Controller control={updateForm.control} name="severity" render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Select severity..." /></SelectTrigger>
                    <SelectContent>{Object.values(IncidentSeverityEnum).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
                {updateForm.formState.errors.severity && <p className="text-red-500 text-sm">{updateForm.formState.errors.severity.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Controller control={updateForm.control} name="status" render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="Select status..." /></SelectTrigger>
                    <SelectContent>{Object.values(IncidentStatusEnum).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
                {updateForm.formState.errors.status && <p className="text-red-500 text-sm">{updateForm.formState.errors.status.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Affected Services</Label>
              <Controller control={updateForm.control} name="affected_services" render={({ field }) => (
                <MultiSelect 
                  options={updateServiceOptions} 
                  onValueChange={field.onChange} 
                  defaultValue={field.value} 
                  placeholder="Select affected services..."
                  className="w-full"
                />
              )} />
              {updateForm.formState.errors.affected_services && <p className="text-red-500 text-sm">{updateForm.formState.errors.affected_services.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="update-message">New Update Message (Optional)</Label>
              <Controller name="message" control={updateForm.control} render={({ field }) => <Textarea id="update-message" {...field} placeholder="Post a new update..." />} />
              {updateForm.formState.errors.message && <p className="text-red-500 text-sm">{updateForm.formState.errors.message.message}</p>}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IncidentsClientPage;
