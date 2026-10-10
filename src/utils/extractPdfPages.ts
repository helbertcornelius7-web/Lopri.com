import type { DocumentPage } from '../types.js';
import { sanitizePdfText } from './sanitizePdfText.js';

export interface ExtractedPdfResult {
  pageCount: number;
  extractedText: string;
  pages: DocumentPage[];
}

/**
 * Extracts per-page text from a PDF buffer using pdfjs-dist.
 * Strictly avoids placeholder text and marks pages with extractionStatus 'ok' or 'empty'.
 */
export async function extractPdfPages(
  buffer: Buffer,
  originalName: string,
  isDrawing: boolean
): Promise<ExtractedPdfResult> {
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const getDocument = pdfjsLib.getDocument || (pdfjsLib.default && pdfjsLib.default.getDocument);

  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages || 1;
  const pages: DocumentPage[] = [];
  const textChunks: string[] = [];

  for (let n = 1; n <= numPages; n++) {
    const page = await pdfDoc.getPage(n);
    const content = await page.getTextContent();
    const pageItems = content.items || [];
    let pageStr = '';

    for (const item of pageItems) {
      if ('str' in item) {
        pageStr += item.str;
        if (item.hasEOL) {
          pageStr += '\n';
        } else {
          pageStr += ' ';
        }
      }
    }

    const cleanText = sanitizePdfText(pageStr).trim();
    textChunks.push(cleanText);

    pages.push({
      pageNumber: n,
      sheetOrSection: isDrawing
        ? `Sheet ${n} - ${originalName.replace(/\.pdf$/i, '')}`
        : `Section ${n}`,
      title: `${isDrawing ? 'Drawing Sheet' : 'Spec Section'} (Page ${n})`,
      text: cleanText,
      extractionStatus: cleanText.length > 0 ? 'ok' : 'empty',
    });
  }

  return {
    pageCount: numPages,
    extractedText: textChunks.join('\n\n'),
    pages,
  };
}

export default extractPdfPages;
