import PublicStatusClientPage from '@/components/public/PublicStatusClientPage';
import { FC } from 'react';

interface PublicStatusPageProps {
  params: {
    organizationSlug: string;
  };
}

const PublicStatusPage: FC<PublicStatusPageProps> = ({ params }) => {
  const { organizationSlug } = params;

  return <PublicStatusClientPage slug={organizationSlug} />;
};

export default PublicStatusPage;
