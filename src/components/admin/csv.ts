/**
 * Client-side roster CSV parsing. Tolerant of:
 *  - UTF-8 BOM, CRLF/LF, quoted fields with "" escapes
 *  - comma, semicolon or tab delimiters (auto-detected from the first line)
 *  - header names like "student_code", "Student ID", "id", "first_name", "First name", "name"
 *  - no header at all (column 1 = code, column 2 = first name)
 */

export interface RosterEntry {
  studentCode: string;
  firstName?: string;
}

export interface RosterParseResult {
  entries: RosterEntry[];
  /** Lines that had something but not a valid 8–12 digit student ID (1-based line numbers). */
  invalid: { line: number; value: string }[];
  duplicates: number;
  headerDetected: boolean;
}

export const MAX_ROSTER_ENTRIES = 1000;
const CODE_RE = /^\d{8,12}$/;

function detectDelimiter(line: string): string {
  const counts: [string, number][] = [",", ";", "\t"].map((d) => [d, line.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** RFC 4180-ish parser. Returns rows of trimmed cells. */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = delimiter ?? detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell.trim() === "") {
      inQuotes = true;
      cell = "";
    } else if (ch === delim) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

/** Lower-case and drop separators only — keeps Thai (and other non-ASCII) letters intact. */
const norm = (h: string) => h.toLowerCase().replace(/[\s_.\-]/g, "");
const CODE_HEADERS = new Set(["studentcode", "studentid", "studentno", "studentnumber", "id", "code", "รหัสนักศึกษา", "รหัส", "เลขประจำตัว", "รหัสประจำตัว"]);
const NAME_HEADERS = new Set(["firstname", "name", "givenname", "first", "ชื่อ", "ชื่อจริง", "ชื่อต้น"]);

const cleanCode = (v: string | undefined) => (v ?? "").replace(/\s/g, "");
/** Collapse whitespace / embedded newlines inside a quoted name cell. */
const cleanName = (v: string | undefined) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

/** Column whose cells most often look like a student ID (ties → leftmost). -1 when none match. */
function bestCodeColumn(rows: string[][]): number {
  const width = Math.max(0, ...rows.map((r) => r.length));
  let best = -1;
  let bestHits = 0;
  for (let c = 0; c < width; c++) {
    const hits = rows.reduce((n, r) => n + (CODE_RE.test(cleanCode(r[c])) ? 1 : 0), 0);
    if (hits > bestHits) {
      best = c;
      bestHits = hits;
    }
  }
  return best;
}

/** First column (other than the code column) that contains non-numeric text — a likely name column. */
function guessNameColumn(rows: string[][], codeCol: number): number | null {
  const width = Math.max(0, ...rows.map((r) => r.length));
  for (let c = 0; c < width; c++) {
    if (c === codeCol) continue;
    if (rows.some((r) => /[^\d\s.,-]/.test(r[c] ?? ""))) return c;
  }
  return null;
}

export function parseRosterCsv(text: string): RosterParseResult {
  const rows = parseCsv(text);
  const result: RosterParseResult = { entries: [], invalid: [], duplicates: 0, headerDetected: false };
  if (rows.length === 0) return result;

  const header = rows[0].map(norm);
  const hCode = header.findIndex((h) => CODE_HEADERS.has(h));
  const hName = header.findIndex((h) => NAME_HEADERS.has(h));
  // A first row is a header when it names a known column or contains no student ID at all.
  const firstHasCode = rows[0].some((cell) => CODE_RE.test(cleanCode(cell)));
  const start = hCode >= 0 || hName >= 0 || !firstHasCode ? 1 : 0;
  result.headerDetected = start === 1;
  const data = rows.slice(start);

  let codeCol = hCode;
  if (codeCol < 0) codeCol = bestCodeColumn(data);
  if (codeCol < 0) codeCol = 0;
  // Named header → use it. Recognised code header but no name header → no names (don't guess e.g. an e-mail column).
  let nameCol: number | null;
  if (hName >= 0 && hName !== codeCol) nameCol = hName;
  else if (hCode >= 0) nameCol = null;
  else nameCol = guessNameColumn(data, codeCol);

  const seen = new Set<string>();
  data.forEach((row, i) => {
    const raw = row[codeCol] ?? "";
    const code = cleanCode(raw);
    if (!CODE_RE.test(code)) {
      result.invalid.push({ line: i + start + 1, value: raw || row.join(", ") });
      return;
    }
    if (seen.has(code)) {
      result.duplicates++;
      return;
    }
    seen.add(code);
    const name = nameCol !== null ? cleanName(row[nameCol]) : "";
    result.entries.push(name ? { studentCode: code, firstName: name } : { studentCode: code });
  });
  return result;
}
