import React, { useState } from 'react';
import { Project, Finding, FindingType, FindingStatus } from '../types';
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
  ExternalLink,
  Upload
} from 'lucide-react';

interface StudioBuildHomeProps {
  project: Project;
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

export const StudioBuildHome: React.FC<StudioBuildHomeProps> = ({
  project,
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

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promptInput.trim()) return;
    const q = promptInput;
    setPromptInput('');
    onSendMessage(q);
    onOpenPlayground();
  };

  const handleFeelingLucky = () => {
    const luckyPrompts = [
      "Check AHU-1 feeder ampacity and disconnect coordination on E2.1",
      "Verify copper vs aluminum busbar specifications in Section 26 24 16",
      "Audit emergency generator fuel storage requirements against site plans",
      "Identify daylight harvesting sensor specifications missing from drawings"
    ];
    const picked = luckyPrompts[Math.floor(Math.random() * luckyPrompts.length)];
    setPromptInput(picked);
  };

  const quickPills = [
    { label: 'Single-Line Diagrams (E1.1)', icon: Zap, query: 'Review single-line diagram feeder ratings and disconnects on sheet E1.1' },
    { label: 'Panel Schedules (E2.1)', icon: Layers, query: 'Check panel schedule bus ratings and neutral sizing on sheet E2.1' },
    { label: 'Division 26 Specifications', icon: FileText, query: 'Cross-reference Division 26 spec requirements against drawing sheets' },
    { label: 'Missing Disconnect Switches', icon: AlertCircle, query: 'Identify mechanical equipment lacking local electrical disconnects' },
    { label: 'Generator & Emergency Fuel', icon: Flame, query: 'Review 72-hour fuel storage tank specs vs mechanical site drawings' },
  ];

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
        <div className="w-full flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          {quickPills.map((pill, idx) => {
            const Icon = pill.icon;
            return (
              <button
                key={idx}
                onClick={() => {
                  setPromptInput(pill.query);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs whitespace-nowrap transition-colors font-medium text-xs"
              >
                <Icon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{pill.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scope Findings Gallery Section (from screenshot bottom) */}
        <div className="w-full pt-6 space-y-4">
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
            <div className="w-full bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-2xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">Documents Loaded — Ready for Scope Check</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {project.documents.length} document(s) uploaded. Click "Run Scope Check" to cross-reference drawing sheets against Division 26 specifications.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenPlayground}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors shadow-2xs"
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

      </div>
    </div>
  );
};
