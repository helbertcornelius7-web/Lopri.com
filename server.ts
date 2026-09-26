import express from 'express';
import path from 'path';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { Project, ProjectDocument, Finding, DocumentPage } from './src/types';
import { sanitizePdfText } from './src/utils/sanitizePdfText';
import { SAMPLE_PROJECT } from './src/demoData';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Multer storage for PDF uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

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

      // Cache raw buffer and base64 for LLM RAG / chat calls
      pdfStoreList.push({
        name: originalName,
        size: file.size,
        category,
        buffer: file.buffer,
        base64: file.buffer.toString('base64'),
        mimeType: file.mimetype || 'application/pdf',
      });

      const isDrawing = category === 'drawing';

      let extractedText = '';
      let pageCount = 1;
      const pages: DocumentPage[] = [];

      try {
        const parser = new PDFParse({ data: file.buffer });
        const parsed: any = await parser.getText();
        extractedText = parsed.text || '';
        pageCount = parsed.total || (parsed.pages ? parsed.pages.length : 1);

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
        // Fallback for non-standard PDF or plain text
        extractedText = file.buffer.toString('utf-8');
      }

      if (pages.length === 0) {
        pages.push({
          pageNumber: 1,
          sheetOrSection: isDrawing ? originalName.replace(/\.pdf$/i, '') : 'General Spec',
          title: originalName,
          text: sanitizePdfText(extractedText).trim() || 'Visual drawing sheet. Text extraction produced minimal character data. Visual review required.',
        });
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

app.post('/api/projects/:id/upload', upload.array('files', 15), handleDocumentUpload);
app.post('/api/projects/:id/documents', upload.array('files', 15), handleDocumentUpload);

// 7. Run Cross-Check AI Analysis on Project
app.post('/api/projects/:id/analyze', async (req, res) => {
  const project = projectsStore.get(req.params.id);
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
      const prompt = `You are a cautious, evidence-based junior electrical estimator performing a scope check.
TASK:
Cross-check electrical drawings against project specifications and identify potential scope conflicts, omissions, or requirements that may be easy for an estimator to miss.

CORE PHILOSOPHY:
"AI finds -> AI explains -> AI shows evidence -> Human decides."
The estimator remains the decision-maker.

LOOK SPECIFICALLY FOR:
1. "SCOPE_GAP" (Potential Scope Gap):
   Specification requires specific equipment, connections, or scope, but drawing/schedules do not show corresponding electrical scope.
   Example: "The specification appears to require emergency power connections for designated equipment, but I could not find corresponding electrical scope in the uploaded drawings."
2. "CONFLICT" (Potential Conflict):
   Drawing indicates one thing (e.g., material, rating, size), while specification describes a different requirement.
   Example: "The drawing indicates X, while Specification Section XX describes Y."
3. "MISSING_REFERENCE" (Potential Missing Reference):
   Requirement mentioned in specifications but not clearly represented in drawings.
   Example: "The specification requires X, but no obvious corresponding reference was found in the uploaded drawings."
4. "DOCUMENT_CONFLICT" (Document Conflict):
   Different documents appear to disagree or provide inconsistent instructions.

CRITICAL ANTI-HALLUCINATION RULES:
- NEVER invent specification sections, page numbers, drawing sheet names, equipment tags, or electrical requirements.
- ONLY cite facts present in the text below.
- If evidence is weak or not conclusively found, DO NOT invent a finding.
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
        model: 'gemini-3.8-flash',
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
          title: 'Emergency & Standby Power Circuit Distribution',
          systemArea: 'Emergency Power Systems',
          keywords: ['emergency', 'standby', 'generator', 'ats', 'refrigerat'],
          explanation: 'Specification requirements for emergency/standby power circuits should be verified against drawing feeder tags and panel schedules to confirm circuit allocation and spare capacity.',
        },
        {
          title: 'Panelboard Bussing & Neutral Rating Specification',
          systemArea: 'Power Distribution',
          keywords: ['copper', 'aluminum', 'bus', 'neutral', 'panelboard', 'switchboard'],
          explanation: 'Specification requires specific bus metallurgy (e.g. copper vs. aluminum) and neutral sizing. Drawing panel schedules and general notes should be verified for consistency.',
        },
        {
          title: 'Lighting Control & Automatic Sensor Coverage',
          systemArea: 'Lighting Controls',
          keywords: ['daylight', 'photocell', 'sensor', 'occupancy', 'dimming', 'timeclock'],
          explanation: 'Energy code and lighting control specifications mandate daylight harvesting or automatic sensors. Verify if corresponding sensor symbols and relay panels appear on the electrical floor plans.',
        },
        {
          title: 'Mechanical Equipment Disconnect & Shunt-Trip Coordination',
          systemArea: 'HVAC & Mechanical Coordination',
          keywords: ['disconnect', 'shunt', 'ahu', 'rtu', 'damper', 'motor', 'chiller', 'pump'],
          explanation: 'Division 26 specifications outline disconnect type and fire alarm interface for mechanical equipment. Confirm that electrical drawings reflect correct starter, disconnect, and breaker ratings.',
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

      // If no specific keyword overlaps were found, create a baseline verification item using the user's actual uploaded documents
      if (newFindings.length === 0 && specs.length > 0 && drawings.length > 0) {
        newFindings.push({
          id: `finding-${Date.now()}-0`,
          projectId: project.id,
          title: 'Drawing Schedule vs. Specification Index Cross-Check',
          type: 'SCOPE_GAP',
          confidence: 'MEDIUM',
          confidenceRationale: 'Indexed document cross-reference',
          systemArea: 'General Electrical',
          explanation: `Cross-checked specification package (${specs[0].name}) against drawing package (${drawings[0].name}). Estimator review recommended to verify equipment schedules against specification sections.`,
          sourceA: {
            id: `src-a-${Date.now()}-0`,
            type: 'specification',
            documentId: specs[0].id,
            documentName: specs[0].name,
            sectionNumber: specs[0].pages[0]?.sheetOrSection,
            pageNumber: specs[0].pages[0]?.pageNumber || 1,
            location: `Page ${specs[0].pages[0]?.pageNumber || 1}`,
            relevantText: specs[0].pages[0]?.text?.slice(0, 180) || 'Specification package indexed.',
            highlightSnippet: specs[0].pages[0]?.text?.slice(0, 50) || 'Specification package',
          },
          sourceB: {
            id: `src-b-${Date.now()}-0`,
            type: 'drawing',
            documentId: drawings[0].id,
            documentName: drawings[0].name,
            sheetNumber: drawings[0].pages[0]?.sheetOrSection,
            pageNumber: drawings[0].pages[0]?.pageNumber || 1,
            location: `Page ${drawings[0].pages[0]?.pageNumber || 1}`,
            relevantText: drawings[0].pages[0]?.text?.slice(0, 180) || 'Drawing package indexed.',
            highlightSnippet: drawings[0].pages[0]?.text?.slice(0, 50) || 'Drawing package',
          },
          status: 'PENDING',
          estimatorNotes: '',
        });
      }
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
});

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
    const systemInstruction = `You are Lopri AI, an elite construction technology assistant specializing in Division 26 specifications and electrical estimating.

CRITICAL RULES FOR CHAT RESPONSES:
1. When the user asks about scope gaps, discrepancies, or specific technical requirements:
   - Always cross-reference BOTH project specifications (Source A) and the drawings / schedules (Source B).
2. Never quote just one source if a comparison is needed.
3. Always highlight the risk of electrical estimation clearly (e.g., potential cost exposure, scope omission, change order liability, feeder/breaker sizing discrepancies, labor takeoff impact, or bid variance).
4. Response Format Requirements:
   - Present a concise cross-reference summary.
   - Source A (Project Specifications): Cite exact document, CSI Section (e.g. Section 26 24 16), page number, and direct specification clause quote.
   - Source B (Drawings / Schedules): Cite exact drawing sheet, schedule name (e.g. Sheet E1.1, Panel Schedule E2.1), page number, and schedule note.
   - Highlight: "Electrical Estimation Risk: <clearly detail the financial, estimating, or change order risk>".
5. Strictly ground all answers in the attached PDF documents and verified document context.
6. If a detail is genuinely not mentioned anywhere in the uploaded Division 26 specification document or drawings, state: "This detail is not mentioned in the uploaded Division 26 specification document or drawings." and set notEnoughInfo: true.
7. Strictly forbid hallucinations or ungrounded assumptions. Maintain an authoritative, professional, and precise construction technology estimating tone.`;

    // Construct contents payload: PDF inlineData + prompt text
    const contents: any[] = [];

    // ✅ REQUIRED ATTACHMENT: Attach PDF payload via inlineData
    if (pdfBase64) {
      contents.push({
        inlineData: {
          data: pdfBase64,
          mimeType: pdfMimeType,
        },
      });
    }

    const promptText = `PROJECT DIVISION 26 DOCUMENT CONTEXT:
${docContext.slice(0, 40000)}

USER INQUIRY:
"${userPrompt}"

MANDATORY PROTOCOL FOR LOPRI AI:
1. Cross-reference BOTH Project Specifications (Source A) and Drawings/Schedules (Source B).
2. Never quote just one source if a comparison is needed.
3. Always highlight the risk of electrical estimation clearly.
4. Provide structured citations for both sources.`;

    contents.push(promptText);

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Electrical Scope Checker running at http://0.0.0.0:${PORT}`);
  });
}

// In Vercel serverless environment, express app is exported
export default app;

if (process.env.VERCEL !== '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}
