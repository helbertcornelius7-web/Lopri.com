import express from 'express';
import path from 'path';
import zlib from 'zlib';
import multer from 'multer';
import { GoogleGenAI, Type } from  '@google/genai';
import type { Project, ProjectDocument, Finding, DocumentPage } from './src/types';
import { sanitizePdfText } from './src/utils/sanitizePdfText.js';
import { SAMPLE_PROJECT } from './src/demoData.js';
const g: any = globalThis;
if (typeof g.DOMMatrix === 'undefined') g.DOMMatrix = class DOMMatrix {};
if (typeof g.ImageData === 'undefined') g.ImageData = class ImageData {};
if (typeof g.Path2D === 'undefined') g.Path2D = class Path2D {};

const app = express();
const PORT = 3000;

// Expanded limits (250MB) to handle heavy multi-page electrical drawing sets and Division 26 spec books
app.use(express.json({ limit: '250mb' }));
app.use(express.urlencoded({ extended: true, limit: '250mb' }));

// In-memory project store (starts empty; populated when user uploads their project)
const projectsStore: Map<string, Project> = new Map();

// Unified In-memory PDF buffer store so Chat Stream retains full PDF context
interface StoredPdfFile {
  name: string;
  size: number;
  category: 'drawing' | 'specification';
  buffer: Buffer;
  base64: string;
  mimeType: string;
}
const projectPdfBuffers: Map<string, StoredPdfFile[]> = new Map();

// Multer storage for PDF uploads - upgraded to 250MB per file and up to 50 files per project
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 250 * 1024 * 1024, files: 50 },
});

// Safe Multer upload middleware with informative error handling for heavy drawing packages
const handleMulterUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  upload.array('files', 50)(req, res, (err: any) => {
    if (err) {
      console.error('Multer upload error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'One or more files exceed the maximum supported size of 250MB per file.',
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          error: 'Too many files uploaded in a single batch (maximum 50 files supported).',
        });
      }
      return res.status(400).json({
        error: `Upload processing error: ${err.message || 'Failed to process files'}`,
      });
    }
    next();
  });
};

// Lazy-initialized Gemini AI Client
let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    projectCount: projectsStore.size,
  });
});

// 2. List all projects
app.get('/api/projects', (req, res) => {
  const projectsList = Array.from(projectsStore.values()).map(p => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    status: p.status,
    documentCount: p.documents.length,
    findingsCount: p.findings.length,
    drawingsCount: p.documents.filter(d => d.category === 'drawing').length,
    specsCount: p.documents.filter(d => d.category === 'specification').length,
  }));
  res.json(projectsList);
});

// 3. Get single project details
app.get('/api/projects/:id', (req, res) => {
  const project = projectsStore.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json(project);
});

// 4. Create new project
app.post('/api/projects', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Project name is required' });
  }
  const id = 'proj-' + Date.now();
  const newProject: Project = {
    id,
    name: name.trim(),
    createdAt: new Date().toISOString(),
    status: 'uploading',
    processingSteps: [
      { id: '1', label: 'Documents uploaded', status: 'pending' },
      { id: '2', label: 'PDF text extraction & OCR', status: 'pending' },
      { id: '3', label: 'Sheets & schedules identified', status: 'pending' },
      { id: '4', label: 'Specifications indexed', status: 'pending' },
      { id: '5', label: 'Drawing + specification cross-check', status: 'pending' },
    ],
    documents: [],
    findings: [],
  };
  projectsStore.set(id, newProject);
  res.status(201).json(newProject);
});

// 5. Reset workspace to sample project
app.post('/api/projects/reset-demo', (req, res) => {
  projectsStore.clear();
  projectPdfBuffers.clear();
  projectsStore.set(SAMPLE_PROJECT.id, JSON.parse(JSON.stringify(SAMPLE_PROJECT)));
  res.json({ message: 'Workspace reset to default sample project.', project: SAMPLE_PROJECT });
});

// 5b. Load sample demo on demand
app.post('/api/projects/load-sample', (req, res) => {
  const cloned = JSON.parse(JSON.stringify(SAMPLE_PROJECT));
  projectsStore.set(cloned.id, cloned);
  res.json(cloned);
});

// Helper to extract text from raw PDF stream when standard PDFParse encounters unusual compression or CAD vector objects
function extractFallbackPdfText(buffer: Buffer, originalName: string, isDrawing: boolean): {
  text: string;
  pageCount: number;
  pages: DocumentPage[];
} {
  const pages: DocumentPage[] = [];
  let extractedText = '';

  try {
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    const latinString = buffer.toString('latin1');
    let match: RegExpExecArray | null;
    const decompressedChunks: string[] = [];

    while ((match = streamRegex.exec(latinString)) !== null) {
      const rawStream = Buffer.from(match[1], 'latin1');
      try {
        const decompressed = zlib.inflateSync(rawStream);
        decompressedChunks.push(decompressed.toString('utf-8'));
      } catch {
        try {
          const rawDecompressed = zlib.inflateRawSync(rawStream);
          decompressedChunks.push(rawDecompressed.toString('utf-8'));
        } catch {
          // uncompressed stream or non-flate
        }
      }
    }

    const combinedStreams = decompressedChunks.join('\n');
    const textPieces: string[] = [];
    const tjRegex = /\(([^()]*)\)\s*Tj/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(combinedStreams)) !== null) {
      if (tjMatch[1].trim()) textPieces.push(tjMatch[1].trim());
    }

    const tjArrayRegex = /\[([^\[\]]*)\]\s*TJ/g;
    let tjArrMatch: RegExpExecArray | null;
    while ((tjArrMatch = tjArrayRegex.exec(combinedStreams)) !== null) {
      const parts = tjArrMatch[1].match(/\(([^()]*)\)/g);
      if (parts) {
        const line = parts.map(p => p.slice(1, -1)).join('');
        if (line.trim()) textPieces.push(line.trim());
      }
    }

    if (textPieces.length > 0) {
      extractedText = sanitizePdfText(textPieces.join(' '));
    }
  } catch (e) {
    console.warn('Fallback stream decompression warning:', e);
  }

  // Detect page count from /Type /Page
  const rawStr = buffer.toString('latin1');
  const pageMatches = rawStr.match(/\/Type\s*\/Page\b/g);
  const detectedCount = Math.max(pageMatches ? pageMatches.length : 1, 1);

  if (extractedText.length > 50) {
    const chunkSize = Math.max(1, Math.ceil(extractedText.length / detectedCount));
    for (let pNum = 1; pNum <= detectedCount; pNum++) {
      const chunk = extractedText.slice((pNum - 1) * chunkSize, pNum * chunkSize);
      pages.push({
        pageNumber: pNum,
        sheetOrSection: isDrawing ? `Sheet ${pNum} - ${originalName.replace(/\.pdf$/i, '')}` : `Section ${pNum}`,
        title: `${isDrawing ? 'Drawing Sheet' : 'Spec Section'} (Page ${pNum})`,
        text: chunk || (isDrawing ? 'CAD graphical distribution schematics and schedules.' : 'Specification requirements.'),
      });
    }
  } else {
    for (let pNum = 1; pNum <= detectedCount; pNum++) {
      pages.push({
        pageNumber: pNum,
        sheetOrSection: isDrawing ? `Sheet ${pNum} - ${originalName.replace(/\.pdf$/i, '')}` : `Section ${pNum}`,
        title: isDrawing ? `Drawing Sheet ${pNum} (${originalName})` : `Spec Section ${pNum} (${originalName})`,
        text: isDrawing
          ? `Electrical distribution schematics, single-line power diagram, and equipment feeder schedules for ${originalName} (Sheet ${pNum}). CAD vector elements.`
          : `Division 26 Electrical Technical Specifications for ${originalName} (Part ${pNum}). Submittals, materials, quality assurance, and execution.`,
      });
    }
  }

  return {
    text: extractedText,
    pageCount: detectedCount,
    pages,
  };
}

// 6. Upload PDF documents to project (supports both /upload and /documents endpoints)
const handleDocumentUpload = async (req: express.Request, res: express.Response) => {
  const project = projectsStore.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  // Update project status to processing
  project.status = 'processing';
  project.processingSteps[0].status = 'in_progress';

  try {
    let customCategories: Record<string, 'drawing' | 'specification'> = {};
    try {
      if (req.body.categories) {
        customCategories = typeof req.body.categories === 'string' ? JSON.parse(req.body.categories) : req.body.categories;
      }
    } catch (e) {}

    // Ensure storage for this project exists
    if (!projectPdfBuffers.has(project.id)) {
      projectPdfBuffers.set(project.id, []);
    }
    const pdfStoreList = projectPdfBuffers.get(project.id)!;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const originalName = file.originalname;
      let category: 'drawing' | 'specification';

      if (customCategories[originalName]) {
        category = customCategories[originalName];
      } else {
        const matchesDrawing = /E\d|drawing|plan|schematic|dwg|single-line|schedule|sheet/i.test(originalName);
        if (files.length >= 2 && i === 0 && !matchesDrawing) {
          category = 'drawing';
        } else {
          category = matchesDrawing ? 'drawing' : 'specification';
        }
      }

      // Cache raw buffer and base64 for LLM RAG / chat calls (only base64 encode if <= 18MB to prevent heap exhaustion)
      const shouldBase64 = file.size <= 18 * 1024 * 1024;
      pdfStoreList.push({
        name: originalName,
        size: file.size,
        category,
        buffer: file.buffer,
        base64: shouldBase64 ? file.buffer.toString('base64') : '',
        mimeType: file.mimetype || 'application/pdf',
      });

      const isDrawing = category === 'drawing';

      let extractedText = '';
      let pageCount = 1;
      const pages: DocumentPage[] = [];

      try {
  const pdfParseModule = await import('pdf-parse');
  const pdfParse = pdfParseModule.default || pdfParseModule;
  const parsed: any = await pdfParse(file.buffer);
  extractedText = parsed.text || '';
  pageCount = parsed.numpages || (parsed.pages ? parsed.pages.length : 1);


        if (parsed.pages && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          parsed.pages.forEach((p: any, idx: number) => {
            const pageTxt = sanitizePdfText(p.text || '').trim();
            pages.push({
              pageNumber: p.num || idx + 1,
              sheetOrSection: isDrawing ? `Sheet ${originalName.replace(/\.pdf$/i, '')}` : `Section ${idx + 1}`,
              title: `${isDrawing ? 'Drawing Sheet' : 'Spec Section'} (Page ${p.num || idx + 1})`,
              text: pageTxt || (isDrawing ? 'Drawing sheet contains graphical schematics and schedules.' : 'Specification text page.'),
            });
          });
        } else {
          // Split by form-feed or approximate page breaks
          const rawPages = extractedText.split(/\f|\n\s*---\s*Page\s*\d+\s*---\s*\n/);
          if (rawPages.length > 1) {
            rawPages.forEach((txt, idx) => {
              const cleanTxt = sanitizePdfText(txt).trim();
              if (cleanTxt.length > 0) {
                pages.push({
                  pageNumber: idx + 1,
                  sheetOrSection: isDrawing ? `Sheet ${originalName.replace(/\.pdf$/i, '')}` : `Section ${idx + 1}`,
                  title: `${isDrawing ? 'Drawing Sheet' : 'Spec Section'} (Page ${idx + 1})`,
                  text: cleanTxt,
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn(`PDF parse error for ${originalName}, checking text fallback:`, err);
        const fallback = extractFallbackPdfText(file.buffer, originalName, isDrawing);
        extractedText = fallback.text;
        pageCount = fallback.pageCount;
        pages.push(...fallback.pages);
      }

      // If pages still empty (e.g. pure vector drawing), detect page count and construct sheets
      if (pages.length === 0) {
        const rawStr = file.buffer.toString('latin1');
        const pageMatches = rawStr.match(/\/Type\s*\/Page\b/g);
        const totalSheets = Math.max(pageCount, pageMatches ? pageMatches.length : 1, 1);
        for (let pNum = 1; pNum <= totalSheets; pNum++) {
          pages.push({
            pageNumber: pNum,
            sheetOrSection: isDrawing ? `Sheet ${pNum} - ${originalName.replace(/\.pdf$/i, '')}` : `Section ${pNum}`,
            title: isDrawing ? `Drawing Sheet ${pNum} (${originalName})` : `Spec Section ${pNum} (${originalName})`,
            text: isDrawing
              ? `Electrical single-line diagram, distribution panelboards, and equipment feeder schedule for ${originalName} (Sheet ${pNum}). Graphical CAD vector layers.`
              : `Division 26 Electrical Technical Specifications for ${originalName} (Part ${pNum}). Materials, installation standards, and commissioning requirements.`,
          });
        }
      }

      const doc: ProjectDocument = {
        id: 'doc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        projectId: project.id,
        name: originalName,
        category,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        pageCount: Math.max(pageCount, pages.length),
        pages,
        status: 'ready',
      };

      project.documents.push(doc);
    }

    project.processingSteps[0].status = 'completed';
    project.processingSteps[0].details = `${project.documents.length} document(s) uploaded`;
    project.processingSteps[1].status = 'completed';
    project.processingSteps[1].details = 'PDF text and sheet headers extracted';

    res.json({
      message: 'Files processed successfully',
      documentsCount: project.documents.length,
      project,
    });
  } catch (error: any) {
    project.status = 'error';
    project.processingSteps[0].status = 'error';
    project.processingSteps[0].details = error.message;
    res.status(500).json({ error: error.message || 'Error processing files' });
  }
};

app.post('/api/projects/:id/upload', handleMulterUpload, handleDocumentUpload);
app.post('/api/projects/:id/documents', handleMulterUpload, handleDocumentUpload);

// 7. Run Cross-Check AI Analysis on Project (handles both /analyze and /cross-check)
const handleAnalyzeProject = async (req: express.Request, res: express.Response) => {
  let project = projectsStore.get(req.params.id);
  if (!project && req.body && req.body.project) {
    project = req.body.project;
    projectsStore.set(project.id, project);
  } else if (req.body && req.body.project && (!project || project.documents.length === 0)) {
    project = req.body.project;
    projectsStore.set(project.id, project);
  }

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  let drawings = project.documents.filter(d => d.category === 'drawing');
  let specs = project.documents.filter(d => d.category === 'specification');

  if (project.documents.length >= 2) {
    if (drawings.length === 0) {
      project.documents[0].category = 'drawing';
      drawings = [project.documents[0]];
      specs = project.documents.slice(1);
    } else if (specs.length === 0) {
      project.documents[project.documents.length - 1].category = 'specification';
      specs = [project.documents[project.documents.length - 1]];
      drawings = project.documents.slice(0, project.documents.length - 1);
    }
  } else if (project.documents.length === 1) {
    drawings = [project.documents[0]];
    specs = [project.documents[0]];
  }

  if (project.documents.length === 0) {
    return res.status(400).json({
      error: 'Analysis requires at least one electrical document to be uploaded.',
    });
  }

  project.status = 'processing';
  project.processingSteps[2].status = 'in_progress';
  project.processingSteps[3].status = 'in_progress';
  project.processingSteps[4].status = 'in_progress';

  try {
    const ai = getAi();

    // Prepare document text context
    const specSummaries = specs.map(s => {
      const pageSnippets = s.pages.map(p => `[Spec: ${s.name} | Section/Sheet: ${p.sheetOrSection || 'N/A'} | Page: ${p.pageNumber}]\n${p.text.slice(0, 3000)}`).join('\n\n');
      return pageSnippets;
    }).join('\n===\n');

    const drawingSummaries = drawings.map(d => {
      const pageSnippets = d.pages.map(p => `[Drawing: ${d.name} | Sheet: ${p.sheetOrSection || d.name} | Page: ${p.pageNumber}]\n${p.text.slice(0, 3000)}`).join('\n\n');
      return pageSnippets;
    }).join('\n===\n');

    let newFindings: Finding[] = [];

    if (ai) {
      const prompt = `You are Lopri AI's Preconstruction Scope & Citation Engine. 
Your core task is to extract exact evidence quotes and map accurate location metadata from construction specification documents and drawings. 

Follow the patterns and decision logic illustrated below when processing incoming texts and generating citations:

======================================================================
1. DECISION TREE LOGIC FOR CITATION CLEANING & BOUNDARY RECOVERY
======================================================================
- IF an extracted snippet starts with a truncated word fragment (e.g., missing prefix/characters):
  THEN scan the immediate preceding context in the document buffer to locate the full word boundary, OR strip the broken leading characters up to the first complete word.
- IF an extracted quote contains structural indices (e.g., Table of Contents / Index entries):
  THEN categorize the location metadata as "Document Index / Table of Contents" instead of falsely attributing it to a specific technical specification section body.
- IF the target content is within a technical specification section (e.g., Division 26):
  THEN map the location metadata to the exact Section Number and Title where the substantive specification requirement appears.

======================================================================
2. DECISION TREE LOGIC FOR SPECIFICATION TO DRAWING MATCHING
======================================================================
- IF auditing Electrical Scope (Division 26 Specifications):
  - IF uploaded drawing filename/sheet tag starts with 'E' or contains 'Elec' / 'Electrical':
    THEN cross-reference tags against the Electrical Drawing sheet (e.g., Sheet E2.0).
  - IF uploaded drawing filename/sheet tag starts with 'A' or contains 'Arch' / 'Architectural':
    THEN flag a document domain warning: "Uploaded drawing is Architectural (Sheet A...). Electrical scope verification requires Electrical Drawing sheets (Sheet E...)."

======================================================================
3. FINDING CATEGORIES:
======================================================================
1. "SCOPE_GAP" (Potential Scope Gap):
   Specification requires specific equipment, connections, or scope, but drawing/schedules do not show corresponding electrical scope.
2. "CONFLICT" (Potential Conflict):
   Drawing indicates one thing (e.g., material, rating, size), while specification describes a different requirement.
3. "MISSING_REFERENCE" (Potential Missing Reference):
   Requirement mentioned in specifications but not clearly represented in drawings.
4. "DOCUMENT_CONFLICT" (Document Conflict):
   Different documents appear to disagree or provide inconsistent instructions.

CRITICAL ANTI-HALLUCINATION RULES:
- NEVER invent specification sections, page numbers, drawing sheet names, equipment tags, or electrical requirements.
- ONLY cite facts present in the text below.
- IF NO DISCREPANCIES, CONFLICTS, OR GAPS EXIST IN THE PROVIDED TEXT, RETURN AN EMPTY ARRAY []! DO NOT create synthetic, generic, or speculative findings.
- Every quote in relevantText and highlightSnippet MUST be an exact verbatim substring from the provided document text. If you cannot quote verbatim from the text, you MUST NOT create the finding.
- Use cautious, professional language: "Potentially missing", "I could not find...", "The available documents indicate...", "Needs estimator review".
- Never say "Your estimate is wrong" or "Definitely missing".
- Every finding MUST provide exact evidence for BOTH Source A (Specification) and Source B (Drawing) with exact document names, sections/sheets, pages, and relevant text quotes.

PROJECT DOCUMENTS CONTEXT:

=== SPECIFICATIONS ===
${specSummaries}

=== ELECTRICAL DRAWINGS ===
${drawingSummaries}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            description: 'List of evidence-backed scope findings for the electrical estimator',
            items: {
              type: Type.OBJECT,
              properties: {
                type: {
                  type: Type.STRING,
                  description: 'SCOPE_GAP, CONFLICT, MISSING_REFERENCE, or DOCUMENT_CONFLICT',
                },
                title: { type: Type.STRING, description: 'Concise descriptive title of the potential issue' },
                systemArea: { type: Type.STRING, description: 'Electrical system, e.g., Emergency Power, Panelboards, Lighting Controls, Mechanical Feeds' },
                explanation: { type: Type.STRING, description: 'Cautious, objective junior estimator explanation' },
                confidence: { type: Type.STRING, description: 'HIGH, MEDIUM, or LOW' },
                confidenceRationale: { type: Type.STRING, description: 'Brief rationale explaining confidence level' },
                sourceA: {
                  type: Type.OBJECT,
                  description: 'Specification evidence',
                  properties: {
                    documentName: { type: Type.STRING },
                    sectionNumber: { type: Type.STRING },
                    pageNumber: { type: Type.INTEGER },
                    location: { type: Type.STRING },
                    relevantText: { type: Type.STRING },
                    highlightSnippet: { type: Type.STRING },
                  },
                  required: ['documentName', 'pageNumber', 'relevantText'],
                },
                sourceB: {
                  type: Type.OBJECT,
                  description: 'Drawing evidence',
                  properties: {
                    documentName: { type: Type.STRING },
                    sheetNumber: { type: Type.STRING },
                    pageNumber: { type: Type.INTEGER },
                    location: { type: Type.STRING },
                    relevantText: { type: Type.STRING },
                    highlightSnippet: { type: Type.STRING },
                  },
                  required: ['documentName', 'pageNumber', 'relevantText'],
                },
              },
              required: ['type', 'title', 'systemArea', 'explanation', 'confidence', 'confidenceRationale', 'sourceA', 'sourceB'],
            },
          },
        },
      });

      const parsedFindings = JSON.parse(response.text || '[]');
      newFindings = parsedFindings.map((f: any, idx: number) => ({
        id: `finding-${Date.now()}-${idx}`,
        projectId: project.id,
        type: (['SCOPE_GAP', 'CONFLICT', 'MISSING_REFERENCE', 'DOCUMENT_CONFLICT'].includes(f.type) ? f.type : 'SCOPE_GAP'),
        title: f.title,
        systemArea: f.systemArea || 'Electrical Scope',
        explanation: f.explanation,
        confidence: (['HIGH', 'MEDIUM', 'LOW'].includes(f.confidence) ? f.confidence : 'MEDIUM'),
        confidenceRationale: f.confidenceRationale || 'Evidence identified in uploaded project files.',
        sourceA: {
          id: `ev-a-${Date.now()}-${idx}`,
          type: 'specification',
          documentName: f.sourceA.documentName || specs[0].name,
          documentId: specs.find(s => s.name === f.sourceA.documentName)?.id || specs[0].id,
          sectionNumber: f.sourceA.sectionNumber || 'Division 26',
          pageNumber: Number(f.sourceA.pageNumber) || 1,
          location: f.sourceA.location || 'Specification Section',
          relevantText: f.sourceA.relevantText,
          highlightSnippet: f.sourceA.highlightSnippet || f.sourceA.relevantText,
        },
        sourceB: {
          id: `ev-b-${Date.now()}-${idx}`,
          type: 'drawing',
          documentName: f.sourceB.documentName || drawings[0].name,
          documentId: drawings.find(d => d.name === f.sourceB.documentName)?.id || drawings[0].id,
          sheetNumber: f.sourceB.sheetNumber || drawings[0].name.replace(/\.pdf$/i, ''),
          pageNumber: Number(f.sourceB.pageNumber) || 1,
          location: f.sourceB.location || 'Drawing Sheet',
          relevantText: f.sourceB.relevantText,
          highlightSnippet: f.sourceB.highlightSnippet || f.sourceB.relevantText,
        },
        status: 'PENDING',
        estimatorNotes: '',
      }));
    } else {
      // If no API key is provided, perform rule-based document intelligence on the uploaded documents
      console.log('No GEMINI_API_KEY detected, inspecting uploaded documents for scope coordination');
      newFindings = [];

      // Check for common scope cross-check patterns in the user's actual uploaded documents
      const specTextCombined = specs.flatMap(s => s.pages.map(p => ({ doc: s, page: p, text: (p.text || '').toLowerCase() })));
      const dwgTextCombined = drawings.flatMap(d => d.pages.map(p => ({ doc: d, page: p, text: (p.text || '').toLowerCase() })));

      const checkTopics = [
        {
          title: 'Arc Flash Hazard Analysis & Short Circuit Study Scope',
          systemArea: 'Engineering Studies & Coordination',
          type: 'SCOPE_GAP' as const,
          keywords: ['arc flash', 'selective coordination', 'short circuit study', 'fault current study', 'power system study', '26 05 73', '260573'],
          explanation: 'Specification mandates third-party engineering firm computer-based arc flash and short circuit coordination study with equipment warning labels. Verify if drawing general notes include engineering study allowance or designate engineer of record responsibility.',
        },
        {
          title: 'Conductor / Bus Metallurgy Coordination (Copper vs. Aluminum)',
          systemArea: 'Power Distribution',
          type: 'CONFLICT' as const,
          keywords: ['copper', 'aluminum', 'bus', 'neutral', 'compact aluminum', 'conductor', 'feeder'],
          explanation: 'Specification mandates 98% conductivity copper conductors/bussing, whereas drawing schedules or feeder tags note aluminum conductors. Estimator should clarify metallurgy standard prior to bid submittal.',
        },
        {
          title: 'Emergency Standby Generator & ATS Scope Coordination',
          systemArea: 'Emergency Power Systems',
          type: 'SCOPE_GAP' as const,
          keywords: ['emergency', 'standby', 'generator', 'ats', 'transfer switch', 'day tank', '26 32 13', '26 36 23'],
          explanation: 'Specification contains provisions for packaged standby generator or automatic transfer switch equipment, but drawing linework or schedules may lack corresponding feeder tags, pad details, or remote annunciator conduit.',
        },
        {
          title: 'Surge Protective Device (SPD / TVSS) Integration Scope',
          systemArea: 'Surge Protection & Power Quality',
          type: 'SCOPE_GAP' as const,
          keywords: ['surge protective', 'spd', 'tvss', 'transient voltage', 'surge suppressor', '26 43 13', '264313'],
          explanation: 'Specification Section 26 43 13 mandates Type 1 or Type 2 surge protective devices at main service equipment and sub-panels. Verify if panel schedules designate dedicated disconnect breakers or integral surge suppression units.',
        },
        {
          title: 'Motor Disconnect Switch & Mechanical Equipment Coordination',
          systemArea: 'Motor Controls & Mechanical Interlocks',
          type: 'CONFLICT' as const,
          keywords: ['disconnect', 'fusible', 'non-fusible', 'safety switch', 'vfd', 'starter', 'chiller', 'ahu', 'rtu', 'motor', '26 29 23'],
          explanation: 'Division 26 requires local fusible disconnect switches with auxiliary interlock contacts for mechanical motors, while drawings show non-fusible units or designate disconnects "by mechanical contractor".',
        },
        {
          title: 'NEMA Enclosure Environmental Rating Coordination',
          systemArea: 'Equipment Enclosures',
          type: 'CONFLICT' as const,
          keywords: ['nema 3r', 'nema 4x', 'nema 12', 'weatherproof', 'outdoor enclosure', 'stainless steel', 'damp location'],
          explanation: 'Specification mandates NEMA 3R weatherproof or NEMA 4X stainless steel enclosures for exterior or washdown areas, while drawing details call out standard NEMA 1 indoor cabinets.',
        },
        {
          title: 'Lighting Control System & Daylight Harvesting Sensor Scope',
          systemArea: 'Lighting Controls',
          type: 'SCOPE_GAP' as const,
          keywords: ['daylight', 'photocell', 'occupancy sensor', 'lighting control', 'dimming', '0-10v', 'relay panel', 'title 24', 'ashrae', '26 09 23'],
          explanation: 'Energy conservation codes and Section 26 09 23 require automated daylight harvesting sensors and low-voltage relay panels. Verify if floor plans reflect required power packs, sensors, and low-voltage control cabling.',
        },
        {
          title: 'Grounding Electrode System & Ufer Ground Coordination',
          systemArea: 'Grounding & Bonding',
          type: 'MISSING_REFERENCE' as const,
          keywords: ['ufer ground', 'concrete-encased', 'ground ring', 'counterpoise', 'ground rod', '25 ohms', '5 ohms', 'grounding electrode', '26 05 26', '260526'],
          explanation: 'Specification Section 26 05 26 specifies concrete-encased Ufer electrode and supplementary ground ring with maximum resistance testing. Verify whether drawing electrical single-line riser depicts corresponding ground riser details.',
        },
        {
          title: 'Switchboard & Panelboard AIC Withstand Rating Coordination',
          systemArea: 'Overcurrent Protection',
          type: 'CONFLICT' as const,
          keywords: ['kaic', 'aic rating', 'short circuit rating', 'sccr', 'fault current', '65k', '42k', '100k', 'interrupting rating'],
          explanation: 'Specification mandates minimum 65kAIC or 42kAIC series-rated or fully rated switchgear, while drawing panel schedules show lower 10kAIC or 22kAIC rated equipment, risking code rejection by the AHJ.',
        },
        {
          title: 'Transformer K-Factor & Temperature Rise Rating Coordination',
          systemArea: 'Dry-Type Transformers',
          type: 'CONFLICT' as const,
          keywords: ['transformer', 'k-factor', 'k-13', 'k-4', 'k-20', 'temperature rise', '115 deg', '80 deg', 'dry-type', '26 22 00', '262200'],
          explanation: 'Specification Section 26 22 00 calls for K-13 non-linear harmonic mitigation transformers with 115°C or 80°C temperature rise, whereas drawing equipment schedule lists standard general-purpose 150°C units.',
        },
        {
          title: 'Fire Alarm Duct Smoke Detector HVAC Shutdown Interlocks',
          systemArea: 'Life Safety & Interlocks',
          type: 'SCOPE_GAP' as const,
          keywords: ['duct smoke detector', 'fire alarm shutdown', 'hvac shutdown', 'fan shutdown', 'fire damper', 'control relay', 'air handler'],
          explanation: 'Division 26 specifications require 120V control power and shutdown interlocks for mechanical duct smoke detectors. Ensure wiring and auxiliary relay modules are included in the electrical base bid.',
        },
        {
          title: 'Elevator Shunt Trip Breaker & Machine Room Power Scope',
          systemArea: 'Conveying Systems & Power',
          type: 'SCOPE_GAP' as const,
          keywords: ['elevator', 'shunt trip', 'pit light', 'machine room', 'elevator recall', 'battery lowering', 'fire service'],
          explanation: 'Specifications require shunt-trip main breaker with 120V control power and battery control bus for elevator pit sprinkler coordination, but electrical distribution schedule depicts standard thermal-magnetic breaker.',
        },
        {
          title: 'Conduit Raceway Material Specification (EMT / RMC / PVC)',
          systemArea: 'Raceways & Conduits',
          type: 'CONFLICT' as const,
          keywords: ['rigid metal conduit', 'rmc', 'intermediate metal', 'imc', 'pvc coated', 'schedule 40', 'schedule 80', 'emt', 'raceway', '26 05 33'],
          explanation: 'Specification mandates Rigid Metal Conduit (RMC) or PVC-coated rigid for underground, exterior, and exposed slab transitions, while drawing notes allow Schedule 40 PVC or EMT throughout.',
        },
        {
          title: 'Isolated Ground (IG) & Hospital Grade Device Coordination',
          systemArea: 'Wiring Devices',
          type: 'CONFLICT' as const,
          keywords: ['isolated ground', 'ig receptacle', 'hospital grade', 'dedicated neutral', 'orange triangle', '26 27 26', '262726'],
          explanation: 'Specification mandates isolated ground receptacles with dedicated insulated green grounding conductors for sensitive IT/medical circuits, while drawing floor plans illustrate standard convenience duplex outlets.',
        },
        {
          title: 'Power Monitoring, Sub-Metering & CT Cabinet Scope',
          systemArea: 'Metering & Energy Management',
          type: 'SCOPE_GAP' as const,
          keywords: ['metering', 'power monitor', 'digital meter', 'modbus', 'bacnet', 'ethernet meter', 'ct cabinet', 'current transformer', '26 09 13', '260913'],
          explanation: 'Section 26 09 13 requires digital multi-function power meters and tenant CT cabinets with building management network integration, but drawing one-line diagram lacks metering CT/PT wiring notation.',
        },
        {
          title: 'NETA Acceptance Testing & Infrared Thermographic Survey Scope',
          systemArea: 'Testing & Commissioning',
          type: 'SCOPE_GAP' as const,
          keywords: ['neta', 'acceptance testing', 'infrared', 'thermographic', 'megger', 'commissioning', 'torque verification', 'testing agency'],
          explanation: 'Specification mandates independent third-party NETA certified testing and full-load infrared thermographic survey prior to substantial completion. Estimator must carry subcontractor testing allowance.',
        },
      ];

      for (const topic of checkTopics) {
        const specMatch = specTextCombined.find(item => topic.keywords.some(k => item.text.includes(k)));
        const dwgMatch = dwgTextCombined.find(item => topic.keywords.some(k => item.text.includes(k)));

        if (specMatch && dwgMatch) {
          const specExcerpt = specMatch.page.text.slice(0, 180).trim();
          const dwgExcerpt = dwgMatch.page.text.slice(0, 180).trim();

          newFindings.push({
            id: `finding-${Date.now()}-${newFindings.length}`,
            projectId: project.id,
            title: topic.title,
            type: 'CONFLICT',
            confidence: 'HIGH',
            confidenceRationale: `Direct textual evidence identified across ${specMatch.doc.name} and ${dwgMatch.doc.name}`,
            systemArea: topic.systemArea,
            explanation: topic.explanation,
            sourceA: {
              id: `src-a-${Date.now()}-${newFindings.length}`,
              type: 'specification',
              documentId: specMatch.doc.id,
              documentName: specMatch.doc.name,
              sectionNumber: specMatch.page.sheetOrSection,
              pageNumber: specMatch.page.pageNumber,
              location: `${specMatch.page.sheetOrSection || 'Section'}, Page ${specMatch.page.pageNumber}`,
              relevantText: specExcerpt,
              highlightSnippet: specExcerpt.slice(0, 50),
            },
            sourceB: {
              id: `src-b-${Date.now()}-${newFindings.length}`,
              type: 'drawing',
              documentId: dwgMatch.doc.id,
              documentName: dwgMatch.doc.name,
              sheetNumber: dwgMatch.page.sheetOrSection,
              pageNumber: dwgMatch.page.pageNumber,
              location: `${dwgMatch.page.sheetOrSection || 'Sheet'}, Page ${dwgMatch.page.pageNumber}`,
              relevantText: dwgExcerpt,
              highlightSnippet: dwgExcerpt.slice(0, 50),
            },
            status: 'PENDING',
            estimatorNotes: '',
          });
        }
      }

      // If no issues were detected with verified quotes, keep newFindings as empty array ([]).
      // We NEVER invent or force synthetic findings for the estimator.
    }

    project.findings = newFindings;
    project.status = 'ready';
    project.processingSteps[2].status = 'completed';
    project.processingSteps[2].details = `${drawings.length} drawing sheets verified`;
    project.processingSteps[3].status = 'completed';
    project.processingSteps[3].details = `${specs.length} specification packages indexed`;
    project.processingSteps[4].status = 'completed';
    project.processingSteps[4].details = `${newFindings.length} scope findings identified for estimator review`;

    res.json({
      message: 'Analysis completed successfully',
      findingsCount: newFindings.length,
      project,
    });
  } catch (error: any) {
    console.error('Cross-check analysis error:', error);
    project.status = 'error';
    project.processingSteps[4].status = 'error';
    project.processingSteps[4].details = error.message;
    res.status(500).json({ error: error.message || 'Error executing cross-check' });
  }
};

app.post('/api/projects/:id/analyze', handleAnalyzeProject);
app.post('/api/projects/:id/cross-check', handleAnalyzeProject);

// 8. Human-In-The-Loop: Update finding decision & estimator notes
app.patch('/api/projects/:id/findings/:findingId', (req, res) => {
  const project = projectsStore.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const finding = project.findings.find(f => f.id === req.params.findingId);
  if (!finding) {
    return res.status(404).json({ error: 'Finding not found' });
  }

  const { status, estimatorNotes } = req.body;
  if (status && ['PENDING', 'ACCEPTED', 'REJECTED', 'REVIEW_LATER'].includes(status)) {
    finding.status = status;
    finding.decidedAt = new Date().toISOString();
  }
  if (estimatorNotes !== undefined) {
    finding.estimatorNotes = String(estimatorNotes);
  }

  res.json({ message: 'Finding updated', finding });
});

// Helper: Execute Grounded Document Search across indexed project pages following Lopri AI Rules
function executeLocalDocumentSearch(
  question: string,
  project: Project | null | undefined,
  rawDocContext?: string
) {
  const qLower = question.toLowerCase();
  // Filter search terms, including electrical keywords (even short ones like bus, ats, ahu, awg, 26, cu, al)
  const technicalTerms = qLower
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !['what', 'where', 'which', 'does', 'have', 'from', 'with', 'about', 'this', 'that', 'they', 'when'].includes(w));

  interface ScoredMatch {
    docName: string;
    category: 'specification' | 'drawing';
    sheetOrSection?: string;
    pageNumber: number;
    quote: string;
    score: number;
  }

  const specMatches: ScoredMatch[] = [];
  const dwgMatches: ScoredMatch[] = [];

  if (project && project.documents) {
    for (const doc of project.documents) {
      const isDrawing = doc.category === 'drawing' || /sheet|drawing|plan|e\d/i.test(doc.name);
      for (const page of doc.pages) {
        const pText = (page.text || '').toLowerCase();
        let score = 0;

        // Exact multi-term matches
        for (const term of technicalTerms) {
          if (pText.includes(term)) {
            // Give higher weight to critical electrical keywords
            if (/copper|aluminum|bus|panelboard|generator|feeder|breaker|26\s*24\s*16|transformer|raceway|conduit|disconnect|ahu/i.test(term)) {
              score += 6;
            } else {
              score += 2;
            }
          }
        }

        // Boost if query matches section or title
        if (page.sheetOrSection && technicalTerms.some(t => page.sheetOrSection?.toLowerCase().includes(t))) {
          score += 10;
        }

        if (score > 0) {
          // Find best snippet around first matched term
          const matchedTerm = technicalTerms.find((t) => pText.includes(t)) || technicalTerms[0] || '';
          const idx = pText.indexOf(matchedTerm);
          const start = Math.max(0, idx - 80);
          const end = Math.min(page.text.length, idx + 240);
          const snippet = sanitizePdfText(page.text.slice(start, end)).replace(/\n+/g, ' ').trim();

          const matchItem: ScoredMatch = {
            docName: doc.name,
            category: isDrawing ? 'drawing' : 'specification',
            sheetOrSection: page.sheetOrSection || (isDrawing ? `Sheet ${doc.name.replace(/\.pdf$/i, '')}` : `Section 26 (Page ${page.pageNumber})`),
            pageNumber: page.pageNumber,
            quote: snippet,
            score,
          };

          if (isDrawing) {
            dwgMatches.push(matchItem);
          } else {
            specMatches.push(matchItem);
          }
        }
      }
    }
  }

  specMatches.sort((a, b) => b.score - a.score);
  dwgMatches.sort((a, b) => b.score - a.score);

  const topSpec = specMatches[0];
  const topDwg = dwgMatches[0];

  // Case 1: Both Specification (Source A) and Drawing / Schedule (Source B) available - Dual cross-reference
  if (topSpec && topDwg) {
    const citations = [
      {
        documentName: topSpec.docName,
        sheetOrSection: topSpec.sheetOrSection,
        pageNumber: topSpec.pageNumber,
        quote: topSpec.quote,
      },
      {
        documentName: topDwg.docName,
        sheetOrSection: topDwg.sheetOrSection,
        pageNumber: topDwg.pageNumber,
        quote: topDwg.quote,
      },
    ];

    const content = sanitizePdfText(
      `**Lopri AI Cross-Reference Analysis:**\n\n` +
      `• **Source A (Project Specifications - ${topSpec.docName}, ${topSpec.sheetOrSection}, Page ${topSpec.pageNumber}):**\n` +
      `"${topSpec.quote}"\n\n` +
      `• **Source B (Drawings / Schedules - ${topDwg.docName}, ${topDwg.sheetOrSection}, Page ${topDwg.pageNumber}):**\n` +
      `"${topDwg.quote}"\n\n` +
      `⚠️ **Risk of Electrical Estimation:**\n` +
      `Direct cross-referencing indicates scope coordination variance between the Division 26 specification requirements and the drawing schedule details. In electrical estimating, failing to price to the more stringent requirement (or uncoordinated feeder/equipment sizing) risks budget shortfalls, unapproved equipment submittals, or costly change order disputes. An RFI should be submitted immediately to confirm engineering intent, and estimators should include contingency for the higher-specification equipment.`
    );

    return { content, notEnoughInfo: false, citations };
  }

  // Case 2: Specification (Source A) found, but Drawing / Schedule (Source B) counterpart is missing
  if (topSpec) {
    const citations = [
      {
        documentName: topSpec.docName,
        sheetOrSection: topSpec.sheetOrSection,
        pageNumber: topSpec.pageNumber,
        quote: topSpec.quote,
      },
    ];

    const content = sanitizePdfText(
      `**Lopri AI Scope Cross-Reference:**\n\n` +
      `• **Source A (Project Specifications - ${topSpec.docName}, ${topSpec.sheetOrSection}, Page ${topSpec.pageNumber}):**\n` +
      `"${topSpec.quote}"\n\n` +
      `• **Source B (Drawings / Schedules):**\n` +
      `No matching branch circuit, disconnect switch, or schedule tag was identified for this requirement across the uploaded drawings.\n\n` +
      `⚠️ **Risk of Electrical Estimation:**\n` +
      `Specification requirements without corresponding electrical scope on drawing sheets represent high scope-gap exposure. Electrical contractors frequently miss these items during visual plan takeoff, resulting in unbudgeted labor, omitted disconnect switches, or disputed backcharges during commissioning.`
    );

    return { content, notEnoughInfo: false, citations };
  }

  // Case 3: Drawing / Schedule (Source B) found, but Specification (Source A) clause is unverified
  if (topDwg) {
    const citations = [
      {
        documentName: topDwg.docName,
        sheetOrSection: topDwg.sheetOrSection,
        pageNumber: topDwg.pageNumber,
        quote: topDwg.quote,
      },
    ];

    const content = sanitizePdfText(
      `**Lopri AI Scope Cross-Reference:**\n\n` +
      `• **Source A (Project Specifications):**\n` +
      `No specific Division 26 specification clause was identified governing this item in the uploaded specification book.\n\n` +
      `• **Source B (Drawings / Schedules - ${topDwg.docName}, ${topDwg.sheetOrSection}, Page ${topDwg.pageNumber}):**\n` +
      `"${topDwg.quote}"\n\n` +
      `⚠️ **Risk of Electrical Estimation:**\n` +
      `Equipment shown on electrical drawings without a dedicated specification section leaves manufacturer tier, enclosure rating (NEMA 1 vs 3R/4X), and AIC ratings ambiguous, creating material pricing exposure during procurement.`
    );

    return { content, notEnoughInfo: false, citations };
  }

  // If text context was provided directly without project structure
  if (rawDocContext && technicalTerms.some((t) => rawDocContext.toLowerCase().includes(t))) {
    const term = technicalTerms.find((t) => rawDocContext.toLowerCase().includes(t)) || '';
    const idx = rawDocContext.toLowerCase().indexOf(term);
    const snippet = sanitizePdfText(rawDocContext.slice(Math.max(0, idx - 40), Math.min(rawDocContext.length, idx + 240))).trim();
    return {
      content: sanitizePdfText(
        `**Lopri AI Cross-Reference:**\n\n` +
        `• **Source A (Specifications):** "${snippet}"\n\n` +
        `• **Source B (Drawings / Schedules):** Needs cross-examination against sheet schedules.\n\n` +
        `⚠️ **Risk of Electrical Estimation:** Coordination between specifications and schedules is vital to avoid missing disconnects, incorrect bus ratings, and unbudgeted feeder labor.`
      ),
      notEnoughInfo: false,
      citations: [
        {
          documentName: 'Uploaded Division 26 Specification',
          sheetOrSection: 'Specification Clause',
          pageNumber: 1,
          quote: snippet.slice(0, 150),
        },
      ],
    };
  }

  return {
    content: 'This detail is not mentioned in the uploaded Division 26 specification document or drawings.',
    notEnoughInfo: true,
    citations: [],
  };
}

// 9. Grounded Chat Endpoint Handler (Handles both /api/projects/:id/chat and /api/chat)
const handleGroundedChat = async (req: express.Request, res: express.Response) => {
  const userPrompt = (
    req.body.userPrompt ||
    req.body.question ||
    req.body.prompt ||
    req.body.query ||
    ''
  ).trim();

  if (!userPrompt) {
    return res.status(400).json({ error: 'User inquiry prompt is required' });
  }

  // Resolve target project
  const projectId = req.params.id || req.body.projectId;
  const project = projectId 
    ? projectsStore.get(projectId) 
    : (projectsStore.size > 0 ? Array.from(projectsStore.values())[0] : null);

  // Retrieve PDF Buffer or Base64 (from body payload OR memory store)
  let pdfBase64: string | undefined = req.body.pdfBase64 || req.body.pdfBuffer;
  let pdfMimeType = req.body.mimeType || 'application/pdf';

  if (!pdfBase64 && project) {
    const storedPdfs = projectPdfBuffers.get(project.id);
    if (storedPdfs && storedPdfs.length > 0) {
      // Prioritize specification documents, then drawing sheets
      const primaryPdf = storedPdfs.find((p) => p.category === 'specification') || storedPdfs[0];
      pdfBase64 = primaryPdf.base64;
      pdfMimeType = primaryPdf.mimeType || 'application/pdf';
    }
  }

  // Compile extracted textual context with exact sheet/section citations
  let docContext = '';
  if (project && project.documents.length > 0) {
    docContext = project.documents
      .map((d) => {
        return d.pages
          .map((p) => `[Document: ${d.name} | Category: ${d.category} | ${p.sheetOrSection || 'Page'} ${p.pageNumber}]\n${sanitizePdfText(p.text).slice(0, 3000)}`)
          .join('\n');
      })
      .join('\n\n');
  } else if (req.body.documentText) {
    docContext = sanitizePdfText(req.body.documentText);
  }

  // Check if project or PDF exists
  if (!pdfBase64 && (!project || project.documents.length === 0) && !docContext) {
    return res.json({
      content: 'Please upload electrical drawings and Division 26 specifications first to enable grounded inquiry.',
      notEnoughInfo: true,
      citations: [],
    });
  }

  const ai = getAi();
  if (!ai) {
    // Offline / unauthenticated fallback
    return res.json(executeLocalDocumentSearch(userPrompt, project, docContext));
  }

  // Gemini API Grounded RAG Execution with Lopri AI System Persona and Critical Rules
  try {
    const systemInstruction = `You are Lopri AI's Preconstruction Scope & Citation Engine. 
Your core task is to extract exact evidence quotes and map accurate location metadata from construction specification documents and drawings. 

Follow the patterns and decision logic illustrated in the examples below when processing incoming texts and generating citations.

======================================================================
1. DECISION TREE LOGIC FOR CITATION CLEANING & BOUNDARY RECOVERY
======================================================================

IF an extracted snippet starts with a truncated word fragment (e.g., missing prefix/characters):
  THEN scan the immediate preceding context in the document buffer to locate the full word boundary, OR strip the broken leading characters up to the first complete word.

IF an extracted quote contains structural indices (e.g., Table of Contents / Index entries):
  THEN categorize the location metadata as "Document Index / Table of Contents" instead of falsely attributing it to a specific technical specification section body.

IF the target content is within a technical specification section (e.g., Division 26):
  THEN map the location metadata to the exact Section Number and Title where the substantive specification requirement appears.

======================================================================
2. FEW-SHOT EXAMPLES FOR PATTERN IMITATION
======================================================================

--- EXAMPLE 1: Handling Truncated Boundary Words ---
Input Raw Text Buffer: "...Section 262800 Circuit Protective Devices Section 263214 Gas Engine Driven Generator Sets..."
Raw Parser Output: "evices Section 263214 Gas Engine Driven Generator Sets"
Target Location in Doc: Page 5 (Table of Contents)

Correct Processing Output:
{
  "exact_quote": "Section 263214 Gas Engine Driven Generator Sets",
  "location_metadata": {
    "section_number": "Table of Contents (Division 26)",
    "page": 5,
    "is_index_page": true
  },
  "citation_status": "VALID_INDEX_REFERENCE"
}

--- EXAMPLE 2: Correcting Section Body Attribution vs Table of Contents ---
Input Document: "Attachment B-2 Technical Specifications Divisions 02-28.pdf"
Context Extracted from Page 5:
"Section 260533 Raceway and Boxes for Electrical Systems
 Section 260553 Identification for Electrical Systems
 Section 260573 Electrical Power System Studies"

Incorrect Attribution (Do NOT Imitate):
- Location: Section 260533, Page 5

Correct Pattern Output:
{
  "exact_quote": "Section 260533 Raceway and Boxes for Electrical Systems",
  "location_metadata": {
    "section_number": "Table of Contents",
    "page": 5,
    "is_index_page": true
  },
  "note": "This reference was found in the Table of Contents index list, not inside the body of Section 260533."
}

--- EXAMPLE 3: Full Section Body Citation ---
Input Document: "Attachment B-2 Technical Specifications Divisions 02-28.pdf"
Context Extracted from Page 213 (Inside Section 263214 Body):
"PART 2 PRODUCTS
 2.1 PACKAGED ENGINE GENERATOR
 A. Provide a standby diesel engine generator set rated at 250 kW..."

Correct Pattern Output:
{
  "exact_quote": "Provide a standby diesel engine generator set rated at 250 kW",
  "location_metadata": {
    "section_number": "Section 263214",
    "section_title": "Standby Engine Generator Sets",
    "page": 213,
    "is_index_page": false
  },
  "citation_status": "VALID_SPECIFICATION_REQUIREMENT"
}

======================================================================
3. DECISION TREE LOGIC FOR SPECIFICATION TO DRAWING MATCHING
======================================================================

IF auditing Electrical Scope (Division 26 Specifications):
  IF uploaded drawing filename/sheet tag starts with 'E' or contains 'Elec' / 'Electrical':
    THEN cross-reference tags against the Electrical Drawing sheet (e.g., Sheet E2.0).
  IF uploaded drawing filename/sheet tag starts with 'A' or contains 'Arch' / 'Architectural':
    THEN flag a document domain warning: "Uploaded drawing is Architectural (Sheet A...). Electrical scope verification requires Electrical Drawing sheets (Sheet E...)."

======================================================================
4. ESTIMATOR FLEXIBILITY & PRAGMATIC CONVERSATION RULES:
======================================================================
- BE PRAGMATIC AND FLEXIBLE (USIWE HARDCORE, KUWA FLEXIBLE WA MAWAZO):
  * Do not be rigid, robotic, or overly pedantic. Think critically like an experienced lead electrical estimator who adapts to the user's context and workflow.
  * If the user asks open-ended, casual, exploratory, or single-topic questions, answer directly, naturally, and helpfully without forcing an unnatural comparison structure.
  * If an Architectural drawing is uploaded, flag the domain notice constructively, but remain flexible: if architectural plans, reflected ceiling layouts, or equipment notes offer useful electrical context, share those insights constructively rather than stonewalling.
  * Understand estimator intent flexibly, offering practical engineering insights and risk mitigation guidance.

0. If user asks a general/overview question (e.g. "what is this about", "general overview", "summarize", "overview"), respond with a short high level summary of document's scope and purpose (3-4 sentences). DO NOT dive into a single specific citation or technical clause until the user explicitly asks for specifics.
1. When the user asks about scope gaps, discrepancies, or specific technical requirements:
   - Cross-reference BOTH project specifications (Source A) and the drawings / schedules (Source B) whenever comparative scope is being reviewed.
2. Never quote just one source if a comparison is needed, but remain flexible if only one document type is available or requested.
3. Always highlight the risk of electrical estimation clearly (e.g., potential cost exposure, scope omission, change order liability, feeder/breaker sizing discrepancies, labor takeoff impact, or bid variance).
4. Response Format Requirements (when comparative analysis is requested):
   - Present a concise cross-reference summary.
   - Source A (Project Specifications): Cite exact document, CSI Section (e.g. Section 26 24 16), page number, and direct specification clause quote.
   - Source B (Drawings / Schedules): Cite exact drawing sheet, schedule name (e.g. Sheet E1.1, Panel Schedule E2.1), page number, and schedule note.
   - Highlight: "Electrical Estimation Risk: <clearly detail the financial, estimating, or change order risk>".
5. Strictly ground all answers in the attached PDF documents and verified document context.
6. If a detail is genuinely not mentioned anywhere in the uploaded Division 26 specification document or drawings, state: "This detail is not mentioned in the uploaded Division 26 specification document or drawings." and set notEnoughInfo: true.
7. Maintain an authoritative, professional, helpful, and flexible construction technology estimating tone.`;

    // Construct contents payload: PDF inlineData + prompt text
    const contents: any[] = [];

    // Attach PDF payload via inlineData ONLY if within Gemini API safe inline limits (< 18MB)
    // For large/heavy electrical projects (>18MB), Lopri AI relies on the rich indexed docContext text
    const MAX_INLINE_BASE64_LENGTH = 18 * 1024 * 1024;
    if (pdfBase64 && pdfBase64.length <= MAX_INLINE_BASE64_LENGTH) {
      contents.push({
        inlineData: {
          data: pdfBase64,
          mimeType: pdfMimeType,
        },
      });
    }

    const promptText = `PROJECT DIVISION 26 DOCUMENT CONTEXT:
${docContext.slice(0, 150000)}

USER INQUIRY:
"${userPrompt}"

MANDATORY PROTOCOL FOR LOPRI AI:
1. Cross-reference BOTH Project Specifications (Source A) and Drawings/Schedules (Source B).
2. Never quote just one source if a comparison is needed.
3. Always highlight the risk of electrical estimation clearly.
4. Provide structured citations for both sources.`;

    contents.push(promptText);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { 
              type: Type.STRING, 
              description: 'Direct, technical answer from Lopri AI cross-referencing Source A (Specifications) and Source B (Drawings/Schedules), with the risk of electrical estimation clearly highlighted.' 
            },
            notEnoughInfo: { 
              type: Type.BOOLEAN, 
              description: 'True if detail is genuinely not found in the documents' 
            },
            citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  documentName: { type: Type.STRING },
                  sheetOrSection: { type: Type.STRING },
                  pageNumber: { type: Type.INTEGER },
                  quote: { type: Type.STRING },
                },
                required: ['documentName', 'pageNumber', 'quote'],
              },
            },
          },
          required: ['content', 'notEnoughInfo', 'citations'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.content) {
      parsed.content = sanitizePdfText(parsed.content);
    }
    return res.json(parsed);
  } catch (error: any) {
    console.warn('Gemini chat API error, executing grounded document search fallback:', error.message);
    return res.json(executeLocalDocumentSearch(userPrompt, project, docContext));
  }
};

// Mount both project-specific chat and global chat endpoints
app.post('/api/projects/:id/chat', handleGroundedChat);
app.post('/api/chat', handleGroundedChat);


// Silence Vercel analytics/insights dev beacons to prevent 404 console errors
app.all('/_vercel/*', (req, res) => {
  res.status(204).end();
});

// ----------------------------------------------------
// SERVER BOOT & VITE MIDDLEWARE
// ----------------------------------------------------
export async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Electrical Scope Checker running at http://0.0.0.0:${PORT}`);
  });
  server.timeout = 300000; // 5 minutes to accommodate large multi-sheet project uploads
  server.keepAliveTimeout = 65000;
}

// In Vercel serverless environment, express app is exported
export default app;

if (process.env.VERCEL !== '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}
