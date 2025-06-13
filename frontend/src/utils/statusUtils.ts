export function getStatusColor(status: string): string {
  const statusColors: { [key: string]: string } = {
    'Operational': 'bg-green-100 text-green-800',
    'Degraded Performance': 'bg-yellow-100 text-yellow-800',
    'Partial Outage': 'bg-orange-100 text-orange-800',
    'Major Outage': 'bg-red-100 text-red-800',
    'Maintenance': 'bg-blue-100 text-blue-800',
  };

  return statusColors[status] || 'bg-gray-100 text-gray-800';
}
