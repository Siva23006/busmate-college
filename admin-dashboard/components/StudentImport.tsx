"use client";
// "Import from Excel/CSV" on the Students page: template download, CSV parsing + checks in the
// browser, preview, then POST /students/bulk (1000 rows per request) and a per-row result list.
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload, XCircle } from "lucide-react";
import { studentApi } from "@/services/busmate";
import { errorMessage } from "@/lib/api";
import { downloadCsv, normHeader, parseCsv } from "@/lib/csv";
import type { Bus, BulkStudentInput } from "@/types";
import { Badge, Button, ErrorBox, Modal, cn } from "./ui";

const COLUMNS = ["name", "student_id", "password", "email", "phone", "department", "year", "bus_number", "stop_name"] as const;
type Col = (typeof COLUMNS)[number];

/** Header spellings we accept for each column (compared after normHeader). */
const ALIASES: Record<Col, string[]> = {
  name: ["name", "fullname", "studentname"],
  student_id: ["studentid", "rollno", "rollnumber", "registerno", "registernumber", "regno"],
  password: ["password", "pass", "initialpassword"],
  email: ["email", "emailid", "mail", "emailaddress"],
  phone: ["phone", "mobile", "phoneno", "phonenumber", "mobileno", "mobilenumber"],
  department: ["department", "dept", "branch"],
  year: ["year", "yr", "studyyear"],
  bus_number: ["busnumber", "busno", "bus"],
  stop_name: ["stopname", "stop", "boardingpoint", "pickuppoint", "pickupstop"],
};

const HELP: { col: Col; required?: boolean; text: string }[] = [
  { col: "name", required: true, text: "Full name" },
  { col: "student_id", required: true, text: "Login ID, must be unique" },
  { col: "password", required: true, text: "At least 8 characters" },
  { col: "email", text: "Needed for “Forgot password”" },
  { col: "phone", text: "Optional" },
  { col: "department", text: "e.g. CSE" },
  { col: "year", text: "1 to 10" },
  { col: "bus_number", text: "Exactly as on the Buses page" },
  { col: "stop_name", text: "A stop on that bus's route" },
];

interface Parsed {
  line: number; // row number in the spreadsheet (header = row 1)
  data: BulkStudentInput;
  errors: string[];
}

interface Outcome { added: number; failed: number; failures: { line: number; studentId: string; error: string }[] }

function buildRows(cells: string[][], buses: Bus[]): { rows: Parsed[]; missing: Col[]; unknownHeaders: string[] } {
  const [header = [], ...body] = cells;
  const index: Partial<Record<Col, number>> = {};
  const unknownHeaders: string[] = [];
  header.forEach((h, i) => {
    const n = normHeader(h);
    const col = COLUMNS.find((c) => ALIASES[c].includes(n));
    if (col && index[col] == null) index[col] = i;
    else if (n) unknownHeaders.push(h.trim());
  });
  const missing = (["name", "student_id", "password"] as Col[]).filter((c) => index[c] == null);
  const busByKey = new Map(buses.map((b) => [b.bus_number.trim().toLowerCase().replace(/\s+/g, " "), b]));
  const seen = new Map<string, number>();

  const rows = body.map((r, i): Parsed => {
    const get = (c: Col) => (index[c] != null ? (r[index[c]!] ?? "").trim() : "");
    const errors: string[] = [];
    const data: BulkStudentInput = { name: get("name"), student_id: get("student_id"), password: get("password") };
    if (!data.name) errors.push("Name is empty");
    if (!data.student_id) errors.push("Student ID is empty");
    if (data.password.length < 8) errors.push(data.password ? "Password is shorter than 8 characters" : "Password is empty");

    const email = get("email");
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Email looks wrong");
      data.email = email;
    }
    const phone = get("phone");
    if (phone) data.phone = phone;
    const dept = get("department");
    if (dept) data.department = dept;
    const year = get("year");
    if (year) {
      const n = Number(year);
      if (!Number.isInteger(n) || n < 1 || n > 10) errors.push("Year must be a whole number 1–10");
      else data.year = n;
    }
    const busNo = get("bus_number");
    if (busNo) {
      const bus = busByKey.get(busNo.toLowerCase().replace(/\s+/g, " "));
      if (buses.length && !bus) errors.push(`Bus “${busNo}” not found`);
      data.bus_number = bus?.bus_number ?? busNo;
    }
    const stop = get("stop_name");
    if (stop) {
      if (!busNo) errors.push("A stop needs a bus number");
      data.stop_name = stop;
    }
    if (data.student_id) {
      const key = data.student_id.toLowerCase();
      const first = seen.get(key);
      if (first != null) errors.push(`Same Student ID as row ${first}`);
      else seen.set(key, i + 2);
    }
    return { line: i + 2, data, errors };
  });
  return { rows, missing, unknownHeaders };
}

export function StudentImportModal({ open, onClose, buses, onImported }:
  { open: boolean; onClose: () => void; buses: Bus[]; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Parsed[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  function reset() {
    setFileName(null); setRows(null); setProblem(null); setNote(null); setError(null); setOutcome(null); setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
  }
  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  function template() {
    const example = ["Priya Sharma", "21CS045", "Welcome@123", "priya@example.com", "9876543210", "CSE", "2",
      buses[0]?.bus_number ?? "BUS 01", "Main Gate"];
    downloadCsv("busmate-students-template.csv", [[...COLUMNS], example]);
  }

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    setFileName(file.name);
    if (/\.xlsx?$/i.test(file.name)) {
      setProblem("This is an Excel workbook (.xlsx). In Excel use File → Save As → “CSV UTF-8 (Comma delimited)”, then choose that .csv file here.");
      return;
    }
    try {
      const text = await file.text();
      const cells = parseCsv(text);
      if (cells.length < 2) { setProblem("The file has no student rows. Keep the header row and add one student per row."); return; }
      const { rows, missing, unknownHeaders } = buildRows(cells, buses);
      if (missing.length) {
        setProblem(`Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Download the template to see the expected headers.`);
        return;
      }
      if (unknownHeaders.length) setNote(`Ignored column${unknownHeaders.length > 1 ? "s" : ""}: ${unknownHeaders.join(", ")}`);
      setRows(rows);
    } catch {
      setProblem("Could not read this file. Save it as CSV and try again.");
    }
  }

  const valid = rows?.filter((r) => !r.errors.length) ?? [];
  const invalid = rows?.filter((r) => r.errors.length) ?? [];

  async function runImport() {
    if (!valid.length) return;
    setBusy(true); setError(null);
    const result: Outcome = { added: 0, failed: 0, failures: [] };
    try {
      for (let start = 0; start < valid.length; start += 1000) {
        const chunk = valid.slice(start, start + 1000);
        if (valid.length > 1000) setProgress(`Importing ${start + 1}–${start + chunk.length} of ${valid.length}…`);
        const res = await studentApi.bulk(chunk.map((r) => r.data));
        result.added += res.added;
        result.failed += res.failed;
        for (const r of res.results) {
          if (r.ok) continue;
          const src = chunk[r.row - 1];
          result.failures.push({ line: src?.line ?? r.row, studentId: r.studentId, error: r.error ?? "Could not add this row." });
        }
      }
      setOutcome(result);
      onImported();
    } catch (err) {
      setError(errorMessage(err));
      if (result.added) { setOutcome(result); onImported(); }
    } finally {
      setBusy(false); setProgress(null);
    }
  }

  const footer = outcome
    ? <><Button variant="secondary" onClick={reset}>Import another file</Button><Button onClick={close}>Done</Button></>
    : <><Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button>
      <Button loading={busy} disabled={!valid.length} onClick={runImport}><Upload className="h-4 w-4" /> Import {valid.length} student{valid.length === 1 ? "" : "s"}</Button></>;

  return (
    <Modal wide open={open} title="Import students from Excel / CSV" onClose={close} footer={footer}>
      {outcome ? (
        <div className="space-y-3 text-[13px]">
          {error && <ErrorBox message={`Stopped early: ${error}`} />}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <div className="flex items-center gap-1.5 text-xs font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> Added</div>
              <div className="num text-2xl font-bold">{outcome.added}</div>
            </div>
            <div className={cn("rounded-xl border p-3", outcome.failed
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
              : "border-[var(--border)] bg-[var(--surface-2)]")}>
              <div className="flex items-center gap-1.5 text-xs font-semibold"><XCircle className="h-3.5 w-3.5" /> Failed</div>
              <div className="num text-2xl font-bold">{outcome.failed}</div>
            </div>
          </div>
          {invalid.length > 0 && <p className="text-muted">{invalid.length} row{invalid.length === 1 ? " was" : "s were"} skipped before upload because of errors in the file.</p>}
          {outcome.failures.length > 0 && (
            <div>
              <div className="mb-1.5 font-semibold">Rows that were not added</div>
              <ul className="max-h-64 divide-y divide-[var(--border)] overflow-y-auto rounded-lg border border-[var(--border)]">
                {outcome.failures.map((f) => (
                  <li key={`${f.line}-${f.studentId}`} className="flex gap-3 px-3 py-2">
                    <span className="text-muted num w-14 shrink-0">Row {f.line}</span>
                    <span className="w-28 shrink-0 truncate font-semibold">{f.studentId}</span>
                    <span className="text-red-700 dark:text-red-300">{f.error}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted mt-1.5 text-xs">Fix these rows in your sheet and import just them again.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 text-[13px]">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <p>One student per row. The first row must be the column names below (in any order). Students with a bus and stop see that bus in the Student app straight away.</p>
            <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-3">
              {HELP.map((h) => (
                <div key={h.col} className="text-xs">
                  <code className="rounded bg-[var(--surface-3)] px-1 py-0.5 font-semibold">{h.col}</code>
                  {h.required && <span className="text-red-600"> *</span>} <span className="text-muted">{h.text}</span>
                </div>
              ))}
            </div>
            <p className="text-muted mt-2 text-xs">Using Excel? Fill the template, then <b>File → Save As → “CSV UTF-8 (Comma delimited) (*.csv)”</b> and choose that file here. Google Sheets: File → Download → CSV.</p>
            <Button variant="secondary" className="mt-2.5" onClick={template}><Download className="h-4 w-4" /> Download template (CSV)</Button>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-[var(--border-strong)] px-4 py-4 transition hover:border-primary hover:bg-primary-soft">
            <FileSpreadsheet className="h-6 w-6 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{fileName ?? "Choose a .csv file"}</span>
              <span className="text-muted block text-xs">{fileName ? "Click to choose a different file" : "Saved from Excel or Google Sheets"}</span>
            </span>
            <input ref={fileRef} type="file" accept=".csv,text/csv,.txt,.xlsx,.xls" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>

          {problem && <ErrorBox message={problem} />}
          {error && <ErrorBox message={error} />}
          {progress && <p className="text-muted">{progress}</p>}

          {rows && (
            <div className="anim-fade-in space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{rows.length} row{rows.length === 1 ? "" : "s"} found</span>
                <Badge tone="green">{valid.length} ready</Badge>
                {invalid.length > 0 && <Badge tone="red">{invalid.length} with errors (will be skipped)</Badge>}
                {note && <span className="text-muted text-xs">{note}</span>}
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[var(--surface-2)]">
                    <tr className="text-muted text-[10px] uppercase tracking-wider">
                      {["Row", "Name", "Student ID", "Dept", "Year", "Bus", "Stop", "Check"].map((h) => <th key={h} className="whitespace-nowrap px-2.5 py-2 font-semibold">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {rows.slice(0, 20).map((r) => (
                      <tr key={r.line} className={r.errors.length ? "bg-red-50/60 dark:bg-red-500/5" : undefined}>
                        <td className="text-muted num px-2.5 py-1.5">{r.line}</td>
                        <td className="max-w-[160px] truncate px-2.5 py-1.5 font-medium">{r.data.name || "-"}</td>
                        <td className="whitespace-nowrap px-2.5 py-1.5">{r.data.student_id || "-"}</td>
                        <td className="px-2.5 py-1.5">{r.data.department ?? "-"}</td>
                        <td className="px-2.5 py-1.5">{r.data.year ?? "-"}</td>
                        <td className="whitespace-nowrap px-2.5 py-1.5">{r.data.bus_number ?? "-"}</td>
                        <td className="max-w-[140px] truncate px-2.5 py-1.5">{r.data.stop_name ?? "-"}</td>
                        <td className="px-2.5 py-1.5">
                          {r.errors.length
                            ? <span className="inline-flex items-start gap-1 text-red-700 dark:text-red-300"><AlertTriangle className="mt-px h-3 w-3 shrink-0" />{r.errors.join("; ")}</span>
                            : <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" /> OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 20 && <p className="text-muted text-xs">Showing the first 20 of {rows.length} rows.</p>}
              {invalid.length > 0 && rows.length > 20 && invalid.some((r) => r.line > 21) && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-semibold text-red-700 dark:text-red-300">Show all {invalid.length} rows with errors</summary>
                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                    {invalid.map((r) => <li key={r.line}><span className="text-muted">Row {r.line}:</span> {r.errors.join("; ")}</li>)}
                  </ul>
                </details>
              )}
              <p className="text-muted text-xs">Bus numbers and stops are checked again by the server; any row it rejects is listed after the import.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
