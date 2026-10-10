import React, { useState, useMemo } from 'react';
import { Project, Finding, FindingType, FindingStatus } from '../types';
import { FeedbackButton } from './FeedbackButton';
import { 
  Sparkles, 
  Plus, 
  Mic, 
  CornerDownLeft, 
  ArrowRight, 
  FileText, 
  Layers, 
  AlertCircle, 
  AlertTriangle, 
  HelpCircle, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Zap,
  Flame,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Upload,
  Trash2,
  Folder,
  Play
} from 'lucide-react';
import { getSampleInquiryChips, getLuckyPrompts, InquiryChip } from '../utils/projectSheets';

interface StudioBuildHomeProps {
  project: Project;
  onRequestDeleteProject?: (project: Project) => void;
  onSelectFinding: (finding: Finding) => void;
  onOpenPlayground: () => void;
  onOpenUpload: () => void;
  onRunScopeCheck: () => void;
  onSendMessage: (query: string) => Promise<void>;
  isAnalyzing: boolean;
  onAcceptFinding: (id: string) => void;
  onRejectFinding: (id: string) => void;
  onReviewLaterFinding: (id: string) => void;
}

export const StudioBuildHome: React.FC<StudioBuildHomeProps> = React.memo(({
  project,
  onRequestDeleteProject,
  onSelectFinding,
  onOpenPlayground,
  onOpenUpload,
  onRunScopeCheck,
  onSendMessage,
  isAnalyzing,
  onAcceptFinding,
  onRejectFinding,
  onReviewLaterFinding,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showAnalysisDetails, setShowAnalysisDetails] = useState(true);

  const hasCompletedAnalysis = Boolean(
    project.processingSteps[4]?.status === 'completed' ||
    project.candidatesFromModel !== undefined ||
    project.pagesSentSpec !== undefined ||
    (project.rejected && project.rejected.length > 0)
  );
  const allProjectPages = useMemo(
    () => project.documents.flatMap((d) => d.pages || []),
    [project.documents]
  );
  const emptyPagesCount = useMemo(
    () => allProjectPages.filter((p) => p.extractionStatus === 'empty').length,
    [allProjectPages]
  );
  const unreadableCount = emptyPagesCount;
  const allPagesOk = allProjectPages.length > 0 && emptyPagesCount === 0;
  const candidatesCount = project.candidatesFromModel ?? 0;
  const rejectedList = project.rejected || [];
  const hasRejected = rejectedList.length > 0;
  const hasUnreadable = unreadableCount > 0;
  const isHonestNoDiscrepancies = candidatesCount === 0 && unreadableCount === 0;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promptInput.trim()) return;
    const q = promptInput;
    setPromptInput('');
    onSendMessage(q);
    onOpenPlayground();
  };

  const sampleInquiryChips = useMemo(() => getSampleInquiryChips(project), [project]);
  const luckyPrompts = useMemo(() => getLuckyPrompts(project), [project]);

  const handleFeelingLucky = () => {
    if (luckyPrompts.length === 0) return;
    const picked = luckyPrompts[Math.floor(Math.random() * luckyPrompts.length)];
    setPromptInput(picked);
  };

  const iconMap: Record<InquiryChip['iconName'], React.ComponentType<{ className?: string }>> = {
    Zap,
    Layers,
    FileText,
    AlertCircle,
    Flame,
  };

  const getTypeMeta = (type: FindingType) => {
    switch (type) {
      case 'SCOPE_GAP':
        return {
          label: 'Scope Gap',
          icon: AlertCircle,
          color: 'text-rose-600',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      case 'CONFLICT':
        return {
          label: 'Conflict',
          icon: AlertTriangle,
          color: 'text-amber-600',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'MISSING_REFERENCE':
        return {
          label: 'Missing Ref',
          icon: HelpCircle,
          color: 'text-orange-600',
          bg: 'bg-orange-50 text-orange-700 border-orange-200',
        };
      case 'DOCUMENT_CONFLICT':
        return {
          label: 'Discrepancy',
          icon: AlertTriangle,
          color: 'text-amber-600',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      default:
        return {
          label: 'Scope Finding',
          icon: AlertTriangle,
          color: 'text-amber-600',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
        };
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50 flex flex-col items-center select-none px-4 sm:px-6 py-10 lg:py-14">
      {/* Container matching Google AI Studio Build width */}
      <div className="w-full max-w-4xl flex flex-col items-center space-y-7">
        
        {/* Hero Title with Diamond Star (Google AI Studio visual layout with Electrical domain words) */}
        <div className="flex flex-col items-center gap-2 text-center justify-center">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-normal tracking-tight text-slate-900 font-sans">
              Cross-check electrical drawings & specs
            </h1>
            {/* 4-point diamond outline star from Google AI Studio layout */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500"
              >
                <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
              </svg>
            </div>
          </div>
          <p className="text-sm sm:text-base text-slate-500 max-w-2xl font-normal">
            Identify scope gaps, missing disconnects, and feeder discrepancies across Division 26 documents
          </p>
        </div>

        {/* Large Iconic Google AI Studio Input Box with Glowing Border */}
        <div className="w-full relative group">
          {/* Subtle multi-accent gradient glow ring around the prompt box */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-400 via-rose-400 to-sky-400 rounded-3xl blur-[2px] opacity-40 group-hover:opacity-75 transition duration-300" />

          <form
            onSubmit={handleSubmit}
            className="relative w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4"
          >
            {/* Top Textarea */}
            <textarea
              rows={3}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask a scope inquiry, cross-check Division 26 specifications against drawing sheets, or search electrical equipment tags..."
              className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder-slate-400 focus:outline-none resize-none font-sans leading-relaxed"
            />

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between pt-2">
              {/* Left action: (+) upload/attach PDF */}
              <button
                type="button"
                onClick={onOpenUpload}
                className="w-8 h-8 rounded-full border border-slate-300 hover:border-slate-400 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors shadow-2xs"
                title="Upload drawings or specification PDFs"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* Right actions: Mic + "Sample scope inquiries" / "Run Scope Check" */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsListening(!isListening)}
                  className={`p-2 rounded-full transition-colors ${
                    isListening
                      ? 'bg-rose-100 text-rose-600'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                  title="Voice inquiry"
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* Sample Prompts button */}
                <button
                  type="button"
                  onClick={handleFeelingLucky}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 border border-slate-200"
                  title="Insert a sample electrical estimating prompt"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>Sample inquiries</span>
                </button>

                {/* Primary Submit Button */}
                <button
                  type="submit"
                  disabled={!promptInput.trim()}
                  className="px-4 py-1.5 rounded-full text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-2xs"
                >
                  <span>Run Check</span>
                  <CornerDownLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Quick Suggestion Pills Row (Exact Google AI Studio pill style) */}
        {sampleInquiryChips.length > 0 && (
          <div className="w-full flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
            {sampleInquiryChips.map((chip, idx) => {
              const Icon = iconMap[chip.iconName] || FileText;
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setPromptInput(chip.query);
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs whitespace-nowrap transition-colors font-medium text-xs"
                >
                  <Icon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Project Management Banner */}
        {project.id && project.documents.length > 0 && (
          <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0">
                <Folder className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                    {project.name}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Active
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {project.documents.length} PDF package(s) • {project.findings.length} findings
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={onOpenUpload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                title="Upload more documents to this project"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload More</span>
              </button>

              {onRequestDeleteProject && (
                <button
                  type="button"
                  onClick={() => onRequestDeleteProject(project)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                  title="Delete this project"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Delete Project</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scope Findings Gallery Section (from screenshot bottom) */}
        <div className="w-full pt-4 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base sm:text-lg font-normal text-slate-900">
              Identified Scope Discrepancies & Findings
            </h2>
            <button
              onClick={onOpenPlayground}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors shadow-2xs"
            >
              <span>Open in Review Canvas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Gallery Cards Grid or Empty State */}
          {project.documents.length === 0 ? (
            <div className="w-full bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-10 text-center space-y-4 shadow-2xs">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-900">Upload Drawings & Specifications</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Upload your electrical drawing sheets (single-line diagrams, lighting plans, equipment schedules) and Division 26 specifications to begin automated scope checking.
                </p>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-2xs transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Drawings & Specifications (PDF)</span>
                </button>
              </div>
            </div>
          ) : project.findings.length === 0 ? (
            <div className="w-full bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-2xs">
              {!hasCompletedAnalysis ? (
                <>
                  <FileText className="w-8 h-8 text-amber-500 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Documents Loaded — Ready for Scope Check
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {project.documents.length} document(s) uploaded. Click &ldquo;Run Scope Check&rdquo; in the top bar to cross-reference drawing sheets against Division 26 specifications.
                  </p>
                </>
              ) : hasRejected ? (
                <>
                  <AlertTriangle className="w-9 h-9 text-amber-500 mx-auto" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                      Inconclusive Grounding
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 pt-1">
                      Inconclusive: {rejectedList.length} candidate{rejectedList.length === 1 ? '' : 's'} could not be verified
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
                    The cross-check model flagged potential scope issues, but verbatim evidence quotes could not be verified on cited pages or relocated elsewhere in the project documents. To eliminate AI hallucinations, these items are withheld from verified findings.
                  </p>
                  {hasUnreadable && (
                    <div className="text-[11px] text-amber-800 bg-amber-50 rounded-lg py-1.5 px-3 max-w-md mx-auto border border-amber-200">
                      Partial check: {unreadableCount} page{unreadableCount === 1 ? '' : 's'} could not be read.
                    </div>
                  )}

                  {/* Rejected Details List */}
                  <div className="w-full max-w-xl mx-auto text-left mt-3 bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2">
                    <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Unverified Candidate Details ({rejectedList.length})</span>
                      <span className="text-[10px] text-slate-500 font-mono">Requires Estimator Audit</span>
                    </div>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {rejectedList.map((item, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs flex flex-col gap-1">
                          <div className="font-semibold text-slate-900">{item.title}</div>
                          <div className="text-[11px] text-rose-700 font-mono bg-rose-50/70 p-1.5 rounded border border-rose-100">
                            {item.reason}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : hasUnreadable ? (
                <>
                  <AlertCircle className="w-9 h-9 text-amber-500 mx-auto" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                      Incomplete Document Coverage
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 pt-1">
                      Partial check: {unreadableCount} page{unreadableCount === 1 ? '' : 's'} could not be read
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                    Some document pages contained unextractable text or raster images without OCR layers. Only readable pages were evaluated, so full cross-check completeness cannot be guaranteed.
                  </p>
                </>
              ) : isHonestNoDiscrepancies ? (
                <>
                  <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Full Coverage Verified
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 pt-1">
                      No discrepancies detected
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                    All uploaded drawing sheets and specification sections were read (0 unreadable pages) and 0 candidate discrepancies were detected by the model.
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className="w-9 h-9 text-amber-500 mx-auto" />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                      Inconclusive Grounding
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 pt-1">
                      Inconclusive: {candidatesCount} candidate{candidatesCount === 1 ? '' : 's'} could not be verified
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                    Model candidates could not be verified against cited document pages.
                  </p>
                </>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={onRunScopeCheck}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  <span>{isAnalyzing ? 'Running Scope Check...' : 'Run Scope Check'}</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenPlayground}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 cursor-pointer"
                >
                  <span>Open Review Canvas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 w-full">
              {project.findings.map((finding) => {
                const meta = getTypeMeta(finding.type);
                const Icon = meta.icon;

                return (
                  <div
                    key={finding.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between group cursor-pointer"
                    onClick={() => {
                      onSelectFinding(finding);
                      onOpenPlayground();
                    }}
                  >
                    <div className="space-y-2">
                      {/* Header: Type tag & System Area */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1 ${meta.bg}`}>
                          <Icon className="w-2.5 h-2.5 shrink-0" />
                          <span>{meta.label}</span>
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          Confidence: {finding.confidence}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-800 transition-colors line-clamp-1">
                        {finding.title}
                      </h3>

                      {/* Short excerpt */}
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {finding.explanation}
                      </p>

                      {/* Citations Preview Box */}
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px] space-y-1 font-mono text-slate-600">
                        <div className="flex items-center gap-1 text-amber-800">
                          <FileText className="w-3 h-3 text-amber-600" />
                          <span className="truncate">{finding.sourceA.documentName} (p.{finding.sourceA.pageNumber})</span>
                        </div>
                        <div className="flex items-center gap-1 text-sky-800">
                          <Layers className="w-3 h-3 text-sky-600" />
                          <span className="truncate">{finding.sourceB.documentName} (p.{finding.sourceB.pageNumber})</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer status & inspector button */}
                    <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className={`font-semibold text-[11px] px-2 py-0.5 rounded border ${
                        finding.status === 'ACCEPTED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : finding.status === 'REVIEW_LATER'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : finding.status === 'REJECTED'
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}>
                        {finding.status}
                      </span>

                      <span className="text-amber-700 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1 text-xs">
                        <span>Inspect Evidence</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Analysis Details Section on Scope Overview Tab */}
        {project.id && project.documents.length > 0 && (
          <div className="w-full bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Analysis details</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAnalysisDetails((prev) => !prev)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>{showAnalysisDetails ? 'Hide Details' : 'Show Details'}</span>
                {showAnalysisDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showAnalysisDetails && (
              <div className="space-y-4 pt-1">
                {/* 5 Diagnostics Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Spec Pages Sent (Pages)
                    </div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5">
                      {project.pagesSentSpec ?? 0}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Drawing Pages Sent (Pages)
                    </div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5">
                      {project.pagesSentDrawings ?? 0}
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${
                    unreadableCount > 0
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-slate-50 border-slate-200/80 text-slate-900'
                  }`}>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Unreadable Pages
                    </div>
                    <div className={`text-lg font-bold mt-0.5 ${unreadableCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                      {unreadableCount}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Candidates From Model
                    </div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5">
                      {project.candidatesFromModel ?? (project.findings.length + rejectedList.length)}
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${
                    hasRejected
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-slate-50 border-slate-200/80 text-slate-900'
                  }`}>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Rejected Candidates
                    </div>
                    <div className={`text-lg font-bold mt-0.5 ${hasRejected ? 'text-rose-700' : 'text-slate-900'}`}>
                      {rejectedList.length}
                    </div>
                  </div>
                </div>

                {/* Uploaded Documents Breakdown */}
                {project.documents.length > 0 && (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                    <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>Uploaded Documents Analysis ({project.documents.length})</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        Per-page extraction diagnostics
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider bg-slate-100/60">
                            <th className="py-2 px-3">Document Name</th>
                            <th className="py-2 px-3">Category</th>
                            <th className="py-2 px-3 text-center">Page Count</th>
                            <th className="py-2 px-3 text-center">Pages 'ok'</th>
                            <th className="py-2 px-3">First 3 Pages Char Length</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70">
                          {project.documents.map((doc) => {
                            const okCount = (doc.pages || []).filter((p) => p.extractionStatus === 'ok').length;
                            const first3Pages = (doc.pages || []).slice(0, 3);
                            return (
                              <tr key={doc.id} className="hover:bg-white/80 transition-colors">
                                <td className="py-2 px-3 font-semibold text-slate-800 max-w-xs truncate" title={doc.name}>
                                  {doc.name}
                                </td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                                      doc.category === 'specification'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                                    }`}
                                  >
                                    {doc.category}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center font-mono font-medium text-slate-700">
                                  {doc.pageCount || doc.pages?.length || 1}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span
                                    className={`inline-flex items-center gap-1 font-mono font-semibold ${
                                      okCount === (doc.pageCount || doc.pages?.length || 1)
                                        ? 'text-emerald-700'
                                        : okCount > 0
                                        ? 'text-amber-700'
                                        : 'text-rose-700'
                                    }`}
                                  >
                                    {okCount} / {doc.pageCount || doc.pages?.length || 1}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                                  {first3Pages.length > 0 ? (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {first3Pages.map((p, idx) => (
                                        <span
                                          key={p.pageNumber || idx + 1}
                                          className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]"
                                          title={`Page ${p.pageNumber || idx + 1}: ${(p.text || '').length} characters`}
                                        >
                                          P{p.pageNumber || idx + 1}: <span className="font-semibold text-slate-800">{(p.text || '').length}</span> chars
                                        </span>
                                      ))}
                                      {doc.pages && doc.pages.length > 3 && (
                                        <span className="text-[10px] text-slate-400">+{doc.pages.length - 3} more</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">None</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Rejected Candidates Breakdown */}
                {hasRejected && (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2">
                    <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Rejected Candidates Log ({rejectedList.length})</span>
                      <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-semibold">
                        Verbatim Check Failed
                      </span>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {rejectedList.map((item, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs flex flex-col gap-1">
                          <div className="font-semibold text-slate-900">{item.title}</div>
                          <div className="text-[11px] text-rose-700 font-mono bg-rose-50/70 p-1.5 rounded border border-rose-100">
                            {item.reason}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audit Integrity Status */}
                {allPagesOk && hasCompletedAnalysis ? (
                  <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1.5 pt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>
                      {isHonestNoDiscrepancies
                        ? 'Fully verified cross-check: 100% of uploaded pages readable, 0 discrepancies detected.'
                        : `Fully verified cross-check: 100% of uploaded pages readable, ${project.findings.length} finding(s) verified.`}
                    </span>
                  </div>
                ) : emptyPagesCount > 0 ? (
                  <div className="text-[11px] text-rose-700 font-medium flex items-center gap-1.5 pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>Text extraction failed for {emptyPagesCount} page{emptyPagesCount === 1 ? '' : 's'}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>All {allProjectPages.length} pages extracted. Click &ldquo;Run Scope Check&rdquo; to start AI cross-check analysis.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* User Feedback Callout (Tally Integration) */}
        <div className="w-full mt-8 p-4 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0">
              💡
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Give your feedback & suggestions</h4>
              <p className="text-xs text-slate-500">Help us improve the Electrical Scope Checker for your estimators</p>
            </div>
          </div>
          <FeedbackButton variant="default" />
        </div>

      </div>
    </div>
  );
});
