/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Film, 
  Settings, 
  CheckCircle2, 
  Plus, 
  ChevronRight, 
  Search, 
  MoreVertical,
  Play,
  Image as ImageIcon,
  Type,
  Layers,
  Video,
  ArrowLeft,
  Sparkles,
  Clock,
  AlertCircle,
  User,
  Box,
  Map,
  Download,
  Share2,
  History,
  Camera,
  Lock,
  Unlock,
  Wand2,
  Scissors,
  Volume2,
  Mic,
  ListTree,
  MonitorPlay,
  Zap,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { 
  Series, 
  Episode, 
  ViewMode, 
  ProductionTab, 
  SeriesStatus,
  EpisodeStatus,
  Asset,
  Chapter,
  Shot
} from './types';

// Mock Data
const MOCK_SERIES: Series[] = [
  {
    id: 's1',
    name: 'Cyberpunk Chronicles',
    description: 'A neon-drenched odyssey through a dystopian future where humanity and machine blur.',
    status: 'producing',
    coverUrl: 'https://picsum.photos/seed/cyber/800/450',
    episodeCount: 12,
    progress: 45,
    createdAt: '2024-03-20'
  },
  {
    id: 's2',
    name: 'The Last Alchemist',
    description: 'Fantasy epic about the last surviving master of ancient transmutation.',
    status: 'partial_done',
    coverUrl: 'https://picsum.photos/seed/alchemy/800/450',
    episodeCount: 24,
    progress: 82,
    createdAt: '2024-02-15'
  },
  {
    id: 's3',
    name: 'Stellar Drift',
    description: 'Hard sci-fi exploration of a generation ship lost in the void.',
    status: 'initialized',
    coverUrl: 'https://picsum.photos/seed/space/800/450',
    episodeCount: 8,
    progress: 5,
    createdAt: '2024-04-01'
  }
];

const MOCK_EPISODES: Episode[] = [
  { id: 'e1', seriesId: 's1', index: 1, title: 'The Awakening', status: 'done', progress: 100 },
  { id: 'e2', seriesId: 's1', index: 2, title: 'Neon Shadows', status: 'in_progress', progress: 65 },
  { id: 'e3', seriesId: 's1', index: 3, title: 'Data Breach', status: 'not_started', progress: 0 },
];

const MOCK_ASSETS: Asset[] = [
  { 
    id: 'a1', name: 'Kaelen (Protagonist)', type: 'character', description: 'Cyber-enhanced rogue with a glowing eye.', isShared: true, imageUrl: 'https://picsum.photos/seed/char1/200/200', isFaceLocked: true, states: [{id: 's1', name: 'Default'}, {id: 's2', name: 'Battle Damaged'}],
    versions: [
      { id: 'v1', imageUrl: 'https://picsum.photos/seed/char1/200/200', isSelected: true },
      { id: 'v2', imageUrl: 'https://picsum.photos/seed/char1_v2/200/200', isSelected: false }
    ]
  },
  { id: 'a2', name: 'Night Market', type: 'scene', description: 'Crowded, rainy market with holographic stalls.', isShared: true, imageUrl: 'https://picsum.photos/seed/scene1/200/200' },
  { id: 'a3', name: 'Neural Link', type: 'prop', description: 'Sleek silver headset with pulsing blue lights.', isShared: false, imageUrl: 'https://picsum.photos/seed/prop1/200/200' },
];

const MOCK_CHAPTERS: Chapter[] = [
  { id: 'c1', episodeId: 'e2', index: 1, title: 'The Meeting', content: 'Kaelen meets the informant in the back alley of the Night Market. Rain pours down, reflecting neon lights on the wet pavement.' },
  { id: 'c2', episodeId: 'e2', index: 2, title: 'The Chase', content: 'Security drones spot them. A high-speed chase through the narrow corridors of the lower city begins.' },
];

const MOCK_SHOTS: Shot[] = [
  { 
    id: 'sh1', chapterId: 'c1', index: 1, description: 'Wide shot of the alleyway.', prompt: 'Wide shot, cyberpunk alleyway, neon lights reflecting on wet pavement, cinematic lighting, 8k resolution', scene: 'Night Market Alley', composition: 'Wide', lighting: 'Neon/Moody', cameraMotion: 'Pan Right', duration: 'Auto (3.5s)', status: 'rendered', imageUrl: 'https://picsum.photos/seed/shot1/400/225',
    takes: [
      { id: 't1', imageUrl: 'https://picsum.photos/seed/shot1/400/225', isSelected: true },
      { id: 't2', imageUrl: 'https://picsum.photos/seed/shot1_alt/400/225', isSelected: false }
    ]
  },
  { 
    id: 'sh2', chapterId: 'c1', index: 2, description: 'Close up on Kaelen\'s face.', prompt: 'Close up portrait of Kaelen, cyber-enhanced rogue, glowing eye, rain falling, high contrast, dramatic shadows', scene: 'Night Market Alley', composition: 'Close-up', lighting: 'High Contrast', cameraMotion: 'Slow Zoom In', duration: 'Auto (2.1s)', status: 'ready', imageUrl: 'https://picsum.photos/seed/shot2/400/225',
    continuityIssues: [{ description: 'Lighting direction mismatch with Shot 1. Light source appears to be from the right instead of left.', severity: 'warning' }],
    takes: [
      { id: 't1', imageUrl: 'https://picsum.photos/seed/shot2/400/225', isSelected: true },
      { id: 't2', imageUrl: 'https://picsum.photos/seed/shot2_alt1/400/225', isSelected: false },
      { id: 't3', imageUrl: 'https://picsum.photos/seed/shot2_alt2/400/225', isSelected: false }
    ],
    videoTakes: [
      { id: 'vt1', videoUrl: 'https://picsum.photos/seed/shot2_vid1/400/225', isSelected: true },
      { id: 'vt2', videoUrl: 'https://picsum.photos/seed/shot2_vid2/400/225', isSelected: false }
    ]
  },
];

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [productionTab, setProductionTab] = useState<ProductionTab>('overview');
  const [storyboardMediaType, setStoryboardMediaType] = useState<'image' | 'video'>('image');

  // Navigation Handlers
  const handleSeriesClick = (series: Series) => {
    setSelectedSeries(series);
    setViewMode('series_detail');
  };

  const handleEpisodeClick = (episode: Episode) => {
    setSelectedEpisode(episode);
    setViewMode('episode_production');
    setProductionTab('overview');
  };

  const goBack = () => {
    if (viewMode === 'episode_production') {
      setViewMode('series_detail');
      setSelectedEpisode(null);
    } else if (viewMode === 'series_detail') {
      setViewMode('dashboard');
      setSelectedSeries(null);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 flex flex-col glass-panel z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-xl tracking-tight">Mercruiser</h1>
        </div>

        <nav className="flex-1 px-3 space-y-1 mt-4">
          <SidebarItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={viewMode === 'dashboard'} 
            onClick={() => { setViewMode('dashboard'); setSelectedSeries(null); setSelectedEpisode(null); }}
          />
          <SidebarItem 
            icon={<Film size={20} />} 
            label="Series" 
            active={viewMode === 'series_detail'} 
            onClick={() => selectedSeries && setViewMode('series_detail')}
            disabled={!selectedSeries}
          />
          <SidebarItem 
            icon={<History size={20} />} 
            label="Tasks" 
            active={viewMode === 'tasks'} 
            onClick={() => setViewMode('tasks')}
          />
          <div className="pt-4 pb-2 px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Resources
          </div>
          <SidebarItem icon={<User size={20} />} label="Characters" onClick={() => {}} />
          <SidebarItem icon={<Map size={20} />} label="Environments" onClick={() => {}} />
          <SidebarItem icon={<Box size={20} />} label="Assets" onClick={() => {}} />
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <SidebarItem 
            icon={<Settings size={20} />} 
            label="Settings" 
            active={viewMode === 'settings'} 
            onClick={() => setViewMode('settings')}
          />
          <div className="mt-4 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-zinc-400">Agent Online</span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Ready to assist with script breakdown and asset generation.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 glass-panel z-10">
          <div className="flex items-center gap-4">
            {viewMode !== 'dashboard' && (
              <button 
                onClick={goBack}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-100"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-500">
                  {viewMode === 'dashboard' ? 'Studio' : selectedSeries?.name}
                </span>
                {selectedEpisode && (
                  <>
                    <ChevronRight size={14} className="text-zinc-600" />
                    <span className="text-sm font-medium text-zinc-100">EP {selectedEpisode.index}: {selectedEpisode.title}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input 
                type="text" 
                placeholder="Search projects..." 
                className="bg-zinc-900 border border-zinc-800 rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-500 transition-colors w-64"
              />
            </div>
            <button className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors">
              <Download size={20} />
            </button>
            <button className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors">
              <Share2 size={20} />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">
              TW
            </div>
          </div>
        </header>

        {/* Content View */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            {viewMode === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-7xl mx-auto"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight mb-1">Welcome back, Producer</h2>
                    <p className="text-zinc-500">Manage your series and continue your production journey.</p>
                  </div>
                  <button className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-brand-600/20 transition-all hover:scale-105 active:scale-95">
                    <Plus size={20} />
                    New Series
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {MOCK_SERIES.map(series => (
                    <SeriesCard 
                      key={series.id} 
                      series={series} 
                      onClick={() => handleSeriesClick(series)} 
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {viewMode === 'series_detail' && selectedSeries && (
              <motion.div 
                key="series_detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-7xl mx-auto"
              >
                <div className="flex flex-col lg:flex-row gap-8">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <StatusBadge status={selectedSeries.status} />
                          <span className="text-xs text-zinc-500 font-mono">ID: {selectedSeries.id}</span>
                        </div>
                        <h2 className="text-4xl font-bold tracking-tight mb-3">{selectedSeries.name}</h2>
                        <p className="text-zinc-400 max-w-2xl leading-relaxed">{selectedSeries.description}</p>
                      </div>
                      <button className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                        <MoreVertical size={24} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                      <StatBox label="Total Episodes" value={selectedSeries.episodeCount.toString()} icon={<Film size={16} />} />
                      <StatBox label="Overall Progress" value={`${selectedSeries.progress}%`} icon={<CheckCircle2 size={16} />} />
                      <StatBox label="Created At" value={selectedSeries.createdAt} icon={<Clock size={16} />} />
                    </div>

                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold">Episodes</h3>
                        <button className="text-brand-400 hover:text-brand-300 text-sm font-medium flex items-center gap-1">
                          <Plus size={16} /> Add Episode
                        </button>
                      </div>
                      <div className="space-y-3">
                        {MOCK_EPISODES.map(ep => (
                          <EpisodeRow 
                            key={ep.id} 
                            episode={ep} 
                            onClick={() => handleEpisodeClick(ep)} 
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="w-full lg:w-80 space-y-6">
                    <div className="glass-panel rounded-2xl p-6">
                      <h3 className="font-bold mb-4 flex items-center gap-2">
                        <Box size={18} className="text-brand-400" />
                        Shared Assets
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {MOCK_ASSETS.filter(a => a.isShared).map(asset => (
                          <div key={asset.id} className="group relative aspect-square rounded-xl overflow-hidden border border-zinc-800">
                            <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                              <span className="text-[10px] font-bold truncate">{asset.name}</span>
                            </div>
                          </div>
                        ))}
                        <button className="aspect-square rounded-xl border border-dashed border-zinc-700 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-all">
                          <Plus size={20} />
                          <span className="text-[10px] font-medium">New Asset</span>
                        </button>
                      </div>
                    </div>

                    <div className="glass-panel rounded-2xl p-6">
                      <h3 className="font-bold mb-4 flex items-center gap-2">
                        <Sparkles size={18} className="text-brand-400" />
                        Agent Strategy
                      </h3>
                      <div className="space-y-3">
                        <StrategyItem label="Visual Style" value="Cyberpunk Noir" />
                        <StrategyItem label="Pacing" value="Fast-paced Action" />
                        <StrategyItem label="Model" value="Gemini 3.1 Pro" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {viewMode === 'episode_production' && selectedEpisode && (
              <motion.div 
                key="episode_production"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="h-full flex flex-col"
              >
                {/* Production Workflow Tabs */}
                <div className="flex items-center gap-1 mb-8 bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800 w-fit">
                  <WorkflowTab 
                    id="overview" 
                    label="Overview" 
                    icon={<LayoutDashboard size={18} />} 
                    active={productionTab === 'overview'} 
                    onClick={() => setProductionTab('overview')} 
                  />
                  <WorkflowTab 
                    id="script" 
                    label="Script" 
                    icon={<Type size={18} />} 
                    active={productionTab === 'script'} 
                    onClick={() => setProductionTab('script')} 
                  />
                  <WorkflowTab 
                    id="assets" 
                    label="Assets" 
                    icon={<Box size={18} />} 
                    active={productionTab === 'assets'} 
                    onClick={() => setProductionTab('assets')} 
                  />
                  <WorkflowTab 
                    id="shot_list" 
                    label="Shot List" 
                    icon={<ListTree size={18} />} 
                    active={productionTab === 'shot_list'} 
                    onClick={() => setProductionTab('shot_list')} 
                  />
                  <WorkflowTab 
                    id="storyboard" 
                    label="Storyboard" 
                    icon={<MonitorPlay size={18} />} 
                    active={productionTab === 'storyboard'} 
                    onClick={() => setProductionTab('storyboard')} 
                  />
                  <WorkflowTab 
                    id="final" 
                    label="Final Video" 
                    icon={<Video size={18} />} 
                    active={productionTab === 'final'} 
                    onClick={() => setProductionTab('final')} 
                  />
                </div>

                <div className="flex-1 min-h-0">
                  {productionTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-2 space-y-8">
                        <div className="glass-panel rounded-3xl p-8">
                          <h3 className="text-2xl font-bold mb-6">Production Status</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                            <ProductionStep label="Script" status="completed" progress={100} />
                            <ProductionStep label="Assets" status="in_progress" progress={75} />
                            <ProductionStep label="Storyboard" status="ready" progress={0} />
                            <ProductionStep label="Rendering" status="idle" progress={0} />
                          </div>
                        </div>

                        <div className="glass-panel rounded-3xl p-8">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold">Recent Activity</h3>
                            <button className="text-sm text-zinc-500 hover:text-zinc-300">View All</button>
                          </div>
                          <div className="space-y-4">
                            <ActivityItem 
                              icon={<Sparkles className="text-brand-400" size={16} />} 
                              title="Agent generated 12 new shots" 
                              time="2 hours ago" 
                            />
                            <ActivityItem 
                              icon={<CheckCircle2 className="text-green-400" size={16} />} 
                              title="Character 'Kaelen' asset locked" 
                              time="5 hours ago" 
                            />
                            <ActivityItem 
                              icon={<AlertCircle className="text-amber-400" size={16} />} 
                              title="Rendering failed for Shot #4" 
                              time="Yesterday" 
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="bg-brand-600/10 border border-brand-500/20 rounded-3xl p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                              <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h4 className="font-bold text-brand-400">Agent Copilot</h4>
                              <p className="text-[10px] text-brand-300/60 uppercase tracking-widest font-bold">Next Recommended Action</p>
                            </div>
                          </div>
                          <p className="text-sm text-zinc-300 mb-6 leading-relaxed">
                            "The script for EP 2 is complete. I recommend extracting character expressions for Kaelen to ensure consistency in the upcoming storyboard phase."
                          </p>
                          <button className="w-full bg-brand-500 hover:bg-brand-400 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2">
                            Execute Extraction
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {productionTab === 'script' && (
                    <div className="flex gap-6 h-full">
                      <div className="w-64 flex flex-col gap-3">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-2">Chapters</h4>
                        {MOCK_CHAPTERS.map(ch => (
                          <button key={ch.id} className="flex flex-col items-start p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-brand-500/50 transition-all text-left">
                            <span className="text-[10px] font-bold text-zinc-500 mb-1">CHAPTER {ch.index}</span>
                            <span className="font-bold text-sm">{ch.title}</span>
                          </button>
                        ))}
                        <button className="flex items-center justify-center gap-2 p-4 rounded-2xl border border-dashed border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all">
                          <Plus size={18} />
                          <span className="text-sm font-medium">Add Chapter</span>
                        </button>
                      </div>
                      <div className="flex-1 glass-panel rounded-3xl p-8 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-2xl font-bold">Chapter 1: The Meeting</h3>
                          <div className="flex items-center gap-2">
                            <button className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition-colors">Save Draft</button>
                          </div>
                        </div>
                        <textarea 
                          className="flex-1 bg-transparent border-none focus:ring-0 text-lg leading-relaxed text-zinc-300 resize-none custom-scrollbar"
                          placeholder="Start writing your script here..."
                          defaultValue={MOCK_CHAPTERS[0].content}
                        />
                        <div className="mt-6 pt-6 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                          <div className="flex gap-4">
                            <span>Words: 124</span>
                            <span>Est. Duration: 45s</span>
                          </div>
                          <span>Last edited 5 mins ago</span>
                        </div>
                      </div>
                      
                      {/* Global Settings Sidebar */}
                      <div className="w-80 glass-panel rounded-3xl p-6 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                        <div className="flex flex-col gap-2">
                          <button className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold transition-colors shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2">
                            <Wand2 size={16} />
                            Extract Assets & Shots
                          </button>
                          <button className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-brand-400 text-sm font-bold transition-colors flex items-center justify-center gap-2 border border-brand-500/30">
                            <Mic size={16} />
                            Generate Global Audio
                          </button>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold mb-3">Video Ratio</h4>
                          <div className="grid grid-cols-4 gap-2">
                            {['16:9', '9:16', '4:3', '3:4'].map((ratio, i) => (
                              <button key={ratio} className={cn(
                                "py-2 rounded-lg border text-xs font-bold transition-all flex flex-col items-center gap-1",
                                i === 1 ? "bg-brand-500/10 border-brand-500 text-brand-400" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600"
                              )}>
                                <div className={cn("border-2 rounded-sm", i === 1 ? "border-brand-400" : "border-zinc-500")} 
                                     style={{ width: ratio === '16:9' ? 24 : ratio === '9:16' ? 14 : 20, height: ratio === '16:9' ? 14 : ratio === '9:16' ? 24 : 15 }} />
                                {ratio}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-bold mb-3 flex items-center gap-1">Creation Mode <AlertCircle size={12} className="text-zinc-500"/></h4>
                          <div className="flex gap-2">
                            <button className="flex-1 py-2 rounded-lg border border-brand-500 bg-brand-500/10 text-brand-400 text-xs font-bold">Text to Video</button>
                            <button className="flex-1 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 text-xs font-bold">Ref to Video</button>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold">Style Reference</h4>
                            <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg">
                              <button className="px-3 py-1 rounded-md bg-zinc-800 text-xs font-bold text-white">Realistic</button>
                              <button className="px-3 py-1 rounded-md text-xs font-bold text-zinc-500">Anime</button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { name: 'Cyber Noir', img: 'https://picsum.photos/seed/cyber/150/200', active: true },
                              { name: 'Fantasy', img: 'https://picsum.photos/seed/fantasy/150/200' },
                              { name: 'Cinematic', img: 'https://picsum.photos/seed/cine/150/200' },
                              { name: 'Studio', img: 'https://picsum.photos/seed/studio/150/200' },
                            ].map(style => (
                              <div key={style.name} className={cn(
                                "relative aspect-[3/4] rounded-xl overflow-hidden border-2 cursor-pointer group",
                                style.active ? "border-brand-500" : "border-transparent hover:border-zinc-700"
                              )}>
                                <img src={style.img} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-2">
                                  <span className="text-[10px] font-bold text-white">{style.name}</span>
                                </div>
                                {style.active && (
                                  <div className="absolute top-2 right-2 w-4 h-4 bg-brand-500 rounded-full flex items-center justify-center">
                                    <CheckCircle2 size={10} className="text-white" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {productionTab === 'assets' && (
                    <div className="flex gap-6 h-full">
                      <div className="flex-1 flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <AssetFilter label="Characters (7)" active />
                            <AssetFilter label="Scenes (5)" />
                            <AssetFilter label="Props (6)" />
                          </div>
                          <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all">
                            <Layers size={16} />
                            Batch Generate
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pb-4">
                          {MOCK_ASSETS.map(asset => (
                            <div key={asset.id} className="group glass-panel rounded-2xl overflow-hidden border border-zinc-800 hover:border-brand-500/50 transition-all flex flex-col">
                              <div className="p-3 flex items-center justify-between border-b border-zinc-800/50">
                                <h4 className="font-bold text-sm">{asset.name}</h4>
                                {asset.isFaceLocked && <Lock size={14} className="text-brand-400" />}
                              </div>
                              <div className="aspect-video relative bg-zinc-900 flex items-center justify-center overflow-hidden">
                                {asset.imageUrl ? (
                                  <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                ) : (
                                  <button className="flex flex-col items-center gap-2 text-zinc-500 hover:text-brand-400 transition-colors">
                                    <Upload size={24} />
                                    <span className="text-xs font-bold">Upload Image</span>
                                  </button>
                                )}
                              </div>
                              <div className="p-3 bg-zinc-900/50 flex items-center justify-between">
                                <span className="text-[10px] text-zinc-500">Voice:</span>
                                <button className="text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1">
                                  {asset.id === 'a1' ? 'Deep Male 1' : 'Select Voice'} <ChevronRight size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Asset Generation Sidebar */}
                      <div className="w-80 glass-panel rounded-3xl p-6 flex flex-col h-full overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="font-bold">Generate Asset</h3>
                          <button className="text-brand-400 hover:text-brand-300 text-sm font-bold flex items-center gap-1">
                            <ArrowLeft size={14} /> Smart Breakdown
                          </button>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <h4 className="text-xs font-bold text-zinc-500 mb-2">Asset Prompt</h4>
                            <textarea 
                              className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-none custom-scrollbar"
                              defaultValue="8K resolution, photorealistic, cinematic lighting. 24 years old male, 1.82m tall, cyber-enhanced rogue. Black hair, glowing blue left eye, wearing dark tactical gear with neon accents. Character sheet showing front, side, and back views."
                            />
                            <div className="text-right mt-1 text-[10px] text-zinc-500">234 / 5000</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 flex items-center justify-between">
                              <span className="text-xs font-bold text-zinc-300">Model</span>
                              <span className="text-xs text-brand-400 font-mono">Jimeng 4.0 | 4k</span>
                            </div>
                            <button className="flex-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg py-2 text-sm font-bold flex items-center justify-center gap-1 shadow-lg shadow-brand-600/20">
                              Generate <Zap size={14} /> 2
                            </button>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-zinc-500 mb-2">Reference Images</h4>
                            <button className="w-full py-4 border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors">
                              <Plus size={20} />
                              <span className="text-xs font-bold">Add Image</span>
                            </button>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-bold text-zinc-500">Generated Materials</h4>
                              <button className="text-[10px] text-brand-400 font-bold">Select All</button>
                            </div>
                            <div className="aspect-square rounded-xl border border-zinc-800 overflow-hidden relative group">
                              <img src={MOCK_ASSETS[0].imageUrl} className="w-full h-full object-cover" />
                              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[8px] font-mono text-white">Jimeng 4.0</div>
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center"><CheckCircle2 size={16} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {productionTab === 'shot_list' && (
                    <div className="h-full flex flex-col">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold">Smart Shot List</h3>
                        <div className="flex gap-2">
                          <button className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-sm font-medium transition-colors flex items-center gap-2">
                            <Upload size={16} /> Import
                          </button>
                          <button className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-sm font-medium transition-colors flex items-center gap-2">
                            <Download size={16} /> Export
                          </button>
                          <button className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold transition-colors shadow-lg shadow-brand-600/20 flex items-center gap-2 ml-4">
                            Generate Storyboard <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                        {MOCK_SHOTS.map(shot => (
                          <div key={shot.id} className="glass-panel rounded-2xl overflow-hidden border border-zinc-800">
                            {/* Shot Header */}
                            <div className="bg-zinc-900/80 px-4 py-3 flex items-start gap-4 border-b border-zinc-800">
                              <span className="text-brand-400 font-bold text-sm whitespace-nowrap mt-0.5">Shot {shot.index}</span>
                              <p className="text-sm text-zinc-300 leading-relaxed flex-1">{shot.description}</p>
                              <div className="flex gap-2">
                                {shot.continuityIssues && shot.continuityIssues.length > 0 && (
                                  <div className="group relative">
                                    <button className="p-1.5 text-yellow-500 hover:text-yellow-400 bg-yellow-500/10 rounded-lg"><AlertCircle size={14} /></button>
                                    <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                                      <p className="text-xs text-yellow-400 font-bold mb-1">Continuity Warning</p>
                                      <p className="text-xs text-zinc-300">{shot.continuityIssues[0].description}</p>
                                    </div>
                                  </div>
                                )}
                                <button className="p-1.5 text-zinc-500 hover:text-zinc-300"><Layers size={14} /></button>
                              </div>
                            </div>
                            
                            {/* Shot Details Table */}
                            <div className="grid grid-cols-12 gap-4 p-4 text-xs items-start">
                              <div className="col-span-1 flex flex-col gap-1">
                                <span className="text-zinc-500 font-medium">Scene</span>
                                <span className="font-bold text-zinc-200">@{shot.scene}</span>
                              </div>
                              <div className="col-span-1 flex flex-col gap-1">
                                <span className="text-zinc-500 font-medium">Comp</span>
                                <span className="font-bold text-zinc-200">{shot.composition}</span>
                              </div>
                              <div className="col-span-1 flex flex-col gap-1">
                                <span className="text-zinc-500 font-medium">Camera</span>
                                <span className="font-bold text-zinc-200">{shot.cameraMotion || 'Static'}</span>
                              </div>
                              <div className="col-span-1 flex flex-col gap-1">
                                <span className="text-zinc-500 font-medium">Lighting</span>
                                <span className="font-bold text-zinc-200">{shot.lighting}</span>
                              </div>
                              <div className="col-span-4 flex flex-col gap-1">
                                <span className="text-zinc-500 font-medium">Prompt</span>
                                <p className="text-zinc-400 font-mono leading-relaxed line-clamp-3 bg-zinc-950 p-2 rounded-md border border-zinc-800/50">{shot.prompt}</p>
                              </div>
                              <div className="col-span-2 flex flex-col gap-1">
                                <span className="text-zinc-500 font-medium">Dialogue</span>
                                <span className="font-bold text-zinc-200">{shot.dialogue || '-'}</span>
                              </div>
                              <div className="col-span-1 flex flex-col gap-1">
                                <span className="text-zinc-500 font-medium">Duration</span>
                                <span className={cn("font-bold", typeof shot.duration === 'string' ? "text-brand-400" : "text-zinc-200")}>
                                  {typeof shot.duration === 'string' ? shot.duration : `${shot.duration}s`}
                                </span>
                              </div>
                              <div className="col-span-1 flex flex-col gap-1 items-end">
                                <span className="text-zinc-500 font-medium">Action</span>
                                <button className="text-brand-400 hover:text-brand-300 font-bold">Edit</button>
                              </div>
                            </div>
                          </div>
                        ))}
                        <button className="w-full py-4 border-2 border-dashed border-zinc-800 rounded-2xl flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors">
                          <Plus size={18} />
                          <span className="text-sm font-bold">Add Shot</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {productionTab === 'storyboard' && (
                    <div className="flex gap-6 h-full">
                      {/* Left: Preview & Timeline */}
                      <div className="flex-1 flex flex-col gap-4 min-w-0">
                        <div className="flex-1 bg-black rounded-3xl relative flex items-center justify-center overflow-hidden border border-zinc-800 shadow-2xl">
                          <img src={MOCK_SHOTS[1].imageUrl} className="h-full w-full object-cover opacity-90" />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pt-20">
                            <p className="text-lg font-medium text-white max-w-3xl">
                              <span className="font-bold text-brand-400 mr-2">Kaelen:</span>
                              "The data is secure. But they know we're here."
                            </p>
                            <div className="flex gap-2 mt-4">
                              <button className="px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 backdrop-blur-md rounded-lg text-xs font-bold text-white transition-colors">Edit Subtitles</button>
                              <button className="px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700 backdrop-blur-md rounded-lg text-xs font-bold text-white transition-colors flex items-center gap-1"><Volume2 size={14}/> Preview Audio</button>
                            </div>
                          </div>
                          <button className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-lg text-white hover:bg-black/80 transition-colors">
                            <MonitorPlay size={20} />
                          </button>
                        </div>

                        <div className="h-48 glass-panel rounded-3xl p-4 flex flex-col">
                          <div className="flex items-center justify-between mb-3 px-2">
                            <div className="flex items-center gap-3">
                              <h4 className="font-bold text-sm">All Shots <span className="text-zinc-500 font-normal">(12 total)</span></h4>
                              <button className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center"><Play size={12} fill="currentColor" className="ml-0.5"/></button>
                            </div>
                            <div className="flex gap-2">
                              <button className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold transition-colors">Batch Images</button>
                              <button className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold transition-colors">Batch Video</button>
                            </div>
                          </div>
                          <div className="flex-1 flex gap-3 overflow-x-auto custom-scrollbar pb-2 items-center">
                            {MOCK_SHOTS.map(shot => (
                              <div key={shot.id} className={cn(
                                "h-full aspect-[16/9] rounded-xl overflow-hidden border-2 relative group shrink-0",
                                shot.id === 'sh2' ? "border-brand-500" : "border-zinc-800 hover:border-zinc-600"
                              )}>
                                <img src={shot.imageUrl} className="w-full h-full object-cover" />
                                <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-bold text-white">Shot {shot.index}</div>
                                <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-mono text-zinc-300">{typeof shot.duration === 'string' ? shot.duration.replace('Auto (','').replace(')','') : `${shot.duration}s`}</div>
                                {shot.continuityIssues && (
                                  <div className="absolute bottom-1 right-1 bg-yellow-500/90 backdrop-blur-md p-1 rounded text-white shadow-lg">
                                    <AlertCircle size={12} />
                                  </div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-1 flex justify-around opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ImageIcon size={12} className="text-zinc-400 hover:text-white cursor-pointer" />
                                  <Video size={12} className="text-zinc-400 hover:text-white cursor-pointer" />
                                  <Layers size={12} className="text-zinc-400 hover:text-white cursor-pointer" />
                                </div>
                              </div>
                            ))}
                            <button className="h-full aspect-[16/9] rounded-xl border-2 border-dashed border-zinc-800 flex items-center justify-center text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 transition-colors shrink-0">
                              <Plus size={24} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Right: Generation Sidebar */}
                      <div className="w-80 glass-panel rounded-3xl p-6 flex flex-col h-full overflow-y-auto custom-scrollbar">
                        <div className="flex gap-2 mb-6 p-1 bg-zinc-900 rounded-xl">
                          <button onClick={() => setStoryboardMediaType('image')} className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors", storyboardMediaType === 'image' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}>Image</button>
                          <button onClick={() => setStoryboardMediaType('video')} className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors", storyboardMediaType === 'video' ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}>Video</button>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-bold text-zinc-500">Image Prompt <span className="text-zinc-600 font-normal">Shot 2</span></h4>
                            </div>
                            <textarea 
                              className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-none custom-scrollbar font-mono leading-relaxed"
                              defaultValue={MOCK_SHOTS[1].prompt}
                            />
                            <div className="text-right mt-1 text-[10px] text-zinc-500">191 / 5000</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-zinc-500">Model</span>
                              <span className="text-xs text-brand-400 font-mono">Jimeng 4.0 | 4k</span>
                            </div>
                            <button className="flex-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg py-2 text-sm font-bold flex items-center justify-center gap-1 shadow-lg shadow-brand-600/20">
                              Generate <Zap size={14} /> 2
                            </button>
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-zinc-500 mb-3">Reference Subjects</h4>
                            <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
                              {MOCK_ASSETS.slice(0,2).map(asset => (
                                <div key={asset.id} className="w-20 shrink-0 relative group">
                                  <div className="aspect-square rounded-xl overflow-hidden border border-zinc-700 mb-1">
                                    <img src={asset.imageUrl} className="w-full h-full object-cover" />
                                  </div>
                                  <p className="text-[10px] font-bold text-center truncate">{asset.name}</p>
                                  <button className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-white border border-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                </div>
                              ))}
                              <button className="w-20 aspect-square shrink-0 rounded-xl border border-dashed border-zinc-700 flex flex-col items-center justify-center gap-1 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors">
                                <Plus size={14} />
                                <span className="text-[10px] font-bold">Subject</span>
                              </button>
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-bold text-zinc-500">{storyboardMediaType === 'image' ? 'Image Takes' : 'Video Takes'} ({storyboardMediaType === 'image' ? 3 : 2})</h4>
                              <button className="text-[10px] text-brand-400 font-bold"><History size={12}/></button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {(storyboardMediaType === 'image' ? MOCK_SHOTS[1].takes : MOCK_SHOTS[1].videoTakes)?.map((take, idx) => (
                                <div key={take.id} className={cn(
                                  "aspect-[16/9] rounded-xl overflow-hidden relative group cursor-pointer border-2",
                                  take.isSelected ? "border-brand-500" : "border-transparent hover:border-zinc-600"
                                )}>
                                  <img src={'imageUrl' in take ? take.imageUrl : take.videoUrl} className="w-full h-full object-cover" />
                                  {storyboardMediaType === 'video' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                      <Play size={16} className="text-white/80" />
                                    </div>
                                  )}
                                  <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-mono text-white">Take {idx + 1}</div>
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    {!take.isSelected && <button className="px-2 py-1 bg-brand-500 text-white text-[10px] font-bold rounded">Select</button>}
                                  </div>
                                  {take.isSelected && (
                                    <div className="absolute top-1 right-1 w-4 h-4 bg-brand-500 rounded-full flex items-center justify-center">
                                      <CheckCircle2 size={10} className="text-white" />
                                    </div>
                                  )}
                                </div>
                              ))}
                              <div className="aspect-[16/9] rounded-xl border-2 border-dashed border-zinc-800 flex items-center justify-center text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 transition-colors cursor-pointer">
                                <Plus size={16} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {productionTab === 'final' && (
                    <div className="h-full flex flex-col gap-4">
                      {/* Video Player Area */}
                      <div className="flex-1 bg-black rounded-3xl flex flex-col items-center justify-center relative overflow-hidden border border-zinc-800 shadow-2xl">
                        <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                          <Video size={16} className="text-brand-400" />
                          <span className="text-xs font-bold text-white">1080p • 24fps</span>
                        </div>
                        <img src={MOCK_SHOTS[0].imageUrl} alt="Preview" className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <button className="w-20 h-20 rounded-full bg-brand-500/90 text-white flex items-center justify-center shadow-2xl shadow-brand-500/50 hover:scale-110 transition-transform backdrop-blur-sm">
                            <Play size={32} fill="currentColor" className="ml-2" />
                          </button>
                        </div>
                        {/* Player Controls */}
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/90 to-transparent flex items-end px-6 pb-4">
                          <div className="w-full flex items-center gap-4">
                            <span className="text-xs font-mono text-zinc-300">00:00:00</span>
                            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="w-1/3 h-full bg-brand-500 rounded-full" />
                            </div>
                            <span className="text-xs font-mono text-zinc-300">00:00:05</span>
                          </div>
                        </div>
                      </div>

                      {/* Timeline Area */}
                      <div className="h-64 bg-zinc-900/80 backdrop-blur-md rounded-3xl border border-zinc-800 p-4 flex flex-col">
                        <div className="flex items-center justify-between mb-4 px-2">
                          <div className="flex items-center gap-4">
                            <h3 className="text-sm font-bold text-zinc-300">Timeline</h3>
                            <div className="flex items-center gap-2">
                              <button className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"><Scissors size={16} /></button>
                              <button className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors"><Plus size={16} /></button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">Zoom</span>
                            <input type="range" className="w-24 accent-brand-500" defaultValue="50" />
                          </div>
                        </div>

                        <div className="flex-1 relative overflow-hidden flex flex-col gap-2">
                          {/* Playhead */}
                          <div className="absolute top-0 bottom-0 left-1/3 w-0.5 bg-brand-500 z-20">
                            <div className="absolute -top-2 -left-1.5 w-3.5 h-3.5 bg-brand-500 rounded-sm" />
                          </div>

                          {/* Video Track */}
                          <div className="flex items-center gap-2 h-16 bg-zinc-950/50 rounded-xl p-1 border border-zinc-800/50">
                            <div className="w-16 flex items-center justify-center text-zinc-600 border-r border-zinc-800"><Video size={16} /></div>
                            <div className="flex-1 flex gap-1 h-full relative">
                              <div className="absolute left-0 w-1/3 h-full bg-blue-900/30 border border-blue-500/30 rounded-lg overflow-hidden flex items-center">
                                <img src={MOCK_SHOTS[0].imageUrl} className="h-full opacity-50 object-cover w-20" />
                                <span className="text-[10px] font-bold px-2 text-blue-300">Shot 1</span>
                              </div>
                              <div className="absolute left-1/3 w-1/4 h-full bg-blue-900/30 border border-blue-500/30 rounded-lg overflow-hidden flex items-center">
                                <img src={MOCK_SHOTS[1].imageUrl} className="h-full opacity-50 object-cover w-20" />
                                <span className="text-[10px] font-bold px-2 text-blue-300">Shot 2</span>
                              </div>
                            </div>
                          </div>

                          {/* Dialogue Track */}
                          <div className="flex items-center gap-2 h-12 bg-zinc-950/50 rounded-xl p-1 border border-zinc-800/50">
                            <div className="w-16 flex items-center justify-center text-zinc-600 border-r border-zinc-800"><Mic size={16} /></div>
                            <div className="flex-1 flex gap-1 h-full relative">
                              <div className="absolute left-[10%] w-1/4 h-full bg-green-900/30 border border-green-500/30 rounded-lg flex items-center px-2">
                                <div className="w-full h-4 opacity-50" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, #4ade80 2px, #4ade80 4px)' }} />
                              </div>
                            </div>
                          </div>

                          {/* Audio/BGM Track */}
                          <div className="flex items-center gap-2 h-12 bg-zinc-950/50 rounded-xl p-1 border border-zinc-800/50">
                            <div className="w-16 flex items-center justify-center text-zinc-600 border-r border-zinc-800"><Volume2 size={16} /></div>
                            <div className="flex-1 flex gap-1 h-full relative">
                              <div className="absolute left-0 w-2/3 h-full bg-purple-900/30 border border-purple-500/30 rounded-lg flex items-center px-2">
                                <div className="w-full h-4 opacity-50" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, #c084fc 2px, #c084fc 4px)' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Global CSS for scrollbar */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}} />
    </div>
  );
}

// Sub-components

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function SidebarItem({ icon, label, active, onClick, disabled }: SidebarItemProps) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group",
        active ? "bg-brand-600/10 text-brand-400 font-bold" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900",
        disabled && "opacity-30 cursor-not-allowed"
      )}
    >
      <span className={cn("transition-transform group-hover:scale-110", active && "text-brand-500")}>
        {icon}
      </span>
      <span className="text-sm">{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(14,145,233,0.8)]" />}
    </button>
  );
}

interface SeriesCardProps {
  key?: string;
  series: Series;
  onClick: () => void;
}

function SeriesCard({ series, onClick }: SeriesCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      onClick={onClick}
      className="group cursor-pointer glass-panel rounded-3xl overflow-hidden transition-all hover:border-brand-500/50 hover:shadow-2xl hover:shadow-brand-500/10"
    >
      <div className="aspect-video relative overflow-hidden">
        <img 
          src={series.coverUrl} 
          alt={series.name} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <StatusBadge status={series.status} />
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
            <Film size={12} className="text-zinc-400" />
            <span className="text-[10px] font-bold text-white">{series.episodeCount} EPs</span>
          </div>
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold mb-2 group-hover:text-brand-400 transition-colors">{series.name}</h3>
        <p className="text-sm text-zinc-500 line-clamp-2 mb-6 leading-relaxed">{series.description}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium">Production Progress</span>
            <span className="text-zinc-100 font-bold">{series.progress}%</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${series.progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full" 
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface EpisodeRowProps {
  key?: string;
  episode: Episode;
  onClick: () => void;
}

function EpisodeRow({ episode, onClick }: EpisodeRowProps) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-brand-500/30 hover:bg-zinc-900 transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-400 group-hover:bg-brand-600/20 group-hover:text-brand-400 transition-colors">
        {episode.index.toString().padStart(2, '0')}
      </div>
      <div className="flex-1 text-left">
        <h4 className="font-bold text-zinc-100">{episode.title}</h4>
        <div className="flex items-center gap-3 mt-1">
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-widest",
            episode.status === 'done' ? "text-green-500" : "text-brand-400"
          )}>
            {episode.status.replace('_', ' ')}
          </span>
          <div className="w-1 h-1 rounded-full bg-zinc-700" />
          <span className="text-[10px] text-zinc-500 font-medium">{episode.progress}% Complete</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden hidden sm:block">
          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${episode.progress}%` }} />
        </div>
        <ChevronRight size={20} className="text-zinc-600 group-hover:text-brand-400 transition-colors" />
      </div>
    </button>
  );
}

interface StatusBadgeProps {
  status: SeriesStatus | EpisodeStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    initialized: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Initialized' },
    producing: { color: 'bg-brand-500/10 text-brand-400 border-brand-500/20', label: 'Producing' },
    partial_done: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Partial' },
    done: { color: 'bg-green-500/10 text-green-400 border-green-500/20', label: 'Completed' },
    paused: { color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', label: 'Paused' },
    not_started: { color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', label: 'Not Started' },
    in_progress: { color: 'bg-brand-500/10 text-brand-400 border-brand-500/20', label: 'In Progress' },
    blocked: { color: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Blocked' },
    review_pending: { color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', label: 'Review' },
    setting: { color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', label: 'Setting' }
  };

  const { color, label } = config[status as keyof typeof config] || config.initialized;

  return (
    <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border", color)}>
      {label}
    </span>
  );
}

interface StatBoxProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function StatBox({ label, value, icon }: StatBoxProps) {
  return (
    <div className="glass-panel rounded-2xl p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-brand-400">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</p>
        <p className="text-xl font-bold text-zinc-100">{value}</p>
      </div>
    </div>
  );
}

interface StrategyItemProps {
  label: string;
  value: string;
}

function StrategyItem({ label, value }: StrategyItemProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
      <span className="text-xs text-zinc-500 font-medium">{label}</span>
      <span className="text-xs text-zinc-100 font-bold">{value}</span>
    </div>
  );
}

interface WorkflowTabProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

function WorkflowTab({ id, label, icon, active, onClick }: WorkflowTabProps) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-sm",
        active ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

interface ProductionStepProps {
  label: string;
  status: string;
  progress: number;
}

function ProductionStep({ label, status, progress }: ProductionStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-400">{label}</span>
        <span className={cn(
          "text-[10px] font-bold uppercase",
          status === 'completed' ? "text-green-500" : status === 'in_progress' ? "text-brand-400" : "text-zinc-600"
        )}>
          {status.replace('_', ' ')}
        </span>
      </div>
      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-500",
            status === 'completed' ? "bg-green-500" : "bg-brand-500"
          )} 
          style={{ width: `${progress}%` }} 
        />
      </div>
    </div>
  );
}

interface ActivityItemProps {
  icon: React.ReactNode;
  title: string;
  time: string;
}

function ActivityItem({ icon, title, time }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-4">
      <div className="mt-1">{icon}</div>
      <div>
        <p className="text-sm font-medium text-zinc-200">{title}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{time}</p>
      </div>
    </div>
  );
}

interface AssetFilterProps {
  label: string;
  active?: boolean;
}

function AssetFilter({ label, active }: AssetFilterProps) {
  return (
    <button className={cn(
      "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
      active ? "bg-brand-600 text-white" : "bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
    )}>
      {label}
    </button>
  );
}

interface AssetCardProps {
  key?: string;
  asset: Asset;
}

function AssetCard({ asset }: AssetCardProps) {
  return (
    <div className="group glass-panel rounded-3xl overflow-hidden border border-zinc-800 hover:border-brand-500/50 transition-all flex flex-col">
      <div className="aspect-square relative overflow-hidden">
        <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
        
        {/* Version Indicators */}
        {asset.versions && asset.versions.length > 0 && (
          <div className="absolute bottom-2 left-2 flex gap-1 z-10">
            {asset.versions.map((v) => (
              <div key={v.id} className={cn("w-6 h-6 rounded border overflow-hidden cursor-pointer hover:scale-110 transition-transform", v.isSelected ? "border-brand-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "border-zinc-500/50 opacity-70")}>
                <img src={v.imageUrl} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="absolute top-3 right-3">
          <span className={cn(
            "px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-widest backdrop-blur-md border",
            asset.type === 'character' ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : 
            asset.type === 'scene' ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : 
            "bg-amber-500/20 text-amber-400 border-amber-500/30"
          )}>
            {asset.type}
          </span>
        </div>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-1">
          <h4 className="font-bold text-sm">{asset.name}</h4>
          {asset.type === 'character' && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
              {asset.isFaceLocked ? <Lock size={10} /> : <Unlock size={10} className="text-zinc-500" />}
              {asset.isFaceLocked ? 'FACE LOCKED' : 'UNLOCKED'}
            </div>
          )}
        </div>
        <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed mb-3">{asset.description}</p>
        
        {asset.states && asset.states.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-3">
            {asset.states.map(state => (
              <span key={state.id} className="px-2 py-0.5 rounded-md bg-zinc-800 text-[10px] font-medium text-zinc-300 border border-zinc-700">
                {state.name}
              </span>
            ))}
          </div>
        )}
        
        <div className="mt-auto pt-3 border-t border-zinc-800/50 flex flex-col gap-2">
          {asset.type === 'character' && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">Voice:</span>
              <button className="text-[10px] font-bold text-zinc-300 hover:text-white flex items-center gap-1">
                {asset.id === 'a1' ? 'Deep Male 1' : 'Select Voice'} <ChevronRight size={10} />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mt-1">
            <button className="text-[10px] font-bold text-brand-400 hover:text-brand-300">Edit Details</button>
            {asset.isShared && <Share2 size={12} className="text-zinc-600" />}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ShotCardProps {
  key?: string;
  shot: Shot;
}

function ShotCard({ shot }: ShotCardProps) {
  return (
    <div className="w-72 flex flex-col gap-4 group">
      <div className="aspect-[16/9] relative rounded-3xl overflow-hidden border border-zinc-800 group-hover:border-brand-500/50 transition-all shadow-xl">
        {shot.imageUrl ? (
          <img src={shot.imageUrl} alt={shot.description} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
            <ImageIcon size={32} className="text-zinc-800" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-white border border-white/10">
            SHOT {shot.index}
          </span>
          <span className={cn(
            "px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-widest backdrop-blur-md border",
            shot.status === 'rendered' ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-brand-500/20 text-brand-400 border-brand-500/30"
          )}>
            {shot.status}
          </span>
        </div>
        <div className="absolute bottom-3 right-3">
          <span className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-white border border-white/10 flex items-center gap-1">
            <Clock size={10} /> {shot.duration}s
          </span>
        </div>
        <div className="absolute inset-0 bg-brand-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button className="w-12 h-12 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-xl shadow-brand-500/40 transform translate-y-4 group-hover:translate-y-0 transition-all">
            <Play size={20} fill="currentColor" />
          </button>
        </div>
      </div>
      <div className="px-2">
        <div className="flex items-center justify-between mb-2">
          <h5 className="font-bold text-sm truncate flex-1">{shot.scene}</h5>
          <button className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <MoreVertical size={16} />
          </button>
        </div>
        <div className="mb-3 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800/50">
          <p className="text-[10px] text-zinc-400 font-mono line-clamp-2 leading-relaxed">
            <span className="text-brand-400 font-bold">Prompt: </span>
            {shot.prompt || shot.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-500">{shot.composition}</div>
          <div className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-500">{shot.lighting}</div>
          {shot.cameraMotion && (
            <div className="px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 text-[10px] font-bold text-brand-400 flex items-center gap-1">
              <Camera size={10} />
              {shot.cameraMotion}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
