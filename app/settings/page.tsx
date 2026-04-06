import { SettingsCenter } from '@/components/settings/settings-center';
import { studioRepository } from '@/lib/server/repository/studio-repository';

export default async function SettingsPage() {
  const workspace = await studioRepository.getWorkspace();

  return <SettingsCenter initialSettings={workspace.settings} />;
}
