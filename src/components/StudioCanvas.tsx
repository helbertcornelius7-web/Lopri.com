import React, { useState, useRef, useEffect } from 'react';
import { Project, Finding, FindingStatus, ChatMessage, PdfContextFile } from '../types';
import { 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  FileText, 
  Layers, 
  ExternalLink,
  CornerDownLeft,
  Save,
  Check,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  FileCheck2
} from 'lucide-react';

interface StudioCanvasProps {
  project: Project;
  activeFinding: Finding | null;
  onAccept: (findingId: string) => void;
  onReject: (findingId: string) => void;
  onReviewLater: (findingId: string) => void;
  onUpdateNotes: (findingId: string, notes: string) => void;
  onInspectEvidence: (docName: string, pageNum: number, view: 'specification' | 'drawing') => void;
  chatMessages: ChatMessage[];
  onSendMessage: (query: string) => Promise<void>;
  isChatLoading: boolean;
  activePdf?: PdfContextFile | null;
  pdfFiles?: PdfContextFile[];
}

export const StudioCanvas: React.FC<StudioCanvasProps> = React.memo(({
  project,
  activeFinding,
  onAccept,
  onReject,
  onReviewLater,
  onUpdateNotes,
  onInspectEvidence,
  chatMessages,
  onSendMessage,
  isChatLoading,
  activePdf,
  pdfFiles = [],
}) => {
  const [isSystemPromptOpen, setIsSystemPromptOpen] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [notes, setNotes] = useState(activeFinding?.estimatorNotes || '');
  const [isSavedNotes, setIsSavedNotes] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotes(activeFinding?.estimatorNotes || '');
    setIsSavedNotes(false);
  }, [activeFinding?.id, activeFinding?.estimatorNotes]);

  const handleSaveNotes = () => {
    if (activeFinding) {
      onUpdateNotes(activeFinding.id, notes);
      setIsSavedNotes(true);
      setTimeout(() => setIsSavedNotes(false), 2000);
    }
  };

  const handlePromptSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promptInput.trim() || isChatLoading) return;
    const query = promptInput;
    setPromptInput('');
    onSendMessage(query);
  };

  const samplePrompts = [
    "What does the specification say about emergency power?",
    "Where is AHU-1 fed from according to drawing E2.1?",
    "What is the required bus material and neutral size in 26 24 16?",
    "Which spec section covers daylight harvesting sensors?"
  ];

  const getTypeMeta = (type?: string) => {
    switch (type) {
      case 'SCOPE_GAP':
        return {
          label: 'Potential Scope Gap',
          icon: AlertCircle,
          badge: 'bg-rose-50 text-rose-800 border-rose-200',
        };
      case 'CONFLICT':
        return {
          label: 'Potential Conflict',
          icon: AlertTriangle,
          badge: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'MISSING_REFERENCE':
        return {
          label: 'Missing Reference',
          icon: HelpCircle,
          badge: 'bg-orange-50 text-orange-800 border-orange-200',
        };
      default:
        return {
          label: 'Scope Finding',
          icon: AlertTriangle,
          badge: 'bg-slate-100 text-slate-800 border-slate-200',
        };
    }
  };

  const activeMeta = activeFinding ? getTypeMeta(activeFinding.type) : null;
  const ActiveIcon = activeMeta ? activeMeta.icon : AlertTriangle;

  return (
    <main className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden relative">
      {/* Scrollable Playground Canvas Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 space-y-5 pb-36">
        {/* Google AI Studio Signature: Collapsible System Instructions */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all">
          <div
            onClick={() => setIsSystemPromptOpen(!isSystemPromptOpen)}
            className="p-3 bg-slate-50/70 hover:bg-slate-100/70 flex items-center justify-between cursor-pointer text-xs font-semibold text-slate-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-mono text-[11px] font-bold border border-amber-200">
                System Instructions
              </span>
              <span className="text-slate-500 font-normal truncate max-w-md hidden sm:inline">
                Electrical Estimator Persona • Specification Cross-Check Grounding Mandate
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <span className="text-[11px] hidden sm:inline">
                {isSystemPromptOpen ? 'Collapse' : 'Expand'}
              </span>
              {isSystemPromptOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {isSystemPromptOpen && (
            <div className="p-4 border-t border-slate-200 bg-white font-mono text-xs text-slate-700 leading-relaxed space-y-2">
              <p>
                <strong>Role:</strong> Cautious Senior Electrical Estimator AI.
              </p>
              <p>
                <strong>Mandate:</strong> Cross-reference Division 26 electrical specifications against drawing sheets, single-line diagrams, and equipment schedules. Flag uncoordinated ratings, omitted disconnect switches, and conflicting conductor specifications.
              </p>
              <p className="text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 text-[11px]">
                <strong>Anti-Hallucination Policy:</strong> Every finding and answer must be strictly substantiated with exact document filenames and page numbers. If an item is unrepresented in drawings, report it as a potential scope gap.
              </p>
            </div>
          )}
        </div>

        {/* Selected Finding Active Turn / Inspection Card */}
        {activeFinding ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-0">
            {/* Card Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${activeMeta?.badge}`}>
                    <ActiveIcon className="w-3.5 h-3.5" />
                    <span>{activeMeta?.label}</span>
                  </span>
                  <span className="text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {activeFinding.systemArea}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Confidence:</span>
                  <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {activeFinding.confidence}
                  </span>
                </div>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-slate-950 leading-snug">
                {activeFinding.title}
              </h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {activeFinding.confidenceRationale}
              </p>
            </div>

            {/* AI Discrepancy Explanation */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-white space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                AI Scope Analysis & Estimating Impact
              </div>
              <p className="text-xs text-slate-800 leading-relaxed font-sans">
                {activeFinding.explanation}
              </p>
            </div>

            {/* Grounded Evidence Comparison Cards */}
            <div className="p-4 sm:p-5 bg-slate-50/30 grid grid-cols-1 md:grid-cols-2 gap-3.5 border-b border-slate-200">
              {/* Source A: Specification */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <FileText className="w-3.5 h-3.5 text-amber-600" />
                      <span>Source A: Specification</span>
                    </div>
                    {activeFinding.sourceA && (
                      <button
                        onClick={() => onInspectEvidence(activeFinding.sourceA?.documentName || '', activeFinding.sourceA?.pageNumber || 1, 'specification')}
                        className="text-[10px] text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Inspect in Evidence Panel"
                      >
                        <span>View in Doc</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mb-2">
                    {activeFinding.sourceA?.documentName || 'Specification Document'} • Section {activeFinding.sourceA?.sectionNumber || 'N/A'} • Page {activeFinding.sourceA?.pageNumber || 1}
                  </div>
                  <blockquote className="text-xs text-slate-800 bg-amber-50/40 p-2.5 rounded-lg border-l-2 border-amber-500 font-mono leading-relaxed">
                    "{activeFinding.sourceA?.relevantText || 'No specific excerpt recorded.'}"
                  </blockquote>
                </div>
                <div className="pt-2 text-[10px] text-slate-400 font-mono">
                  Location: {activeFinding.sourceA?.location || 'Section Spec Body'}
                </div>
              </div>

              {/* Source B: Drawing */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
                      <Layers className="w-3.5 h-3.5 text-sky-600" />
                      <span>Source B: Drawing Plan / Schedule</span>
                    </div>
                    {activeFinding.sourceB && (
                      <button
                        onClick={() => onInspectEvidence(activeFinding.sourceB?.documentName || '', activeFinding.sourceB?.pageNumber || 1, 'drawing')}
                        className="text-[10px] text-sky-700 hover:text-sky-900 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Inspect in Evidence Panel"
                      >
                        <span>View in Doc</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mb-2">
                    {activeFinding.sourceB?.documentName || 'Drawing Document'} • Sheet {activeFinding.sourceB?.sheetNumber || 'N/A'} • Page {activeFinding.sourceB?.pageNumber || 1}
                  </div>
                  <blockquote className="text-xs text-slate-800 bg-sky-50/40 p-2.5 rounded-lg border-l-2 border-sky-500 font-mono leading-relaxed">
                    "{activeFinding.sourceB?.relevantText || 'No specific drawing schedule excerpt recorded.'}"
                  </blockquote>
                </div>
                <div className="pt-2 text-[10px] text-slate-400 font-mono">
                  Location: {activeFinding.sourceB?.location || 'Drawing Plan'}
                </div>
              </div>
            </div>

            {/* Estimator Decision & Notes Bar */}
            <div className="p-4 sm:p-5 bg-white space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-bold text-slate-800">
                  Estimator Verification Action:
                </div>

                {/* Status Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAccept(activeFinding.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFinding.status === 'ACCEPTED'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept (Scope Impact)</span>
                  </button>

                  <button
                    onClick={() => onReviewLater(activeFinding.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFinding.status === 'REVIEW_LATER'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Review Later (RFI)</span>
                  </button>

                  <button
                    onClick={() => onReject(activeFinding.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeFinding.status === 'REJECTED'
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject / Ignore</span>
                  </button>
                </div>
              </div>

              {/* Estimator Notes Field */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Estimator Notes / RFI Clarification:</span>
                  {isSavedNotes && (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Saved to scope log
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    placeholder="Enter bid clarification note, pricing adjustment tag, or question for the engineer..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="flex-1 text-xs bg-slate-50 rounded-lg p-2.5 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-sans"
                  />
                  <button
                    onClick={handleSaveNotes}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 flex flex-col items-center justify-center gap-1 transition-colors self-stretch shrink-0"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 space-y-3">
            <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">
              Ready to Cross-Check
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {project.documents.length === 0
                ? 'Upload electrical drawings and Division 26 specification PDFs using the "Upload PDFs" button in the top bar to begin automated scope checking.'
                : 'Select any finding from the left sidebar to inspect verified discrepancies, or ask a question in the prompt box below.'}
            </p>
          </div>
        )}

        {/* Conversational Turns / Prompt Queries Stream */}
        {chatMessages.length > 0 && (
          <div className="space-y-4 pt-3 border-t border-slate-200/80">
            <div className="flex items-center justify-between px-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Grounded Inquiries Stream ({chatMessages.length})
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <FileCheck2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>PDF Context: {activePdf?.name || (pdfFiles.length > 0 ? pdfFiles[0].name : 'Active Specifications')}</span>
              </div>
            </div>

            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[95%] sm:max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-2xs ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white rounded-br-xs font-medium'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5 text-[10px] text-slate-400 font-mono">
                    <span>{msg.role === 'user' ? 'User Prompt' : 'Lopri AI Grounded Response'}</span>
                    <span>•</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Document Citations Pills */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Verified Document Citations:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((c, idx) => {
                          const isDwg = /drawing|sheet|e\d/i.test(c.documentName) || !!c.sheetOrSection;
                          return (
                            <button
                              key={idx}
                              onClick={() => onInspectEvidence(c.documentName, c.pageNumber, isDwg ? 'drawing' : 'specification')}
                              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
                            >
                              {isDwg ? (
                                <Layers className="w-3 h-3 text-sky-600 shrink-0" />
                              ) : (
                                <FileText className="w-3 h-3 text-amber-600 shrink-0" />
                              )}
                              <span className="font-semibold">{c.documentName}</span>
                              <span className="text-slate-500">p.{c.pageNumber}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="bg-white border border-slate-200 text-slate-600 p-3.5 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs max-w-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                <span>Checking indexed drawings and specs...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Google AI Studio Iconic Floating Bottom Prompt Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent pt-4 pb-4 px-4 sm:px-8 pointer-events-none z-20">
        <div className="max-w-4xl mx-auto space-y-2 pointer-events-auto">
          {/* Quick Prompt Suggestions Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Suggestions:
            </span>
            {samplePrompts.map((sp, i) => (
              <button
                key={i}
                onClick={() => {
                  setPromptInput(sp);
                }}
                className="bg-white/90 hover:bg-white text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-full text-[11px] border border-slate-200 shadow-2xs whitespace-nowrap transition-colors"
              >
                {sp}
              </button>
            ))}
          </div>

          {/* Prompt Form */}
          <form
            onSubmit={handlePromptSubmit}
            className="bg-white rounded-2xl border border-slate-300 shadow-lg p-2 sm:p-2.5 flex items-center gap-2 transition-all focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20"
          >
            <div className="pl-2 text-slate-400">
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>

            <input
              type="text"
              placeholder="Ask a question about project drawings & specs, or enter a prompt (e.g. 'Check AHU-1 feeder size')..."
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              className="flex-1 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none font-sans px-1"
            />

            {/* Run Button (AI Studio Signature Style) */}
            <button
              type="submit"
              disabled={!promptInput.trim() || isChatLoading}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold disabled:opacity-40 transition-all flex items-center gap-1.5 shrink-0 shadow-2xs"
              title="Run Prompt (Enter)"
            >
              <span>Run</span>
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </main>
  );
});
