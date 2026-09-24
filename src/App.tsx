/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Project, Finding, FindingStatus, ChatMessage, ProjectDocument } from './types';
import { EMPTY_PROJECT } from './demoData';
import { apiClient } from './services/apiClient';
import { StudioHeader } from './components/StudioHeader';
import { StudioSidebar } from './components/StudioSidebar';
import { StudioBuildHome } from './components/StudioBuildHome';
import { StudioCanvas } from './components/StudioCanvas';
import { StudioInspector } from './components/StudioInspector';
import { FeedbackButton } from './components/FeedbackButton';

// High-performance code-splitting: lazy load heavy modals on demand
const UploadModal = React.lazy(() =>
  import('./components/UploadModal').then((m) => ({ default: m.UploadModal }))
);
const PipelineStatusModal = React.lazy(() =>
  import('./components/PipelineStatusModal').then((m) => ({ default: m.PipelineStatusModal }))
);
const ExportSummaryModal = React.lazy(() =>
  import('./components/ExportSummaryModal').then((m) => ({ default: m.ExportSummaryModal }))
);

export default function App() {
  const [project, setProject] = useState<Project>(EMPTY_PROJECT);
  const [allProjects, setAllProjects] = useState<
    Array<{ id: string; name: string; status: string; findingsCount: number }>
  >([]);

  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  // Active Main View: 'home' matches the Google AI Studio Build Home screenshot!
  const [currentView, setCurrentView] = useState<'home' | 'playground' | 'history' | 'gallery'>('home');

  const [preferredView, setPreferredView] = useState<'specification' | 'drawing' | 'split'>('specification');

  // Side Panel Collapsible States (Google AI Studio style)
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);

  // Analysis / Prompt Execution State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Conversational Turns / Queries
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isPipelineOpen, setIsPipelineOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Fetch project list on load
  const loadProjects = useCallback(async () => {
    try {
      const list = await apiClient.getProjects();
      if (list && list.length > 0) {
        setAllProjects(list.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          findingsCount: p.findings.length,
        })));
        setProject((current) => {
          if (!current.id || !list.some((p: any) => p.id === current.id)) {
            loadProject(list[0].id);
          }
          return current;
        });
      }
    } catch (err) {
      console.warn('Could not fetch projects list:', err);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Fetch specific project
  const loadProject = useCallback(async (projectId: string) => {
    try {
      const data = await apiClient.getProject(projectId);
      if (data) {
        setProject(data);
        if (data.findings.length > 0) {
          setSelectedFindingId(data.findings[0].id);
        } else {
          setSelectedFindingId(null);
        }
      }
    } catch (err) {
      console.error('Error fetching project:', err);
    }
  }, []);

  const activeFinding = useMemo(() => {
    return project.findings.find((f) => f.id === selectedFindingId) || project.findings[0] || null;
  }, [project.findings, selectedFindingId]);

  // Decision updater helper
  const updateFindingStatus = useCallback(async (findingId: string, newStatus: FindingStatus) => {
    setProject((prev) => ({
      ...prev,
      findings: prev.findings.map((f) =>
        f.id === findingId
          ? { ...f, status: newStatus, decidedAt: new Date().toISOString() }
          : f
      ),
    }));

    try {
      await apiClient.updateFindingStatus(project.id, findingId, newStatus);
    } catch (err) {
      console.error('Failed to sync finding status:', err);
    }
  }, [project.id]);

  const handleAccept = useCallback((findingId: string) => updateFindingStatus(findingId, 'ACCEPTED'), [updateFindingStatus]);
  const handleReject = useCallback((findingId: string) => updateFindingStatus(findingId, 'REJECTED'), [updateFindingStatus]);
  const handleReviewLater = useCallback((findingId: string) => updateFindingStatus(findingId, 'REVIEW_LATER'), [updateFindingStatus]);

  const handleUpdateNotes = useCallback(async (findingId: string, notes: string) => {
    setProject((prev) => ({
      ...prev,
      findings: prev.findings.map((f) =>
        f.id === findingId ? { ...f, estimatorNotes: notes } : f
      ),
    }));

    try {
      await apiClient.updateFindingNotes(project.id, findingId, notes);
    } catch (err) {
      console.error('Failed to sync estimator notes:', err);
    }
  }, [project.id]);

  const handleResetDemo = useCallback(async () => {
    try {
      await apiClient.resetWorkspace();
    } catch (err) {
      console.warn('Reset error:', err);
    }
    setProject(EMPTY_PROJECT);
    setAllProjects([]);
    setSelectedFindingId(null);
    setChatMessages([]);
  }, []);

  // Re-run Scope Check (AI Studio Primary Action)
  const handleRunScopeCheck = useCallback(async () => {
    if (!project.id || project.documents.length === 0) {
      setIsUploadOpen(true);
      return;
    }
    setIsAnalyzing(true);
    try {
      const analyzedProject = await apiClient.analyzeProject(project.id);
      if (analyzedProject) {
        setProject(analyzedProject);
        if (analyzedProject.findings.length > 0) {
          setSelectedFindingId(analyzedProject.findings[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to re-run scope check:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [project.id, project.documents.length]);

  // Grounded Prompt Execution from Canvas Prompt Bar or Build Home Input
  const handleSendMessage = useCallback(async (query: string) => {
    if (!query.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };

    if (!project.id || project.documents.length === 0) {
      const assistantMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        role: 'assistant',
        content: 'Please upload electrical drawing sheets and Division 26 specifications to begin grounded scope checking.',
        citations: [],
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, userMsg, assistantMsg]);
      return;
    }

    setChatMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const assistantMsg = await apiClient.chatWithProject(project.id, query);
      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: 'msg-err-' + Date.now(),
        role: 'assistant',
        content: 'Sorry, I encountered an error checking project documents. Please verify your connection or try again.',
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  }, [isChatLoading, project.id, project.documents.length]);

  // Jump from finding or citation directly to Inspector evidence viewer
  const handleInspectEvidence = useCallback((docName: string, pageNum: number, view: 'specification' | 'drawing') => {
    setPreferredView(view);
    setIsRightOpen(true);
    setCurrentView('playground');
  }, []);

  // Keyboard navigation for fast estimator review in playground
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (currentView !== 'playground' || !activeFinding) return;

      const currentIndex = project.findings.findIndex((f) => f.id === activeFinding.id);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = Math.min(project.findings.length - 1, currentIndex + 1);
        setSelectedFindingId(project.findings[nextIdx].id);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = Math.max(0, currentIndex - 1);
        setSelectedFindingId(project.findings[prevIdx].id);
      } else if (e.key === 'a' || e.key === 'A') {
        handleAccept(activeFinding.id);
      } else if (e.key === 'r' || e.key === 'R') {
        handleReject(activeFinding.id);
      } else if (e.key === 'l' || e.key === 'L') {
        handleReviewLater(activeFinding.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFinding, project.findings, currentView]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 text-slate-900 font-sans overflow-hidden antialiased">
      {/* Top AI Studio Header Bar */}
      <StudioHeader
        project={project}
        allProjects={allProjects}
        onSelectProject={loadProject}
        isLeftOpen={isLeftOpen}
        onToggleLeft={() => setIsLeftOpen(!isLeftOpen)}
        isRightOpen={isRightOpen}
        onToggleRight={() => setIsRightOpen(!isRightOpen)}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenPipeline={() => setIsPipelineOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onResetDemo={handleResetDemo}
        onRunScopeCheck={handleRunScopeCheck}
        isAnalyzing={isAnalyzing}
        currentView={currentView}
        onChangeView={setCurrentView}
      />

      {/* Main Studio Area */}
      <div className="flex-1 flex overflow-hidden w-full relative">
        {/* Left Sidebar (Matching Google AI Studio Explore / Build / Manage hierarchy) */}
        {isLeftOpen && (
          <StudioSidebar
            project={project}
            currentView={currentView}
            onChangeView={setCurrentView}
            selectedFindingId={selectedFindingId}
            onSelectFinding={(f) => {
              setSelectedFindingId(f.id);
              setCurrentView('playground');
            }}
            onOpenUpload={() => setIsUploadOpen(true)}
            onOpenPipeline={() => setIsPipelineOpen(true)}
            onOpenExport={() => setIsExportOpen(true)}
            onToggleSidebar={() => setIsLeftOpen(false)}
          />
        )}

        {/* Dynamic Center: Exact Google AI Studio Build Home vs Playground */}
        {currentView === 'home' || currentView === 'gallery' ? (
          /* Google AI Studio Build Home View (matches user's screenshot) */
          <StudioBuildHome
            project={project}
            onSelectFinding={(f) => {
              setSelectedFindingId(f.id);
              setCurrentView('playground');
            }}
            onOpenPlayground={() => setCurrentView('playground')}
            onOpenUpload={() => setIsUploadOpen(true)}
            onRunScopeCheck={handleRunScopeCheck}
            onSendMessage={handleSendMessage}
            isAnalyzing={isAnalyzing}
            onAcceptFinding={handleAccept}
            onRejectFinding={handleReject}
            onReviewLaterFinding={handleReviewLater}
          />
        ) : (
          /* Google AI Studio Playground 2-Pane / 3-Pane View (Discrepancy inspection & Side-by-Side viewer) */
          <div className="flex-1 flex overflow-hidden w-full h-full">
            <StudioCanvas
              project={project}
              activeFinding={activeFinding}
              onAccept={handleAccept}
              onReject={handleReject}
              onReviewLater={handleReviewLater}
              onUpdateNotes={handleUpdateNotes}
              onInspectEvidence={handleInspectEvidence}
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
              isChatLoading={isChatLoading}
            />

            {/* Right Inspector: Parameters & Side-by-Side Evidence Viewer */}
            {isRightOpen && (
              <StudioInspector
                project={project}
                activeFinding={activeFinding}
                preferredView={preferredView}
                onChangePreferredView={setPreferredView}
                onClose={() => setIsRightOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Upload Modal (Lazy loaded on-demand) */}
      {isUploadOpen && (
        <Suspense fallback={null}>
          <UploadModal
            isOpen={isUploadOpen}
            onClose={() => setIsUploadOpen(false)}
            onUploadSuccess={(newProj) => {
              setProject(newProj);
              loadProjects();
              if (newProj.findings.length > 0) {
                setSelectedFindingId(newProj.findings[0].id);
              }
            }}
          />
        </Suspense>
      )}

      {/* Pipeline Status Modal (Lazy loaded on-demand) */}
      {isPipelineOpen && (
        <Suspense fallback={null}>
          <PipelineStatusModal
            isOpen={isPipelineOpen}
            onClose={() => setIsPipelineOpen(false)}
            project={project}
          />
        </Suspense>
      )}

      {/* Export Summary Modal (Lazy loaded on-demand) */}
      {isExportOpen && (
        <Suspense fallback={null}>
          <ExportSummaryModal
            isOpen={isExportOpen}
            onClose={() => setIsExportOpen(false)}
            project={project}
          />
        </Suspense>
      )}

      {/* Floating Feedback Button (Always accessible on bottom corner for mobile / fast feedback) */}
      <div className="fixed bottom-4 right-4 z-40 sm:hidden">
        <FeedbackButton 
          variant="default" 
          className="bg-blue-600 text-white px-3.5 py-2 rounded-full font-semibold shadow-lg hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-1.5 text-xs cursor-pointer border border-blue-400/30" 
        />
      </div>
    </div>
  );
}
