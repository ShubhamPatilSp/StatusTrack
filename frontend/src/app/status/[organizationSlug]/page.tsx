'use client';

import { ShieldCheck, ShieldAlert, ShieldX, Wrench, Bell, ServerCrash, CheckCircle2, History, Loader2, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSockets';
import UptimeGraph from '@/components/UptimeGraph';

// --- Data Types ---
interface Organization {
  id: string;
  name: string;
  slug: string;
}

type ServiceStatus = "Operational" | "Degraded Performance" | "Partial Outage" | "Major Outage" | "Under Maintenance" | "Minor Outage";
interface Service {
  _id: string;
  name: string;
  status: ServiceStatus;
}

type IncidentStatus = "Investigating" | "Identified" | "Monitoring" | "Resolved" | "Scheduled";
interface IncidentUpdate {
  message: string;
  timestamp: string;
}
interface Incident {
  _id: string;
  title: string;
  status: IncidentStatus;
  updates: IncidentUpdate[];
  created_at: string;
}

// --- UI Configuration Maps ---
const serviceStatusMap: Record<ServiceStatus, { icon: FC<any>, color: string, label: string }> = {
  "Operational": { icon: ShieldCheck, color: 'text-green-500', label: 'Operational' },
  "Degraded Performance": { icon: ShieldAlert, color: 'text-yellow-500', label: 'Degraded Performance' },
  "Partial Outage": { icon: ShieldX, color: 'text-orange-500', label: 'Partial Outage' },
  "Minor Outage": { icon: ShieldAlert, color: 'text-orange-500', label: 'Minor Outage' },
  "Major Outage": { icon: ShieldX, color: 'text-red-500', label: 'Major Outage' },
  "Under Maintenance": { icon: Wrench, color: 'text-blue-500', label: 'Maintenance' },
};

const incidentStatusConfig: Record<IncidentStatus, { color: string, label: string }> = {
  "Investigating": { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200", label: "Investigating" },
  "Identified": { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200", label: "Identified" },
  "Monitoring": { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200", label: "Monitoring" },
  "Resolved": { color: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200", label: "Resolved" },
  "Scheduled": { color: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200", label: "Scheduled" },
};

// --- UI Components ---
const OverallStatusBanner: FC<{ services: Service[] }> = ({ services }) => {
  const hasMajorOutage = services.some(s => s.status === 'Major Outage');
  const hasPartialIssue = services.some(s => ["Degraded Performance", "Partial Outage", "Minor Outage"].includes(s.status));
  const status = hasMajorOutage ? 'outage' : hasPartialIssue ? 'degraded' : 'operational';

  const bannerConfig = {
    operational: { icon: CheckCircle2, bgColor: 'bg-green-100 dark:bg-green-900/50', textColor: 'text-green-800 dark:text-green-200', text: 'All Systems Operational' },
    degraded: { icon: ShieldAlert, bgColor: 'bg-yellow-100 dark:bg-yellow-900/50', textColor: 'text-yellow-800 dark:text-yellow-200', text: 'Some Systems Experiencing Issues' },
    outage: { icon: ServerCrash, bgColor: 'bg-red-100 dark:bg-red-900/50', textColor: 'text-red-800 dark:text-red-200', text: 'Major System Outage' },
  }[status];

  return (
    <div className={`flex items-center p-4 rounded-lg ${bannerConfig.bgColor} ${bannerConfig.textColor}`}>
      <bannerConfig.icon className="w-6 h-6 mr-3 flex-shrink-0" />
      <p className="font-semibold text-lg">{bannerConfig.text}</p>
    </div>
  );
};

const ServiceStatusRow: FC<{ service: Service; slug: string; isExpanded: boolean; onToggle: () => void; }> = ({ service, slug, isExpanded, onToggle }) => {
  const status = serviceStatusMap[service.status] || serviceStatusMap["Operational"];
  return (
    <li className="bg-white dark:bg-gray-800/50 rounded-lg shadow-sm overflow-hidden">
      <div
        className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={onToggle}
      >
        <span className="font-medium text-gray-700 dark:text-gray-300">{service.name}</span>
        <div className={`flex items-center text-sm font-semibold ${status.color}`}>
          <status.icon className="w-5 h-5 mr-2" />
          <span>{status.label}</span>
        </div>
      </div>
      {isExpanded && <UptimeGraph slug={slug} serviceId={service._id} />}
    </li>
  );
};

const IncidentCard: FC<{ incident: Incident }> = ({ incident }) => {
  const config = incidentStatusConfig[incident.status] || incidentStatusConfig.Investigating;
  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{incident.title}</h3>
        <span className={`mt-1 inline-block px-2 py-1 text-xs font-bold uppercase rounded-full ${config.color}`}>
          {config.label}
        </span>
      </div>
      <div className="p-5 space-y-4">
        {incident.updates.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((update, index) => (
          <div key={index} className="flex items-start">
            <div className="w-1.5 h-1.5 mt-2 bg-gray-300 dark:bg-gray-600 rounded-full mr-4 flex-shrink-0"></div>
            <div>
              <p className="text-sm text-gray-800 dark:text-gray-200">{update.message}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(update.timestamp).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LoadingState = () => (
  <div className="flex items-center justify-center h-screen">
    <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
  </div>
);

const ErrorState: FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center justify-center h-screen text-center">
    <div>
      <ServerCrash className="w-16 h-16 mx-auto text-red-500" />
      <h2 className="mt-4 text-2xl font-bold text-gray-800 dark:text-gray-200">An Error Occurred</h2>
      <p className="mt-2 text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  </div>
);

type MessageType = 'success' | 'error' | 'info';

const SubscriptionForm: FC<{ slug: string }> = ({ slug }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('');
    setMessageType(null);

    try {
      const res = await fetch(`/api/public_proxy/${slug}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageType('error');
        throw new Error(data.detail || 'Subscription failed.');
      }

      const responseMessage = data.message || 'Subscription successful!';
      if (responseMessage.includes('already subscribed')) {
        setMessageType('info');
      } else if (responseMessage.includes('could not be sent')) {
        setMessageType('info');
      } else {
        setMessageType('success');
      }
      setMessage(responseMessage);
      if (!responseMessage.includes('already subscribed')) {
        setEmail('');
      }
    } catch (error: any) {
      setMessageType('error');
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const messageConfig = messageType ? {
    success: { icon: CheckCircle2, color: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' },
    error: { icon: ShieldX, color: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200' },
    info: { icon: Bell, color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' },
  }[messageType] : null;

  return (
    <div className="mt-12 p-6 bg-gray-100 dark:bg-gray-800/50 rounded-lg">
      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 flex items-center">
        <Mail className="w-5 h-5 mr-2" />
        Subscribe to Updates
      </h3>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col sm:flex-row gap-2">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-grow"
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Subscribe'}
        </Button>
      </form>
      {message && messageConfig && (
        <div className={`mt-4 p-3 rounded-lg flex items-center text-sm ${messageConfig.color}`}>
          <messageConfig.icon className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}
    </div>
  );
};

// --- Main Page Component ---
export default function StatusPage({ params }: { params: { organizationSlug: string } }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [expandedService, setExpandedService] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/public_proxy/${params.organizationSlug}/status`);
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(`Failed to fetch status: ${errorData.detail || res.statusText}`);
        }
        const data = await res.json();
        setOrganization(data.organization);
        setServices(data.services || []);
        setIncidents(data.incidents || []);
        setLastUpdated(new Date());
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.organizationSlug]);

  // Connect to WebSocket
  const { lastMessage } = useWebSocket(organization?.id || null);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    try {
      const event = JSON.parse(lastMessage);
      const { event_type, payload } = event;

      if (!event_type || !payload) {
        console.warn("Received malformed WebSocket event:", event);
        return;
      }

      switch (event_type) {
        case 'service_created':
        case 'service_updated':
          setServices(prevServices => {
            const index = prevServices.findIndex(s => s._id === payload._id);
            if (index !== -1) {
              const newServices = [...prevServices];
              newServices[index] = payload;
              return newServices;
            } else {
              return [...prevServices, payload];
            }
          });
          break;
        case 'service_deleted':
          setServices(prevServices => prevServices.filter(s => s._id !== payload._id));
          break;
        case 'incident_created':
        case 'incident_updated':
          setIncidents(prevIncidents => {
            const index = prevIncidents.findIndex(i => i._id === payload._id);
            if (index !== -1) {
              const newIncidents = [...prevIncidents];
              newIncidents[index] = payload;
              return newIncidents;
            } else {
              return [payload, ...prevIncidents];
            }
          });
          break;
        case 'incident_deleted':
          setIncidents(prevIncidents => prevIncidents.filter(i => i._id !== payload._id));
          break;
        default:
          console.warn(`Unhandled WebSocket event type: ${event_type}`);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to parse or handle WebSocket message:", error, lastMessage);
    }
  }, [lastMessage]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!organization) return <ErrorState message="Organization not found." />;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 font-sans">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-5 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{organization.name} Status</h1>
          <a href="https://github.com/shubham-patil-18" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">Powered by StatusTrack</a>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="space-y-10 md:space-y-12">
          <OverallStatusBanner services={services} />

          <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-lg text-gray-800 dark:text-gray-200">Component Status</h2>
            </div>
            <div className="p-4 space-y-2">
              {services.map(service => (
                <ServiceStatusRow 
                  key={service._id} 
                  service={service} 
                  slug={params.organizationSlug}
                  isExpanded={expandedService === service._id}
                  onToggle={() => setExpandedService(expandedService === service._id ? null : service._id)}
                />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
              <History className="w-6 h-6 mr-3 text-gray-500" />
              Incident History
            </h2>
            {incidents.length > 0 ? (
              <div className="space-y-6">
                {incidents.map(incident => <IncidentCard key={incident._id} incident={incident} />)}
              </div>
            ) : (
              <div className="text-center py-12 bg-white dark:bg-gray-800/50 rounded-lg shadow-sm">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                <h4 className="mt-4 font-semibold text-lg text-gray-700 dark:text-gray-200">No Active Incidents</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">All systems have been stable.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <SubscriptionForm slug={params.organizationSlug} />
          <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
              <p>Last updated: {lastUpdated.toLocaleString()}</p>
              <p className="mt-1">Powered by StatusTrack</p>
          </div>
      </footer>
    </div>
  );
}
