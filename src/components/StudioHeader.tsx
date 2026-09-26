import React from 'react';
import { Project } from '../types';
import { FeedbackButton } from './FeedbackButton';
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  PanelRightClose, 
  PanelRightOpen, 
  Sparkles, 
  ChevronDown, 
  Download, 
  Upload, 
  RotateCcw, 
  ShieldCheck, 
  Play,
  Settings,
  Terminal,
  LayoutGrid
} from 'lucide-react';

interface StudioHeaderProps {
  project: Project;
  allProjects: Array<{ id: string; name: string; status: string; findingsCount: number }>;
  onSelectProject: (id: string) => void;
  isLeftOpen: boolean;
  onToggleLeft: () => void;
  isRightOpen: boolean;
  onToggleRight: () => void;
  onOpenUpload: () => void;
  onOpenPipeline: () => void;
  onOpenExport: () => void;
  onResetDemo: () => void;
  onRunScopeCheck: () => void;
  isAnalyzing: boolean;
  currentView: 'home' | 'playground' | 'history' | 'gallery';
  onChangeView: (view: 'home' | 'playground' | 'history' | 'gallery') => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = React.memo(({
  project,
  allProjects = [],
  onSelectProject = (_id: string) => {},
  isLeftOpen = true,
  onToggleLeft = () => {},
  isRightOpen = true,
  onToggleRight = () => {},
  onOpenUpload,
  onOpenPipeline,
  onOpenExport,
  onResetDemo,
  onRunScopeCheck,
  isAnalyzing = false,
  currentView = 'home',
  onChangeView,
}) => {
  return (
    <header className="h-13 border-b border-slate-200 bg-white px-3 sm:px-4 flex items-center justify-between text-slate-800 shrink-0 z-30 select-none shadow-xs">
      {/* Left side: Sidebar toggles & Project Title breadcrumbs */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onToggleLeft}
          title={isLeftOpen ? 'Collapse Left Sidebar' : 'Expand Left Sidebar'}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          {isLeftOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        {/* Brand / Logo */}
        <div 
          onClick={() => onChangeView('home')}
          className="flex items-center gap-2 pr-2 border-r border-slate-200 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
          </div>
          <span className="text-xs font-bold tracking-tight text-slate-900 hidden sm:inline">
            Electrical Scope Checker
          </span>
        </div>

        {/* View Switcher: Scope Overview vs Side-by-Side Review */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
          <button
            onClick={() => onChangeView('home')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              currentView === 'home' || currentView === 'gallery'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
            <span>Scope Overview</span>
          </button>
          <button
            onClick={() => onChangeView('playground')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              currentView === 'playground'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span>Review Canvas</span>
          </button>
        </div>

        {/* Breadcrumb separator & Project Selector Dropdown (only when projects exist) */}
        {(allProjects || []).length > 0 && (
          <>
            <span className="text-slate-300 text-xs hidden md:inline">/</span>
            <div className="relative hidden sm:flex items-center gap-1.5 min-w-0">
              <select
                value={project.id || ''}
                onChange={(e) => onSelectProject(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs font-semibold rounded-md border border-slate-200 px-2.5 py-1 pr-6 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer appearance-none truncate max-w-[140px] md:max-w-xs transition-colors"
              >
                {(allProjects || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
            </div>
          </>
        )}
      </div>

      {/* Center: Grounding Indicator */}
      <div className="hidden xl:flex items-center gap-2">
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border font-medium ${
          project.documents.length > 0
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-slate-50 text-slate-500 border-slate-200'
        }`}>
          <ShieldCheck className={`w-3.5 h-3.5 ${project.documents.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          <span>{project.documents.length > 0 ? '100% Document Grounded' : 'Awaiting Document Upload'}</span>
        </div>
      </div>

      {/* Right side: Studio Action Buttons & Inspector Toggle */}
      <div className="flex items-center gap-2">
        {/* Run Scope Check Button (AI Studio Primary Action) */}
        <button
          onClick={onRunScopeCheck}
          disabled={isAnalyzing}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors disabled:opacity-50 shadow-2xs"
          title="Run Grounded Scope Check on active documents"
        >
          {isAnalyzing ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-950 animate-ping" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-slate-950" />
              <span>Run Scope Check</span>
            </>
          )}
        </button>

        {/* Upload Button */}
        <button
          onClick={onOpenUpload}
          className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
          title="Upload new drawing or specification PDFs"
        >
          <Upload className="w-3.5 h-3.5 text-slate-500" />
          <span>Upload PDFs</span>
        </button>

        {/* Export Log */}
        <button
          onClick={onOpenExport}
          className="hidden md:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
          title="Export Scope Review Summary Log"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export Log</span>
        </button>

        {/* Feedback Button (Tally Widget) */}
        <FeedbackButton variant="header" />

        {/* Reset / Reload Demo Workspace */}
        <button
          onClick={onResetDemo}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Reset Workspace"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Settings gear icon matching top-right of screenshot */}
        <button
          onClick={onOpenPipeline}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Settings & Grounding Pipeline"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Right Inspector Toggle (visible in playground mode or toggleable) */}
        {currentView === 'playground' && (
          <button
            onClick={onToggleRight}
            title={isRightOpen ? 'Collapse Evidence & Parameters' : 'Expand Evidence & Parameters'}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors ml-0.5"
          >
            {isRightOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        )}
      </div>
    </header>
  );
});
