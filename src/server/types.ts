export type EpisodeStage =
  | "planning"
  | "script"
  | "assets"
  | "storyboard"
  | "video"
  | "review"
  | "export";

export type StageStatus = "not_started" | "in_progress" | "blocked" | "ready" | "done";
export type SeriesStatus = "initialized" | "setting" | "producing" | "partial_done" | "done" | "paused";

export type ScriptAspectRatio = "16:9" | "9:16" | "4:3" | "3:4";
export type ScriptCreationMode = "image_to_video" | "reference_video";
export type ScriptVisualTone = "realistic" | "anime";
export type ScriptChapterStatus = "active" | "ready" | "draft";

export type EntityType = "character" | "scene" | "prop";

export type VendorProvider = "openai" | "google" | "openai-compatible";

export type VendorModelType = "text" | "image" | "video";

export interface VendorModel {
  name: string;
  modelName: string;
  type: VendorModelType;
  supportsTools?: boolean;
  mode?: string[];
}

export interface VendorConfig {
  id: string;
  name: string;
  provider: VendorProvider;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  models: VendorModel[];
  config: Record<string, string>;
}

export interface SeriesRecord {
  id: string;
  title: string;
  summary: string;
  genre: string;
  status: SeriesStatus;
  worldview: string;
  visualGuide: string;
  directorGuide: string;
  createdAt: string;
}

export interface SeriesStrategyRecord {
  seriesId: string;
  textModelRef: string | null;
  imageModelRef: string | null;
  videoModelRef: string | null;
  promptPolicies: Array<{ stage: string; policy: string }>;
  agentPolicies: Array<{ name: string; value: string }>;
  updatedAt: string;
}

export interface EpisodeRecord {
  id: string;
  seriesId: string;
  code: string;
  title: string;
  synopsis: string;
  sourceText: string;
  stage: EpisodeStage;
  status: StageStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EntityRecord {
  id: string;
  episodeId: string;
  type: EntityType;
  name: string;
  description: string;
  prompt: string;
  createdAt: string;
}

export interface ScriptRecord {
  id: string;
  episodeId: string;
  version: number;
  strategy: string;
  outline: string[];
  scriptText: string;
  createdAt: string;
}

export interface AssetRecord {
  id: string;
  episodeId: string;
  type: EntityType;
  name: string;
  description: string;
  prompt: string;
  imageUrl: string | null;
  locked: boolean;
  createdAt: string;
}

export interface StoryboardRecord {
  id: string;
  episodeId: string;
  shotIndex: number;
  title: string;
  action: string;
  dialogue: string;
  prompt: string;
  durationSeconds: number;
  assetRefs: string[];
  status: "draft" | "fixed" | "locked";
  imageUrl: string | null;
  createdAt: string;
}

export interface VideoCandidateRecord {
  id: string;
  episodeId: string;
  storyboardId: string;
  provider: string;
  model: string;
  status: "ready" | "rendering" | "failed";
  summary: string;
  videoUrl: string | null;
  localPath: string | null;
  selected: boolean;
  createdAt: string;
}

export interface FinalCutRecord {
  episodeId: string;
  filePath: string;
  fileUrl: string;
  format: string;
  createdAt: string;
}

export interface TaskRecord {
  id: string;
  seriesId: string;
  episodeId: string;
  stage: EpisodeStage;
  action: string;
  status: "waiting" | "running" | "success" | "failed" | "retrying";
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeriesSharedAssetRecord {
  id: string;
  seriesId: string;
  name: string;
  category: "characters" | "scenes" | "props";
  summary: string;
  locked: boolean;
  mainVersion: string;
  note: string;
  owner: string;
  episodeRefs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SeriesSharedAssetVariantRecord {
  id: string;
  assetId: string;
  label: string;
  prompt: string;
  selected: boolean;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EpisodeScriptWorkspaceConfigRecord {
  episodeId: string;
  targetWords: number;
  aspectRatio: ScriptAspectRatio;
  creationMode: ScriptCreationMode;
  visualTone: ScriptVisualTone;
  chapterCursor: string;
  quickNotes: string[];
  styleReferences: ScriptStyleReference[];
  updatedAt: string;
}

export interface EpisodeSnapshot {
  episode: EpisodeRecord;
  entities: EntityRecord[];
  script: ScriptRecord | null;
  assets: AssetRecord[];
  storyboards: StoryboardRecord[];
  videos: VideoCandidateRecord[];
  finalCut: FinalCutRecord | null;
}

export interface SeriesEpisodeSummaryView {
  id: string;
  code: string;
  title: string;
  synopsis: string;
  stage: EpisodeStage;
  status: StageStatus;
  progress: number;
  blockers: string[];
}

export interface SharedAssetVariantView {
  id: string;
  label: string;
  prompt: string;
  selected: boolean;
  locked: boolean;
}

export interface SharedAssetView {
  id: string;
  name: string;
  category: "characters" | "scenes" | "props";
  summary: string;
  mainVersion: string;
  locked: boolean;
  note?: string;
  owner?: string;
  episodeRefs?: string[];
  variants: SharedAssetVariantView[];
}

export interface SeriesDetailView {
  id: string;
  title: string;
  subtitle: string;
  worldview: string;
  visualGuide: string;
  directorGuide: string;
  stats: Array<{ label: string; value: string; note: string }>;
  episodes: SeriesEpisodeSummaryView[];
  sharedAssets: SharedAssetView[];
  strategy: {
    models: {
      text: string;
      image: string;
      video: string;
    };
    promptPolicies: Array<{ stage: string; policy: string }>;
    agentPolicies: Array<{ name: string; value: string }>;
  };
  orchestrator: {
    focus: string;
    completion: number;
    blocking: string;
    nextStep: string;
    recommendations: string[];
    queuePreview: Array<{ id: string; title: string; status: string }>;
  };
}

export interface EpisodeStudioView {
  seriesId: string;
  episodeId: string;
  episodeTitle: string;
  sourceText: string;
  stageProgress: Record<EpisodeStage, StageStatus>;
  planning: {
    adaptationGoal: string;
    splitParams: string;
    outline: string[];
  };
  script: {
    skeleton: string[];
    strategy: string;
    draft: Array<{
      id: string;
      heading: string;
      content: string;
    }>;
  };
  assets: {
    extracted: Array<{
      id: string;
      name: string;
      type: string;
      matchedSeriesAsset: string;
    }>;
    variants: Array<{
      assetId: string;
      variantName: string;
      status: string;
      note: string;
    }>;
  };
  storyboard: {
    frames: Array<{
      id: string;
      shot: string;
      action: string;
      dialogue: string;
      prompt: string;
      status: "draft" | "fixed" | "locked";
    }>;
  };
  video: {
    candidates: Array<{
      id: string;
      frameId: string;
      model: string;
      duration: string;
      status: "ready" | "rendering" | "failed";
      selected: boolean;
      summary: string;
    }>;
  };
  review: {
    completion: number;
    checklist: Array<{
      item: string;
      done: boolean;
      action: string;
    }>;
  };
  export: {
    options: Array<{ label: string; value: string }>;
    history: Array<{
      version: string;
      format: string;
      time: string;
      operator: string;
    }>;
  };
  orchestrator: {
    currentStage: EpisodeStage;
    completion: number;
    blockers: string[];
    nextAction: string;
    tips: string[];
  };
}

export interface ScriptStyleReference {
  id: string;
  title: string;
  summary: string;
  tone: ScriptVisualTone;
  palette: string;
  selected: boolean;
}

export interface EpisodeScriptWorkspaceView {
  seriesId: string;
  episodeId: string;
  seriesTitle: string;
  episodeCode: string;
  episodeTitle: string;
  scriptText: string;
  targetWords: number;
  chapterCursor: string;
  chapters: Array<{
    id: string;
    code: string;
    title: string;
    progress: number;
    status: ScriptChapterStatus;
  }>;
  config: {
    aspectRatio: ScriptAspectRatio;
    creationMode: ScriptCreationMode;
    visualTone: ScriptVisualTone;
  };
  styleReferences: ScriptStyleReference[];
  quickNotes: string[];
}
