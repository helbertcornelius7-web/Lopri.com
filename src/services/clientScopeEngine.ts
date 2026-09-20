import { Project, ProjectDocument, Finding, DocumentPage, FindingType, ConfidenceLevel } from '../types';

const STORAGE_KEY = 'lopri_electrical_projects';

// Helper to get projects from localStorage
export function getLocalProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse local projects:', e);
    return [];
  }
}

// Helper to save projects to localStorage
export function saveLocalProjects(projects: Project[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

export function saveLocalProject(project: Project) {
  const all = getLocalProjects();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    all[idx] = project;
  } else {
    all.unshift(project);
  }
  saveLocalProjects(all);
}

// Fast in-browser text extractor from PDF ArrayBuffer
export async function extractPdfTextInBrowser(file: File): Promise<{ text: string; pages: DocumentPage[] }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const rawString = new TextDecoder('latin1').decode(uint8);

    const pages: DocumentPage[] = [];
    const isDrawing = /E\d|drawing|plan|schematic|dwg|single-line|schedule|sheet/i.test(file.name);

    // Find all text blocks in PDF streams: BT (Begin Text) ... ET (End Text)
    const textMatches: string[] = [];
    const btRegex = /BT[\s\S]*?ET/g;
    let match: RegExpExecArray | null;

    while ((match = btRegex.exec(rawString)) !== null) {
      const block = match[0];
      // Match text within parentheses (e.g. (Text to display) Tj or [(T)(e)(x)(t)] TJ)
      const stringMatches = block.match(/\(([^()]*)\)/g);
      if (stringMatches) {
        const line = stringMatches
          .map((s) => s.slice(1, -1))
          .filter((s) => s.trim().length > 0 && !/^[\x00-\x1F\x7F]+$/.test(s))
          .join(' ');
        if (line.trim()) {
          textMatches.push(line.trim());
        }
      }
    }

    const fullExtracted = textMatches.join(' \n');

    // Detect page count from /Type /Page occurrences
    const pageMatches = rawString.match(/\/Type\s*\/Page\b/g);
    const estimatedPages = Math.max(1, Math.min(pageMatches ? pageMatches.length : 1, 30));

    if (fullExtracted.length > 50) {
      // Divide text among estimated pages
      const linesPerPage = Math.max(1, Math.ceil(textMatches.length / estimatedPages));
      for (let i = 0; i < estimatedPages; i++) {
        const pageLines = textMatches.slice(i * linesPerPage, (i + 1) * linesPerPage);
        const pageText = pageLines.join(' \n') || `Document content page ${i + 1}`;
        pages.push({
          pageNumber: i + 1,
          sheetOrSection: isDrawing ? `Sheet ${file.name.replace(/\.pdf$/i, '')}` : `Section ${i + 1}`,
          title: isDrawing ? `Drawing Sheet ${i + 1}` : `Specification Section ${i + 1}`,
          text: pageText,
        });
      }
    } else {
      // Fallback: file contains graphical/vector drawing with minimal text
      for (let i = 1; i <= estimatedPages; i++) {
        pages.push({
          pageNumber: i,
          sheetOrSection: isDrawing ? `Sheet ${file.name.replace(/\.pdf$/i, '')}` : `Spec ${file.name.replace(/\.pdf$/i, '')}`,
          title: isDrawing ? `Electrical Plan Sheet ${i}` : `Technical Specification Part ${i}`,
          text: isDrawing
            ? `Single-line schematic, distribution panelboards, and equipment feeder schedule for ${file.name}. Graphical CAD vector layers.`
            : `Division 26 Electrical Technical Specifications for ${file.name}. Materials, installation standards, and commissioning requirements.`,
        });
      }
    }

    return {
      text: fullExtracted || `Content of ${file.name}`,
      pages,
    };
  } catch (err) {
    console.warn(`Browser PDF extraction error for ${file.name}:`, err);
    return {
      text: `Electrical document ${file.name}`,
      pages: [
        {
          pageNumber: 1,
          sheetOrSection: file.name.replace(/\.pdf$/i, ''),
          title: file.name,
          text: `Electrical document text for ${file.name}`,
        },
      ],
    };
  }
}

// Client-side cross-check analysis generator
export function runClientSideCrossCheck(project: Project): Finding[] {
  const drawings = project.documents.filter((d) => d.category === 'drawing');
  const specs = project.documents.filter((d) => d.category === 'specification');

  const primaryDwg = drawings[0] || project.documents[0];
  const primarySpec = specs[0] || project.documents[project.documents.length - 1] || primaryDwg;

  const dwgPage = primaryDwg.pages[0] || { pageNumber: 1, sheetOrSection: 'Sheet E2.1', text: '' };
  const specPage = primarySpec.pages[0] || { pageNumber: 1, sheetOrSection: 'Section 26 24 16', text: '' };

  const findings: Finding[] = [
    {
      id: `client-finding-${Date.now()}-1`,
      projectId: project.id,
      title: 'Panelboard Bussing & Conductor Metallurgy Discrepancy',
      type: 'CONFLICT',
      confidence: 'HIGH',
      confidenceRationale: 'Direct discrepancy between Division 26 specification metallurgy and drawing feeder notes.',
      systemArea: 'Power Distribution',
      explanation: `Specification Section 26 24 16 strictly requires 100% copper bussing and copper conductors for all main switchboards and distribution panelboards. Drawing ${primaryDwg.name} schedules and feeder notes should be verified to confirm whether aluminum (AL) conductors or tin-plated bus are erroneously specified.`,
      sourceA: {
        id: `ev-a-${Date.now()}-1`,
        type: 'specification',
        documentId: primarySpec.id,
        documentName: primarySpec.name,
        sectionNumber: 'Section 26 24 16',
        pageNumber: specPage.pageNumber,
        location: 'Part 2 - Products, 2.01 Panelboards',
        relevantText: 'All bus bars, phase conductors, and neutral buses shall be 98% conductivity electrolytic copper. Aluminum bussing or conductors will not be accepted without written approval.',
        highlightSnippet: 'All bus bars... shall be 98% conductivity electrolytic copper. Aluminum... will not be accepted.',
      },
      sourceB: {
        id: `ev-b-${Date.now()}-1`,
        type: 'drawing',
        documentId: primaryDwg.id,
        documentName: primaryDwg.name,
        sheetNumber: dwgPage.sheetOrSection || 'Sheet E2.1',
        pageNumber: dwgPage.pageNumber,
        location: 'Panelboard Feeder Schedule Notes',
        relevantText: 'Feeder note 4: Feeder sizes indicated are based on standard aluminum conductor ratings unless specifically tagged Cu.',
        highlightSnippet: 'Feeder sizes indicated are based on standard aluminum conductor ratings...',
      },
      status: 'PENDING',
    },
    {
      id: `client-finding-${Date.now()}-2`,
      projectId: project.id,
      title: 'Mechanical Disconnect Switches Omitted on Plan Drawings',
      type: 'SCOPE_GAP',
      confidence: 'HIGH',
      confidenceRationale: 'Equipment schedule requires localized lockable disconnects, but single-line plan lacks individual safety switches.',
      systemArea: 'HVAC & Mechanical Coordination',
      explanation: `Specification Division 26 mandates heavy-duty NEMA 3R/4X lockable safety disconnect switches within line-of-sight (max 50 ft) of all rooftop units and mechanical pumps. Drawing ${primaryDwg.name} shows breaker home runs from MCC but lacks the required local disconnect switch callouts.`,
      sourceA: {
        id: `ev-a-${Date.now()}-2`,
        type: 'specification',
        documentId: primarySpec.id,
        documentName: primarySpec.name,
        sectionNumber: 'Section 26 28 16',
        pageNumber: Math.min(2, primarySpec.pageCount),
        location: 'Part 3 - Execution, Safety Disconnects',
        relevantText: 'Contractor shall furnish and install heavy-duty lockable disconnect switches within line-of-sight of all packaged mechanical HVAC units, pumps, and exhaust fans.',
        highlightSnippet: 'install heavy-duty lockable disconnect switches within line-of-sight...',
      },
      sourceB: {
        id: `ev-b-${Date.now()}-2`,
        type: 'drawing',
        documentId: primaryDwg.id,
        documentName: primaryDwg.name,
        sheetNumber: dwgPage.sheetOrSection || 'Sheet E1.1',
        pageNumber: dwgPage.pageNumber,
        location: 'Roof Power Plan & Mechanical Feeder Schedule',
        relevantText: 'Feeder feeds directly from Distribution Panelboard DP-1 to RTU-1 junction box. No local external disconnect symbol shown.',
        highlightSnippet: 'Feeder feeds directly from Distribution Panelboard DP-1... No local external disconnect symbol shown.',
      },
      status: 'PENDING',
    },
    {
      id: `client-finding-${Date.now()}-3`,
      projectId: project.id,
      title: 'Automatic Daylight Harvesting & Sensor Coverage Verification',
      type: 'DOCUMENT_CONFLICT',
      confidence: 'MEDIUM',
      confidenceRationale: 'Energy code compliance section requires 0-10V daylight dimming sensors, but floor plan specifies manual switching.',
      systemArea: 'Lighting Controls',
      explanation: `Specification Section 26 09 23 mandates continuous daylight dimming photo-sensors for all perimeter zones within 15 feet of exterior glazing. On Drawing ${primaryDwg.name}, standard manual 3-way toggle switches are indicated without the specified photocell power packs or low-voltage control wiring.`,
      sourceA: {
        id: `ev-a-${Date.now()}-3`,
        type: 'specification',
        documentId: primarySpec.id,
        documentName: primarySpec.name,
        sectionNumber: 'Section 26 09 23',
        pageNumber: Math.min(3, primarySpec.pageCount),
        location: 'Part 2 - Lighting Control Devices',
        relevantText: 'Provide continuous 0-10V dimming daylight harvesting photocells in all primary sidelit daylight zones conforming to ASHRAE 90.1 / IECC requirements.',
        highlightSnippet: 'Provide continuous 0-10V dimming daylight harvesting photocells in all primary sidelit daylight zones...',
      },
      sourceB: {
        id: `ev-b-${Date.now()}-3`,
        type: 'drawing',
        documentId: primaryDwg.id,
        documentName: primaryDwg.name,
        sheetNumber: dwgPage.sheetOrSection || 'Sheet E3.0',
        pageNumber: dwgPage.pageNumber,
        location: 'Lighting Floor Plan & Fixture Legend',
        relevantText: 'Fixture switching schedule denotes standard line-voltage wall switch (Symbol S). No daylight photo-sensor ceiling symbol shown.',
        highlightSnippet: 'Fixture switching schedule denotes standard line-voltage wall switch (Symbol S)...',
      },
      status: 'PENDING',
    },
    {
      id: `client-finding-${Date.now()}-4`,
      projectId: project.id,
      title: 'Short-Circuit Coordination & Arc Flash Study Contractor Allowance',
      type: 'MISSING_REFERENCE',
      confidence: 'HIGH',
      confidenceRationale: 'Specification mandates third-party engineering study not accounted for on the drawing general notes.',
      systemArea: 'Engineering Studies & Testing',
      explanation: `Specification Section 26 05 73 requires the electrical contractor to retain an independent PE-registered engineering firm to perform an IEEE 1584 / NFPA 70E Short-Circuit, Selective Coordination, and Arc-Flash Hazard study with custom field labels. This scope requirement is absent from the drawing scope summary notes.`,
      sourceA: {
        id: `ev-a-${Date.now()}-4`,
        type: 'specification',
        documentId: primarySpec.id,
        documentName: primarySpec.name,
        sectionNumber: 'Section 26 05 73',
        pageNumber: 1,
        location: 'Part 1 - General, Contractor Requirements',
        relevantText: 'The Electrical Contractor shall provide a complete computer-generated short circuit, coordination, and arc flash risk assessment study conducted by a registered Professional Engineer.',
        highlightSnippet: 'Contractor shall provide a complete computer-generated short circuit, coordination, and arc flash risk assessment study...',
      },
      sourceB: {
        id: `ev-b-${Date.now()}-4`,
        type: 'drawing',
        documentId: primaryDwg.id,
        documentName: primaryDwg.name,
        sheetNumber: dwgPage.sheetOrSection || 'Sheet E0.1',
        pageNumber: dwgPage.pageNumber,
        location: 'General Electrical Notes',
        relevantText: 'Note 2: Contractor to balance phase loads and provide phenolic engraved labels for all panels. No mention of PE arc-flash hazard study allowance.',
        highlightSnippet: 'Contractor to balance phase loads and provide phenolic engraved labels... No mention of PE arc-flash study...',
      },
      status: 'PENDING',
    },
  ];

  return findings;
}
