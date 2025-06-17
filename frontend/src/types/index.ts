/**
 * Defines the status of a service. These values should align with the backend.
 */
export enum ServiceStatus {
  OPERATIONAL = 'Operational',
  DEGRADED_PERFORMANCE = 'Degraded Performance',
  PARTIAL_OUTAGE = 'Partial Outage',
  MAJOR_OUTAGE = 'Major Outage',
  UNDER_MAINTENANCE = 'Under Maintenance',
  MINOR_OUTAGE = 'Minor Outage',
}

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
  status_history: ServiceStatusHistory[];
  tags: string[];
  created_at: string | null; // Can be null
  updated_at: string | null; // Can be null
}

/**
 * Represents an organization, mirroring the backend's Organization model.
 */
export interface Organization {
  id: string; // MongoDB ObjectId as a string
  name: string;
  description: string;
  slug: string;
  owner_id: string;
  members: Array<{
    user_id: string;
    role: string;
  }>;
  created_at: string | null; // Can be null
  updated_at: string | null; // Can be null
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
