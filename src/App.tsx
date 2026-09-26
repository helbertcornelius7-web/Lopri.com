/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { Project, FindingStatus } from './types';
import { PdfProjectProvider, usePdfProject } from './context/PdfProjectContext';
import { StudioHeader } from './components/StudioHeader';
import { StudioSidebar } from './components/StudioSidebar';
import { StudioBuildHome } from './components/StudioBuildHome';
import { StudioCanvas } from './components/StudioCanvas';
import { StudioInspector } from './components/StudioInspector';
import { FeedbackButton } from './components/FeedbackButton';
import { UploadModal } from './components/UploadModal';
import { PipelineStatusModal } from './components/PipelineStatusModal';
import { ExportSummaryModal } from './components/ExportSummaryModal';

function AppContent() {
  const {
    project,
    setProject,
    allProjects,
    activeFinding,
    selectedFindingId,
    setSelectedFindingId,
    updateFindingStatus,
    updateFindingNotes,
    pdfFiles,
    activePdf,
    chatMessages,
    isChatLoading,
    sendChatMessage,
    runScopeCheck,
    resetWorkspace,
  } = usePdfProject();

  // Active Main View: 'home' matches the Google AI Studio Build Home
  const [currentView, setCurrentView] = useState<'home' | 'playground' | 'history' | 'gallery'>('home');
  const [preferredView, setPreferredView] = useState<'specification' | 'drawing' | 'split'>('specification');

  // Side Panel Collapsible States (Google AI Studio style)
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);

  // Analysis / Prompt Execution State
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isPipelineOpen, setIsPipelineOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const handleAccept = useCallback((findingId: string) => updateFindingStatus(findingId, 'ACCEPTED'), [updateFindingStatus]);
  const handleReject = useCallback((findingId: string) => updateFindingStatus(findingId, 'REJECTED'), [updateFindingStatus]);
  const handleReviewLater = useCallback((findingId: string) => updateFindingStatus(findingId, 'REVIEW_LATER'), [updateFindingStatus]);

  // Re-run Scope Check (AI Studio Primary Action)
  const handleRunScopeCheck = useCallback(async () => {
    if (!project.id || project.documents.length === 0) {
      setIsUploadOpen(true);
      return;
    }
    setIsAnalyzing(true);
    try {
      await runScopeCheck();
    } catch (err) {
      console.error('Failed to re-run scope check:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [project.id, project.documents.length, runScopeCheck]);

  // Grounded Prompt Execution from Canvas Prompt Bar or Build Home Input
  const handleSendMessage = useCallback(async (query: string) => {
    await sendChatMessage(query);
  }, [sendChatMessage]);

  // Jump from finding or citation directly to Inspector evidence viewer
  const handleInspectEvidence = useCallback((docName: string, pageNum: number, view: 'specification' | 'drawing') => {
    setPreferredView(view);
    setIsRightOpen(true);
    setCurrentView('playground');
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-white text-slate-900 overflow-hidden select-none font-sans">
      {/* Top Google AI Studio Header */}
      <StudioHeader
        project={project}
        projectsList={allProjects}
        onSelectProject={() => {}}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenPipeline={() => setIsPipelineOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onResetDemo={resetWorkspace}
        onRunScopeCheck={handleRunScopeCheck}
        isAnalyzing={isAnalyzing}
        currentView={currentView}
        onChangeView={setCurrentView}
      />

      {/* Main Studio Area */}
      <div className="flex-1 flex overflow-hidden w-full relative">
        {/* Left Sidebar */}
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

        {/* Dynamic Center: Google AI Studio Build Home vs Playground */}
        {currentView === 'home' || currentView === 'gallery' ? (
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
          <div className="flex-1 flex overflow-hidden w-full h-full">
            <StudioCanvas
              project={project}
              activeFinding={activeFinding}
              onAccept={handleAccept}
              onReject={handleReject}
              onReviewLater={handleReviewLater}
              onUpdateNotes={updateFindingNotes}
              onInspectEvidence={handleInspectEvidence}
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
              isChatLoading={isChatLoading}
              activePdf={activePdf}
              pdfFiles={pdfFiles}
            />

            {/* Right Inspector: Parameters & Evidence Viewer */}
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

      {/* Upload Modal with Unified PDF Pipeline */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={(newProj) => {
          setProject(newProj);
          if (newProj.findings.length > 0) {
            setSelectedFindingId(newProj.findings[0].id);
          }
        }}
      />

      {/* Pipeline Status Modal */}
      <PipelineStatusModal
        isOpen={isPipelineOpen}
        onClose={() => setIsPipelineOpen(false)}
        project={project}
      />

      {/* Export Summary Modal */}
      <ExportSummaryModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        project={project}
      />

      {/* Floating Feedback Button */}
      <div className="fixed bottom-4 right-4 z-40 sm:hidden">
        <FeedbackButton 
          variant="default" 
          className="bg-blue-600 text-white px-3.5 py-2 rounded-full font-semibold shadow-lg hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-1.5 text-xs cursor-pointer border border-blue-400/30" 
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <PdfProjectProvider>
      <AppContent />
    </PdfProjectProvider>
  );
}
