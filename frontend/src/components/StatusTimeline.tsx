import { Incident, Service, ServiceStatusHistory } from '@/types';
import { format } from 'date-fns';

interface StatusTimelineProps {
  services: Service[];
  incidents: Incident[];
}

type TimelineEvent = 
    | { type: 'incident'; data: Incident; timestamp: Date } 
    | { type: 'service_status_update'; data: ServiceStatusHistory & { serviceName: string }; timestamp: Date };

export const StatusTimeline = ({ services, incidents }: StatusTimelineProps) => {
  const timelineEvents: TimelineEvent[] = [];

  // Add incidents to timeline
  incidents.forEach(incident => {
    timelineEvents.push({ type: 'incident', data: incident, timestamp: new Date(incident.created_at) });
  });

  // Add service status history to timeline
  services.forEach(service => {
    if (service.status_history) {
      service.status_history.forEach(history => {
        timelineEvents.push({ 
          type: 'service_status_update', 
          data: { ...history, serviceName: service.name }, 
          timestamp: new Date(history.timestamp) 
        });
      });
    }
  });

  // Sort all events chronologically
  timelineEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Event Timeline</h2>
      <div className="relative border-l-2 border-gray-200">
        {timelineEvents.map((event, index) => (
          <div key={index} className="mb-8 ml-6">
            <span className="absolute flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full -left-3 ring-8 ring-white">
              {/* Icon can be dynamic based on event type */}
              <svg className="w-3 h-3 text-blue-800" fill="currentColor" viewBox="0 0 20 20"><path d="M20 4a2 2 0 0 0-2-2h-2V1a1 1 0 0 0-2 0v1h-3V1a1 1 0 0 0-2 0v1H6V1a1 1 0 0 0-2 0v1H2a2 2 0 0 0-2 2v2h20V4Z"/><path d="M0 18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8H0v10Zm5-8h10a1 1 0 0 1 0 2H5a1 1 0 0 1 0-2Z"/></svg>
            </span>
            {event.type === 'incident' ? (
              <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="items-center justify-between sm:flex">
                    <time className="mb-1 text-xs font-normal text-gray-400 sm:order-last sm:mb-0">{format(event.timestamp, 'MMM d, yyyy HH:mm')}</time>
                    <div className="text-sm font-normal text-gray-500"><span className="font-semibold text-gray-900">{event.data.title}</span></div>
                </div>
                <div className="p-3 mt-3 text-sm italic text-gray-700 bg-gray-50 rounded-lg border border-gray-200">
                  {event.data.updates[0]?.message || 'Incident reported.'}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="items-center justify-between sm:flex">
                    <time className="mb-1 text-xs font-normal text-gray-400 sm:order-last sm:mb-0">{format(event.timestamp, 'MMM d, yyyy HH:mm')}</time>
                    <div className="text-sm font-normal text-gray-500">Service <span className="font-semibold text-gray-900">{event.data.serviceName}</span> changed status from <span className="font-semibold text-gray-900">{event.data.old_status}</span> to <span className="font-semibold text-gray-900">{event.data.new_status}</span>.</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
