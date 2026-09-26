/**
 * PDF Text Sanitization Utility
 * Purges Mojibake, corrupted CID font glyphs, binary stream noise,
 * and non-printable ASCII artifacts (e.g., 'YA jœu.uuu1~y') while preserving
 * legitimate engineering text, technical notations, and electrical symbols.
 */

// Permitted engineering and technical symbols:
// Ω (Ohms), µ/μ (Micro), ° (Degree), ± (Plus-minus), Ø/ø/Φ (Diameter/Phase),
// ² (Square), ³ (Cubic), • (Bullet), ™, ®, ©, —, –, “, ”, ‘, ’, ✓, Δ (Delta), etc.
const ALLOWED_ENGINEERING_SYMBOLS = /[\u03A9\u00B5\u03BC\u00B0\u00B1\u00D8\u00F8\u03A6\u03C6\u00B2\u00B3\u2022\u2122\u00AE\u00A9\u2014\u2013\u201C\u201D\u2018\u2019\u2713\u0394\u03B4\u2190-\u2195]/;

/**
 * Common double-encoded UTF-8 Mojibake sequences to direct ASCII/Unicode equivalents.
 */
const MOJIBAKE_MAP: Array<[RegExp, string]> = [
  [/â€™/g, "'"],
  [/â€˜/g, "'"],
  [/â€œ/g, '"'],
  [/â€/g, '"'],
  [/â€“/g, '–'],
  [/â€”/g, '—'],
  [/â€¦/g, '...'],
  [/Â°/g, '°'],
  [/Â±/g, '±'],
  [/Âµ/g, 'µ'],
  [/Â©/g, '©'],
  [/Â®/g, '®'],
  [/Ã©/g, 'é'],
  [/Ã¨/g, 'è'],
  [/Ã /g, 'à'],
  [/Ã§/g, 'ç'],
  [/Ã±/g, 'ñ'],
  [/Ã³/g, 'ó'],
  [/Ã­/g, 'í'],
  [/Ãº/g, 'ú'],
  [/Ã¼/g, 'ü'],
  [/Ã¶/g, 'ö'],
  [/Ã¤/g, 'ä'],
];

/**
 * Checks if a character is a valid printable character for technical documents.
 */
function isPrintableOrTechnical(char: string, code: number): boolean {
  // Whitespace (tab, newline, carriage return, space)
  if (code === 9 || code === 10 || code === 13 || code === 32) return true;

  // Standard printable ASCII (exclamation point through tilde: 33 - 126)
  if (code >= 33 && code <= 126) return true;

  // Allowed specific engineering and scientific symbols
  return ALLOWED_ENGINEERING_SYMBOLS.test(char);
}

/**
 * Tests if an individual token is corrupted font noise or a Mojibake artifact.
 * Examples of noise:
 * - "YA" (when adjacent to noise)
 * - "jœu.uuu1~y"
 * - "(cid:142)"
 * - "%ODÙ5É:-Œ"
 * - "~~y"
 */
function isCorruptedToken(token: string): boolean {
  if (!token || token.length === 0) return true;

  // Preserve short tokens like numbers, standard abbreviations, electrical symbols
  if (token.length <= 1) {
    const code = token.charCodeAt(0);
    return !isPrintableOrTechnical(token, code);
  }

  // Unmapped CID font artifacts: (cid:123), cid:45
  if (/^\(?cid:\d+\)?$/i.test(token)) return true;

  // Repeating binary junk: "~~~~", "####", "-----"
  if (/^([^\w\s])\1{3,}$/.test(token)) return true;

  // Obvious Mojibake characters like œ, Œ, æ, Æ, ð, Ð, ø, Ø, þ, Þ, ß mixed with noise
  if (/[œŒæÆðÐøØþÞß]/.test(token)) {
    return true;
  }

  // Tokens containing tildes inside words or at ends: e.g. "uuu1~y", "~y"
  if (/\w+~\w*/.test(token) || /~\w+/.test(token)) {
    return true;
  }

  // Count printable alphanumeric characters vs obscure symbols
  let validCharCount = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token[i];
    const code = token.charCodeAt(i);
    if (
      (code >= 48 && code <= 57) || // 0-9
      (code >= 65 && code <= 90) || // A-Z
      (code >= 97 && code <= 122) || // a-z
      ALLOWED_ENGINEERING_SYMBOLS.test(char)
    ) {
      validCharCount++;
    }
  }

  // If token is longer than 3 characters and has less than 45% valid characters, it's noise
  if (token.length >= 4 && validCharCount / token.length < 0.45) {
    return true;
  }

  return false;
}

/**
 * Sanitizes extracted PDF text for UI display, vector context, and LLM Q&A prompts.
 * Strips out Mojibake, corrupted font artifacts, and non-printable control characters.
 *
 * @param text Unprocessed raw string from PDF text extraction
 * @returns Cleaned, human-readable UTF-8 string
 */
export function sanitizePdfText(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return '';

  // 1. Remove non-printable control characters & null bytes (except \t, \n, \r)
  let clean = text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
    .replace(/\uFFFD/g, ' ') // Replacement character 
    .replace(/\uFEFF/g, ''); // Zero-width no-break space (BOM)

  // 2. Remove common corrupted font / Mojibake artifact clusters (e.g., 'YA jœu.uuu1~y', '(cid:142)')
  clean = clean
    .replace(/\b[A-Z]{1,2}\s+[A-Za-z]*[œŒæÆ][A-Za-z0-9.~-]*\b/g, '') // Strips 'YA jœu.uuu1~y'
    .replace(/[A-Za-z0-9]*[œŒæÆ][A-Za-z0-9.~-]*/g, '')
    .replace(/\(?cid:\d+\)?/gi, '')
    .replace(/\b\w*~\w*\b/g, '');

  // 3. Decode known double-encoded UTF-8 Mojibake sequences
  for (const [regex, replacement] of MOJIBAKE_MAP) {
    clean = clean.replace(regex, replacement);
  }

  // 4. Normalize common PDF typography ligatures
  clean = clean
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    .replace(/\uFB05/g, 'ft')
    .replace(/\uFB06/g, 'st');

  // 5. Filter characters character-by-character to eliminate any remaining unprintable bytes
  const filteredChars: string[] = [];
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const code = clean.charCodeAt(i);
    if (isPrintableOrTechnical(char, code)) {
      filteredChars.push(char);
    } else {
      filteredChars.push(' ');
    }
  }
  clean = filteredChars.join('');

  // 6. Line-by-line token sanitization to eliminate any remaining corrupted tokens
  const lines = clean.split(/\r?\n/);
  const sanitizedLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const tokens = trimmedLine.split(/\s+/);
    const validTokens: string[] = [];

    for (const token of tokens) {
      if (!isCorruptedToken(token)) {
        validTokens.push(token);
      }
    }

    if (validTokens.length > 0) {
      const reconstructed = validTokens.join(' ');
      // Retain lines that contain meaningful content
      if (/[A-Za-z0-9]/.test(reconstructed) || ALLOWED_ENGINEERING_SYMBOLS.test(reconstructed)) {
        sanitizedLines.push(reconstructed);
      }
    }
  }

  // 7. Normalize whitespace: collapse consecutive spaces & excessive blank lines
  return sanitizedLines
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default sanitizePdfText;
