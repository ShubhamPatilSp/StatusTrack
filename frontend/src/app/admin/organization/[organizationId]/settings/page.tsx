import OrganizationSettingsPage from '@/components/admin/OrganizationSettingsPage';

export default function Page({ params }: { params: { organizationId: string } }) {
  return <OrganizationSettingsPage organizationId={params.organizationId} />;
}
