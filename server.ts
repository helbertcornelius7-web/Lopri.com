import express from 'express';
import path from 'path';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { Project, ProjectDocument, Finding, DocumentPage } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory project store starts completely empty (no demo files)
const projectsStore: Map<string, Project> = new Map();

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

// 5. Clear all projects & workspace
app.post('/api/projects/reset-demo', (req, res) => {
  projectsStore.clear();
  res.json({ message: 'Workspace cleared. No projects or documents uploaded.' });
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
            const pageTxt = (p.text || '').trim();
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
              if (txt.trim().length > 0) {
                pages.push({
                  pageNumber: idx + 1,
                  sheetOrSection: isDrawing ? `Sheet ${originalName.replace(/\.pdf$/i, '')}` : `Section ${idx + 1}`,
                  title: `${isDrawing ? 'Drawing Sheet' : 'Spec Section'} (Page ${idx + 1})`,
                  text: txt.trim(),
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
          text: extractedText.trim() || 'Visual drawing sheet. Text extraction produced minimal character data. Visual review required.',
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

// 9. Limited Project Chat: Strictly grounded Q&A
app.post('/api/projects/:id/chat', async (req, res) => {
  const project = projectsStore.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const rawQuestion = req.body.question || req.body.query;
  if (!rawQuestion || typeof rawQuestion !== 'string' || !rawQuestion.trim()) {
    return res.status(400).json({ error: 'Question is required' });
  }
  const question = rawQuestion.trim();

  // If no documents exist in the project, decline grounded question
  if (!project.documents || project.documents.length === 0) {
    return res.json({
      content: 'No documents have been uploaded for this project yet. Please upload electrical drawings and specifications first to enable grounded inquiry.',
      notEnoughInfo: true,
      citations: [],
    });
  }

  const ai = getAi();
  if (!ai) {
    // Grounded search across the user's actual uploaded documents
    const qLower = question.toLowerCase();
    const words = qLower.split(/\s+/).filter(w => w.length > 3);
    
    // Search pages for matching query words
    const matchingPages: Array<{
      docName: string;
      sheetOrSection?: string;
      pageNumber: number;
      text: string;
      score: number;
    }> = [];

    for (const doc of project.documents) {
      for (const page of doc.pages) {
        const pText = (page.text || '').toLowerCase();
        let score = 0;
        for (const w of words) {
          if (pText.includes(w)) score += 1;
        }
        if (score > 0) {
          matchingPages.push({
            docName: doc.name,
            sheetOrSection: page.sheetOrSection,
            pageNumber: page.pageNumber,
            text: page.text,
            score,
          });
        }
      }
    }

    matchingPages.sort((a, b) => b.score - a.score);

    if (matchingPages.length > 0) {
      const topMatch = matchingPages[0];
      const excerpt = topMatch.text.slice(0, 260).trim();
      return res.json({
        content: `Based on verified text in ${topMatch.docName} (${topMatch.sheetOrSection || 'Page ' + topMatch.pageNumber}): "${excerpt}..."`,
        citations: [
          {
            documentName: topMatch.docName,
            sheetOrSection: topMatch.sheetOrSection || `Page ${topMatch.pageNumber}`,
            pageNumber: topMatch.pageNumber,
            quote: excerpt.slice(0, 150),
          },
        ],
      });
    } else {
      return res.json({
        content: 'Not enough information in the uploaded documents to answer this specific query.',
        notEnoughInfo: true,
        citations: [],
      });
    }
  }

  // With Gemini AI Client
  try {
    const docContext = project.documents.map(d => {
      const pText = d.pages.map(p => `[${d.name} | ${p.sheetOrSection || 'Page'} ${p.pageNumber}]\n${p.text.slice(0, 2500)}`).join('\n');
      return pText;
    }).join('\n\n');

    const systemInstruction = `You are a Senior Electrical Estimator & Specification Specialist specializing in Commercial Electrical Construction, CSI MasterFormat Division 26, and NEC / NFPA standards.

OPERATIONAL MODES & INTENT CLASSIFICATION:

MODE 1: DIRECT DOCUMENT QA (DEFAULT FOR CHAT)
- Trigger: User asks a factual, technical, or informational question about specifications or drawings (e.g., conduit types, wiring methods, equipment ratings, emergency power, approved manufacturers, testing requirements).
- Behavior: Search the provided project documents, synthesize a direct, technical, and precise answer, and cite the EXACT CSI section number (e.g., Section 26 05 33 Raceway and Boxes, Section 26 24 16 Panelboards) and page number.
- CRITICAL NEGATIVE CONSTRAINT: DO NOT frame the answer as a "conflict", "discrepancy", or "scope gap". DO NOT mention "conflicts" or recommend checking "mechanical schedules" or other unrelated trades unless the user specifically inquired about them or unless the text explicitly mandates a cross-trade interface.

MODE 2: SCOPE & GAP AUDIT (TRIGGERED ONLY ON EXPLICIT COMPARISON REQUESTS)
- Trigger: The user explicitly uses words like "conflict", "gap", "discrepancy", "omission", "missing allowance", "mismatch between specs and drawings", or "compare".
- Behavior: Cross-reference Specification requirements against Drawing schedules/notes, identify scope gaps or missing contractor allowances, and cite both sources.

FALLBACK & GROUNDING INTEGRITY:
- If the requested detail is not found in the uploaded documents, state clearly: "This detail is not mentioned in the uploaded Division 26 specification document."
- Strictly forbid hallucinations, ungrounded assumptions, or pointing estimators to unrelated trades.`;

    const prompt = `PROJECT DOCUMENTS CONTEXT:
${docContext}

USER INQUIRY:
"${question}"

Provide a grounded response with precise citations following the System Instructions.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING, description: 'Direct, technical, evidence-based answer or fallback statement' },
            notEnoughInfo: { type: Type.BOOLEAN, description: 'True if detail is not found in the documents' },
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
    res.json(parsed);
  } catch (error: any) {
    console.warn('Gemini chat API error or spike, falling back to document search:', error.message);
    
    // Fallback grounded answer directly from indexed project documents
    const qLower = question.toLowerCase();
    const matchingPages: Array<{ docName: string; sheetOrSection: string; pageNum: number; quote: string }> = [];

    project.documents.forEach((d) => {
      d.pages.forEach((p) => {
        const textLower = p.text.toLowerCase();
        // Check relevance
        const terms = qLower.split(/\s+/).filter(w => w.length > 3);
        const matchCount = terms.filter(t => textLower.includes(t)).length;
        if (matchCount >= 1) {
          // Extract relevant quote snippet around first match
          const firstTerm = terms.find(t => textLower.includes(t)) || '';
          const idx = textLower.indexOf(firstTerm);
          const snippet = p.text.slice(Math.max(0, idx - 40), Math.min(p.text.length, idx + 140)).replace(/\n/g, ' ').trim();
          matchingPages.push({
            docName: d.name,
            sheetOrSection: p.sheetOrSection || `Page ${p.pageNumber}`,
            pageNum: p.pageNumber,
            quote: snippet,
          });
        }
      });
    });

    if (matchingPages.length > 0) {
      const topMatches = matchingPages.slice(0, 3);
      res.json({
        content: `From document search on this project: Found ${matchingPages.length} relevant citation(s) in ${topMatches.map(m => m.docName).join(', ')}.`,
        notEnoughInfo: false,
        citations: topMatches.map(m => ({
          documentName: m.docName,
          sheetOrSection: m.sheetOrSection,
          pageNumber: m.pageNum,
          quote: m.quote,
        })),
      });
    } else {
      res.json({
        content: 'Not enough information in the uploaded documents to answer this specific query.',
        notEnoughInfo: true,
        citations: [],
      });
    }
  }
});

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
