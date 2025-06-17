'use client';

import { FC, useEffect, useState } from 'react';

// Define TypeScript interfaces for the data
interface Organization {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
  status: string;
}

interface Incident {
  id: string;
  title: string;
  status: string;
  updates: { timestamp: string; description: string }[];
}

interface PublicStatusData {
  organization: Organization;
  services: Service[];
  incidents: Incident[];
}

interface PublicStatusClientPageProps {
  slug: string;
}

const statusStyles: { [key: string]: { color: string; text: string } } = {
  OPERATIONAL: { color: 'bg-green-500', text: 'Operational' },
  DEGRADED_PERFORMANCE: { color: 'bg-yellow-500', text: 'Degraded Performance' },
  PARTIAL_OUTAGE: { color: 'bg-orange-500', text: 'Partial Outage' },
  MAJOR_OUTAGE: { color: 'bg-red-500', text: 'Major Outage' },
  MAINTENANCE: { color: 'bg-blue-500', text: 'Under Maintenance' },
};

const PublicStatusClientPage: FC<PublicStatusClientPageProps> = ({ slug }) => {
  const [data, setData] = useState<PublicStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/public_proxy/${slug}/status`);
        if (!response.ok) {
          throw new Error('Failed to fetch status data.');
        }
        const result: PublicStatusData = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  if (loading) {
    return <div className="text-center p-10">Loading status page...</div>;
  }

  if (error) {
    return <div className="text-center p-10 text-red-500">Error: {error}</div>;
  }

  if (!data) {
    return <div className="text-center p-10">No data available for this organization.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-white shadow-md p-6">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold text-gray-800">{data.organization.name} Status</h1>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-700">Current System Status</h2>
          <ul className="space-y-4">
            {data.services.map((service) => {
              const statusInfo = statusStyles[service.status] || { color: 'bg-gray-500', text: 'Unknown' };
              return (
                <li key={service.id} className="flex items-center justify-between p-4 border rounded-md">
                  <span className="text-lg text-gray-800">{service.name}</span>
                  <div className="flex items-center">
                    <span className={`px-3 py-1 text-sm font-semibold text-white rounded-full ${statusInfo.color}`}>
                      {statusInfo.text}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Incident history can be added here in the future */}
      </main>

      <footer className="text-center py-4 text-gray-500 text-sm">
        Powered by StatusTrack
      </footer>
    </div>
  );
};

export default PublicStatusClientPage;
