import { DashboardHome } from '@/components/dashboard/dashboard-home';
import { studioRepository } from '@/lib/server/repository/studio-repository';

export default async function Page() {
  const dashboard = await studioRepository.getDashboardView();

  return <DashboardHome dashboard={dashboard} />;
}
