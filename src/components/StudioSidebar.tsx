import React from 'react';
import { Project, Finding, FindingType, FindingStatus } from '../types';
import { FeedbackButton } from './FeedbackButton';
import { 
  Plus, 
  Terminal, 
  History, 
  LayoutGrid, 
  LayoutTemplate, 
  Gauge, 
  BookOpen, 
  ChevronRight, 
  Bell, 
  Settings, 
  Search, 
  KeyRound, 
  Sparkles, 
  Menu,
  FileText,
  Layers,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Clock,
  XCircle
} from 'lucide-react';

interface StudioSidebarProps {
  project: Project;
  currentView: 'home' | 'playground' | 'history' | 'gallery';
  onChangeView: (view: 'home' | 'playground' | 'history' | 'gallery') => void;
  selectedFindingId: string | null;
  onSelectFinding: (finding: Finding) => void;
  onOpenUpload: () => void;
  onOpenPipeline: () => void;
  onOpenExport: () => void;
  onToggleSidebar?: () => void;
}

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  project,
  currentView,
  onChangeView,
  selectedFindingId,
  onSelectFinding,
  onOpenUpload,
  onOpenPipeline,
  onOpenExport,
  onToggleSidebar,
}) => {
  return (
    <aside className="w-64 sm:w-72 h-full bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 overflow-hidden select-none z-20">
      {/* Top Header & Navigation Links */}
      <div className="flex flex-col overflow-y-auto flex-1 p-3 space-y-6">
        
        {/* Brand Header: Electrical Scope Checker with Collapse Icon */}
        <div className="flex items-center justify-between px-1 pt-1">
          <div 
            onClick={() => onChangeView('home')} 
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700">
              <Sparkles className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-tight text-slate-900 group-hover:text-amber-800">
                Electrical Scope Checker
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Division 26 vs Drawings</span>
            </div>
          </div>

          <button
            onClick={onToggleSidebar}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: EXPLORE */}
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
            EXPLORE
          </div>

          <button
            onClick={() => onChangeView('playground')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              currentView === 'playground'
                ? 'bg-slate-100 text-slate-950 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Terminal className="w-4 h-4 text-slate-500" />
            <span>Scope Review Canvas</span>
          </button>

          <button
            onClick={() => onChangeView('history')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              currentView === 'history'
                ? 'bg-slate-100 text-slate-950 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>Decision History</span>
          </button>
        </div>

        {/* Section 2: SCOPE REVIEW */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
            SCOPE REVIEW
          </div>

          {/* + Upload Documents pill button */}
          <button
            onClick={onOpenUpload}
            className="w-full flex items-center gap-2.5 px-4 py-2 rounded-full border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold transition-all shadow-2xs group mb-2"
          >
            <Plus className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
            <span>Upload Drawings & Specs</span>
          </button>

          <button
            onClick={() => onChangeView('home')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              currentView === 'home'
                ? 'bg-slate-100 text-slate-950 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <LayoutGrid className="w-4 h-4 text-slate-500" />
            <span>Scope Overview</span>
          </button>

          <button
            onClick={() => onChangeView('gallery')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              currentView === 'gallery'
                ? 'bg-slate-100 text-slate-950 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <LayoutTemplate className="w-4 h-4 text-slate-500" />
            <span>Discrepancies & Gaps</span>
          </button>
        </div>

        {/* Section 3: AUDIT & EXPORT */}
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
            AUDIT & EXPORT
          </div>

          <button
            onClick={onOpenPipeline}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Gauge className="w-4 h-4 text-slate-500" />
              <span>Extraction Pipeline</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={onOpenExport}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-slate-500" />
              <span>Estimator Scope Log</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Playground Findings Drawer (visible if user is in Playground mode) */}
        {currentView === 'playground' && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 flex items-center justify-between">
              <span>SCOPE FINDINGS</span>
              <span className="font-mono text-slate-500">{project.findings.length}</span>
            </div>

            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {project.findings.length === 0 ? (
                <div className="p-3 text-center text-[11px] text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  No findings yet. Upload drawings and specifications to check scope.
                </div>
              ) : (
                project.findings.map((f) => {
                  const isSelected = f.id === selectedFindingId;
                  return (
                    <div
                      key={f.id}
                      onClick={() => onSelectFinding(f)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors border ${
                        isSelected
                          ? 'bg-amber-50 text-slate-950 font-semibold border-amber-300'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent'
                      }`}
                    >
                      <div className="truncate">{f.title}</div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between mt-0.5">
                        <span>{f.systemArea}</span>
                        <span className="font-mono">{f.status}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>

      {/* Bottom Footer Box & Profile (Styled like screenshot card & profile) */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50 space-y-3 shrink-0">
        
        {/* Verification Grounding Card */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">
              {project.documents.length > 0 ? 'Document-Grounded' : 'Awaiting Documents'}
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              project.documents.length > 0
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-slate-500 bg-slate-100 border-slate-200'
            }`}>
              {project.documents.length > 0 ? '100%' : '0 Files'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 leading-snug">
            {project.documents.length > 0
              ? 'All findings cite specific drawing sheets and Division 26 specification sections.'
              : 'Upload electrical drawing sheets and Division 26 specs to begin verification.'}
          </div>
        </div>

        {/* User Feedback (Tally Form) */}
        <div className="px-1">
          <FeedbackButton variant="sidebar" />
        </div>

        {/* Action icons row (Bell, Settings, Search, Upload) */}
        <div className="flex items-center justify-between px-1 text-slate-500">
          <button 
            onClick={onOpenPipeline}
            className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors" 
            title="Processing Pipeline Status"
          >
            <Bell className="w-4 h-4" />
          </button>
          <button 
            onClick={onOpenExport}
            className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors" 
            title="Export Scope Review Summary"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onChangeView('playground')}
            className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors" 
            title="Search Drawing Sheets & Specs"
          >
            <Search className="w-4 h-4" />
          </button>
          <button 
            onClick={onOpenUpload}
            className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-800 transition-colors" 
            title="Upload New Drawing & Specification PDFs"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* User / Estimator Profile Bar */}
        <div className="flex items-center gap-2.5 px-1 pt-1">
          <div className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
            EE
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-slate-800 truncate">
              Electrical Estimator
            </span>
            <span className="text-[10px] text-slate-400 truncate">
              Lead Scope Reviewer
            </span>
          </div>
        </div>

      </div>
    </aside>
  );
};
