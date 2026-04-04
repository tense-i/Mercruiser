export type StageId =
  | "planning"
  | "script"
  | "assets"
  | "storyboard"
  | "video"
  | "review"
  | "export";

export type StageStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "ready"
  | "done";

export type EpisodeCanvasNodeType =
  | "script"
  | "director_plan"
  | "storyboard_table"
  | "derived_assets"
  | "storyboard_panel"
  | "video_workbench";

export interface EpisodeCanvasNode {
  id: string;
  type: EpisodeCanvasNodeType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: StageStatus;
  blockers: string[];
  nextAction: string;
  updatedAt: string;
  content: {
    summary: string;
    detail: string;
  };
}

export interface EpisodeCanvasLink {
  id: string;
  from: string;
  to: string;
  label: string;
  tone: "default" | "risk";
}

export interface EpisodeCanvasDiffLine {
  field: string;
  before: string;
  after: string;
}

export interface EpisodeCanvasDiffPreview {
  id: string;
  nodeId: string;
  prompt: string;
  impact: string;
  lines: EpisodeCanvasDiffLine[];
}

export interface EpisodeCanvasSnapshot {
  id: string;
  createdAt: string;
  note: string;
}

export interface EpisodeCanvas {
  id: string;
  seriesId: string;
  episodeId: string;
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  nodes: EpisodeCanvasNode[];
  links: EpisodeCanvasLink[];
  diffTemplates: Record<string, EpisodeCanvasDiffPreview[]>;
  snapshots: EpisodeCanvasSnapshot[];
}

export interface SeriesCard {
  id: string;
  title: string;
  subtitle: string;
  genre: string;
  statusLabel: string;
  statusTone: "warning" | "good" | "active";
  progress: number;
  riskSummary: string;
  nextAction: string;
  episodesTotal: number;
  episodesDone: number;
  updatedAt: string;
}

export interface EpisodeSummary {
  id: string;
  code: string;
  title: string;
  synopsis: string;
  stage: StageId;
  status: StageStatus;
  progress: number;
  blockers: string[];
}

export interface AssetVariant {
  id: string;
  label: string;
  prompt: string;
  selected: boolean;
  locked: boolean;
}

export interface SharedAsset {
  id: string;
  name: string;
  category: "characters" | "scenes" | "props";
  summary: string;
  mainVersion: string;
  locked: boolean;
  note?: string;
  owner?: string;
  episodeRefs?: string[];
  variants: AssetVariant[];
}

export interface SeriesDetail {
  id: string;
  title: string;
  subtitle: string;
  worldview: string;
  visualGuide: string;
  directorGuide: string;
  stats: Array<{ label: string; value: string; note: string }>;
  episodes: EpisodeSummary[];
  sharedAssets: SharedAsset[];
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

export interface ScriptBlock {
  id: string;
  heading: string;
  content: string;
}

export interface StoryFrame {
  id: string;
  shot: string;
  action: string;
  dialogue: string;
  prompt: string;
  status: "draft" | "fixed" | "locked";
}

export interface VideoCandidate {
  id: string;
  frameId: string;
  model: string;
  duration: string;
  status: "ready" | "rendering" | "failed";
  selected: boolean;
  summary: string;
}

export interface EpisodeStudio {
  seriesId: string;
  episodeId: string;
  episodeTitle: string;
  sourceText: string;
  stageProgress: Record<StageId, StageStatus>;
  planning: {
    adaptationGoal: string;
    splitParams: string;
    outline: string[];
  };
  script: {
    skeleton: string[];
    strategy: string;
    draft: ScriptBlock[];
  };
  assets: {
    extracted: Array<{ id: string; name: string; type: string; matchedSeriesAsset: string }>;
    variants: Array<{ assetId: string; variantName: string; status: string; note: string }>;
  };
  storyboard: {
    frames: StoryFrame[];
  };
  video: {
    candidates: VideoCandidate[];
  };
  review: {
    completion: number;
    checklist: Array<{ item: string; done: boolean; action: string }>;
  };
  export: {
    options: Array<{ label: string; value: string }>;
    history: Array<{ version: string; format: string; time: string; operator: string }>;
  };
  orchestrator: {
    currentStage: StageId;
    completion: number;
    blockers: string[];
    nextAction: string;
    tips: string[];
  };
}

export type ScriptAspectRatio = "16:9" | "9:16" | "4:3" | "3:4";
export type ScriptCreationMode = "image_to_video" | "reference_video";
export type ScriptVisualTone = "realistic" | "anime";
export type ScriptChapterStatus = "active" | "ready" | "draft";

export interface ScriptStyleReference {
  id: string;
  title: string;
  summary: string;
  tone: ScriptVisualTone;
  palette: string;
  selected: boolean;
}

export interface EpisodeScriptWorkspace {
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

export interface QueueTask {
  id: string;
  series: string;
  episode: string;
  stage: StageId;
  action: string;
  status: "queued" | "running" | "success" | "failed";
  startedAt: string;
  duration: string;
  failureReason?: string;
  recoveryHint?: string;
}

export interface RuntimeSettingSection {
  id: string;
  title: string;
  description: string;
  entries: Array<{ key: string; value: string; note?: string }>;
}

export const stageLabels: Record<StageId, string> = {
  planning: "策划",
  script: "剧本",
  assets: "资产",
  storyboard: "分镜",
  video: "视频",
  review: "审校装配",
  export: "导出",
};

export const statusLabels: Record<StageStatus, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  blocked: "阻塞",
  ready: "待确认",
  done: "完成",
};

export const workspaceOrchestrator = {
  focus: "系列级生产编排总览",
  completion: 63,
  blocking: "Episode 04 分镜帧 02 需人工审阅",
  nextStep: "优先处理风险系列并重排队列，再启动下一批导入。",
  recommendations: ["运行就绪诊断", "锁定已选结果", "打开 Prompt 套件"],
  queuePreview: [
    { id: "Q-2101", title: "Episode 04 / Storyboard 修复", status: "running" },
    { id: "Q-2102", title: "Episode 06 / Asset 变体生成", status: "queued" },
    { id: "Q-2103", title: "Episode 02 / Video 候选重渲", status: "failed" },
  ],
};

export const seriesCards: SeriesCard[] = [
  {
    id: "glasshouse",
    title: "Glasshouse Rehearsal",
    subtitle: "都市悬疑 / 情感反转",
    genre: "Live-action Thriller",
    statusLabel: "制作中",
    statusTone: "active",
    progress: 68,
    riskSummary: "E04 分镜与视频一致性存在偏差",
    nextAction: "审阅 Frame 02 并锁定视频主版本",
    episodesTotal: 12,
    episodesDone: 7,
    updatedAt: "10 分钟前",
  },
  {
    id: "silent-orbit",
    title: "Silent Orbit Motel",
    subtitle: "复古科幻 / 漫剧",
    genre: "Comic Drama",
    statusLabel: "有风险",
    statusTone: "warning",
    progress: 44,
    riskSummary: "共享资产里 2 个角色主版本未锁定",
    nextAction: "完成角色版本锁定并回流系列资产",
    episodesTotal: 8,
    episodesDone: 3,
    updatedAt: "27 分钟前",
  },
  {
    id: "petalcode",
    title: "Petalcode District",
    subtitle: "轻科幻 / 群像",
    genre: "AI Romance",
    statusLabel: "待发版",
    statusTone: "good",
    progress: 89,
    riskSummary: "E08 仍有 1 个导出参数待确认",
    nextAction: "执行终检后导出 Season 包",
    episodesTotal: 10,
    episodesDone: 9,
    updatedAt: "1 小时前",
  },
];

const glasshouseEpisodes: EpisodeSummary[] = [
  {
    id: "e01",
    code: "Episode 01",
    title: "门铃响起",
    synopsis: "暴雨夜电话惊醒，悬念线索首次出现。",
    stage: "export",
    status: "done",
    progress: 100,
    blockers: [],
  },
  {
    id: "e02",
    code: "Episode 02",
    title: "门外的人",
    synopsis: "主角与陌生人交错，信息错位升级。",
    stage: "video",
    status: "in_progress",
    progress: 76,
    blockers: ["镜头 5 视频候选未选定"],
  },
  {
    id: "e03",
    code: "Episode 03",
    title: "缺失的相册",
    synopsis: "关键道具被发现，母女线并行推进。",
    stage: "review",
    status: "ready",
    progress: 91,
    blockers: ["导出参数尚未确认"],
  },
  {
    id: "e04",
    code: "Episode 04",
    title: "玻璃回声",
    synopsis: "对峙场景高密度推进，动作节奏要求更高。",
    stage: "storyboard",
    status: "blocked",
    progress: 58,
    blockers: ["Frame 02 构图与角色一致性冲突", "视频重渲队列拥堵"],
  },
  {
    id: "e05",
    code: "Episode 05",
    title: "备用钥匙",
    synopsis: "反派线索回收，节奏转入追逐。",
    stage: "planning",
    status: "not_started",
    progress: 10,
    blockers: ["原始文本拆分参数待确认"],
  },
];

const silentOrbitEpisodes: EpisodeSummary[] = [
  {
    id: "e01",
    code: "Episode 01",
    title: "旅店开门",
    synopsis: "角色初登场，风格设定需要统一。",
    stage: "assets",
    status: "in_progress",
    progress: 52,
    blockers: ["角色 #C03 未锁定主版本"],
  },
  {
    id: "e02",
    code: "Episode 02",
    title: "失重餐厅",
    synopsis: "空间设计复杂，资产重用率偏低。",
    stage: "script",
    status: "in_progress",
    progress: 33,
    blockers: ["改编策略尚未定稿"],
  },
];

const petalcodeEpisodes: EpisodeSummary[] = [
  {
    id: "e08",
    code: "Episode 08",
    title: "城市开花",
    synopsis: "季终前夜，群像情绪收束。",
    stage: "review",
    status: "ready",
    progress: 94,
    blockers: ["导出比特率策略待确认"],
  },
  {
    id: "e09",
    code: "Episode 09",
    title: "晨雾协议",
    synopsis: "叙事进入尾声，视觉连贯性稳定。",
    stage: "export",
    status: "done",
    progress: 100,
    blockers: [],
  },
];

export const seriesDetails: Record<string, SeriesDetail> = {
  glasshouse: {
    id: "glasshouse",
    title: "Glasshouse Rehearsal",
    subtitle: "系列总控：都市悬疑短剧生产线",
    worldview:
      "围绕一栋老宅与相互误解的亲属关系展开。每集在同一空间中推进新信息，并持续强化家庭权力结构和心理压力。",
    visualGuide:
      "冷暖对冲、柔光室内、强轮廓人物，强调夜间窗外反差与局部道具高亮。",
    directorGuide:
      "镜头语言先静后动，重要冲突前增加 1-2 帧静默停顿，避免快切损失情绪。",
    stats: [
      { label: "集数总量", value: "12", note: "当前进行到 E04" },
      { label: "共享资产", value: "37", note: "锁定主资产 29" },
      { label: "阶段阻塞", value: "2", note: "均在分镜/视频链路" },
      { label: "近 24h 成功任务", value: "49", note: "失败 6 条" },
    ],
    episodes: glasshouseEpisodes,
    sharedAssets: [
      {
        id: "char-yeqing",
        name: "叶雪清",
        category: "characters",
        summary: "女主，22 岁，外冷内紧，夜间室内戏占比高。",
        mainVersion: "v5",
        locked: true,
        note: "主角，系列主资产，建议优先复用。",
        owner: "系列共享",
        episodeRefs: ["E01", "E02", "E04"],
        variants: [
          {
            id: "char-yeqing-v4",
            label: "v4 暖色夜景",
            prompt: "cinematic portrait, warm practical light",
            selected: false,
            locked: false,
          },
          {
            id: "char-yeqing-v5",
            label: "v5 冷暖对冲主版",
            prompt: "cinematic portrait, cool room light with warm edge",
            selected: true,
            locked: true,
          },
        ],
      },
      {
        id: "scene-bedroom",
        name: "卧室-夜",
        category: "scenes",
        summary: "高频主场景，需跨集一致的床位与门口关系。",
        mainVersion: "v3",
        locked: true,
        note: "主场景，跨集镜位关系必须稳定。",
        owner: "系列共享",
        episodeRefs: ["E01", "E03", "E04"],
        variants: [
          {
            id: "scene-bedroom-v2",
            label: "v2 低照度",
            prompt: "dim bedroom, shallow depth, rain on window",
            selected: false,
            locked: false,
          },
          {
            id: "scene-bedroom-v3",
            label: "v3 标准主版",
            prompt: "dramatic bedroom, practical lamp and cool fill",
            selected: true,
            locked: true,
          },
        ],
      },
      {
        id: "prop-phone",
        name: "旧手机",
        category: "props",
        summary: "贯穿道具，镜头中必须保留裂纹与贴纸。",
        mainVersion: "v2",
        locked: false,
        note: "关键剧情道具，待锁定最终贴纸版。",
        owner: "E04 回流",
        episodeRefs: ["E02", "E04"],
        variants: [
          {
            id: "prop-phone-v1",
            label: "v1 无贴纸",
            prompt: "old smartphone, scratches, no sticker",
            selected: false,
            locked: false,
          },
          {
            id: "prop-phone-v2",
            label: "v2 带贴纸主版",
            prompt: "old smartphone with corner sticker and crack",
            selected: true,
            locked: false,
          },
        ],
      },
    ],
    strategy: {
      models: {
        text: "gpt-5.4-mini-creative",
        image: "imagen-cinematic-v2",
        video: "wan-2.6-studio",
      },
      promptPolicies: [
        {
          stage: "剧本",
          policy: "先输出剧情骨架，再输出对白版，保留冲突锚点与伏笔表。",
        },
        {
          stage: "资产",
          policy: "优先匹配系列共享资产，新增资产必须附带回流条件。",
        },
        {
          stage: "分镜",
          policy: "每帧必须明确角色、动作、机位，默认输出可执行镜头注释。",
        },
      ],
      agentPolicies: [
        { name: "阻塞升级阈值", value: "同阶段失败 >= 2 次自动升级人工审阅" },
        { name: "自动重试策略", value: "仅对可恢复错误自动重试 1 次" },
        { name: "推荐动作模式", value: "优先给出 1 条明确下一步，不给泛建议" },
      ],
    },
    orchestrator: {
      focus: "E04 分镜与视频一致性修复",
      completion: 58,
      blocking: "Frame 02 的角色朝向与上一镜头冲突",
      nextStep: "先锁定 Frame 02 的修订提示词，再重跑单帧候选。",
      recommendations: ["打开分镜修复清单", "应用推荐 Prompt", "推送单帧重渲任务"],
      queuePreview: [
        { id: "Q-2192", title: "E04 Frame02 Prompt 修复", status: "queued" },
        { id: "Q-2188", title: "E04 Frame02 单帧重渲", status: "running" },
      ],
    },
  },
  "silent-orbit": {
    id: "silent-orbit",
    title: "Silent Orbit Motel",
    subtitle: "系列总控：复古科幻漫剧工作区",
    worldview: "封闭旅店里的住客各自携带记忆残片，故事在时间回环中展开。",
    visualGuide: "复古蓝绿光、颗粒感、低饱和，强调空间层次。",
    directorGuide: "镜头以中景和静态为主，保留角色关系图的阅读停留。",
    stats: [
      { label: "集数总量", value: "8", note: "当前进行到 E02" },
      { label: "共享资产", value: "21", note: "锁定主资产 13" },
      { label: "阶段阻塞", value: "1", note: "角色主版本待确认" },
      { label: "近 24h 成功任务", value: "22", note: "失败 4 条" },
    ],
    episodes: silentOrbitEpisodes,
    sharedAssets: [],
    strategy: {
      models: {
        text: "gpt-5.2-plot",
        image: "flux-cinematic-lite",
        video: "wan-2.5",
      },
      promptPolicies: [],
      agentPolicies: [],
    },
    orchestrator: {
      focus: "角色主版本锁定",
      completion: 44,
      blocking: "C03 资产主版未锁定",
      nextStep: "先完成角色锁定，再推进分镜。",
      recommendations: ["查看角色候选", "锁定主版本"],
      queuePreview: [],
    },
  },
  petalcode: {
    id: "petalcode",
    title: "Petalcode District",
    subtitle: "系列总控：轻科幻短剧生产线",
    worldview: "AI 社区中的年轻创作者共同维护城市生态算法。",
    visualGuide: "柔和高光、自然肤色、日景为主。",
    directorGuide: "鼓励长镜头和群像互动。",
    stats: [
      { label: "集数总量", value: "10", note: "季终收尾中" },
      { label: "共享资产", value: "30", note: "锁定主资产 28" },
      { label: "阶段阻塞", value: "1", note: "导出参数" },
      { label: "近 24h 成功任务", value: "31", note: "失败 2 条" },
    ],
    episodes: petalcodeEpisodes,
    sharedAssets: [],
    strategy: {
      models: {
        text: "gpt-5.4-story",
        image: "imagen-narrative-v3",
        video: "wan-2.6-fast",
      },
      promptPolicies: [],
      agentPolicies: [],
    },
    orchestrator: {
      focus: "E08 导出确认",
      completion: 89,
      blocking: "导出码率策略未确认",
      nextStep: "审校后导出季包。",
      recommendations: ["应用推荐导出参数"],
      queuePreview: [],
    },
  },
};

export const episodeStudios: Record<string, EpisodeStudio> = {
  "glasshouse:e04": {
    seriesId: "glasshouse",
    episodeId: "e04",
    episodeTitle: "Episode 04 · 玻璃回声",
    sourceText:
      "叶雪清在卧室听到门外对话，怀疑母亲隐瞒关键事实。电话、门铃、旧相册三条线索在同一夜晚交错。",
    stageProgress: {
      planning: "done",
      script: "done",
      assets: "done",
      storyboard: "blocked",
      video: "in_progress",
      review: "not_started",
      export: "not_started",
    },
    planning: {
      adaptationGoal: "在 90 秒内完成冲突建立与第一次反转，确保下一集留钩子。",
      splitParams: "按冲突点拆 6 幕，每幕 12-18 秒。",
      outline: [
        "开场：卧室电话建立紧张语境",
        "推进：门铃与门外对话产生误解",
        "反转：母亲出现，信息被重新解释",
        "钩子：旧相册缺页被发现",
      ],
    },
    script: {
      skeleton: [
        "场 1：卧室夜，电话对话",
        "场 2：门口对峙",
        "场 3：客厅揭示",
        "场 4：相册钩子",
      ],
      strategy: "对白保持简短高压，动作描述明确到镜头级。",
      draft: [
        {
          id: "s1",
          heading: "1-1 卧室·夜",
          content:
            "叶雪清被电话惊醒，压低声音与门外来电争执。镜头先固定在床头，再轻推到脸部特写。",
        },
        {
          id: "s2",
          heading: "1-2 门口·内",
          content:
            "她抓起旧手机冲向门口。门外脚步停住，母亲的声音第一次出现，语气与来电内容矛盾。",
        },
        {
          id: "s3",
          heading: "1-3 客厅·夜",
          content:
            "两人对峙，母亲递出旧相册。叶雪清发现关键一页被撕掉。",
        },
      ],
    },
    assets: {
      extracted: [
        {
          id: "a1",
          name: "叶雪清",
          type: "角色",
          matchedSeriesAsset: "char-yeqing / v5",
        },
        {
          id: "a2",
          name: "卧室-夜",
          type: "场景",
          matchedSeriesAsset: "scene-bedroom / v3",
        },
        {
          id: "a3",
          name: "旧手机",
          type: "道具",
          matchedSeriesAsset: "prop-phone / v2",
        },
      ],
      variants: [
        {
          assetId: "a1",
          variantName: "叶雪清·高压近景 v2",
          status: "已选主版本",
          note: "与系列角色主版一致",
        },
        {
          assetId: "a2",
          variantName: "卧室门口逆光 v4",
          status: "待锁定",
          note: "建议修正门框角度",
        },
      ],
    },
    storyboard: {
      frames: [
        {
          id: "f1",
          shot: "Frame 01",
          action: "叶雪清在床上接电话，缓慢坐起。",
          dialogue: "什么人敲门？已经八点了。",
          prompt: "bedroom night, close-up, phone in hand, shallow depth",
          status: "locked",
        },
        {
          id: "f2",
          shot: "Frame 02",
          action: "她走向门口，镜头从背后跟随。",
          dialogue: "你先别挂。",
          prompt: "hallway tracking shot, same costume, phone glow on face",
          status: "draft",
        },
        {
          id: "f3",
          shot: "Frame 03",
          action: "门开半扇，母亲身影出现。",
          dialogue: "我在门外，先开门。",
          prompt: "door crack light, tense eye line",
          status: "fixed",
        },
      ],
    },
    video: {
      candidates: [
        {
          id: "v1",
          frameId: "f1",
          model: "wan-2.6",
          duration: "5s",
          status: "ready",
          selected: true,
          summary: "节奏稳定，角色情绪准确",
        },
        {
          id: "v2",
          frameId: "f2",
          model: "wan-2.6",
          duration: "5s",
          status: "rendering",
          selected: false,
          summary: "候选重渲中",
        },
        {
          id: "v3",
          frameId: "f3",
          model: "wan-2.5",
          duration: "5s",
          status: "ready",
          selected: false,
          summary: "门口光比过强，建议不用",
        },
      ],
    },
    review: {
      completion: 72,
      checklist: [
        { item: "关键分镜均已锁定", done: false, action: "前往分镜修复" },
        { item: "每帧视频已选定最终版本", done: false, action: "前往视频挑选" },
        { item: "共享资产回流标记完成", done: true, action: "查看资产记录" },
        { item: "导出参数预设完成", done: false, action: "前往导出设置" },
      ],
    },
    export: {
      options: [
        { label: "导出格式", value: "MP4 + Project Bundle" },
        { label: "分辨率", value: "1080p" },
        { label: "字幕", value: "双语烧录" },
      ],
      history: [
        {
          version: "v0.7",
          format: "Preview MP4",
          time: "2026-04-04 13:12",
          operator: "Mira",
        },
      ],
    },
    orchestrator: {
      currentStage: "storyboard",
      completion: 58,
      blockers: ["Frame 02 构图冲突", "对应视频候选未完成"],
      nextAction: "修复 Frame 02 Prompt 后执行单帧重渲。",
      tips: [
        "优先保证镜头衔接，再处理光影风格。",
        "修复完成后立即锁定，避免后续漂移。",
      ],
    },
  },
};

const defaultScriptStyleReferences: Array<Omit<ScriptStyleReference, "selected">> = [
  {
    id: "style-ancient-realism",
    title: "古风写实",
    summary: "人像质感稳定，适合高压对峙戏。",
    tone: "realistic",
    palette: "from-[#7a4d31] via-[#c18c62] to-[#f0cfa6]",
  },
  {
    id: "style-urban-realism",
    title: "都市写实",
    summary: "夜景街灯与室内实拍风格统一。",
    tone: "realistic",
    palette: "from-[#2f3b53] via-[#4f688d] to-[#8cb1d8]",
  },
  {
    id: "style-suspense-realism",
    title: "悬疑冷调",
    summary: "低饱和、高反差，突出心理压迫。",
    tone: "realistic",
    palette: "from-[#28313f] via-[#3c485b] to-[#77849c]",
  },
  {
    id: "style-romance-realism",
    title: "都市情感",
    summary: "暖色主导，适合角色关系推进。",
    tone: "realistic",
    palette: "from-[#74453f] via-[#b57567] to-[#f0b0a4]",
  },
  {
    id: "style-anime-neo",
    title: "新番动漫",
    summary: "边缘线清晰，发丝与服装层次明确。",
    tone: "anime",
    palette: "from-[#2d3173] via-[#4f59bf] to-[#8e92ff]",
  },
  {
    id: "style-anime-waterink",
    title: "水墨动漫",
    summary: "墨色层次柔和，适合古装戏。",
    tone: "anime",
    palette: "from-[#2f3240] via-[#5f6878] to-[#9aa5b8]",
  },
  {
    id: "style-anime-cyber",
    title: "赛博动漫",
    summary: "蓝紫霓虹与高光轮廓更突出。",
    tone: "anime",
    palette: "from-[#1c1f43] via-[#304d8a] to-[#4fc9ff]",
  },
  {
    id: "style-anime-inkline",
    title: "线描动漫",
    summary: "轻量上色，便于快速验证分镜。",
    tone: "anime",
    palette: "from-[#3f4459] via-[#646e8e] to-[#94a3d8]",
  },
];

const episodeScriptWorkspaces: Record<string, EpisodeScriptWorkspace> = {
  "glasshouse:e04": {
    seriesId: "glasshouse",
    episodeId: "e04",
    seriesTitle: "Glasshouse Rehearsal",
    episodeCode: "Episode 04",
    episodeTitle: "玻璃回声",
    scriptText: `我是萧乔，当今圣上的第七子。一个被幽置在东郊寒院的闲散皇子。檐角的冰棱垂了半尺，院中的炭炉却只够勉强维持一丝暖意，这是我刻意营造的“绝境”。\n\n今日不同寻常，内侍监的李公公竟亲自来了。他穿着簇新的锦袍，踏碎院中的薄雪，目光扫过我院中枯黄的梅枝，最后落在我手中的粗瓷茶碗上。“七殿下，陛下念及骨肉情分，特赐新茶一斤。”他说着，示意身后小太监递上锦盒。\n\n我指尖微颤，这茶哪里是赐给我的，分明是丞相宇文渊的试探。陛下病重，宇文渊权倾朝野，诸皇子争储愈烈，我这“闲散”的身份，反倒成了各方窥探的焦点。\n\n“有劳李公公跑一趟。”我起身接过锦盒，语气平淡无波。李公公眼底闪过一丝诧异，似是没想到我这般平静。他又寒暄两句，目光却不住打量我院中陈设，像是在寻找什么。\n\n送走李公公，我打开锦盒，茶香醇厚，确是贡品。但茶针拨开茶叶时，一枚细小的银刺藏在其中。宇文渊在试探我的警觉，也在警告我，我的一举一动，都在他的监视之下。我稳起银刺，唇角勾起一抹冷笑，这场戏，才刚刚开始。`,
    targetWords: 2000,
    chapterCursor: "e04",
    chapters: [
      { id: "e01", code: "Episode 01", title: "门铃响起", progress: 100, status: "ready" },
      { id: "e02", code: "Episode 02", title: "门外的人", progress: 76, status: "ready" },
      { id: "e03", code: "Episode 03", title: "缺失的相册", progress: 91, status: "ready" },
      { id: "e04", code: "Episode 04", title: "玻璃回声", progress: 58, status: "active" },
      { id: "e05", code: "Episode 05", title: "备用钥匙", progress: 10, status: "draft" },
    ],
    config: {
      aspectRatio: "9:16",
      creationMode: "image_to_video",
      visualTone: "realistic",
    },
    styleReferences: defaultScriptStyleReferences.map((style) => ({
      ...style,
      selected: style.id === "style-ancient-realism",
    })),
    quickNotes: [
      "当前章节重点：先稳住权谋线，再抬升母女情绪线。",
      "对白长度建议控制在 2-3 行，避免口播节奏拖慢。",
      "如需转分镜，优先锁定“门口逆光 + 手机冷光”视觉锚点。",
    ],
  },
};

const canvasNodeByStage: Record<StageId, string> = {
  planning: "node-director-plan",
  script: "node-script",
  assets: "node-derived-assets",
  storyboard: "node-storyboard-panel",
  video: "node-video-workbench",
  review: "node-storyboard-table",
  export: "node-video-workbench",
};

const episodeCanvases: Record<string, EpisodeCanvas> = {
  "glasshouse:e04": {
    id: "canvas-glasshouse-e04",
    seriesId: "glasshouse",
    episodeId: "e04",
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
    nodes: [
      {
        id: "node-script",
        type: "script",
        label: "剧本",
        x: 120,
        y: 120,
        width: 260,
        height: 170,
        status: "done",
        blockers: [],
        nextAction: "确认对白压缩版本",
        updatedAt: "14:06",
        content: {
          summary: "剧情骨架已定稿，台词完成第一轮修订。",
          detail: "围绕电话、门铃、旧相册三条线索展开，节奏控制在 90 秒。",
        },
      },
      {
        id: "node-director-plan",
        type: "director_plan",
        label: "导演计划",
        x: 420,
        y: 80,
        width: 260,
        height: 170,
        status: "done",
        blockers: [],
        nextAction: "同步分镜机位注释",
        updatedAt: "14:08",
        content: {
          summary: "静到动的镜头语言已设定。",
          detail: "冲突前增加静默帧，门口镜头优先逆光处理。",
        },
      },
      {
        id: "node-storyboard-table",
        type: "storyboard_table",
        label: "分镜表",
        x: 760,
        y: 80,
        width: 280,
        height: 170,
        status: "blocked",
        blockers: ["Frame 02 构图冲突"],
        nextAction: "修复 Frame 02 提示词并重渲",
        updatedAt: "14:21",
        content: {
          summary: "3 个关键帧，1 个待修复。",
          detail: "Frame 02 与前一镜头朝向不一致，导致衔接断裂。",
        },
      },
      {
        id: "node-derived-assets",
        type: "derived_assets",
        label: "衍生资产",
        x: 240,
        y: 360,
        width: 280,
        height: 170,
        status: "done",
        blockers: [],
        nextAction: "将门口逆光场景版本上升为系列资产",
        updatedAt: "13:58",
        content: {
          summary: "角色与场景主版本已匹配。",
          detail: "叶雪清、卧室-夜、旧手机三类资产已绑定系列主版本。",
        },
      },
      {
        id: "node-storyboard-panel",
        type: "storyboard_panel",
        label: "分镜面板",
        x: 620,
        y: 340,
        width: 300,
        height: 170,
        status: "blocked",
        blockers: ["Frame 02 画面一致性失败"],
        nextAction: "应用 Agent 修订建议并重试",
        updatedAt: "14:22",
        content: {
          summary: "分镜图已生成，局部需修复。",
          detail: "Frame 02 服装和视角与角色主资产存在偏差。",
        },
      },
      {
        id: "node-video-workbench",
        type: "video_workbench",
        label: "视频工作台",
        x: 1000,
        y: 340,
        width: 300,
        height: 170,
        status: "in_progress",
        blockers: ["关键帧最终视频未锁定"],
        nextAction: "等待 Frame 02 修复后重新挑选主结果",
        updatedAt: "14:23",
        content: {
          summary: "3 条候选，1 条主选。",
          detail: "Frame 01 已锁定，Frame 02 正在重渲，Frame 03 待决策。",
        },
      },
    ],
    links: [
      { id: "l-1", from: "node-script", to: "node-director-plan", label: "策略同步", tone: "default" },
      { id: "l-2", from: "node-director-plan", to: "node-storyboard-table", label: "机位约束", tone: "default" },
      { id: "l-3", from: "node-script", to: "node-derived-assets", label: "资产提取", tone: "default" },
      { id: "l-4", from: "node-derived-assets", to: "node-storyboard-panel", label: "参考资产", tone: "default" },
      { id: "l-5", from: "node-storyboard-table", to: "node-storyboard-panel", label: "分镜落地", tone: "risk" },
      { id: "l-6", from: "node-storyboard-panel", to: "node-video-workbench", label: "视频生成", tone: "risk" },
    ],
    diffTemplates: {
      "node-storyboard-panel": [
        {
          id: "diff-storyboard-frame02",
          nodeId: "node-storyboard-panel",
          prompt: "修复 Frame 02 角色一致性并保留门口逆光",
          impact: "会更新分镜提示词并触发单帧重渲任务。",
          lines: [
            {
              field: "Frame 02 Prompt",
              before: "hallway tracking shot, same costume, phone glow on face",
              after: "hallway tracking shot, female lead v5 outfit, back-follow camera, door-edge rim light, phone glow retained",
            },
            {
              field: "检查项",
              before: "服装一致性校验：未通过",
              after: "服装一致性校验：通过",
            },
          ],
        },
      ],
      "node-derived-assets": [
        {
          id: "diff-asset-main-version",
          nodeId: "node-derived-assets",
          prompt: "将门口逆光场景升级为系列主版本",
          impact: "会把 scene-bedroom-v4 标记为候选主版本。",
          lines: [
            {
              field: "场景主版本",
              before: "scene-bedroom / v3",
              after: "scene-bedroom / v4 (候选主版本)",
            },
            {
              field: "回流标记",
              before: "未创建",
              after: "已创建待审核回流项",
            },
          ],
        },
      ],
      "node-video-workbench": [
        {
          id: "diff-video-pick",
          nodeId: "node-video-workbench",
          prompt: "把 Frame 03 设为备选并保留 Frame 01 主结果",
          impact: "会更新视频候选优先级，不触发重渲。",
          lines: [
            {
              field: "Frame 03 状态",
              before: "待决策",
              after: "备选保留",
            },
            {
              field: "最终结果",
              before: "Frame 01 已选，Frame 02 未完成",
              after: "Frame 01 保持主选，等待 Frame 02 后再全局确认",
            },
          ],
        },
      ],
    },
    snapshots: [
      {
        id: "snap-e04-1410",
        createdAt: "14:10",
        note: "初始快照",
      },
    ],
  },
};

export const queueTasks: QueueTask[] = [
  {
    id: "Q-2192",
    series: "Glasshouse Rehearsal",
    episode: "Episode 04",
    stage: "storyboard",
    action: "Frame 02 Prompt 修复",
    status: "queued",
    startedAt: "14:22",
    duration: "-",
  },
  {
    id: "Q-2188",
    series: "Glasshouse Rehearsal",
    episode: "Episode 04",
    stage: "video",
    action: "Frame 02 单帧重渲",
    status: "running",
    startedAt: "14:19",
    duration: "03:12",
  },
  {
    id: "Q-2170",
    series: "Silent Orbit Motel",
    episode: "Episode 01",
    stage: "assets",
    action: "角色 C03 主版本锁定",
    status: "failed",
    startedAt: "13:56",
    duration: "01:47",
    failureReason: "候选图像中角色服装与系列设定冲突",
    recoveryHint: "切换到系列角色主提示词模板并重新生成 2 个候选",
  },
  {
    id: "Q-2154",
    series: "Petalcode District",
    episode: "Episode 08",
    stage: "review",
    action: "审校缺失项扫描",
    status: "success",
    startedAt: "13:22",
    duration: "00:49",
  },
];

export function getTaskById(taskId: string): QueueTask | undefined {
  return queueTasks.find((task) => task.id === taskId);
}

export const runtimeSettings: RuntimeSettingSection[] = [
  {
    id: "language",
    title: "语言与区域",
    description: "控制 Studio 显示语言、时区和日志时间格式。",
    entries: [
      { key: "界面语言", value: "中文（简体）" },
      { key: "内容默认语言", value: "中文 + 英文字幕" },
      { key: "时区", value: "Asia/Shanghai" },
    ],
  },
  {
    id: "vendors",
    title: "供应商与凭据",
    description: "管理文本、图像、视频与语音供应商的可用性。",
    entries: [
      { key: "Text Vendor", value: "OpenAI", note: "主用" },
      { key: "Image Vendor", value: "Google Imagen", note: "主用" },
      { key: "Video Vendor", value: "Wan Studio", note: "主用" },
      { key: "Fallback Vendor", value: "Luma API", note: "仅失败时启用" },
    ],
  },
  {
    id: "models",
    title: "模型配置",
    description: "定义系列默认模型与各阶段覆盖策略。",
    entries: [
      { key: "默认文本模型", value: "gpt-5.4-mini-creative" },
      { key: "默认图像模型", value: "imagen-cinematic-v2" },
      { key: "默认视频模型", value: "wan-2.6-studio" },
      { key: "分镜覆盖策略", value: "高风险场景强制高保真模型" },
    ],
  },
  {
    id: "requests",
    title: "请求与队列",
    description: "控制并发、重试、超时与任务恢复策略。",
    entries: [
      { key: "全局并发", value: "6" },
      { key: "失败重试", value: "1 次（仅可恢复错误）" },
      { key: "单任务超时", value: "180s" },
      { key: "失败任务保留", value: "7 天" },
    ],
  },
  {
    id: "prompt",
    title: "Prompt 套件",
    description: "维护跨阶段 Prompt 模板和版本。",
    entries: [
      { key: "Script Prompt Bundle", value: "v12" },
      { key: "Asset Prompt Bundle", value: "v8" },
      { key: "Storyboard Prompt Bundle", value: "v15" },
    ],
  },
  {
    id: "skill",
    title: "Skill 注册",
    description: "维护可用于 Agent 编排的技能与优先级。",
    entries: [
      { key: "enabled skills", value: "42" },
      { key: "流程关键技能", value: "script-extract, frame-fix, export-audit" },
      { key: "禁用技能", value: "legacy-chat-ops" },
    ],
  },
  {
    id: "memory",
    title: "Memory 策略",
    description: "管理项目事实、经验与决策记忆的读写规则。",
    entries: [
      { key: "事实记忆 TTL", value: "永久" },
      { key: "经验记忆 TTL", value: "90 天" },
      { key: "自动摘要周期", value: "每 12 小时" },
    ],
  },
  {
    id: "agent",
    title: "Agent 策略",
    description: "定义诊断规则、推荐动作和失败恢复策略。",
    entries: [
      { key: "推荐模式", value: "单一下一步优先" },
      { key: "阻塞识别阈值", value: "同阶段连续失败 >= 2" },
      { key: "人工审阅触发", value: "高风险资产 + 高风险分镜" },
    ],
  },
  {
    id: "files",
    title: "文件与存储",
    description: "维护素材上传、缓存策略和导出归档。",
    entries: [
      { key: "素材存储", value: "S3 / regional bucket" },
      { key: "缓存清理周期", value: "每周" },
      { key: "导出归档", value: "180 天" },
    ],
  },
  {
    id: "data",
    title: "数据维护",
    description: "执行无效数据清理、索引重建与运行体检。",
    entries: [
      { key: "孤立任务清理", value: "开启" },
      { key: "索引体检", value: "每天 03:00" },
      { key: "最近体检", value: "2026-04-04 03:00" },
    ],
  },
  {
    id: "about",
    title: "关于与更新",
    description: "查看当前版本信息、更新日志与升级策略。",
    entries: [
      { key: "Studio 版本", value: "Mercruiser Web v0.9.4-beta" },
      { key: "最近更新", value: "2026-04-04：新增批量导入集数与任务详情页" },
      { key: "更新渠道", value: "stable + weekly preview" },
    ],
  },
];

export const importPreviewEpisodes = [
  {
    id: "p1",
    title: "Episode 01 · 风暴电话",
    summary: "开场冲突建立，角色关系引入。",
  },
  {
    id: "p2",
    title: "Episode 02 · 门外来客",
    summary: "误解升级，悬念抬升。",
  },
  {
    id: "p3",
    title: "Episode 03 · 断页相册",
    summary: "关键道具揭示，进入第一轮反转。",
  },
];

export function getSeriesById(seriesId: string): SeriesDetail | undefined {
  return seriesDetails[seriesId];
}

export function getEpisodeSummaryById(seriesId: string, episodeId: string): EpisodeSummary | undefined {
  return seriesDetails[seriesId]?.episodes.find((episode) => episode.id === episodeId);
}

export function getSeriesIdByTitle(seriesTitle: string): string | undefined {
  const series = Object.values(seriesDetails).find((item) => item.title === seriesTitle);
  return series?.id;
}

export function getEpisodeIdByLabel(episodeLabel: string): string | undefined {
  const match = episodeLabel.match(/(\d+)/);
  if (!match) {
    return undefined;
  }
  return `e${match[1].padStart(2, "0")}`;
}

export function getCanvasNodeIdByStage(stage: StageId): string {
  return canvasNodeByStage[stage];
}

export function getEpisodeCanvas(
  seriesId: string,
  episodeId: string,
): EpisodeCanvas | undefined {
  const key = `${seriesId}:${episodeId}`;
  const existing = episodeCanvases[key];
  if (existing) {
    return existing;
  }

  const episode = getEpisodeStudio(seriesId, episodeId);
  if (!episode) {
    return undefined;
  }

  return {
    id: `canvas-${seriesId}-${episodeId}`,
    seriesId,
    episodeId,
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
    nodes: [
      {
        id: "node-script",
        type: "script",
        label: "剧本",
        x: 120,
        y: 120,
        width: 260,
        height: 170,
        status: episode.stageProgress.script,
        blockers: [],
        nextAction: "复核剧情骨架并确认对白版本。",
        updatedAt: "刚刚",
        content: {
          summary: `剧本骨架 ${episode.script.skeleton.length} 条，草稿段落 ${episode.script.draft.length} 段。`,
          detail: episode.script.strategy,
        },
      },
      {
        id: "node-director-plan",
        type: "director_plan",
        label: "导演计划",
        x: 420,
        y: 80,
        width: 260,
        height: 170,
        status: episode.stageProgress.planning,
        blockers: [],
        nextAction: "确认镜头节奏和冲突钩子。",
        updatedAt: "刚刚",
        content: {
          summary: "改编目标与导演计划已同步。",
          detail: episode.planning.adaptationGoal,
        },
      },
      {
        id: "node-storyboard-table",
        type: "storyboard_table",
        label: "分镜表",
        x: 760,
        y: 80,
        width: 280,
        height: 170,
        status: episode.stageProgress.storyboard,
        blockers: episode.orchestrator.blockers,
        nextAction: "按优先级修复阻塞分镜。",
        updatedAt: "刚刚",
        content: {
          summary: `当前分镜帧 ${episode.storyboard.frames.length} 条。`,
          detail: episode.storyboard.frames.map((item) => item.shot).join(" / "),
        },
      },
      {
        id: "node-derived-assets",
        type: "derived_assets",
        label: "衍生资产",
        x: 240,
        y: 360,
        width: 280,
        height: 170,
        status: episode.stageProgress.assets,
        blockers: [],
        nextAction: "确认可回流系列资产。",
        updatedAt: "刚刚",
        content: {
          summary: `本集资产 ${episode.assets.extracted.length} 条，候选变体 ${episode.assets.variants.length} 条。`,
          detail: "优先复用系列主版本，减少重复生成。",
        },
      },
      {
        id: "node-storyboard-panel",
        type: "storyboard_panel",
        label: "分镜面板",
        x: 620,
        y: 340,
        width: 300,
        height: 170,
        status: episode.stageProgress.storyboard,
        blockers: episode.orchestrator.blockers,
        nextAction: episode.orchestrator.nextAction,
        updatedAt: "刚刚",
        content: {
          summary: "分镜图像与提示词可在此局部修复。",
          detail: "建议优先处理阻塞帧，再推进视频阶段。",
        },
      },
      {
        id: "node-video-workbench",
        type: "video_workbench",
        label: "视频工作台",
        x: 1000,
        y: 340,
        width: 300,
        height: 170,
        status: episode.stageProgress.video,
        blockers: [],
        nextAction: "挑选最终视频并锁定主结果。",
        updatedAt: "刚刚",
        content: {
          summary: `视频候选 ${episode.video.candidates.length} 条。`,
          detail: "确保每个关键分镜都绑定最终视频结果。",
        },
      },
    ],
    links: [
      { id: "l-1", from: "node-script", to: "node-director-plan", label: "策略同步", tone: "default" },
      { id: "l-2", from: "node-director-plan", to: "node-storyboard-table", label: "机位约束", tone: "default" },
      { id: "l-3", from: "node-script", to: "node-derived-assets", label: "资产提取", tone: "default" },
      { id: "l-4", from: "node-derived-assets", to: "node-storyboard-panel", label: "参考资产", tone: "default" },
      { id: "l-5", from: "node-storyboard-table", to: "node-storyboard-panel", label: "分镜落地", tone: "risk" },
      { id: "l-6", from: "node-storyboard-panel", to: "node-video-workbench", label: "视频生成", tone: "risk" },
    ],
    diffTemplates: {},
    snapshots: [
      {
        id: `snap-${seriesId}-${episodeId}-initial`,
        createdAt: "刚刚",
        note: "自动生成初始画布",
      },
    ],
  };
}

export function getEpisodeCanvasDiffPreview(
  seriesId: string,
  episodeId: string,
  nodeId: string,
  prompt: string,
): EpisodeCanvasDiffPreview | undefined {
  const canvas = getEpisodeCanvas(seriesId, episodeId);
  if (!canvas) {
    return undefined;
  }

  const template = canvas.diffTemplates[nodeId]?.[0];
  if (!template) {
    return undefined;
  }

  return {
    ...template,
    id: `${template.id}-${Date.now()}`,
    prompt,
  };
}

export function getEpisodeScriptWorkspace(
  seriesId: string,
  episodeId: string,
): EpisodeScriptWorkspace | undefined {
  const key = `${seriesId}:${episodeId}`;
  const existing = episodeScriptWorkspaces[key];
  if (existing) {
    return existing;
  }

  const series = getSeriesById(seriesId);
  const summary = getEpisodeSummaryById(seriesId, episodeId);
  const episode = getEpisodeStudio(seriesId, episodeId);
  if (!series || !summary || !episode) {
    return undefined;
  }

  const scriptText = episode.script.draft
    .map((block) => `${block.heading}\n${block.content}`)
    .join("\n\n");
  const plainLength = scriptText.replace(/\s+/g, "").length;
  const visualTone: ScriptVisualTone = series.id === "silent-orbit" ? "anime" : "realistic";
  const selectedStyle =
    defaultScriptStyleReferences.find((style) => style.tone === visualTone) ?? defaultScriptStyleReferences[0];

  return {
    seriesId,
    episodeId,
    seriesTitle: series.title,
    episodeCode: summary.code,
    episodeTitle: summary.title,
    scriptText,
    targetWords: Math.max(1200, Math.round((plainLength || 760) * 1.6)),
    chapterCursor: episodeId,
    chapters: series.episodes.map((item) => ({
      id: item.id,
      code: item.code,
      title: item.title,
      progress: item.progress,
      status: item.id === episodeId ? "active" : item.progress >= 70 ? "ready" : "draft",
    })),
    config: {
      aspectRatio: "9:16",
      creationMode: "image_to_video",
      visualTone,
    },
    styleReferences: defaultScriptStyleReferences.map((style) => ({
      ...style,
      selected: style.id === selectedStyle.id,
    })),
    quickNotes: [
      `当前阻塞：${episode.orchestrator.blockers.join("；")}`,
      `下一步动作：${episode.orchestrator.nextAction}`,
      "建议先在剧本页完成对白与场景锚点，再进入分镜批处理。",
    ],
  };
}

export function getEpisodeStudio(
  seriesId: string,
  episodeId: string,
): EpisodeStudio | undefined {
  const key = `${seriesId}:${episodeId}`;
  const existing = episodeStudios[key];
  if (existing) {
    return existing;
  }

  const series = getSeriesById(seriesId);
  const summary = series?.episodes.find((episode) => episode.id === episodeId);
  if (!series || !summary) {
    return undefined;
  }

  const stageFlow: StageId[] = ["planning", "script", "assets", "storyboard", "video", "review", "export"];
  const stageProgress: Record<StageId, StageStatus> = {
    planning: "not_started",
    script: "not_started",
    assets: "not_started",
    storyboard: "not_started",
    video: "not_started",
    review: "not_started",
    export: "not_started",
  };
  const currentIndex = stageFlow.indexOf(summary.stage);
  stageFlow.forEach((stage, index) => {
    if (index < currentIndex) {
      stageProgress[stage] = "done";
      return;
    }
    if (index === currentIndex) {
      stageProgress[stage] = summary.status;
    }
  });

  return {
    seriesId,
    episodeId,
    episodeTitle: `${summary.code} · ${summary.title}`,
    sourceText: `${summary.synopsis}（自动生成的默认执行页数据）`,
    stageProgress,
    planning: {
      adaptationGoal: "围绕本集核心冲突构建 60-90 秒叙事节奏。",
      splitParams: "按冲突节点拆分，保持每段 10-18 秒。",
      outline: [
        "开场建立冲突",
        "推进角色关系",
        "反转信息揭示",
        "结尾留下一集钩子",
      ],
    },
    script: {
      skeleton: [
        "场 1：冲突引入",
        "场 2：关系推进",
        "场 3：信息反转",
      ],
      strategy: "对白短句化，动作描述明确到镜头级。",
      draft: [
        {
          id: "draft-1",
          heading: "1-1 自动生成草稿",
          content: "该集尚未有完整执行数据，当前内容为默认模板，可在画布和执行页继续完善。",
        },
      ],
    },
    assets: {
      extracted: [],
      variants: [],
    },
    storyboard: {
      frames: [
        {
          id: "frame-1",
          shot: "Frame 01",
          action: "默认分镜占位：待补充动作。",
          dialogue: "默认对白占位。",
          prompt: "default cinematic storyboard placeholder",
          status: "draft",
        },
      ],
    },
    video: {
      candidates: [],
    },
    review: {
      completion: Math.max(10, summary.progress),
      checklist: [
        { item: "剧本草稿已准备", done: stageProgress.script === "done", action: "进入剧本阶段完善" },
        { item: "分镜可执行", done: stageProgress.storyboard === "done", action: "进入分镜阶段完善" },
      ],
    },
    export: {
      options: [
        { label: "导出格式", value: "MP4 + Project Bundle" },
        { label: "分辨率", value: "1080p" },
      ],
      history: [],
    },
    orchestrator: {
      currentStage: summary.stage,
      completion: Math.max(12, summary.progress),
      blockers: summary.blockers.length > 0 ? summary.blockers : ["默认执行数据待完善"],
      nextAction: summary.blockers.length > 0 ? summary.blockers[0] : "先完善剧本与分镜基础数据。",
      tips: [
        "先补齐本集关键资产，再推进分镜与视频。",
        "每次修改后保留一个可回退快照。",
      ],
    },
  };
}
