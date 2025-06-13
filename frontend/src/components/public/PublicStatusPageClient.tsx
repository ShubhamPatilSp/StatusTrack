'use client';

import { Service, Organization, Incident, ServiceStatus, IncidentStatusEnum, IncidentUpdate } from '@/types/index';
import { StatusTimeline } from '@/components/StatusTimeline';
import { EmailSubscription } from '@/components/EmailSubscription';
import UptimeGraphs from '@/components/UptimeGraphs';
import ServiceCard from './ServiceCard';
import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';

interface PublicStatusData {
  organization: Partial<Organization> & { name: string };
  services: Service[];
  incidents: Incident[];
}

interface ServiceUpdateData {
  service_id: string;
  status: ServiceStatus;
}

interface IncidentUpdateData {
  incident_id: string;
  status: IncidentStatusEnum;
  updates: IncidentUpdate[];
}

interface NewIncidentData {
  incident: Incident;
}

interface PublicStatusPageClientProps {
  initialData: PublicStatusData;
  organizationSlug: string;
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'Minor':
      return 'bg-yellow-100 text-yellow-800';
    case 'Major':
      return 'bg-red-100 text-red-800';
    case 'Critical':
      return 'bg-red-200 text-red-900';
    default:
      return 'bg-green-100 text-green-800';
  }
}

export default function PublicStatusPageClient({ initialData, organizationSlug }: PublicStatusPageClientProps) {
  const [data, setData] = useState<PublicStatusData>(initialData);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    let s: Socket;

    import('socket.io-client').then(({ io }) => {
      s = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');
      setSocket(s);

      s.on('connect', () => {
        console.log('Connected to WebSocket');
        s.emit('subscribe', { organizationSlug });
      });

      s.on('service_update', (update: ServiceUpdateData) => {
        setData((prev) => {
          if (!prev) return prev;
          const updatedServices = prev.services.map((service: Service) =>
            service.id === update.service_id ? { ...service, status: update.status } : service
          );
          return { ...prev, services: updatedServices };
        });
      });

      s.on('incident_update', (update: IncidentUpdateData) => {
        setData((prev) => {
          if (!prev) return prev;
          const updatedIncidents = prev.incidents.map((incident: Incident) =>
            incident.id === update.incident_id
              ? { ...incident, status: update.status, updates: update.updates }
              : incident
          );
          return { ...prev, incidents: updatedIncidents };
        });
      });

      s.on('incident_new', (newIncidentData: NewIncidentData) => {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            incidents: [newIncidentData.incident, ...prev.incidents],
          };
        });
      });
    });

    return () => {
      if (s) {
        s.disconnect();
      }
    };
  }, [organizationSlug]);

  const { organization, services, incidents } = data;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Organization Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{organization.name}</h1>
        <p className="text-gray-600">{organization?.description}</p>
      </div>

      {/* Email Subscription */}
      <div className="mb-8">
        {organization.id && <EmailSubscription organizationId={organization.id} />}
      </div>

      {/* Uptime Graphs */}
      <div className="mb-8">
        <UptimeGraphs services={services} />
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {services.map((service: Service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>

      {/* Active Incidents */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4">Active Incidents</h2>
        {incidents.filter(inc => inc.status !== IncidentStatusEnum.RESOLVED).length > 0 ? (
          incidents.filter(inc => inc.status !== IncidentStatusEnum.RESOLVED).map(incident => (
            <div key={incident.id} className="border-t pt-6 first:border-t-0 first:pt-0">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold text-gray-900">{incident.title}</h3>
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getSeverityColor(incident.severity)}`}>
                  {incident.severity}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Status: <span className="font-semibold">{incident.status}</span> | Last updated: {new Date(incident.updated_at).toLocaleString()}
              </p>
              
              <div className="mt-4 space-y-3">
                {incident.updates.slice().reverse().map((update, index) => (
                  <div key={update.id || index} className="pl-4 border-l-2">
                    <p className="text-gray-700">{update.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(update.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-600">Affected Services:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {incident.affected_services.map(serviceId => {
                    const service = services.find(s => s.id === serviceId);
                    return service ? (
                      <span key={serviceId} className="bg-gray-200 text-gray-800 px-2 py-1 text-xs font-medium rounded-full">
                        {service.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-600">No active incidents to report. All systems are operational.</p>
        )}
      </div>

      {/* Timeline */}
      <div>
        <StatusTimeline services={services} incidents={incidents} />
      </div>

      <footer className="text-center py-6 text-gray-500">
        <p>&copy; {new Date().getFullYear()} {organization.name}. All rights reserved.</p>
      </footer>
    </div>
  );
}
