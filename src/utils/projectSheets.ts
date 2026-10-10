import { Project, Finding } from '../types';

export interface DetectedSheet {
  sheetNumber: string;
  category: 'panel' | 'single_line' | 'lighting' | 'power' | 'general' | 'other';
  label: string;
  query: string;
}

export interface InquiryChip {
  label: string;
  query: string;
  iconName: 'Zap' | 'Layers' | 'FileText' | 'AlertCircle' | 'Flame';
  isSheetSpecific: boolean;
  sheetNumber?: string;
}

// Regex matching legitimate electrical and MEP drawing sheet tags:
// Matches e.g. E-001, E-101, E-201, E-301, E1.1, E2.1, EP-101, ED-101, EL-101, M-101, P-101
const SHEET_CODE_REGEX = /^(?:E|EL|EP|ED|ES|FA|M|P|A|S)[-.]?\d{2,4}(?:\.\d+)?$|^E\d{1,2}\.\d{1,2}$/i;

function cleanSheetTag(raw: string): string {
  return raw
    .replace(/^(?:SHEET|DWG|DRAWING|NOTE)\s*[:#.]?\s*/i, '')
    .replace(/[,\.;:()\[\]]/g, '')
    .trim()
    .toUpperCase();
}

function isValidSheetTag(tag: string): boolean {
  if (!tag || tag.length < 2 || tag.length > 10) return false;
  // Exclude common false positives like equipment/panel tags, voltages, ampacities
  if (/^(?:LP|DP|HP|PP|RP|AHU|RTU|MSB|MDP|MCC|ATS|XFMR|GEN)[-.]?\d+$/i.test(tag)) return false;
  if (/^\d+(?:A|V|KVA|KW|HP|AWG|PH|W)$/i.test(tag)) return false;
  return SHEET_CODE_REGEX.test(tag);
}

function categorizeSheetText(sheetNum: string, context: string): DetectedSheet['category'] {
  const ctx = (sheetNum + ' ' + context).toLowerCase();
  if (/schedule|panel|breaker|space|busbar|bus\b/i.test(ctx)) return 'panel';
  if (/single[\s-]line|one[\s-]line|riser|feed/i.test(ctx)) return 'single_line';
  if (/light|luminaire|fixture|photocell|daylight|sensor|occupancy/i.test(ctx)) return 'lighting';
  if (/power|receptacle|branch|conduit|outlet|home\s*run/i.test(ctx)) return 'power';
  if (/general[\s-]note|legend|symbol|abbreviation|cover/i.test(ctx) || /001$|00$|01$/i.test(sheetNum)) return 'general';
  return 'other';
}

function createSheetMetadata(sheetNumber: string, category: DetectedSheet['category']): DetectedSheet {
  switch (category) {
    case 'panel':
      return {
        sheetNumber,
        category,
        label: `Panel Schedules (${sheetNumber})`,
        query: `Check panel schedule bus ratings, breaker types, and spare capacity on sheet ${sheetNumber}`,
      };
    case 'single_line':
      return {
        sheetNumber,
        category,
        label: `Single-Line Diagram (${sheetNumber})`,
        query: `Review single-line diagram feeder ratings and disconnects on sheet ${sheetNumber}`,
      };
    case 'lighting':
      return {
        sheetNumber,
        category,
        label: `Lighting Controls (${sheetNumber})`,
        query: `Review occupancy sensors, fixture schedules, and emergency battery units on sheet ${sheetNumber}`,
      };
    case 'power':
      return {
        sheetNumber,
        category,
        label: `Power Plan (${sheetNumber})`,
        query: `Check branch circuit conductor sizes, conduit types, and receptacles on sheet ${sheetNumber}`,
      };
    case 'general':
      return {
        sheetNumber,
        category,
        label: `General Notes (${sheetNumber})`,
        query: `Cross-reference general notes, specification references, and wiring minimums on sheet ${sheetNumber}`,
      };
    default:
      return {
        sheetNumber,
        category,
        label: `Drawing Sheet (${sheetNumber})`,
        query: `Review electrical equipment tags, schedules, and circuit details on sheet ${sheetNumber}`,
      };
  }
}

/**
 * Extracts distinct drawing sheets actually present in the uploaded project documents or verified findings.
 */
export function getProjectSheets(project?: Project): DetectedSheet[] {
  if (!project) return [];

  const foundSheets = new Map<string, { category: DetectedSheet['category']; score: number }>();

  // 1. Scan verified findings (highest confidence source for active sheets)
  if (project.findings && Array.isArray(project.findings)) {
    for (const f of project.findings) {
      const candidates = [
        f.sourceB?.sheetNumber,
        f.sourceA?.sheetNumber,
        f.sourceB?.location,
        f.sourceA?.location,
      ];
      for (const cand of candidates) {
        if (!cand) continue;
        const words = cand.split(/[\s,;()]+/);
        for (const w of words) {
          const clean = cleanSheetTag(w);
          if (isValidSheetTag(clean)) {
            const cat = categorizeSheetText(clean, `${f.title} ${f.explanation} ${f.systemArea} ${cand}`);
            const prev = foundSheets.get(clean);
            if (!prev || prev.score < 10) {
              foundSheets.set(clean, { category: cat, score: 10 });
            }
          }
        }
      }
    }
  }

  // 2. Scan uploaded documents (pages and document names)
  if (project.documents && Array.isArray(project.documents)) {
    for (const doc of project.documents) {
      const isDrawing = doc.category === 'drawing' || /drawing|dwg|sheet|plan|e[-_]?\d/i.test(doc.name);

      // Document name check (e.g. E1.1_Power_Single_Line_Diagram.pdf, E-001_Plans.pdf)
      const nameWords = doc.name.replace(/\.pdf$/i, '').split(/[\s,;_\-]+/);
      for (const w of nameWords) {
        const clean = cleanSheetTag(w);
        if (isValidSheetTag(clean)) {
          const cat = categorizeSheetText(clean, doc.name);
          const prev = foundSheets.get(clean);
          if (!prev || prev.score < 8) {
            foundSheets.set(clean, { category: cat, score: 8 });
          }
        }
      }

      // Page level scan
      if (doc.pages && Array.isArray(doc.pages)) {
        for (const p of doc.pages) {
          // Check sheetOrSection property
          if (p.sheetOrSection) {
            const rawTokens = p.sheetOrSection.split(/[\s,;()]+/);
            for (const t of rawTokens) {
              const clean = cleanSheetTag(t);
              if (isValidSheetTag(clean)) {
                const cat = categorizeSheetText(clean, `${p.title || ''} ${p.text || ''}`);
                const prev = foundSheets.get(clean);
                if (!prev || prev.score < 6) {
                  foundSheets.set(clean, { category: cat, score: 6 });
                }
              }
            }
          }

          // Check page text for sheet tags
          if (p.text && isDrawing) {
            // Match sheet tokens like E-001, E-101, E-201, E-301, E1.1
            const matches = p.text.match(/\b(?:E|EL|EP|ED|ES|FA|M|P)[-.]?\d{2,4}(?:\.\d+)?\b|\bE\d{1,2}\.\d{1,2}\b/gi);
            if (matches) {
              for (const m of matches) {
                const clean = cleanSheetTag(m);
                if (isValidSheetTag(clean)) {
                  const cat = categorizeSheetText(clean, p.text.slice(Math.max(0, p.text.indexOf(m) - 100), p.text.indexOf(m) + 100));
                  const prev = foundSheets.get(clean);
                  if (!prev || prev.score < 5) {
                    foundSheets.set(clean, { category: cat, score: 5 });
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Convert to sorted DetectedSheet list
  const sheets: DetectedSheet[] = [];
  for (const [sheetNumber, meta] of foundSheets.entries()) {
    sheets.push(createSheetMetadata(sheetNumber, meta.category));
  }

  // Sort logically (e.g. E-001, E-101, E-201, E-301 or E1.1, E2.1)
  return sheets.sort((a, b) => a.sheetNumber.localeCompare(b.sheetNumber, undefined, { numeric: true }));
}

/**
 * Returns sample inquiry chips. If matching sheets exist in the uploaded documents,
 * generates dynamic chips for those sheets. When no matching sheet exists, hides sheet-specific chips.
 */
export function getSampleInquiryChips(project?: Project): InquiryChip[] {
  const detectedSheets = getProjectSheets(project);

  const chips: InquiryChip[] = [];

  // Generate chips from sheets actually present
  for (const s of detectedSheets.slice(0, 4)) {
    let iconName: InquiryChip['iconName'] = 'FileText';
    if (s.category === 'single_line') iconName = 'Zap';
    else if (s.category === 'panel') iconName = 'Layers';
    else if (s.category === 'lighting' || s.category === 'power') iconName = 'Zap';

    chips.push({
      label: s.label,
      query: s.query,
      iconName,
      isSheetSpecific: true,
      sheetNumber: s.sheetNumber,
    });
  }

  // Generic specification chips that do NOT reference any nonexistent sheet
  chips.push({
    label: 'Division 26 Specifications',
    query: 'Cross-reference Division 26 spec requirements against drawing sheets and schedules',
    iconName: 'FileText',
    isSheetSpecific: false,
  });

  chips.push({
    label: 'Missing Disconnect Switches',
    query: 'Identify mechanical equipment lacking local electrical disconnects within sight',
    iconName: 'AlertCircle',
    isSheetSpecific: false,
  });

  chips.push({
    label: 'Generator & Emergency Fuel',
    query: 'Review emergency power and fuel storage requirements against project documents',
    iconName: 'Flame',
    isSheetSpecific: false,
  });

  // If no matching sheets exist, return only non-sheet chips (hiding sheet-specific ones)
  if (detectedSheets.length === 0) {
    return chips.filter((c) => !c.isSheetSpecific);
  }

  return chips;
}

/**
 * Returns suggestions prompts for Canvas / Chat.
 * If sheets exist, includes prompts grounded in those actual sheets.
 * If no matching sheets exist, hides sheet-specific questions and returns general spec prompts.
 */
export function getCanvasSamplePrompts(project?: Project): string[] {
  const sheets = getProjectSheets(project);

  if (sheets.length === 0) {
    // No matching sheet exists -> Hide any sheet-referencing prompt
    return [
      'What does the specification say about emergency power duration?',
      'What is the required bus material and neutral size in Section 26 24 16?',
      'Which spec section covers daylight harvesting sensors?',
      'What minimum conductor size is specified for branch wiring in Division 26?',
    ];
  }

  const prompts: string[] = [];

  // Sheet-specific prompts grounded in actual uploaded sheets
  const panelSheet = sheets.find((s) => s.category === 'panel') || sheets[sheets.length - 1];
  const powerOrLightingSheet = sheets.find((s) => s.category === 'power' || s.category === 'lighting') || sheets[0];

  if (panelSheet) {
    prompts.push(`What are the panelboard ratings and circuit spaces on drawing ${panelSheet.sheetNumber}?`);
  }

  prompts.push('What does the specification say about emergency power?');

  if (powerOrLightingSheet && powerOrLightingSheet.sheetNumber !== panelSheet?.sheetNumber) {
    prompts.push(`Check conductor sizing and device specifications on sheet ${powerOrLightingSheet.sheetNumber}`);
  }

  prompts.push('What is the required bus material and neutral size in 26 24 16?');
  prompts.push('Which spec section covers daylight harvesting sensors?');

  return prompts.slice(0, 4);
}

/**
 * Returns dynamic placeholder string for canvas input prompt.
 * If sheets exist, references an actual sheet present.
 * If no matching sheet exists, provides clean generic placeholder without nonexistent sheet references.
 */
export function getCanvasPlaceholder(project?: Project): string {
  const sheets = getProjectSheets(project);
  if (sheets.length > 0) {
    const primary = sheets.find((s) => s.category === 'panel') || sheets[0];
    return `Ask a question about project drawings & specs (e.g. 'Check schedule on sheet ${primary.sheetNumber}')...`;
  }
  return 'Ask a question about project drawings & specifications, or enter an electrical scope check prompt...';
}

/**
 * Returns dynamic lucky prompts for the "Sample inquiries" button.
 * Incorporates actual sheets present, or stays purely spec-grounded when no sheets exist.
 */
export function getLuckyPrompts(project?: Project): string[] {
  const sheets = getProjectSheets(project);

  if (sheets.length === 0) {
    return [
      'Verify copper vs aluminum busbar specifications in Section 26 24 16',
      'Audit emergency generator fuel storage requirements against specifications',
      'Identify daylight harvesting sensor specifications in Division 26',
      'Review minimum branch circuit conductor size specified in Section 26 05 19',
    ];
  }

  const firstSheet = sheets[0].sheetNumber;
  const panelSheet = sheets.find((s) => s.category === 'panel')?.sheetNumber || firstSheet;

  return [
    `Check panelboard main breaker and circuit count coordination on sheet ${panelSheet}`,
    `Verify branch conductor size and conduit type on sheet ${firstSheet}`,
    'Verify copper vs aluminum busbar specifications in Section 26 24 16',
    'Audit emergency battery duration requirements against project lighting drawings',
    'Identify occupancy sensor specifications missing from drawing plans',
  ];
}
