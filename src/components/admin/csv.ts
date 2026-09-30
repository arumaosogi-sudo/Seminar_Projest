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
  const src = text.replace(/^﻿/, "");
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

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
const CODE_HEADERS = new Set(["studentcode", "studentid", "studentno", "studentnumber", "id", "code"]);
const NAME_HEADERS = new Set(["firstname", "name", "givenname", "first"]);

export function parseRosterCsv(text: string): RosterParseResult {
  const rows = parseCsv(text);
  const result: RosterParseResult = { entries: [], invalid: [], duplicates: 0, headerDetected: false };
  if (rows.length === 0) return result;

  let codeCol = 0;
  let nameCol: number | null = rows[0].length > 1 ? 1 : null;
  let start = 0;

  const header = rows[0].map(norm);
  const hCode = header.findIndex((h) => CODE_HEADERS.has(h));
  const hName = header.findIndex((h) => NAME_HEADERS.has(h));
  if (hCode >= 0 || hName >= 0) {
    result.headerDetected = true;
    start = 1;
    codeCol = hCode >= 0 ? hCode : 0;
    nameCol = hName >= 0 ? hName : null;
  } else if (!CODE_RE.test(rows[0][0]?.replace(/\s/g, "") ?? "")) {
    // Unknown header row (e.g. "รหัส,ชื่อ") — skip it rather than report it as invalid.
    result.headerDetected = true;
    start = 1;
  }

  const seen = new Set<string>();
  for (let i = start; i < rows.length; i++) {
    const raw = rows[i][codeCol] ?? "";
    const code = raw.replace(/\s/g, "");
    if (!CODE_RE.test(code)) {
      result.invalid.push({ line: i + 1, value: raw || rows[i].join(", ") });
      continue;
    }
    if (seen.has(code)) {
      result.duplicates++;
      continue;
    }
    seen.add(code);
    const name = nameCol !== null ? (rows[i][nameCol] ?? "").trim().slice(0, 60) : "";
    result.entries.push(name ? { studentCode: code, firstName: name } : { studentCode: code });
  }
  return result;
}
