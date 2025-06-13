import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Service, ServiceStatus } from '@/types';

interface DailyUptimeStatus {
  date: string;
  status: ServiceStatus;
}

interface ServiceUptimeData {
  daily_statuses: DailyUptimeStatus[];
}

interface UptimeGraphsProps {
  services: Service[];
}

const UptimeGraphs: React.FC<UptimeGraphsProps> = ({ services }) => {
  const [uptimeData, setUptimeData] = useState<ServiceUptimeData[]>([]);

  useEffect(() => {
    // Fetch uptime data for each service
    const fetchUptimeData = async () => {
      const serviceUptimePromises = services.map(async (service) => {
        try {
          const response = await fetch(`/api/v1/public/${service.organization_id}/services/${service.id}/uptime`);
          if (!response.ok) throw new Error('Failed to fetch uptime data');
          return await response.json();
        } catch (error) {
          console.error('Error fetching uptime data:', error);
          return null;
        }
      });

      const serviceUptimeData = await Promise.all(serviceUptimePromises);
      setUptimeData(serviceUptimeData.filter((data): data is ServiceUptimeData => data !== null));
    };

    fetchUptimeData();
  }, [services]);

  if (uptimeData.length === 0) {
    return <div className="min-h-[200px] flex items-center justify-center">Loading...</div>;
  }

  // Calculate overall uptime
  const calculateOverallUptime = (): { labels: string[]; datasets: { label: string; data: number[]; borderColor: string; tension: number }[] } => {
    const totalDays = 30; // Last 30 days
    const days = Array.from({ length: totalDays }, (_, i) => 
      new Date(Date.now() - (totalDays - i - 1) * 24 * 60 * 60 * 1000)
    );

    const overallUptime = days.map((day) => {
      const totalServices = services.length;
      let operationalCount = 0;

      services.forEach((service, index) => {
        if (uptimeData[index] && uptimeData[index].daily_statuses) {
          const status = uptimeData[index].daily_statuses.find(
            (status: DailyUptimeStatus) => new Date(status.date).toDateString() === day.toDateString()
          );
          operationalCount += status?.status === 'Operational' ? 1 : 0;
        }
      });

      return (operationalCount / totalServices) * 100;
    });

    return {
      labels: days.map(d => d.toLocaleDateString()),
      datasets: [{
        label: 'Overall Uptime',
        data: overallUptime,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }]
    };
  };

  // Create individual service uptime data
  const createServiceUptimeData = (): { labels: string[]; datasets: { label: string; data: number[]; borderColor: string; tension: number }[] } => {
    const datasets: { label: string; data: number[]; borderColor: string; tension: number }[] = [];
    let allDates: string[] = [];
    
    services.forEach((service, index) => {
      if (!uptimeData[index] || !uptimeData[index].daily_statuses) return;

      const serviceDates = uptimeData[index].daily_statuses.map((status: DailyUptimeStatus) => 
        new Date(status.date).toLocaleDateString()
      );
      const uptimes = uptimeData[index].daily_statuses.map((status: DailyUptimeStatus) => 
        status.status === 'Operational' ? 100 : 0
      );

      // Add to the set of all dates
      allDates = [...new Set([...allDates, ...serviceDates])].sort();

      datasets.push({
        label: service.name,
        data: uptimes,
        borderColor: `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`,
        tension: 0.1
      });
    });

    return {
      labels: allDates,
      datasets
    };
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Uptime'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20
        }
      }
    }
  } as const;

  const overallUptimeData = calculateOverallUptime();
  const serviceUptimeData = createServiceUptimeData();

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Overall Organization Uptime</h2>
        <div className="h-[300px]">
          <Line data={overallUptimeData} options={{ ...options, plugins: { title: { display: true, text: 'Overall Uptime' } } }} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Individual Service Uptime</h2>
        <div className="h-[300px]">
          <Line data={serviceUptimeData} options={{ ...options, plugins: { title: { display: true, text: 'Service Uptime' } } }} />
        </div>
      </div>
    </div>
  );
};

export default UptimeGraphs;
