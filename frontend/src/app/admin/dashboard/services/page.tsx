import ServicesClientPage from '@/components/admin/ServicesClientPage';
import { Suspense } from 'react';

export default function ManageServicesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading Page...</div>}>
      <ServicesClientPage />
    </Suspense>
  );
}

