/**
 * Defines the status of a service. These values should align with the backend.
 */
export type ServiceStatus =
  | 'Operational'
  | 'Degraded Performance'
  | 'Partial Outage'
  | 'Major Outage'
  | 'Under Maintenance'
  | 'Minor Outage';

/**
 * Represents a single historical record of a service status change.
 */
export interface ServiceStatusHistory {
  id: string;
  old_status: ServiceStatus;
  new_status: ServiceStatus;
  timestamp: string; // ISO date string
}

/**
 * Represents a single service, mirroring the backend's Service model.
 * Uses snake_case for date fields to match the API response directly.
 */
export interface Service {
  id: string; // MongoDB ObjectId as a string
  name: string;
  description: string;
  status: ServiceStatus;
  organization_id: string;
  tags: string[];
  status_history: ServiceStatusHistory[];
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

/**
 * Represents an organization, mirroring the backend's Organization model.
 */
export interface Organization {
  id: string; // MongoDB ObjectId as a string
  name: string;
  description: string;
}

/**
 * Represents the data payload for creating or updating a service.
 */
export interface ServiceFormData {
  name: string;
  description: string;
  status: ServiceStatus;
  organization_id?: string;
}

/**
 * Defines the status of an incident.
 */
export enum IncidentStatusEnum {
    INVESTIGATING = "Investigating",
    IDENTIFIED = "Identified",
    MONITORING = "Monitoring",
    RESOLVED = "Resolved",
    SCHEDULED = "Scheduled",
}

/**
 * Defines the severity of an incident.
 */
export enum IncidentSeverityEnum {
    CRITICAL = "Critical",
    MAJOR = "Major",
    MINOR = "Minor",
}

/**
 * Represents a single update within an incident.
 */
export interface IncidentUpdate {
  id?: string; // The ID of the update itself
  message: string;
  timestamp: string; // ISO date string
}

/**
 * Represents a single incident, mirroring the backend's Incident model.
 */
export interface Incident {
  id: string; // MongoDB ObjectId as a string
  title: string;
  severity: IncidentSeverityEnum;
  status: IncidentStatusEnum; // Use the enum for strong typing
  organization_id: string;
  affected_services: string[];
  updates: IncidentUpdate[];
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  resolved_at?: string; // ISO date string
}
