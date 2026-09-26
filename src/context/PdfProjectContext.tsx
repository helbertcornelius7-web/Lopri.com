import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Project, Finding, ChatMessage, PdfContextFile, FindingStatus } from '../types';
import { apiClient } from '../services/apiClient';
import { extractPdfTextInBrowser } from '../services/clientScopeEngine';
import { sanitizePdfText } from '../utils/sanitizePdfText';

interface PdfProjectContextType {
  // Project & Findings state
  project: Project;
  allProjects: Project[];
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  activeFinding: Finding | null;
  selectedFindingId: string | null;
  setSelectedFindingId: (id: string | null) => void;
  loadProject: (id: string) => Promise<void>;
  updateFindingStatus: (findingId: string, status: FindingStatus) => Promise<void>;
  updateFindingNotes: (findingId: string, notes: string) => Promise<void>;

  // Unified PDF Global State (Consumed by Scope Canvas & Chat Stream)
  pdfFiles: PdfContextFile[];
  activePdf: PdfContextFile | null;
  setActivePdf: (pdf: PdfContextFile | null) => void;
  activePdfBase64: string | null;

  // Grounded Chat / Inquiries Stream
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  sendChatMessage: (userPrompt: string) => Promise<void>;
  clearChat: () => void;

  // Global Pipeline Actions
  uploadPdfFiles: (
    files: File[], 
    categories?: Record<string, 'drawing' | 'specification'>, 
    projectName?: string
  ) => Promise<Project>;
  runScopeCheck: () => Promise<Project>;
  resetWorkspace: () => Promise<void>;
}

const PdfProjectContext = createContext<PdfProjectContextType | undefined>(undefined);

// Helper to convert browser File to Base64 string (without the data URL prefix)
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip out metadata header like "data:application/pdf;base64,"
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

const INITIAL_WELCOME_MSG: ChatMessage = {
  id: 'msg-welcome',
  role: 'assistant',
  content: 'Grounded Electrical Scope Assistant initialized. Ask any specification or drawing inquiry (e.g., "What is the panelboard bus material?" or "What are the feeder sizes for AHU-1?"). Every answer is grounded directly in the attached PDF document with exact citations.',
  timestamp: new Date().toISOString(),
};

export const PdfProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<Project>({
    id: '',
    name: 'Electrical Scope Project',
    createdAt: new Date().toISOString(),
    status: 'ready',
    processingSteps: [
      { id: '1', label: 'Documents uploaded', status: 'pending' },
      { id: '2', label: 'PDF text extraction & OCR', status: 'pending' },
      { id: '3', label: 'Sheets & schedules identified', status: 'pending' },
      { id: '4', label: 'Specifications indexed', status: 'pending' },
      { id: '5', label: 'Drawing + specification cross-check', status: 'pending' },
    ],
    documents: [],
    findings: [],
  });

  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  
  // Unified PDF Global State
  const [pdfFiles, setPdfFiles] = useState<PdfContextFile[]>([]);
  const [activePdfId, setActivePdfId] = useState<string | null>(null);

  // Chat stream
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([INITIAL_WELCOME_MSG]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // Derive active finding
  const activeFinding = useMemo(() => {
    if (!project.findings || project.findings.length === 0) return null;
    return project.findings.find((f) => f.id === selectedFindingId) || project.findings[0];
  }, [project.findings, selectedFindingId]);

  // Derive active PDF
  const activePdf = useMemo(() => {
    if (pdfFiles.length === 0) return null;
    if (activePdfId) {
      const found = pdfFiles.find((p) => p.id === activePdfId);
      if (found) return found;
    }
    // Default to the first specification PDF, or the first PDF available
    const spec = pdfFiles.find((p) => p.category === 'specification');
    return spec || pdfFiles[0];
  }, [pdfFiles, activePdfId]);

  const activePdfBase64 = useMemo(() => {
    return activePdf?.base64 || pdfFiles.find((p) => Boolean(p.base64))?.base64 || null;
  }, [activePdf, pdfFiles]);

  // Load project list on mount
  const loadProjects = useCallback(async () => {
    try {
      const list = await apiClient.getProjects();
      setAllProjects(list);
      if (list.length > 0) {
        const fullProj = await apiClient.getProject(list[0].id);
        if (fullProj) {
          setProject(fullProj);
          if (fullProj.findings.length > 0) {
            setSelectedFindingId(fullProj.findings[0].id);
          }
          // Populate pdfFiles from project documents
          const docsAsPdfs: PdfContextFile[] = fullProj.documents.map((d) => ({
            id: d.id,
            name: d.name,
            size: d.fileSize,
            category: d.category,
            text: sanitizePdfText(d.pages.map((p) => p.text).join('\n\n')),
            pages: d.pages,
          }));
          setPdfFiles((prev) => {
            // Preserve existing base64 buffers if already present
            return docsAsPdfs.map((doc) => {
              const match = prev.find((p) => p.name === doc.name);
              return match?.base64 ? { ...doc, base64: match.base64 } : doc;
            });
          });
        }
      }
    } catch (err) {
      console.warn('Could not load initial projects:', err);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const loadProject = useCallback(async (id: string) => {
    try {
      const full = await apiClient.getProject(id);
      if (full) {
        setProject(full);
        setSelectedFindingId(full.findings.length > 0 ? full.findings[0].id : null);
        
        // Sync PDF files
        const mapped: PdfContextFile[] = full.documents.map((d) => ({
          id: d.id,
          name: d.name,
          size: d.fileSize,
          category: d.category,
          text: sanitizePdfText(d.pages.map((p) => p.text).join('\n\n')),
          pages: d.pages,
        }));
        setPdfFiles((prev) => {
          return mapped.map((m) => {
            const existing = prev.find((p) => p.name === m.name);
            return existing?.base64 ? { ...m, base64: existing.base64 } : m;
          });
        });
      }
    } catch (err) {
      console.error('Error switching project:', err);
    }
  }, []);

  const updateFindingStatus = useCallback(async (findingId: string, status: FindingStatus) => {
    setProject((prev) => ({
      ...prev,
      findings: prev.findings.map((f) => (f.id === findingId ? { ...f, status } : f)),
    }));
    await apiClient.updateFindingStatus(project.id, findingId, status);
  }, [project.id]);

  const updateFindingNotes = useCallback(async (findingId: string, notes: string) => {
    setProject((prev) => ({
      ...prev,
      findings: prev.findings.map((f) => (f.id === findingId ? { ...f, estimatorNotes: notes } : f)),
    }));
    await apiClient.updateFindingNotes(project.id, findingId, notes);
  }, [project.id]);

  // Upload PDFs into Unified Global State & Backend
  const uploadPdfFiles = useCallback(async (
    files: File[], 
    categories?: Record<string, 'drawing' | 'specification'>, 
    projectName = 'Custom Electrical Scope Project'
  ): Promise<Project> => {
    // 1. Convert all files to base64 & extract client text immediately
    const convertedPdfs: PdfContextFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let base64 = '';
      try {
        base64 = await fileToBase64(file);
      } catch (e) {
        console.warn('Base64 encoding error for file:', file.name, e);
      }

      const assignedCategory = categories?.[file.name] || 
        (/E\d|drawing|plan|schematic|dwg|single-line|schedule/i.test(file.name) ? 'drawing' : 'specification');

      let parsedPages = [];
      try {
        const extracted = await extractPdfTextInBrowser(file);
        parsedPages = extracted.pages.map((p) => ({
          ...p,
          text: sanitizePdfText(p.text),
        }));
      } catch (err) {
        console.warn('Browser extraction error:', err);
      }

      convertedPdfs.push({
        id: `pdf-${Date.now()}-${i}`,
        name: file.name,
        size: file.size,
        category: assignedCategory,
        base64,
        text: sanitizePdfText(parsedPages.map((p) => p.text).join('\n\n')),
        pages: parsedPages,
      });
    }

    // Update global PDF state
    setPdfFiles(convertedPdfs);
    if (convertedPdfs.length > 0) {
      setActivePdfId(convertedPdfs[0].id);
    }

    // 2. Transmit to server & backend scope pipeline
    const projData = await apiClient.createProject(
      projectName,
      `Uploaded ${files.length} electrical documents for grounded cross-checking.`
    );

    const uploaded = await apiClient.uploadDocuments(projData.id, files, categories);
    const analyzed = await apiClient.analyzeProject(uploaded.id);

    setProject(analyzed);
    setAllProjects((prev) => [analyzed, ...prev.filter((p) => p.id !== analyzed.id)]);
    if (analyzed.findings.length > 0) {
      setSelectedFindingId(analyzed.findings[0].id);
    }

    // Clear previous chat and introduce the newly uploaded files
    setChatMessages([
      {
        id: 'msg-upload-' + Date.now(),
        role: 'assistant',
        content: `Documents parsed & indexed: ${files.map((f) => f.name).join(', ')}. Full Division 26 specification PDF context is now active for grounded inquiries.`,
        timestamp: new Date().toISOString(),
      },
    ]);

    return analyzed;
  }, []);

  // Send Grounded Chat Inquiry with Active PDF Base64 Context Attached
  const sendChatMessage = useCallback(async (userPrompt: string) => {
    const trimmed = userPrompt.trim();
    if (!trimmed || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      // Find the active PDF base64 or specification PDF base64
      const primaryPdf = activePdf || pdfFiles.find((p) => p.category === 'specification') || pdfFiles[0];
      const pdfBase64Payload = primaryPdf?.base64 || undefined;

      const assistantMsg = await apiClient.chatWithProject(
        project.id, 
        trimmed, 
        pdfBase64Payload
      );

      // Sanitize the response text
      const sanitizedContent = sanitizePdfText(assistantMsg.content);

      setChatMessages((prev) => [
        ...prev, 
        {
          ...assistantMsg,
          content: sanitizedContent || assistantMsg.content,
        }
      ]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setChatMessages((prev) => [
        ...prev,
        {
          id: 'msg-err-' + Date.now(),
          role: 'assistant',
          content: 'An error occurred while cross-checking the uploaded specification document. Please verify your connection or try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  }, [activePdf, isChatLoading, pdfFiles, project.id]);

  const clearChat = useCallback(() => {
    setChatMessages([INITIAL_WELCOME_MSG]);
  }, []);

  const runScopeCheck = useCallback(async () => {
    const analyzed = await apiClient.analyzeProject(project.id);
    setProject(analyzed);
    if (analyzed.findings.length > 0) {
      setSelectedFindingId(analyzed.findings[0].id);
    }
    return analyzed;
  }, [project.id]);

  const resetWorkspace = useCallback(async () => {
    await apiClient.resetWorkspace();
    setPdfFiles([]);
    setActivePdfId(null);
    setChatMessages([INITIAL_WELCOME_MSG]);
    setProject({
      id: '',
      name: 'Empty Workspace',
      createdAt: new Date().toISOString(),
      status: 'ready',
      processingSteps: [],
      documents: [],
      findings: [],
    });
    setAllProjects([]);
    setSelectedFindingId(null);
  }, []);

  const value = useMemo(
    () => ({
      project,
      allProjects,
      setProject,
      activeFinding,
      selectedFindingId,
      setSelectedFindingId,
      loadProject,
      updateFindingStatus,
      updateFindingNotes,
      pdfFiles,
      activePdf,
      setActivePdf: (pdf: PdfContextFile | null) => setActivePdfId(pdf ? pdf.id : null),
      activePdfBase64,
      chatMessages,
      isChatLoading,
      sendChatMessage,
      clearChat,
      uploadPdfFiles,
      runScopeCheck,
      resetWorkspace,
    }),
    [
      project,
      allProjects,
      activeFinding,
      selectedFindingId,
      loadProject,
      updateFindingStatus,
      updateFindingNotes,
      pdfFiles,
      activePdf,
      activePdfBase64,
      chatMessages,
      isChatLoading,
      sendChatMessage,
      clearChat,
      uploadPdfFiles,
      runScopeCheck,
      resetWorkspace,
    ]
  );

  return <PdfProjectContext.Provider value={value}>{children}</PdfProjectContext.Provider>;
};

export function usePdfProject(): PdfProjectContextType {
  const context = useContext(PdfProjectContext);
  if (!context) {
    throw new Error('usePdfProject must be used within a PdfProjectProvider');
  }
  return context;
}
