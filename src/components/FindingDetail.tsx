import React, { useState, useEffect } from 'react';
import { Finding, FindingType, Project } from '../types';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileSearch, 
  AlertCircle, 
  AlertTriangle, 
  HelpCircle,
  FileText,
  Layers,
  Save,
  ChevronLeft
} from 'lucide-react';
import { SourceViewer } from './SourceViewer';

interface FindingDetailProps {
  finding: Finding;
  project: Project;
  onAccept: (findingId: string) => void;
  onReject: (findingId: string) => void;
  onReviewLater: (findingId: string) => void;
  onUpdateNotes: (findingId: string, notes: string) => void;
  preferredView: 'specification' | 'drawing' | 'split';
  onChangePreferredView: (view: 'specification' | 'drawing' | 'split') => void;
  onBackToList?: () => void;
}

export const FindingDetail: React.FC<FindingDetailProps> = ({
  finding,
  project,
  onAccept,
  onReject,
  onReviewLater,
  onUpdateNotes,
  preferredView,
  onChangePreferredView,
  onBackToList,
}) => {
  const [notes, setNotes] = useState(finding.estimatorNotes || '');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setNotes(finding.estimatorNotes || '');
    setIsSaved(false);
  }, [finding.id, finding.estimatorNotes]);

  const handleSaveNotes = () => {
    onUpdateNotes(finding.id, notes);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const getTypeMeta = (type: FindingType) => {
    switch (type) {
      case 'SCOPE_GAP':
        return {
          label: 'Potential Scope Gap',
          icon: AlertCircle,
          badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
          desc: 'The project specification appears to mandate scope that is not visible on the drawings or equipment schedules.',
        };
      case 'CONFLICT':
        return {
          label: 'Potential Conflict',
          icon: AlertTriangle,
          badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
          desc: 'Drawing details directly disagree with specification material or sizing requirements.',
        };
      case 'MISSING_REFERENCE':
        return {
          label: 'Missing Reference',
          icon: HelpCircle,
          badgeBg: 'bg-orange-50 text-orange-800 border-orange-200',
          desc: 'Requirement mentioned in specifications but not clearly represented on floor plans or single-line diagrams.',
        };
      case 'DOCUMENT_CONFLICT':
        return {
          label: 'Document Conflict',
          icon: AlertTriangle,
          badgeBg: 'bg-yellow-50 text-yellow-800 border-yellow-200',
          desc: 'Different project documents provide contradictory equipment sources, feeders, or schedules.',
        };
    }
  };

  const meta = getTypeMeta(finding.type);
  const TypeIcon = meta.icon;

  return (
    <div className="flex flex-col h-full bg-slate-50/50 overflow-y-auto">
      {/* Top Banner & Quick Controls */}
      <div className="p-4 md:p-6 bg-white border-b border-slate-200 shadow-2xs">
        {onBackToList && (
          <button
            onClick={onBackToList}
            className="md:hidden flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium mb-3"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back to Findings List</span>
          </button>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${meta.badgeBg}`}>
              <TypeIcon className="w-3.5 h-3.5" />
              {meta.label}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
              {finding.systemArea}
            </span>
          </div>

          {/* Confidence Badge */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Confidence:</span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full border font-bold ${
                finding.confidence === 'HIGH'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : finding.confidence === 'MEDIUM'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              {finding.confidence === 'HIGH' && 'High — Clear Evidence'}
              {finding.confidence === 'MEDIUM' && 'Medium — Needs Estimator Review'}
              {finding.confidence === 'LOW' && 'Low — Incomplete Evidence'}
            </span>
          </div>
        </div>

        <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-snug">
          {finding.title}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {meta.desc}
        </p>

        {/* HUMAN-IN-THE-LOOP Decision Action Bar */}
        <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Estimator Decision
            </span>
            <span className="text-[11px] text-slate-500">
              Keyboard shortcuts: <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px]">A</kbd> Accept, <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px]">R</kbd> Reject, <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px]">L</kbd> Later
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Accept Button */}
            <button
              onClick={() => onAccept(finding.id)}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-semibold transition-all shadow-xs ${
                finding.status === 'ACCEPTED'
                  ? 'bg-emerald-600 border-emerald-700 text-white shadow-sm ring-2 ring-emerald-400/40'
                  : 'bg-white hover:bg-emerald-50 border-slate-300 hover:border-emerald-400 text-slate-700 hover:text-emerald-900'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 ${finding.status === 'ACCEPTED' ? 'text-white' : 'text-emerald-600'}`} />
              <span>Accept (Scope Gap)</span>
            </button>

            {/* Reject Button */}
            <button
              onClick={() => onReject(finding.id)}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-semibold transition-all shadow-xs ${
                finding.status === 'REJECTED'
                  ? 'bg-slate-800 border-slate-900 text-white shadow-sm ring-2 ring-slate-400/40'
                  : 'bg-white hover:bg-slate-100 border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900'
              }`}
            >
              <XCircle className={`w-4 h-4 ${finding.status === 'REJECTED' ? 'text-white' : 'text-slate-600'}`} />
              <span>Reject (Non-Issue)</span>
            </button>

            {/* Review Later Button */}
            <button
              onClick={() => onReviewLater(finding.id)}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-semibold transition-all shadow-xs ${
                finding.status === 'REVIEW_LATER'
                  ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-sm ring-2 ring-amber-300/40'
                  : 'bg-white hover:bg-amber-50 border-slate-300 hover:border-amber-400 text-slate-700 hover:text-amber-900'
              }`}
            >
              <Clock className={`w-4 h-4 ${finding.status === 'REVIEW_LATER' ? 'text-slate-950' : 'text-amber-600'}`} />
              <span>Review Later</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Body Section */}
      <div className="p-4 md:p-6 space-y-5">
        {/* Finding Plain Explanation */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
            <span>Finding Explanation</span>
            <span className="text-[11px] text-slate-400 font-mono">Junior Estimator Scope Check</span>
          </div>
          <p className="text-sm leading-relaxed text-slate-800 font-medium">
            {finding.explanation}
          </p>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <strong className="text-slate-800 font-semibold">Why this was flagged:</strong> {finding.confidenceRationale}
          </div>
        </div>

        {/* Evidence Sources Overview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileSearch className="w-4 h-4 text-amber-600" />
              Verified Document Evidence (Anti-Hallucination)
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Click either card to inspect in document reader below
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Source A: Specification */}
            <div 
              onClick={() => onChangePreferredView('specification')}
              className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
                preferredView === 'specification'
                  ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                  : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 truncate">
                    Source A: Specification
                  </span>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
                  Page {finding.sourceA.pageNumber}
                </span>
              </div>

              <div className="text-xs text-slate-600 font-medium mb-1 truncate">
                {finding.sourceA.documentName}
              </div>
              <div className="text-xs text-slate-800 font-bold mb-2">
                Section {finding.sourceA.sectionNumber} ({finding.sourceA.location})
              </div>

              <div className="bg-amber-50/60 rounded-lg p-3 text-xs text-slate-900 font-sans border-l-3 border-amber-500 leading-relaxed italic">
                "{finding.sourceA.highlightSnippet || finding.sourceA.relevantText}"
              </div>
            </div>

            {/* Source B: Drawing */}
            <div 
              onClick={() => onChangePreferredView('drawing')}
              className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
                preferredView === 'drawing'
                  ? 'bg-sky-50/70 border-sky-300 shadow-xs'
                  : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Layers className="w-4 h-4 text-sky-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 truncate">
                    Source B: Drawing
                  </span>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-200 shrink-0">
                  Sheet {finding.sourceB.sheetNumber}
                </span>
              </div>

              <div className="text-xs text-slate-600 font-medium mb-1 truncate">
                {finding.sourceB.documentName}
              </div>
              <div className="text-xs text-slate-800 font-bold mb-2">
                Sheet {finding.sourceB.sheetNumber} ({finding.sourceB.location})
              </div>

              <div className="bg-sky-50/60 rounded-lg p-3 text-xs text-slate-900 font-sans border-l-3 border-sky-500 leading-relaxed italic">
                "{finding.sourceB.highlightSnippet || finding.sourceB.relevantText}"
              </div>
            </div>
          </div>
        </div>

        {/* Live Document Page Viewer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Live Document Context (Page Preview)
            </span>
            <span className="text-[11px] text-slate-500">
              Verified quotes are highlighted in yellow on the document page
            </span>
          </div>

          <div className="h-[480px] rounded-xl overflow-hidden shadow-2xs border border-slate-200">
            <SourceViewer
              project={project}
              activeFinding={finding}
              preferredView={preferredView}
              onChangePreferredView={onChangePreferredView}
            />
          </div>
        </div>

        {/* Estimator Notes Section */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Estimator Internal Notes / RFI Tracking
            </span>
            {isSaved && (
              <span className="text-xs text-emerald-600 font-bold">
                ✓ Saved to project!
              </span>
            )}
          </div>

          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleSaveNotes}
            placeholder="Write scope remarks, proposal exclusions, or RFI text (e.g. 'Draft RFI 14: Confirm if specimen refrigeration requires emergency panel connection. Exclude feed in current base bid.')..."
            className="w-full bg-slate-50 text-xs text-slate-900 placeholder-slate-400 rounded-lg border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 leading-relaxed font-sans"
          />

          <div className="flex justify-end mt-2">
            <button
              onClick={handleSaveNotes}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors shadow-2xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Note</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

