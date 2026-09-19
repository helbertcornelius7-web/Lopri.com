import React, { useState } from 'react';
import { Project, Finding, ProjectDocument } from '../types';
import { SourceViewer } from './SourceViewer';
import { 
  FileSearch, 
  Sliders, 
  FileText, 
  Layers, 
  X, 
  ShieldCheck, 
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';

interface StudioInspectorProps {
  project: Project;
  activeFinding: Finding | null;
  preferredView: 'specification' | 'drawing' | 'split';
  onChangePreferredView: (view: 'specification' | 'drawing' | 'split') => void;
  onClose: () => void;
}

export const StudioInspector: React.FC<StudioInspectorProps> = ({
  project,
  activeFinding,
  preferredView,
  onChangePreferredView,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'evidence' | 'documents' | 'parameters'>('evidence');
  const [selectedDocId, setSelectedDocId] = useState<string>(
    project.documents[0]?.id || ''
  );

  const currentDoc = project.documents.find((d) => d.id === selectedDocId) || project.documents[0];

  return (
    <aside className="w-96 xl:w-[440px] h-full bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden select-none">
      {/* Header with AI Studio Inspector Tabs */}
      <div className="p-2 border-b border-slate-200 bg-white flex items-center justify-between gap-1">
        <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
          <button
            onClick={() => setActiveTab('evidence')}
            className={`py-1 px-2.5 rounded-md font-medium transition-all ${
              activeTab === 'evidence'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Evidence
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-1 px-2.5 rounded-md font-medium transition-all ${
              activeTab === 'documents'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Documents
          </button>
          <button
            onClick={() => setActiveTab('parameters')}
            className={`py-1 px-2.5 rounded-md font-medium transition-all ${
              activeTab === 'parameters'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Parameters
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab 1: Evidence Inspector (SourceViewer) */}
      {activeTab === 'evidence' && (
        <div className="flex-1 p-2 overflow-hidden flex flex-col">
          {activeFinding ? (
            <SourceViewer
              project={project}
              activeFinding={activeFinding}
              preferredView={preferredView}
              onChangePreferredView={onChangePreferredView}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 text-xs">
              <FileSearch className="w-8 h-8 mb-2 text-slate-300" />
              <span>Select a finding to inspect side-by-side evidence with highlighted citations.</span>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Document Browser */}
      {activeTab === 'documents' && (
        <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-3">
          <div className="text-xs font-bold text-slate-800">
            Project Documents Index ({project.documents.length})
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1">
            {project.documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium whitespace-nowrap transition-colors border ${
                  selectedDocId === doc.id
                    ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {doc.name}
              </button>
            ))}
          </div>

          {currentDoc ? (
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-3 font-mono text-xs text-slate-800">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-slate-900 truncate">{currentDoc.name}</span>
                <span className="text-[11px] text-slate-500">{currentDoc.pages.length} Pages</span>
              </div>

              <div className="space-y-2">
                {currentDoc.pages.map((p) => (
                  <div key={p.pageNumber} className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                      <span>Page {p.pageNumber}: {p.sheetOrSection || 'Document Section'}</span>
                      <span className="text-slate-400 font-normal">{p.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-3 leading-relaxed font-sans">
                      {p.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 text-xs space-y-2 border border-dashed border-slate-200 rounded-xl">
              <FileText className="w-8 h-8 text-slate-300" />
              <span>Upload drawing or specification PDFs to view document pages.</span>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Parameters & Tuning */}
      {activeTab === 'parameters' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          <div>
            <div className="text-xs font-bold text-slate-900 mb-1">
              Model & Grounding Parameters
            </div>
            <p className="text-[11px] text-slate-500">
              Configuration used for automated specification and drawing cross-checks.
            </p>
          </div>

          <div className="space-y-3.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Active Reasoning Model
              </label>
              <div className="bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono text-slate-900 font-semibold">
                gemini-2.5-pro
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Temperature
                </label>
                <span className="font-mono font-bold text-slate-900">0.0 (Deterministic)</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                defaultValue="0"
                disabled
                className="w-full accent-amber-500 cursor-not-allowed opacity-75"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Locked to 0.0 to prevent hallucination in electrical code & sizing checks.
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Grounding Policy
                </label>
                <span className="font-mono font-semibold text-emerald-700">Strict (100%)</span>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                <span>Every claim must map directly to an exact document section and sheet number.</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-900 mb-2">
              Estimator Scope Review Tally
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Total Findings</span>
                <span className="text-sm font-bold font-mono text-slate-900">{project.findings.length}</span>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-emerald-700 block">Accepted</span>
                <span className="text-sm font-bold font-mono text-emerald-900">
                  {project.findings.filter(f => f.status === 'ACCEPTED').length}
                </span>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-amber-700 block">Review Later</span>
                <span className="text-sm font-bold font-mono text-amber-900">
                  {project.findings.filter(f => f.status === 'REVIEW_LATER').length}
                </span>
              </div>
              <div className="p-2 bg-slate-100 rounded-lg border border-slate-200">
                <span className="text-slate-600 block">Rejected</span>
                <span className="text-sm font-bold font-mono text-slate-700">
                  {project.findings.filter(f => f.status === 'REJECTED').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
