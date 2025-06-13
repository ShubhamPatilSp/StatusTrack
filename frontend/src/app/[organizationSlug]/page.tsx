import { notFound } from 'next/navigation';
import PublicStatusPageClient from '../../components/public/PublicStatusPageClient';
import { Organization, Service, Incident } from '@/types/index';

interface PublicStatusData {
  organization: Partial<Organization> & { name: string };
  services: Service[];
  incidents: Incident[];
}

async function getPublicStatusData(organizationSlug: string): Promise<PublicStatusData | null> {
  try {
    // On the server, we need to use an absolute URL to fetch from our own API routes.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${appUrl}/api/public_status/${organizationSlug}`, {
      next: { revalidate: 60 } // Revalidate every 60 seconds
    });

    if (!res.ok) {
      if (res.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch status data');
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching public status data:', error);
    // In a production environment, you might want to log this to a service like Sentry
    return null;
  }
}

export default async function StatusPage({ params }: { params: { organizationSlug: string } }) {
  const data = await getPublicStatusData(params.organizationSlug);

  if (!data) {
    notFound();
  }

  return (
    <PublicStatusPageClient 
      initialData={data} 
      organizationSlug={params.organizationSlug} 
    />
  );
}
