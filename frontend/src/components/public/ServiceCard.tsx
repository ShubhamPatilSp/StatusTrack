"use client";

import { useEffect, useState } from 'react';
import { Service } from '@/types/index';
import MetricGraph from '@/components/metrics/MetricGraph';

interface ServiceCardProps {
  service: Service;
}

interface MetricDataPoint {
  timestamp: string;
  value: number;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Operational':
      return 'bg-green-100 text-green-800';
    case 'Degraded Performance':
      return 'bg-yellow-100 text-yellow-800';
    case 'Partial Outage':
      return 'bg-orange-100 text-orange-800';
    case 'Major Outage':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service }) => {
  const [metricData, setMetricData] = useState<MetricDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetricData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/metrics/${service.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch metric data');
        }
        const data: MetricDataPoint[] = await response.json();
        setMetricData(data);
      } catch (error) {
        console.error(`Error fetching metrics for service ${service.id}:`, error);
      } finally {
        setLoading(false);
      }
    };

    if (service.id) {
        fetchMetricData();
    }
  }, [service.id]);

  return (
    <div className="bg-white rounded-lg shadow p-6 flex flex-col justify-between">
      <div>
        <h3 className="text-lg font-semibold mb-2">{service.name}</h3>
        <p className="text-gray-600 mb-4">{service.description}</p>
        <div className="flex justify-between items-center mb-4">
          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(service.status)}`}>
            {service.status}
          </span>
          <span className="text-sm text-gray-500">Live Status</span>
        </div>
      </div>
      <div className="mt-4">
        <MetricGraph data={metricData} loading={loading} />
      </div>
    </div>
  );
};

export default ServiceCard;
