import { TaskCenter } from '@/components/tasks/task-center';
import { studioRepository } from '@/lib/server/repository/studio-repository';

export default async function TasksPage() {
  const workspace = await studioRepository.getWorkspace();

  return <TaskCenter initialTasks={workspace.tasks} />;
}
