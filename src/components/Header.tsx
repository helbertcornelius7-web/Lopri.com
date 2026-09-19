import React from 'react';
import { Project } from '../types';
import { 
  FileText, 
  Layers, 
  Upload, 
  RotateCcw, 
  Download,
  MessageSquare,
  ChevronDown,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface HeaderProps {
  project: Project;
  allProjects: Array<{ id: string; name: string; status: string; findingsCount: number }>;
  onSelectProject: (id: string) => void;
  onOpenUpload: () => void;
  onOpenPipeline: () => void;
  onOpenExport: () => void;
  onOpenChat: () => void;
  onResetDemo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  allProjects,
  onSelectProject,
  onOpenUpload,
  onOpenPipeline,
  onOpenExport,
  onOpenChat,
  onResetDemo,
}) => {
  const drawingCount = project.documents.filter(d => d.category === 'drawing').length;
  const specCount = project.documents.filter(d => d.category === 'specification').length;

  const acceptedCount = project.findings.filter(f => f.status === 'ACCEPTED').length;
  const rejectedCount = project.findings.filter(f => f.status === 'REJECTED').length;
  const reviewLaterCount = project.findings.filter(f => f.status === 'REVIEW_LATER').length;
  const pendingCount = project.findings.filter(f => f.status === 'PENDING').length;
  const totalFindings = project.findings.length;
  const decidedCount = totalFindings - pendingCount;

  return (
    <header className="bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-20 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Brand & Project Selector */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2.5 pr-3 border-r border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700 font-bold text-xs tracking-tight">
              ESC
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                <span>Electrical Scope Checker</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Drawings & Specs Cross-Check
              </div>
            </div>
          </div>

          {/* Project dropdown */}
          <div className="relative flex items-center gap-2 min-w-0">
            <div className="relative">
              <select
                value={project.id}
                onChange={(e) => onSelectProject(e.target.value)}
                className="bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-semibold rounded-lg border border-slate-300 px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer appearance-none truncate max-w-[200px] sm:max-w-xs transition-colors"
              >
                {allProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>

            {project.id === 'demo-st-jude-pavilion' && (
              <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Sample Project
              </span>
            )}
          </div>
        </div>

        {/* Center: Document Counts */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-2.5 text-xs bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200">
            <span className="text-slate-600 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              <strong className="text-slate-900 font-semibold">{drawingCount}</strong> Drawings
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <strong className="text-slate-900 font-semibold">{specCount}</strong> Specs
            </span>
          </div>

          <button
            onClick={onOpenPipeline}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            title="View Pipeline Status"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium">Ready for Review</span>
          </button>
        </div>

        {/* Right: Review Progress & Primary Actions */}
        <div className="flex items-center gap-2">
          {/* Review Progress Tracker */}
          <div className="hidden sm:flex items-center gap-2 text-xs px-2.5 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-medium">Decided:</span>
            <span className="font-semibold text-slate-800">{decidedCount}/{totalFindings}</span>
            <div className="flex items-center gap-1 text-[11px] ml-1">
              {acceptedCount > 0 && (
                <span className="text-emerald-700 bg-emerald-100 font-semibold px-1.5 py-0.2 rounded">
                  {acceptedCount} ✓
                </span>
              )}
              {rejectedCount > 0 && (
                <span className="text-slate-600 bg-slate-200 font-semibold px-1.5 py-0.2 rounded">
                  {rejectedCount} ✕
                </span>
              )}
              {reviewLaterCount > 0 && (
                <span className="text-amber-700 bg-amber-100 font-semibold px-1.5 py-0.2 rounded">
                  {reviewLaterCount} ?
                </span>
              )}
            </div>
          </div>

          {/* Ask Grounded Assistant */}
          <button
            onClick={onOpenChat}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium transition-colors"
            title="Ask a Question About Project"
          >
            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Ask AI</span>
          </button>

          {/* Export Log Button */}
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium transition-colors"
            title="Export Estimator Findings Review Log"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Export Log</span>
          </button>

          {/* Reset Demo Project Button */}
          <button
            onClick={onResetDemo}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors"
            title="Reset to initial sample data"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Upload New Project PDFs Button */}
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload PDFs</span>
          </button>
        </div>
      </div>
    </header>
  );
};

