/**
 * PDF Text Sanitization Utility
 * Purges Mojibake, corrupted CID font glyphs, binary stream noise,
 * and unmapped control characters while preserving legitimate engineering text,
 * technical notations, and electrical symbols.
 */

// Permitted engineering and construction symbols:
// Ω (Ohms), µ/μ (Micro), ° (Degree), ± (Plus-minus), Ø/ø/Φ (Diameter/Phase),
// ² (Square), ³ (Cubic), • (Bullet), ™, ®, ©, —, –, “, ”, ‘, ’, ✓
const ALLOWED_SYMBOLS_REGEX = /[\u03A9\u00B5\u03BC\u00B0\u00B1\u00D8\u00F8\u03A6\u03C6\u00B2\u00B3\u2022\u2122\u00AE\u00A9\u2014\u2013\u201C\u201D\u2018\u2019\u2713\u2190-\u2195]/;

/**
 * Checks if a character is a valid printable character for technical documents.
 */
function isPrintableOrTechnical(char: string, code: number): boolean {
  // Line feeds, tabs, carriage returns
  if (code === 9 || code === 10 || code === 13) return true;

  // Standard printable ASCII (space through tilde)
  if (code >= 32 && code <= 126) return true;

  // Common Latin-1 supplement (accented letters, fractions, etc.)
  if (code >= 160 && code <= 255) return true;

  // Allowed specific engineering symbols
  return ALLOWED_SYMBOLS_REGEX.test(char);
}

/**
 * Tests if a word token resembles binary noise or corrupted CID glyphs.
 * E.g., tokens like "jœu.uuu1~y", "%ODÙ5É:-Œ", or high ratio of punctuation to letters.
 */
function isGarbageToken(token: string): boolean {
  if (token.length <= 1) return false;

  // Catch unmapped CID font artifacts like (cid:123)
  if (/^\(?cid:\d+\)?$/i.test(token)) return true;

  // If word has excessive non-alphanumeric/non-symbol characters
  let readableCount = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token[i];
    const code = token.charCodeAt(i);
    if (
      (code >= 48 && code <= 57) || // 0-9
      (code >= 65 && code <= 90) || // A-Z
      (code >= 97 && code <= 122) || // a-z
      ALLOWED_SYMBOLS_REGEX.test(char)
    ) {
      readableCount++;
    }
  }

  // If token is longer than 4 chars and less than 40% alphanumeric/valid symbols, it's noise
  if (token.length >= 4 && readableCount / token.length < 0.45) {
    return true;
  }

  // Catch repeating binary symbols (e.g. "~~~~~" or "")
  if (/([\W_])\1{3,}/.test(token)) {
    return true;
  }

  return false;
}

/**
 * Purges Mojibake and sanitizes extracted PDF text for UI display and RAG context.
 *
 * @param rawText Unprocessed string extracted from PDF parser
 * @returns Cleaned, human-readable UTF-8 string
 */
export function sanitizePdfText(rawText: string | null | undefined): string {
  if (!rawText) return '';

  // 1. Remove raw null bytes, backspaces, form feeds, and non-printable control chars (except \n, \r, \t)
  let clean = rawText
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
    .replace(/\uFFFD/g, ' '); // Strip replacement character 

  // 2. Normalize common PDF ligatures
  clean = clean
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    .replace(/\uFB05/g, 'ft')
    .replace(/\uFB06/g, 'st');

  // 3. Filter characters based on strict whitelist/bounds
  const charArray: string[] = [];
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const code = clean.charCodeAt(i);
    if (isPrintableOrTechnical(char, code)) {
      charArray.push(char);
    } else {
      charArray.push(' ');
    }
  }
  clean = charArray.join('');

  // 4. Line by line processing to remove binary noise tokens and empty lines
  const lines = clean.split(/\r?\n/);
  const sanitizedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const tokens = trimmed.split(/\s+/);
    const validTokens: string[] = [];

    for (const token of tokens) {
      if (!isGarbageToken(token)) {
        validTokens.push(token);
      }
    }

    // Only keep line if it has legitimate content
    const processedLine = validTokens.join(' ');
    if (processedLine.length > 2) {
      sanitizedLines.push(processedLine);
    }
  }

  // 5. Clean up multiple consecutive spaces & excessive blank lines
  return sanitizedLines
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
