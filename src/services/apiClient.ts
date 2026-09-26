import { Project, Finding, FindingStatus, ChatMessage, ProjectDocument } from '../types';
import { 
  getLocalProjects, 
  saveLocalProject, 
  saveLocalProjects, 
  extractPdfTextInBrowser, 
  runClientSideCrossCheck 
} from './clientScopeEngine';
import { sanitizePdfText } from '../utils/sanitizePdfText';

// Detect if running in static Vercel frontend or serverless environment without active Node server
const isVercel = typeof window !== 'undefined' && (
  window.location.hostname.includes('vercel.app') ||
  window.location.hostname.includes('.vercel.')
);

// Unified API Client with Automatic Fallback for Vercel/Static Deployments
export const apiClient = {
  // 1. Get all projects
  async getProjects(): Promise<Project[]> {
    if (!isVercel) {
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const serverProjects = await res.json();
          if (Array.isArray(serverProjects)) {
            return serverProjects;
          }
        }
      } catch (err) {
        console.warn('Backend /api/projects unreachable, reading from client store:', err);
      }
    }
    return getLocalProjects();
  },

  // 2. Get single project
  async getProject(projectId: string): Promise<Project | null> {
    if (!isVercel) {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn(`Backend /api/projects/${projectId} error, using client store:`, err);
      }
    }

    const locals = getLocalProjects();
    return locals.find((p) => p.id === projectId) || null;
  },

  // 3. Create project
  async createProject(name: string, description?: string): Promise<Project> {
    if (!isVercel) {
      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description }),
        });

        if (res.ok) {
          const data = await res.json();
          saveLocalProject(data);
          return data;
        }
      } catch (err) {
        console.warn('Backend /api/projects POST failed (404/network), falling back to client engine:', err);
      }
    }

    // Client-side fallback creation
    const newProject: Project = {
      id: 'proj-' + Date.now(),
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

    saveLocalProject(newProject);
    return newProject;
  },

  // 4. Upload documents to project
  async uploadDocuments(
    projectId: string, 
    files: File[], 
    categories?: Record<string, 'drawing' | 'specification'>
  ): Promise<Project> {
    // Attempt backend upload first if not running on static Vercel
    let backendSucceeded = false;
    if (!isVercel) {
      try {
        const formData = new FormData();
        files.forEach((f) => formData.append('files', f));
        if (categories) {
          formData.append('categories', JSON.stringify(categories));
        }

        const res = await fetch(`/api/projects/${projectId}/documents`, {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.project) {
            saveLocalProject(data.project);
            return data.project;
          }
          backendSucceeded = true;
        }
      } catch (err) {
        console.warn('Backend document upload failed (404/network), extracting in browser:', err);
      }
    }

    // If backend upload failed (or 404 on Vercel), parse PDFs directly in browser
    let currentProject = await this.getProject(projectId);
    if (!currentProject) {
      currentProject = {
        id: projectId,
        name: 'Electrical Project',
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
    }

    currentProject.status = 'processing';
    currentProject.processingSteps[0].status = 'in_progress';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let assignedCategory: 'drawing' | 'specification';

      if (categories && categories[file.name]) {
        assignedCategory = categories[file.name];
      } else {
        const isDrawingRegex = /E\d|drawing|plan|schematic|dwg|single-line|schedule/i.test(file.name);
        if (files.length >= 2 && i === 0 && !isDrawingRegex) {
          assignedCategory = 'drawing';
        } else {
          assignedCategory = isDrawingRegex ? 'drawing' : 'specification';
        }
      }

      const extracted = await extractPdfTextInBrowser(file);

      const doc: ProjectDocument = {
        id: `doc-${Date.now()}-${i}`,
        projectId,
        name: file.name,
        category: assignedCategory,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        pageCount: extracted.pages.length,
        pages: extracted.pages,
        status: 'ready',
      };

      currentProject.documents.push(doc);
    }

    currentProject.processingSteps[0].status = 'completed';
    currentProject.processingSteps[0].details = `${currentProject.documents.length} document(s) uploaded`;
    currentProject.processingSteps[1].status = 'completed';
    currentProject.processingSteps[1].details = 'PDF text and sheet headers extracted';

    saveLocalProject(currentProject);
    return currentProject;
  },

  // 5. Analyze Project / Cross-Check
  async analyzeProject(projectId: string): Promise<Project> {
    if (!isVercel) {
      try {
        const res = await fetch(`/api/projects/${projectId}/analyze`, {
          method: 'POST',
        });

        if (res.ok) {
          const data = await res.json();
          if (data.project) {
            saveLocalProject(data.project);
            return data.project;
          }
        }
      } catch (err) {
        console.warn('Backend analyze failed (404/network), executing client scope engine:', err);
      }
    }

    // Client-side cross-check analysis
    const current = await this.getProject(projectId);
    if (!current) {
      throw new Error('Project not found');
    }

    current.status = 'processing';
    current.processingSteps[2].status = 'in_progress';
    current.processingSteps[3].status = 'in_progress';
    current.processingSteps[4].status = 'in_progress';

    // Ensure we have at least one drawing and one spec
    const hasDwg = current.documents.some((d) => d.category === 'drawing');
    const hasSpec = current.documents.some((d) => d.category === 'specification');

    if (!hasDwg && current.documents.length > 0) {
      current.documents[0].category = 'drawing';
    }
    if (!hasSpec && current.documents.length > 1) {
      current.documents[current.documents.length - 1].category = 'specification';
    }

    const generatedFindings = runClientSideCrossCheck(current);
    current.findings = generatedFindings;
    current.status = 'ready';

    current.processingSteps[2].status = 'completed';
    current.processingSteps[2].details = `${current.documents.filter(d => d.category === 'drawing').length} drawing sheets verified`;
    current.processingSteps[3].status = 'completed';
    current.processingSteps[3].details = `${current.documents.filter(d => d.category === 'specification').length} specification packages indexed`;
    current.processingSteps[4].status = 'completed';
    current.processingSteps[4].details = `${generatedFindings.length} scope findings identified for estimator review`;

    saveLocalProject(current);
    return current;
  },

  // 6. Update finding status
  async updateFindingStatus(projectId: string, findingId: string, status: FindingStatus): Promise<void> {
    try {
      await fetch(`/api/projects/${projectId}/findings/${findingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      // Local sync
    }

    const current = await this.getProject(projectId);
    if (current) {
      current.findings = current.findings.map((f) =>
        f.id === findingId ? { ...f, status, decidedAt: new Date().toISOString() } : f
      );
      saveLocalProject(current);
    }
  },

  // 7. Update finding notes
  async updateFindingNotes(projectId: string, findingId: string, notes: string): Promise<void> {
    try {
      await fetch(`/api/projects/${projectId}/findings/${findingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimatorNotes: notes }),
      });
    } catch (e) {
      // Local sync
    }

    const current = await this.getProject(projectId);
    if (current) {
      current.findings = current.findings.map((f) =>
        f.id === findingId ? { ...f, estimatorNotes: notes } : f
      );
      saveLocalProject(current);
    }
  },

  // 8. Chat with project - passes user prompt and PDF base64 context
  async chatWithProject(projectId: string, query: string, pdfBase64?: string): Promise<ChatMessage> {
    const payload = {
      userPrompt: query,
      question: query,
      prompt: query,
      query,
      projectId,
      pdfBase64,
    };

    try {
      let res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok && res.status === 404) {
        // Fall back to root /api/chat endpoint
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const data = await res.json();
        return {
          id: 'msg-' + Date.now(),
          role: 'assistant',
          content: sanitizePdfText(data.content || ''),
          timestamp: new Date().toISOString(),
          citations: (data.citations || []).map((c: any) => ({
            documentName: c.documentName,
            sheetOrSection: c.sheetOrSection,
            pageNumber: c.pageNumber,
            quote: sanitizePdfText(c.quote || ''),
          })),
          notEnoughInfo: data.notEnoughInfo,
        };
      }
    } catch (e) {
      console.warn('Backend chat unreachable, performing client search:', e);
    }

    // Client-side search & citation fallback
    const current = await this.getProject(projectId);
    const qLower = query.toLowerCase();

    if (!current || current.documents.length === 0) {
      return {
        id: 'msg-' + Date.now(),
        role: 'assistant',
        content: 'Please upload electrical drawings and specifications to search and verify scope requirements.',
        timestamp: new Date().toISOString(),
        citations: [],
      };
    }

    // Search for keywords and technical terms
    const technicalTerms = qLower
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !['what', 'where', 'which', 'does', 'have', 'from', 'with', 'about', 'this', 'that', 'they', 'when'].includes(w));

    const scoredPages: Array<{
      documentName: string;
      sheetOrSection?: string;
      pageNumber: number;
      quote: string;
      score: number;
    }> = [];

    current.documents.forEach((doc) => {
      doc.pages.forEach((page) => {
        const textLower = page.text.toLowerCase();
        let score = 0;
        technicalTerms.forEach((t) => {
          if (textLower.includes(t)) {
            score += /copper|bussing|bus|panelboard|generator|feeder|26\s*24\s*16/i.test(t) ? 5 : 2;
          }
        });

        if (score > 0) {
          const matchWord = technicalTerms.find((t) => textLower.includes(t)) || '';
          const idx = textLower.indexOf(matchWord);
          const snippet = sanitizePdfText(page.text.slice(Math.max(0, idx - 40), Math.min(page.text.length, idx + 160)))
            .replace(/\n+/g, ' ')
            .trim();

          scoredPages.push({
            documentName: doc.name,
            sheetOrSection: page.sheetOrSection || `Section 26`,
            pageNumber: page.pageNumber,
            quote: snippet,
            score,
          });
        }
      });
    });

    scoredPages.sort((a, b) => b.score - a.score);

    if (scoredPages.length > 0) {
      const top = scoredPages[0];
      return {
        id: 'msg-' + Date.now(),
        role: 'assistant',
        content: sanitizePdfText(`According to project document references regarding "${query}":\n\n"${top.quote}"`),
        timestamp: new Date().toISOString(),
        citations: scoredPages.slice(0, 3).map((p) => ({
          documentName: p.documentName,
          sheetOrSection: p.sheetOrSection,
          pageNumber: p.pageNumber,
          quote: p.quote,
        })),
        notEnoughInfo: false,
      };
    }

    return {
      id: 'msg-' + Date.now(),
      role: 'assistant',
      content: 'This detail is not mentioned in the uploaded Division 26 specification document.',
      timestamp: new Date().toISOString(),
      citations: [],
      notEnoughInfo: true,
    };
  },

  // 9. Reset workspace (wipes all projects for clean slate)
  async resetWorkspace(): Promise<void> {
    if (!isVercel) {
      try {
        await fetch('/api/projects/reset-demo', { method: 'POST' });
      } catch (e) {
        // Ignore
      }
    }
    saveLocalProjects([]);
  },

  // 10. Load optional sample demo project on demand
  async loadSampleDemo(): Promise<Project> {
    if (!isVercel) {
      try {
        const res = await fetch('/api/projects/load-sample', { method: 'POST' });
        if (res.ok) {
          const sample = await res.json();
          saveLocalProject(sample);
          return sample;
        }
      } catch (e) {
        console.warn('Backend load-sample error, using local demo data:', e);
      }
    }
    // Fallback using SAMPLE_PROJECT from demoData
    const { SAMPLE_PROJECT } = await import('../demoData');
    saveLocalProject(SAMPLE_PROJECT);
    return SAMPLE_PROJECT;
  },

  // 11. Delete project
  async deleteProject(projectId: string): Promise<void> {
    if (!isVercel) {
      try {
        await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      } catch (e) {
        console.warn('Backend delete project error:', e);
      }
    }
    const locals = getLocalProjects().filter((p) => p.id !== projectId);
    saveLocalProjects(locals);
  },
};
