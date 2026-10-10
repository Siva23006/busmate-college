// Small CSV helpers (no dependencies): parse uploaded files and build downloads that Excel opens.

/** Pick the delimiter used on the first line: comma, semicolon (Excel in some regions) or tab. */
function detectDelimiter(text: string): string {
  let inQuotes = false;
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    else if (!inQuotes && ch in counts) counts[ch] += 1;
  }
  if (counts[";"] > counts[","] && counts[";"] >= counts["\t"]) return ";";
  if (counts["\t"] > counts[","]) return "\t";
  return ",";
}

/**
 * Parse CSV text into rows of cells. Handles quoted fields ("a, b"), escaped quotes (""),
 * line breaks inside quotes, CRLF / LF / CR line endings and a UTF-8 BOM. Blank lines are skipped.
 */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delim = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const endField = () => { row.push(field); field = ""; };
  const endRow = () => {
    endField();
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field.trim() === "") { field = ""; inQuotes = true; }
    else if (ch === delim) endField();
    else if (ch === "\r") { endRow(); if (text[i + 1] === "\n") i++; }
    else if (ch === "\n") endRow();
    else field += ch;
  }
  if (field !== "" || row.length) endRow();
  return rows;
}

/** Normalise a header cell: "Student ID" / "student_id" / " STUDENT-ID " -> "studentid". */
export function normHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-.]/g, "");
}

function cell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n;]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build CSV text (CRLF line endings, like Excel). */
export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

/** Download rows as a .csv file. A BOM is added so Excel reads UTF-8 (names, ₹, etc.) correctly. */
export function downloadCsv(filename: string, rows: unknown[][]) {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
