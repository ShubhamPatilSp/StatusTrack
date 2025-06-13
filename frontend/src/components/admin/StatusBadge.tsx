import { FC } from 'react';
import { ServiceStatus } from '@/types/index';

interface StatusBadgeProps {
  status: ServiceStatus;
}

const statusStyles: Record<ServiceStatus, string> = {
  [ServiceStatus.OPERATIONAL]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  [ServiceStatus.DEGRADED_PERFORMANCE]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  [ServiceStatus.PARTIAL_OUTAGE]: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  [ServiceStatus.MAJOR_OUTAGE]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  [ServiceStatus.UNDER_MAINTENANCE]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  [ServiceStatus.MINOR_OUTAGE]: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
};

const StatusBadge: FC<StatusBadgeProps> = ({ status }) => {
  const style = statusStyles[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${style} transition-colors duration-200 hover:opacity-90`}>
      <svg className="-ml-0.5 mr-2 h-3 w-3" fill="currentColor" viewBox="0 0 8 8">
        <circle cx="4" cy="4" r="3" />
      </svg>
      {status}
    </span>
  );
};

export default StatusBadge;
