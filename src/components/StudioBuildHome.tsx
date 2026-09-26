import React, { useState } from 'react';
import { Project, Finding, FindingType, FindingStatus } from '../types';
import { usePdfProject } from '../context/PdfProjectContext';
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
  ExternalLink,
  Upload,
  Trash2,
  FolderPlus,
  Play,
  RotateCcw,
  Check
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

export const StudioBuildHome: React.FC<StudioBuildHomeProps> = React.memo(({
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
  const { uploadPdfFiles, loadSampleDemo, resetWorkspace } = usePdfProject();
  const [promptInput, setPromptInput] = useState('');
  const [isListening, setIsListening] = useState(false);

  // In-line SaaS Project Creator state (when no documents are loaded)
  const [customProjectName, setCustomProjectName] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileCategories, setFileCategories] = useState<Record<string, 'drawing' | 'specification'>>({});
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

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

  // In-line file selection handlers
  const isLikelyDrawing = (name: string) => {
    return /E\d|drawing|plan|schematic|dwg|single-line|schedule|sheet/i.test(name);
  };

  const handleAddFiles = (filesToAdd: File[]) => {
    const pdfs = filesToAdd.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) return;

    setUploadedFiles((prev) => {
      const combined = [...prev, ...pdfs];
      setFileCategories((prevCats) => {
        const next = { ...prevCats };
        combined.forEach((file, index) => {
          if (!next[file.name]) {
            if (isLikelyDrawing(file.name)) {
              next[file.name] = 'drawing';
            } else if (combined.length >= 2 && index === 0) {
              next[file.name] = 'drawing';
            } else {
              next[file.name] = 'specification';
            }
          }
        });
        return next;
      });
      return combined;
    });
  };

  const handleRemoveUploadedFile = (idx: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleToggleCategory = (fileName: string) => {
    setFileCategories((prev) => ({
      ...prev,
      [fileName]: prev[fileName] === 'drawing' ? 'specification' : 'drawing',
    }));
  };

  const handleCreateAndAnalyzeProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadedFiles.length === 0) {
      setUploadError('Please choose at least one PDF file (drawings or specifications).');
      return;
    }
    setIsUploadingFiles(true);
    setUploadError(null);
    try {
      const name = customProjectName.trim() || 'Custom Electrical Scope Project';
      await uploadPdfFiles(uploadedFiles, fileCategories, name);
      setUploadedFiles([]);
      setCustomProjectName('');
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to analyze project documents.');
    } finally {
      setIsUploadingFiles(false);
    }
  };

  const handleLoadDemo = async () => {
    setIsLoadingDemo(true);
    try {
      await loadSampleDemo();
    } catch (err) {
      console.error('Demo loading error:', err);
    } finally {
      setIsLoadingDemo(false);
    }
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

  const hasDocuments = project.documents && project.documents.length > 0;

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50 flex flex-col items-center select-none px-4 sm:px-6 py-8 lg:py-12">
      <div className="w-full max-w-4xl flex flex-col items-center space-y-7">
        
        {/* ============================================================== */}
        {/* CASE 1: FREE SAAS CLEAN WORKSPACE (No preloaded project / ready for upload) */}
        {/* ============================================================== */}
        {!hasDocuments ? (
          <div className="w-full flex flex-col items-center space-y-8 animate-fadeIn">
            {/* SaaS Hero Badge & Title */}
            <div className="flex flex-col items-center gap-3 text-center justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/80 border border-amber-300 text-amber-900 text-xs font-semibold shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                <span>100% Free Software as a Service (SaaS) • No Account Required</span>
              </div>

              <div className="flex items-center gap-3 justify-center">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-normal tracking-tight text-slate-900 font-sans">
                  Cross-check electrical drawings & specs
                </h1>
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

              <p className="text-sm sm:text-base text-slate-600 max-w-2xl font-normal leading-relaxed">
                A clean, open workspace for electrical estimators and engineers. Upload your PDF drawings and Division 26 specification books to instantly detect scope gaps, missing disconnects, and uncoordinated feeder ratings.
              </p>
            </div>

            {/* In-Line Project Upload Card */}
            <div className="w-full relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-400 via-rose-400 to-sky-400 rounded-3xl blur-[2px] opacity-40 group-hover:opacity-75 transition duration-300" />
              
              <div className="relative w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                      <FolderPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Create & Upload Your Project</h2>
                      <p className="text-xs text-slate-500">Provide a project name and attach your PDF drawings and specifications</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 font-mono hidden sm:inline">PDF Format • Up to 50MB</span>
                </div>

                {uploadError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateAndAnalyzeProject} className="space-y-4">
                  {/* Project Name Field */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Project Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Regional Medical Center - Commercial Electrical Scope"
                      value={customProjectName}
                      onChange={(e) => setCustomProjectName(e.target.value)}
                      className="w-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder-slate-400 rounded-xl border border-slate-200 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-sans transition-all"
                    />
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files) {
                        handleAddFiles(Array.from(e.dataTransfer.files));
                      }
                    }}
                    onClick={() => document.getElementById('inline-file-picker')?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer bg-slate-50/50 hover:bg-amber-50/20 group/drop"
                  >
                    <input
                      type="file"
                      id="inline-file-picker"
                      multiple
                      accept=".pdf"
                      onChange={(e) => {
                        if (e.target.files) {
                          handleAddFiles(Array.from(e.target.files));
                        }
                      }}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 mx-auto mb-3 group-hover/drop:scale-105 transition-transform">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 mb-1">
                      Click to browse or drag & drop electrical PDFs
                    </div>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Attach single-line diagrams (E1.1), panel schedules (E2.1), lighting plans, and Division 26 specification books.
                    </p>
                  </div>

                  {/* Uploaded File List */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>Selected Documents ({uploadedFiles.length})</span>
                        <span className="text-[11px] font-normal text-slate-500">Click tag to switch type</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {uploadedFiles.map((file, idx) => {
                          const cat = fileCategories[file.name] || 'specification';
                          const isDrawing = cat === 'drawing';
                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {isDrawing ? (
                                  <Layers className="w-4 h-4 text-sky-600 shrink-0" />
                                ) : (
                                  <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                                )}
                                <span className="font-semibold text-slate-800 truncate max-w-xs sm:max-w-md">
                                  {file.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCategory(file.name)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                    isDrawing
                                      ? 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
                                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                  }`}
                                  title="Click to toggle between Drawing and Specification"
                                >
                                  {isDrawing ? 'Drawing Sheet' : 'Division 26 Spec'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveUploadedFile(idx)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Remove file"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Submission Row */}
                  <div className="flex flex-col sm:flex-row items-center justify-between pt-3 gap-3">
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Ready to cross-check. All documents analyzed in-memory.</span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="submit"
                        disabled={uploadedFiles.length === 0 || isUploadingFiles}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                      >
                        {isUploadingFiles ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                            <span>Extracting & Analyzing Scope...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-slate-950" />
                            <span>Upload & Run Scope Check</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Optional Demo Loader for users testing the system */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                  <span>Don't have project files right now? Test the platform with sample commercial electrical data:</span>
                  <button
                    type="button"
                    onClick={handleLoadDemo}
                    disabled={isLoadingDemo}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>{isLoadingDemo ? 'Loading Sample...' : 'Explore Sample Demo Project'}</span>
                  </button>
                </div>

              </div>
            </div>

            {/* 3-Step SaaS Workflow Showcase */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full pt-2">
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
                <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <h3 className="text-xs font-bold text-slate-900">Upload Plans & Specs</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Drop your electrical drawing sheets (one-lines, riser diagrams, schedules) and Division 26 specification books.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <h3 className="text-xs font-bold text-slate-900">Automated Cross-Check</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  AI extracts schedules and correlates equipment ratings against specification clauses to detect omissions.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <h3 className="text-xs font-bold text-slate-900">Review & Export Log</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Inspect findings side-by-side with exact citations, log estimator decisions, and export scope logs for bidding.
                </p>
              </div>
            </div>

          </div>
        ) : (
          /* ============================================================== */
          /* CASE 2: ACTIVE PROJECT LOADED (Drawing sheets & specs present) */
          /* ============================================================== */
          <div className="w-full flex flex-col items-center space-y-7">
            
            {/* Project Active Header */}
            <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-bold text-slate-900">
                      {project.name}
                    </h1>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active SaaS Scope
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {project.documents.length} document(s) indexed • {project.findings.length} findings identified
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-600" />
                  <span>Add Documents</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenPlayground}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors shadow-2xs"
                >
                  <span>Open Review Canvas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Large Iconic Prompt Input Box */}
            <div className="w-full relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-400 via-rose-400 to-sky-400 rounded-3xl blur-[2px] opacity-40 group-hover:opacity-75 transition duration-300" />

              <form
                onSubmit={handleSubmit}
                className="relative w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4"
              >
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

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={onOpenUpload}
                    className="w-8 h-8 rounded-full border border-slate-300 hover:border-slate-400 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors shadow-2xs"
                    title="Upload drawings or specification PDFs"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

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

                    <button
                      type="button"
                      onClick={handleFeelingLucky}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 border border-slate-200"
                      title="Insert a sample electrical estimating prompt"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>Sample inquiries</span>
                    </button>

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

            {/* Quick Suggestion Pills Row */}
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

            {/* Scope Findings Gallery Section */}
            <div className="w-full pt-4 space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-normal text-slate-900">
                    Identified Scope Discrepancies & Findings
                  </h2>
                  <span className="text-xs font-mono font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                    {project.findings.length}
                  </span>
                </div>
                <button
                  onClick={onOpenPlayground}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 transition-colors shadow-2xs"
                >
                  <span>Open in Review Canvas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {project.findings.length === 0 ? (
                <div className="w-full bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3 shadow-2xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-900">Documents Loaded — Ready for Scope Check</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {project.documents.length} document(s) uploaded. Click "Run Scope Check" to cross-reference drawing sheets against Division 26 specifications.
                  </p>
                  <div className="pt-2 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={onRunScopeCheck}
                      disabled={isAnalyzing}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors shadow-2xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-slate-950" />
                      <span>{isAnalyzing ? 'Analyzing Scope...' : 'Run Automated Scope Check'}</span>
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
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1 ${meta.bg}`}>
                              <Icon className="w-2.5 h-2.5 shrink-0" />
                              <span>{meta.label}</span>
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                              Confidence: {finding.confidence}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-800 transition-colors line-clamp-1">
                            {finding.title}
                          </h3>

                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {finding.explanation}
                          </p>

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
        )}

        {/* User Feedback Callout (Tally Integration) */}
        <div className="w-full mt-6 p-4 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-lg shrink-0">
              💡
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Free SaaS Feedback & Suggestions</h4>
              <p className="text-xs text-slate-500">Help us tailor the Electrical Scope Checker for your estimators and project teams</p>
            </div>
          </div>
          <FeedbackButton variant="default" />
        </div>

      </div>
    </div>
  );
});
