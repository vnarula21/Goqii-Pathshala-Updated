export interface ParsedRow {
  fullName: string;
  email: string;
}

export interface SkippedRow {
  line: number;
  text: string;
  reason: string;
}

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

/** Splits one line on a delimiter, honouring "quoted, values". */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Reads learners from CSV / pasted text. Tolerates Windows, Mac and Unix line
 * endings, a BOM, comma / semicolon / tab separators, quoted values, header
 * rows (including separate First/Last name columns) and extra columns.
 * Rows that cannot be used are returned in `skipped` instead of aborting.
 */
export function parseLearnerText(input: string): { rows: ParsedRow[]; skipped: SkippedRow[] } {
  const text = input.replace(/^﻿/, "");
  const lines = text.split(/\r\n|\r|\n/);
  const rows: ParsedRow[] = [];
  const skipped: SkippedRow[] = [];

  const firstReal = lines.find((l) => l.trim().length > 0) ?? "";
  const count = (d: string) => firstReal.split(d).length - 1;
  const delim = [["\t", count("\t")], [";", count(";")], [",", count(",")]]
    .sort((a, b) => (b[1] as number) - (a[1] as number))[0][0] as string;

  let emailCol = -1;
  let nameCols: number[] = [];
  let headerSeen = false;
  const seen = new Set<string>();

  lines.forEach((raw, idx) => {
    if (raw.trim().length === 0) return;
    const cells = splitLine(raw, delim);

    // Header row: a cell that says "email" and no cell that looks like an address.
    if (!headerSeen && rows.length === 0 && !cells.some((c) => c.includes("@"))) {
      const e = cells.findIndex((c) => /e-?mail/i.test(c));
      if (e >= 0) {
        headerSeen = true;
        emailCol = e;
        const first = cells.findIndex((c) => /first/i.test(c) && /name/i.test(c));
        const last = cells.findIndex((c) => /last|sur/i.test(c) && /name/i.test(c));
        if (first >= 0 && last >= 0) nameCols = [first, last];
        else {
          const full = cells.findIndex((c, i) => i !== e && /name/i.test(c));
          nameCols = full >= 0 ? [full] : [];
        }
        return;
      }
    }

    const ec = emailCol >= 0 && cells[emailCol] !== undefined ? emailCol : cells.findIndex((c) => c.includes("@"));
    const email = (ec >= 0 ? cells[ec] : "").trim().toLowerCase();
    if (!email) {
      skipped.push({ line: idx + 1, text: raw.trim(), reason: "No email address" });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      skipped.push({ line: idx + 1, text: raw.trim(), reason: "Invalid email" });
      return;
    }
    if (seen.has(email)) {
      skipped.push({ line: idx + 1, text: raw.trim(), reason: "Duplicate email" });
      return;
    }

    let name = nameCols.length
      ? nameCols.map((i) => cells[i] ?? "").join(" ")
      : cells.filter((c, i) => i !== ec && c.length > 0 && !c.includes("@"))[0] ?? "";
    name = name.replace(/\s+/g, " ").trim();
    if (!name) {
      skipped.push({ line: idx + 1, text: raw.trim(), reason: "No name" });
      return;
    }
    seen.add(email);
    rows.push({ fullName: name, email });
  });

  return { rows, skipped };
}
