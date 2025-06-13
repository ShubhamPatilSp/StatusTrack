export enum ServiceStatus {
  OPERATIONAL = 'Operational',
  DEGRADED_PERFORMANCE = 'Degraded Performance',
  PARTIAL_OUTAGE = 'Partial Outage',
  MAJOR_OUTAGE = 'Major Outage',
  MAINTENANCE = 'Maintenance',
}

export enum IncidentStatusEnum {
  INVESTIGATING = 'Investigating',
  IDENTIFIED = 'Identified',
  MONITORING = 'Monitoring',
  RESOLVED = 'Resolved',
}

export enum IncidentSeverityEnum {
  MINOR = 'Minor',
  MAJOR = 'Major',
  CRITICAL = 'Critical',
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  slug: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  status: ServiceStatus;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentUpdate {
  id: string;
  message: string;
  timestamp: string;
  incident_id: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverityEnum;
  status: IncidentStatusEnum;
  organization_id: string;
  updates: IncidentUpdate[];
  affected_services: string[];
  created_at: string;
  updated_at: string;
}
