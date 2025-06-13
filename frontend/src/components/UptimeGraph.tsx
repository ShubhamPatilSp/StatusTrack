'use client';

import { useState, useEffect, FC } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, TooltipProps } from 'recharts';
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import { Loader2, ServerCrash } from 'lucide-react';

// --- Types ---
type ServiceStatus = "Operational" | "Degraded Performance" | "Partial Outage" | "Major Outage" | "Under Maintenance" | "Minor Outage";

interface DailyStatus {
  date: string;
  status: ServiceStatus;
}

interface UptimeData {
  overall_uptime_percentage: number;
  daily_statuses: DailyStatus[];
}

// --- Helper Functions & Constants ---
const statusColorMap: Record<ServiceStatus, string> = {
  "Operational": '#22c55e', // green-500
  "Degraded Performance": '#f59e0b', // yellow-500
  "Partial Outage": '#f97316', // orange-500
  "Minor Outage": '#f97316', // orange-500
  "Major Outage": '#ef4444', // red-500
  "Under Maintenance": '#3b82f6', // blue-500
};

const CustomTooltip: FC<TooltipProps<ValueType, NameType>> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data: DailyStatus = payload[0].payload;
    const statusColor = statusColorMap[data.status] || '#cccccc';
    return (
      <div className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg">
        <p className="font-bold text-gray-800 dark:text-gray-200">{new Date(label as string).toLocaleDateString()}</p>
        <p style={{ color: statusColor }}>Status: {data.status}</p>
      </div>
    );
  }
  return null;
};

// --- Main Component ---
interface UptimeGraphProps {
  slug: string;
  serviceId: string;
}

const UptimeGraph: FC<UptimeGraphProps> = ({ slug, serviceId }) => {
  const [data, setData] = useState<UptimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/public_status_proxy/${slug}/services/${serviceId}/uptime`);
        if (!res.ok) {
          const errorData = await res.json();
          console.error('Full error from backend proxy:', errorData);
          throw new Error(errorData.error || errorData.detail || 'Failed to fetch uptime data.');
        }
        const uptimeData: UptimeData = await res.json();
        setData(uptimeData);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [slug, serviceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-red-500">
        <ServerCrash className="w-8 h-8" />
        <p className="mt-2 text-sm text-center max-w-md break-words">{error || 'Could not load uptime data.'}</p>
      </div>
    );
  }

  const chartData = data.daily_statuses.map(d => ({ ...d, value: 1 }));

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-bold text-gray-800 dark:text-gray-200">90-Day Uptime</h4>
        <p className="font-bold text-lg text-green-600 dark:text-green-400">{data.overall_uptime_percentage.toFixed(4)}%</p>
      </div>
      <div style={{ width: '100%', height: 100 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} barCategoryGap={1} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <XAxis dataKey="date" hide />
            <YAxis hide domain={[0, 1]} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.1)' }} />
            <Bar dataKey="value">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={statusColorMap[entry.status] || '#cccccc'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default UptimeGraph;
