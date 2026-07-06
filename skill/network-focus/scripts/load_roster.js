#!/usr/bin/env node
"use strict";

/**
 * Load, validate, and report on the CEO's network roster.
 *
 * This script owns the data. Claude never reads the spreadsheet directly — it
 * reasons only over this script's JSON output. A deterministic parser handles the
 * exact facts (names, dates, strengths); the model handles judgment. That keeps the
 * weekly brief trustworthy and debuggable.
 *
 * Zero runtime dependencies: it runs from ~/.claude where there is no node_modules,
 * so it relies only on Node built-ins (fs, os, path, zlib). CSV is parsed natively;
 * XLSX is unzipped with zlib and its XML read directly.
 *
 * Output: a single JSON object on stdout.
 *   {"ok": true,  "roster": [...], "quality": {...}}   on success
 *   {"ok": false, "error": "...", "hint": "..."}       on failure
 *
 * Roster path resolution order:
 *   1. NETWORK_ROSTER_PATH environment variable
 *   2. rosterPath in the settings file
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

const STALE_DAYS = 90;
const THIN_SUMMARY_MIN = 15;

// Canonical field -> accepted header spellings (lowercased, trimmed).
const COLUMN_ALIASES = {
  name: ["name", "full name", "contact"],
  role: ["role", "title", "position"],
  company: ["company", "org", "organization", "organisation"],
  relationship: ["how she knows them", "relationship", "how i know them",
    "connection", "how we met"],
  last_contact_date: ["last contact date", "last contacted", "last contact",
    "last touch date"],
  last_contact_channel: ["last contact channel", "channel", "last channel"],
  last_contact_summary: ["last contact summary", "summary", "last summary",
    "last interaction"],
  strength: ["relationship strength", "strength", "relationship strength (1-5)",
    "rel strength"],
  tags: ["tags", "tag"],
  notes: ["notes", "note", "comments"],
};

function fail(error, hint = "") {
  process.stdout.write(JSON.stringify({ ok: false, error, hint }));
  process.exit(0); // exit 0: the JSON carries status; Claude reads "ok".
}

function expandHome(p) {
  if (!p) return p;
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function findSettingsPath() {
  const argIdx = process.argv.indexOf("--settings");
  if (argIdx !== -1 && process.argv[argIdx + 1]) return process.argv[argIdx + 1];
  const candidates = [
    path.join(os.homedir(), ".claude", "network-focus.settings.json"),
    path.join(__dirname, "..", "reference", "settings.example.json"),
  ];
  return candidates.find((c) => fs.existsSync(c)) || null;
}

function resolveRosterPath() {
  const env = process.env.NETWORK_ROSTER_PATH;
  if (env) return { p: expandHome(env), source: "NETWORK_ROSTER_PATH env var" };
  const settingsPath = findSettingsPath();
  if (settingsPath) {
    let settings;
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch (e) {
      fail(`Settings file ${settingsPath} is not valid JSON: ${e.message}`,
        "Fix the JSON syntax in your settings file (a missing comma or quote).");
    }
    if (settings.rosterPath) {
      return { p: expandHome(settings.rosterPath), source: `rosterPath in ${settingsPath}` };
    }
  }
  fail("No roster path configured.",
    "Set 'rosterPath' in ~/.claude/network-focus.settings.json to the full path of " +
    "your roster CSV/XLSX file, or set the NETWORK_ROSTER_PATH env var.");
}

// ---- CSV parsing (RFC-4180-ish: quotes, embedded commas/newlines) -------------

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v !== ""));
}

// ---- Minimal ZIP + XLSX reading (pure Node, via zlib) -------------------------

function unzipEntries(buf) {
  // Locate End Of Central Directory record (scan backwards for signature).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error("not a valid zip/xlsx file");
  const cdCount = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = {};
  for (let n = 0; n < cdCount; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    // Read local header to find actual data start (its own name/extra lengths).
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = buf.slice(dataStart, dataStart + compSize);
    entries[name] = method === 0 ? comp : zlib.inflateRawSync(comp);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function xmlMatchAll(xml, re) {
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m);
  return out;
}

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, "&");
}

function parseXLSX(buf) {
  const entries = unzipEntries(buf);
  const sheetName = Object.keys(entries).find((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
  if (!sheetName) throw new Error("no worksheet found in xlsx");
  const sheetXml = entries[sheetName].toString("utf8");

  // Shared strings table.
  const shared = [];
  if (entries["xl/sharedStrings.xml"]) {
    const ss = entries["xl/sharedStrings.xml"].toString("utf8");
    for (const m of xmlMatchAll(ss, /<si>([\s\S]*?)<\/si>/g)) {
      const texts = xmlMatchAll(m[1], /<t[^>]*>([\s\S]*?)<\/t>/g).map((t) => t[1]);
      shared.push(decodeXmlEntities(texts.join("")));
    }
  }

  const colToIdx = (ref) => {
    const letters = ref.replace(/[0-9]/g, "");
    let n = 0;
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };

  const rows = [];
  for (const rm of xmlMatchAll(sheetXml, /<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cm of xmlMatchAll(rm[1], /<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const inner = cm[2] || "";
      const refM = /r="([A-Z]+\d+)"/.exec(attrs);
      const idx = refM ? colToIdx(refM[1]) : cells.length;
      const typeM = /t="([^"]+)"/.exec(attrs);
      const vM = /<v>([\s\S]*?)<\/v>/.exec(inner);
      const tM = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
      let val = "";
      if (typeM && typeM[1] === "s" && vM) val = shared[+vM[1]] || "";
      else if (typeM && typeM[1] === "inlineStr" && tM) val = decodeXmlEntities(tM[1]);
      else if (vM) val = decodeXmlEntities(vM[1]);
      cells[idx] = val;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = "";
    rows.push(cells);
  }
  return rows.filter((r) => r.some((v) => v !== ""));
}

// ---- Row loading --------------------------------------------------------------

function readRows(p) {
  if (!fs.existsSync(p)) {
    fail(`Roster file not found at: ${p}`,
      "Check the file location and update 'rosterPath' in your settings, then run " +
      "the brief again.");
  }
  const ext = path.extname(p).toLowerCase();
  let matrix;
  if (ext === ".csv") {
    matrix = parseCSV(fs.readFileSync(p, "utf8").replace(/^﻿/, ""));
  } else if (ext === ".xlsx" || ext === ".xlsm") {
    try {
      matrix = parseXLSX(fs.readFileSync(p));
    } catch (e) {
      fail(`Could not read the Excel file: ${e.message}`,
        "Try opening the sheet and saving it as CSV (File > Save As > CSV), then " +
        "point rosterPath at the .csv file.");
    }
  } else {
    fail(`Unsupported file type: ${ext || "(none)"}`,
      "Use a .csv or .xlsx file for the roster.");
  }
  if (!matrix || matrix.length === 0) {
    fail(`The roster at ${p} is empty.`, "Add a header row and at least one contact.");
  }
  const headers = matrix[0].map((h) => (h == null ? "" : String(h).trim()));
  return matrix.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] == null ? "" : String(r[i]).trim(); });
    return obj;
  });
}

function buildColumnMap(headers) {
  const normalized = {};
  for (const h of headers) {
    if (h && h.trim()) normalized[h.trim().toLowerCase()] = h;
  }
  const colmap = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      if (normalized[alias]) { colmap[field] = normalized[alias]; break; }
    }
  }
  return colmap;
}

const DATE_FORMATS = [
  /^(\d{4})-(\d{1,2})-(\d{1,2})/, // ISO
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // M/D/YYYY (US-first)
  /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, // M/D/YY
];

function parseDate(raw) {
  if (!raw) return null;
  raw = String(raw).trim();
  if (!raw) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(raw);
  if (m) return new Date(2000 + +m[3], +m[1] - 1, +m[2]);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function parseStrength(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const m = /[1-5]/.exec(String(raw));
  return m ? +m[0] : null;
}

function normalizeRow(row, colmap) {
  const get = (field) => {
    const col = colmap[field];
    if (!col) return "";
    const v = row[col];
    return v == null ? "" : String(v).trim();
  };
  return {
    name: get("name"),
    role: get("role"),
    company: get("company"),
    relationship: get("relationship"),
    last_contact_date: get("last_contact_date"),
    last_contact_channel: get("last_contact_channel"),
    last_contact_summary: get("last_contact_summary"),
    strength: parseStrength(get("strength")),
    tags: get("tags"),
    notes: get("notes"),
  };
}

function loadGoalContacts() {
  const p = path.join(__dirname, "..", "reference", "goals.md");
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, "utf8");
  const m = /##\s*goal_contacts([\s\S]*?)(?:\n##\s|$)/i.exec(text);
  if (!m) return [];
  return m[1].split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-"))
    .map((l) => l.replace(/^-+/, "").trim())
    .filter(Boolean);
}

function today() {
  const override = process.env.NETWORK_TODAY;
  if (override) { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(override); if (m) return new Date(+m[1], +m[2] - 1, +m[3]); }
  return new Date();
}

function buildQualityReport(roster, colmap, goalContacts) {
  const warnings = [];
  const missingCols = ["name", "role", "company", "strength", "last_contact_date"]
    .filter((f) => !(f in colmap));
  if (missingCols.length) {
    warnings.push("Could not find expected columns: " + missingCols.join(", ") +
      ". Scoring may be less accurate.");
  }

  const now = today();
  const stale = [];
  const thin = [];
  for (const c of roster) {
    if (!c.name) continue;
    const d = parseDate(c.last_contact_date);
    if (d === null) thin.push(c.name);
    else if ((now - d) / 86400000 > STALE_DAYS) stale.push(c.name);
    const blob = (c.last_contact_summary + " " + c.notes).trim();
    if (blob.length < THIN_SUMMARY_MIN && !thin.includes(c.name)) thin.push(c.name);
  }

  const haystack = roster.filter((c) => c.name).map((c) => ({ n: c.name, co: c.company }));
  const missingGoal = [];
  for (const gc of goalContacts) {
    const gcl = gc.toLowerCase();
    const matches = haystack
      .filter((h) => h.n.toLowerCase().includes(gcl) || (h.co && h.co.toLowerCase().includes(gcl)))
      .map((h) => h.n);
    const unique = [...new Set(matches)];
    if (unique.length === 0) missingGoal.push(gc);
    else if (unique.length > 1) {
      warnings.push(`'${gc}' matches multiple contacts: ${unique.sort().join(", ")}`);
    }
  }

  return {
    total_contacts: roster.filter((c) => c.name).length,
    missing_goal_contacts: missingGoal,
    stale_contacts: stale,
    thin_contacts: thin,
    stale_threshold_days: STALE_DAYS,
    warnings,
  };
}

function main() {
  const { p, source } = resolveRosterPath();
  const rows = readRows(p);
  if (rows.length === 0) {
    fail(`The roster at ${p} has a header but no contact rows.`,
      "Add at least one contact row to the spreadsheet.");
  }
  const colmap = buildColumnMap(Object.keys(rows[0]));
  if (!("name" in colmap)) {
    fail("Could not find a 'Name' column in the roster.",
      "Make sure the first row has column headers including a 'Name' column.");
  }
  const roster = rows.map((r) => normalizeRow(r, colmap)).filter((c) => c.name);
  const goalContacts = loadGoalContacts();
  const quality = buildQualityReport(roster, colmap, goalContacts);
  process.stdout.write(JSON.stringify({
    ok: true,
    source,
    roster_path: p,
    roster,
    quality,
  }));
}

main();
