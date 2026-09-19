export type FindingType =
  | 'SCOPE_GAP' // Potential Scope Gap
  | 'CONFLICT' // Potential Conflict
  | 'MISSING_REFERENCE' // Potential Missing Reference
  | 'DOCUMENT_CONFLICT'; // Document Conflict

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type FindingStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REVIEW_LATER';

export interface EvidenceSource {
  id: string;
  type: 'specification' | 'drawing';
  documentName: string;
  documentId?: string;
  sectionNumber?: string; // e.g. "26 05 00", "26 32 13"
  sheetNumber?: string; // e.g. "E1.1", "E3.2"
  pageNumber: number;
  location?: string; // e.g. "Panel Schedule", "General Note 4", "Equipment Schedule"
  relevantText: string;
  highlightSnippet?: string;
}

export interface Finding {
  id: string;
  projectId: string;
  type: FindingType;
  title: string;
  systemArea: string; // e.g. "Emergency Power", "Lighting Controls", "Panel Bussing"
  explanation: string;
  confidence: ConfidenceLevel;
  confidenceRationale: string;
  sourceA: EvidenceSource; // Usually Specification
  sourceB: EvidenceSource; // Usually Drawing
  status: FindingStatus;
  estimatorNotes?: string;
  decidedAt?: string;
}

export interface DocumentPage {
  pageNumber: number;
  sheetOrSection?: string;
  title?: string;
  text: string;
  notes?: string[];
  tables?: Array<{
    title: string;
    headers: string[];
    rows: string[][];
  }>;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  category: 'drawing' | 'specification';
  fileSize: number;
  uploadedAt: string;
  pageCount: number;
  pages: DocumentPage[];
  status: 'uploading' | 'processing' | 'ready' | 'error';
}

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  details?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  processingSteps: ProcessingStep[];
  documents: ProjectDocument[];
  findings: Finding[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: Array<{
    documentName: string;
    sheetOrSection?: string;
    pageNumber: number;
    quote: string;
  }>;
  notEnoughInfo?: boolean;
}
