import React, { useState, useEffect } from 'react';
import { Project, Finding, ProjectDocument, DocumentPage } from '../types';
import { sanitizePdfText } from '../utils/sanitizePdfText';
import { 
  FileText, 
  Layers, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Columns,
  Table as TableIcon
} from 'lucide-react';

interface SourceViewerProps {
  project: Project;
  activeFinding: Finding | null;
  preferredView: 'specification' | 'drawing' | 'split';
  onChangePreferredView: (view: 'specification' | 'drawing' | 'split') => void;
}

export const SourceViewer: React.FC<SourceViewerProps> = ({
  project,
  activeFinding,
  preferredView,
  onChangePreferredView,
}) => {
  const [activeTab, setActiveTab] = useState<'specification' | 'drawing'>(
    preferredView === 'split' ? 'specification' : preferredView
  );
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [copiedText, setCopiedText] = useState(false);
  const [isSplitMode, setIsSplitMode] = useState(preferredView === 'split');

  useEffect(() => {
    if (preferredView === 'split') {
      setIsSplitMode(true);
    } else {
      setIsSplitMode(false);
      setActiveTab(preferredView);
    }
  }, [preferredView]);

  useEffect(() => {
    if (!activeFinding) return;

    const targetSource = activeTab === 'specification' ? activeFinding.sourceA : activeFinding.sourceB;
    const foundDoc = project.documents.find(
      (d) => d.id === targetSource.documentId || d.name === targetSource.documentName
    );

    if (foundDoc) {
      setSelectedDocId(foundDoc.id);
      const pageIdx = foundDoc.pages.findIndex((p) => p.pageNumber === targetSource.pageNumber);
      setCurrentPageIndex(pageIdx >= 0 ? pageIdx : 0);
    }
  }, [activeFinding, activeTab, project.documents]);

  const currentDoc = project.documents.find((d) => d.id === selectedDocId) || project.documents[0];
  const currentPage: DocumentPage | undefined = currentDoc?.pages?.[currentPageIndex] || currentDoc?.pages?.[0];

  const activeEvidence = activeFinding
    ? activeTab === 'specification'
      ? activeFinding.sourceA
      : activeFinding.sourceB
    : null;

  const handleCopyCitation = () => {
    if (!activeEvidence) return;
    const citation = `Document: ${activeEvidence.documentName} | ${activeEvidence.sheetNumber ? `Sheet: ${activeEvidence.sheetNumber}` : `Section: ${activeEvidence.sectionNumber}`} | Page: ${activeEvidence.pageNumber}\nQuote: "${activeEvidence.relevantText}"`;
    navigator.clipboard.writeText(citation);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleSwitchTab = (tab: 'specification' | 'drawing') => {
    setActiveTab(tab);
    setIsSplitMode(false);
    onChangePreferredView(tab);
    if (!activeFinding) return;
    const src = tab === 'specification' ? activeFinding.sourceA : activeFinding.sourceB;
    const doc = project.documents.find(
      (d) => d.id === src.documentId || d.name === src.documentName
    );
    if (doc) {
      setSelectedDocId(doc.id);
      const pIdx = doc.pages.findIndex((p) => p.pageNumber === src.pageNumber);
      setCurrentPageIndex(pIdx >= 0 ? pIdx : 0);
    }
  };

  const renderHighlightedContent = (rawText: string, rawSnippet?: string) => {
    const text = sanitizePdfText(rawText);
    const highlightSnippet = rawSnippet ? sanitizePdfText(rawSnippet) : undefined;

    if (!highlightSnippet || !text.includes(highlightSnippet)) {
      return <div className="whitespace-pre-wrap leading-relaxed text-slate-700">{text}</div>;
    }

    const parts = text.split(highlightSnippet);
    return (
      <div className="whitespace-pre-wrap leading-relaxed text-slate-700">
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            {part}
            {i < parts.length - 1 && (
              <mark className="bg-amber-200 text-slate-950 font-semibold px-1 py-0.5 rounded shadow-xs border-b border-amber-400">
                {highlightSnippet}
              </mark>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden text-slate-800 rounded-xl border border-slate-200 shadow-xs">
      {/* Top Bar: Tabs & View Controls */}
      <div className="p-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* Specification Source Tab */}
          <button
            onClick={() => handleSwitchTab('specification')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              activeTab === 'specification' && !isSplitMode
                ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-xs'
                : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/70'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            <span>Spec Page {activeFinding ? activeFinding.sourceA.pageNumber : ''}</span>
          </button>

          {/* Drawing Source Tab */}
          <button
            onClick={() => handleSwitchTab('drawing')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              activeTab === 'drawing' && !isSplitMode
                ? 'bg-sky-50 text-sky-900 border-sky-300 shadow-xs'
                : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/70'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            <span>Drawing Sheet {activeFinding ? activeFinding.sourceB.sheetNumber : ''}</span>
          </button>

          {/* Split Mode Toggle */}
          <button
            onClick={() => {
              const nextSplit = !isSplitMode;
              setIsSplitMode(nextSplit);
              onChangePreferredView(nextSplit ? 'split' : activeTab);
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              isSplitMode
                ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/70'
            }`}
            title="Side-by-side comparison of Specification and Drawing"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Compare Both</span>
          </button>
        </div>

        {/* Copy Citation */}
        <button
          onClick={handleCopyCitation}
          disabled={!activeEvidence}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium disabled:opacity-40 transition-colors"
          title="Copy verified quote with citation to clipboard"
        >
          {copiedText ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Copy Quote</span>
            </>
          )}
        </button>
      </div>

      {/* Split Mode View */}
      {isSplitMode && activeFinding ? (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden">
          {/* Left Column: Spec */}
          <div className="flex flex-col h-full overflow-hidden bg-white">
            <div className="p-2.5 bg-amber-50/70 border-b border-amber-200/70 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-700" />
                Spec: Sec. {activeFinding.sourceA.sectionNumber} (Pg {activeFinding.sourceA.pageNumber})
              </span>
              <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                {activeFinding.sourceA.documentName}
              </span>
            </div>
            <div className="p-3 bg-amber-50/40 border-b border-amber-100">
              <div className="text-[10px] uppercase tracking-wider text-amber-800 font-bold mb-1">
                Verified Requirement ({activeFinding.sourceA.location}):
              </div>
              <div className="text-xs text-amber-950 bg-white p-2.5 rounded-lg border border-amber-200 leading-relaxed font-medium">
                "{sanitizePdfText(activeFinding.sourceA.relevantText)}"
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto text-xs font-sans leading-relaxed text-slate-700 bg-slate-50/40">
              {renderHighlightedContent(
                project.documents.find(d => d.id === activeFinding.sourceA.documentId || d.name === activeFinding.sourceA.documentName)?.pages.find(p => p.pageNumber === activeFinding.sourceA.pageNumber)?.text || activeFinding.sourceA.relevantText,
                activeFinding.sourceA.highlightSnippet
              )}
            </div>
          </div>

          {/* Right Column: Drawing */}
          <div className="flex flex-col h-full overflow-hidden bg-white">
            <div className="p-2.5 bg-sky-50/70 border-b border-sky-200/70 flex items-center justify-between">
              <span className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-700" />
                Drawing: Sheet {activeFinding.sourceB.sheetNumber} (Pg {activeFinding.sourceB.pageNumber})
              </span>
              <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                {activeFinding.sourceB.documentName}
              </span>
            </div>
            <div className="p-3 bg-sky-50/40 border-b border-sky-100">
              <div className="text-[10px] uppercase tracking-wider text-sky-800 font-bold mb-1">
                Verified Drawing ({activeFinding.sourceB.location}):
              </div>
              <div className="text-xs text-sky-950 bg-white p-2.5 rounded-lg border border-sky-200 leading-relaxed font-medium">
                "{sanitizePdfText(activeFinding.sourceB.relevantText)}"
              </div>
            </div>
            <div className="flex-1 p-4 overflow-y-auto text-xs font-sans leading-relaxed text-slate-700 bg-slate-50/40">
              {renderHighlightedContent(
                project.documents.find(d => d.id === activeFinding.sourceB.documentId || d.name === activeFinding.sourceB.documentName)?.pages.find(p => p.pageNumber === activeFinding.sourceB.pageNumber)?.text || activeFinding.sourceB.relevantText,
                activeFinding.sourceB.highlightSnippet
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Single Source Viewer Mode */
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Document metadata & Page selector sub-bar */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              {currentDoc?.category === 'drawing' ? (
                <Layers className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              )}
              <span className="font-bold text-slate-800 truncate">
                {currentDoc?.name}
              </span>
              {currentPage?.sheetOrSection && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs">
                  {currentPage.sheetOrSection}
                </span>
              )}
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setCurrentPageIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentPageIndex <= 0}
                className="p-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="text-[11px] text-slate-600 px-1 font-medium">
                Page <strong className="text-slate-900">{currentPage?.pageNumber || currentPageIndex + 1}</strong> of{' '}
                {currentDoc?.pages?.length || 1}
              </span>

              <button
                onClick={() =>
                  setCurrentPageIndex((prev) =>
                    Math.min((currentDoc?.pages?.length || 1) - 1, prev + 1)
                  )
                }
                disabled={currentPageIndex >= (currentDoc?.pages?.length || 1) - 1}
                className="p-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 disabled:opacity-40 transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Callout box for active finding evidence */}
          {activeEvidence && (
            <div className={`p-3 border-b ${
              activeTab === 'specification' ? 'bg-amber-50/60 border-amber-200/80' : 'bg-sky-50/60 border-sky-200/80'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  activeTab === 'specification' ? 'text-amber-800' : 'text-sky-800'
                }`}>
                  Exact Evidence Citation ({activeEvidence.location || 'Document Citation'}):
                </span>
                <span className="text-[10px] font-medium text-slate-500">
                  Page {activeEvidence.pageNumber}
                </span>
              </div>
              <div className="text-xs text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed font-medium shadow-2xs">
                "{activeEvidence.relevantText}"
              </div>
            </div>
          )}

          {/* Document Content View Area */}
          <div className="flex-1 p-4 overflow-y-auto text-xs space-y-4 bg-slate-50/50">
            {currentPage ? (
              <div className="space-y-4 max-w-4xl mx-auto bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                {/* Page Title / Header */}
                <div className="pb-2 border-b border-slate-200 flex items-center justify-between text-slate-500 text-[11px]">
                  <span className="font-semibold text-slate-700">{currentPage.title || `Page ${currentPage.pageNumber}`}</span>
                  <span>{currentDoc?.name}</span>
                </div>

                {/* Highlighted text body */}
                <div className="p-1 leading-relaxed">
                  {renderHighlightedContent(
                    currentPage.text,
                    activeEvidence?.pageNumber === currentPage.pageNumber
                      ? activeEvidence.highlightSnippet || activeEvidence.relevantText
                      : undefined
                  )}
                </div>

                {/* Schedules / tables if present */}
                {currentPage.tables && currentPage.tables.map((table, tIdx) => (
                  <div key={tIdx} className="rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="p-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <TableIcon className="w-3.5 h-3.5 text-sky-600" />
                      {table.title}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100/70 text-slate-700 border-b border-slate-200 font-semibold">
                          <tr>
                            {table.headers.map((h, hIdx) => (
                              <th key={hIdx} className="px-3 py-1.5">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {table.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50">
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {/* Page Notes */}
                {currentPage.notes && currentPage.notes.length > 0 && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                    <div className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      General Notes:
                    </div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {currentPage.notes.map((note, nIdx) => (
                        <li key={nIdx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs">
                No document page selected.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

