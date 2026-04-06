export const seriesStatuses = ['initialized', 'setting', 'producing', 'partial_done', 'done', 'paused'] as const;
export const episodeStatuses = ['not_started', 'in_progress', 'blocked', 'review_pending', 'done'] as const;
export const stationStatuses = ['idle', 'ready', 'generating', 'editing', 'blocked', 'completed'] as const;
export const shotStatuses = ['draft', 'ready', 'locked', 'rendered'] as const;
export const assetTypes = ['character', 'scene', 'prop'] as const;
export const takeKinds = ['image', 'video'] as const;
export const taskStatuses = ['queued', 'running', 'failed', 'completed'] as const;
export const taskKinds = [
  'agent',
  'script',
  'asset',
  'shot',
  'storyboard',
  'final_cut',
  'settings',
  'recovery',
] as const;
export const workstationTabs = ['overview', 'script', 'subjects', 'shots', 'storyboard', 'final-cut'] as const;
export const assetProcessingStates = ['pending', 'extracting', 'ready', 'generating', 'completed', 'failed'] as const;
export const workflowStages = [
  'script_generation',
  'asset_extraction',
  'asset_rendering',
  'shot_generation',
  'shot_rendering',
  'storyboard',
  'final_cut',
  'export',
] as const;
export const workflowActionKinds = [
  'generate_script',
  'extract_assets',
  'generate_asset_images',
  'generate_shots',
  'generate_shot_images',
  'open_storyboard',
  'open_final_cut',
  'export_episode',
] as const;
