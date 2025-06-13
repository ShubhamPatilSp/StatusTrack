"use client";

import { useState, FormEvent, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Keep only one import for Select
import { Textarea } from "@/components/ui/textarea";
import { Service, ServiceStatus, Organization, ServiceFormData } from "@/types";

interface AddServiceFormProps {
  organizations: Organization[]; 
  onSubmit: (serviceData: ServiceFormData) => void; 
  onCloseDialog: () => void;
  existingService?: Service | null; 
}

const AddServiceForm: React.FC<AddServiceFormProps> = ({ onSubmit, onCloseDialog, existingService, organizations }) => {
  // Initialize name, description, status from existingService or defaults
  const [name, setName] = useState(existingService?.name || '');
  const [description, setDescription] = useState(existingService?.description || '');
  const [status, setStatus] = useState<ServiceStatus>(existingService?.status || ServiceStatus.OPERATIONAL);
  const [organizationId, setOrganizationId] = useState<string>('');

  useEffect(() => {
    if (existingService?.organization_id) {
      setOrganizationId(existingService.organization_id);
    } else if (!existingService && organizations && organizations.length > 0) {
      // Default to the first organization if creating a new service and organizations are available
      setOrganizationId(organizations[0].id);
    } else {
      // If no existing service and no organizations, or editing without org_id, clear it or set to a placeholder if your Select supports it
      setOrganizationId(''); 
    }
  }, [existingService, organizations]);



  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const serviceData: ServiceFormData = { name, description, status };
    if (!existingService) { 
      if (!organizationId) {
        alert("Please select an organization."); 
        return;
      }
      serviceData.organization_id = organizationId;
    }
    onSubmit(serviceData);
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="service-name">Service Name</Label>
        <Input
          id="service-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Main Website, API Gateway"
          required
        />
      </div>
      <div>
        <Label htmlFor="service-description">Description (Optional)</Label>
        <Textarea
          id="service-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description of the service"
        />
      </div>
      {!existingService && (
        <div>
          <Label htmlFor="organization">Organization</Label>
          <Select onValueChange={setOrganizationId} value={organizationId} required>
            <SelectTrigger id="organization">
              <SelectValue placeholder="Select an organization" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <Label htmlFor="service-status">Status</Label>
        <Select value={status} onValueChange={(value) => setStatus(value as ServiceStatus)} required>
          <SelectTrigger id="service-status">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(ServiceStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCloseDialog}>
          Cancel
        </Button>
        <Button type="submit">{existingService ? 'Save Changes' : 'Add Service'}</Button>
      </div>
    </form>
  );
};

export default AddServiceForm;
