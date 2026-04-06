export type SeriesStatus = 'initialized' | 'setting' | 'producing' | 'partial_done' | 'done' | 'paused';

export type EpisodeStatus = 'not_started' | 'in_progress' | 'blocked' | 'review_pending' | 'done';

export type StationStatus = 'idle' | 'ready' | 'generating' | 'editing' | 'blocked' | 'completed';

export type ShotStatus = 'draft' | 'ready' | 'locked' | 'rendered';

export interface Series {
  id: string;
  name: string;
  description: string;
  status: SeriesStatus;
  coverUrl?: string;
  episodeCount: number;
  progress: number;
  createdAt: string;
}

export interface Episode {
  id: string;
  seriesId: string;
  index: number;
  title: string;
  status: EpisodeStatus;
  progress: number;
}

export interface Chapter {
  id: string;
  episodeId: string;
  index: number;
  title: string;
  content: string;
}

export interface Take {
  id: string;
  imageUrl?: string;
  videoUrl?: string;
  isSelected: boolean;
}

export interface ContinuityIssue {
  description: string;
  severity: 'warning' | 'error';
}

export interface Shot {
  id: string;
  chapterId: string;
  index: number;
  description: string;
  prompt?: string;
  scene: string;
  composition: string;
  lighting: string;
  cameraMotion?: string;
  dialogue?: string;
  duration: number | string;
  status: ShotStatus;
  imageUrl?: string;
  videoUrl?: string;
  takes?: Take[];
  videoTakes?: Take[];
  continuityIssues?: ContinuityIssue[];
}

export interface AssetVersion {
  id: string;
  imageUrl: string;
  isSelected: boolean;
}

export interface Asset {
  id: string;
  seriesId?: string;
  episodeId?: string;
  name: string;
  type: 'character' | 'scene' | 'prop';
  description: string;
  imageUrl?: string;
  isShared: boolean;
  isFaceLocked?: boolean;
  states?: { id: string; name: string }[];
  versions?: AssetVersion[];
}

export type ViewMode = 'dashboard' | 'series_detail' | 'episode_production' | 'tasks' | 'settings';
export type ProductionTab = 'overview' | 'script' | 'assets' | 'shot_list' | 'storyboard' | 'final';
