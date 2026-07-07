# Network Focus — Handoff Guide

_For the person who runs this each week (the chief of staff / EA). No coding needed._

Every Monday, this tool reads the CEO's network roster and her three quarterly goals
and produces a short **Network Focus brief**: the 3-5 people to invest time in this
week, plus a few dormant relationships worth reviving. You bring it to her
week-planning session.

---

## Part 1 — Install (one time, ~3 minutes)

**Before you start, you need:**

- **Claude Code** open on your Mac/Windows (if you can type to it, you're ready).
- **The roster spreadsheet** — a CSV or Excel file, one contact per row.
  1
  **Steps:**

1. Open the Terminal app (macOS: press ⌘ + Space, type "Terminal", and press Enter;
   Windows: press Windows + S, type "Windows Terminal" or "PowerShell", and press
   Enter).
2. Copy-paste this line and press Enter. It's the same kind of one-line install you
   used for Claude Code itself:
   ```
   npx github:migodlcrz/claude-network-skills install
   ```
3. You'll see a few green ✓ checks.
4. Save the roster spreadsheet into this exact folder — create it if it doesn't
   exist yet:
   ```
   ~/Documents/reports/
   ```
   That's it — **no file path to type or paste anywhere.** The tool looks in that
   folder automatically and picks up whatever spreadsheet is there.

That's the whole setup. Next time the spreadsheet is updated, just replace the
file in that same folder — nothing else to change.

> **If you'd rather keep the spreadsheet somewhere else** (e.g. a synced Dropbox
> folder), that's fine too — open `~/.claude/network-focus.settings.json` and add
> `{ "rosterPath": "/full/path/to/your/file.csv" }`. Optional, not required. The
> same file also lets you change where saved brief copies go (see Part 2) by
> adding `"briefOutputDir": "/full/path/to/a/folder"`.

---

## Part 2 — Run it (every Monday, ~30 seconds)

1. Open **Claude Code**.
2. Type: `/network-brief`
3. Read the brief it produces. It's also saved as a file (named with that week's
   date) in `~/Documents/network-focus-briefs/` by default, or wherever you set
   `briefOutputDir` in Part 1 — open it directly, or attach it if you want to send
   it instead of copy-pasting.
4. Copy it into the CEO's week-planning doc, or just hand her the saved file.

You can still ask follow-up questions in the same Claude Code conversation
afterward (see Part 3) — the saved file is just a copy for your records, you don't
need to reopen it to ask something.

---

## Part 3 — What "good" looks like (two examples)

### Use case A — A normal week

**You do:** type `/network-brief`.
**You get:** a brief with two sections —

- **This week's focus (3-5 people):** for each person, who they are, which goal they
  serve, the evidence from the roster, the specific move to make, and what's at risk
  if she waits. Example pick:
  > **Diana Chen — CTO, Stripe** · Goal: Hire a CTO · She offered to help with the
  > CTO search and knows 3-4 candidates, but was never followed up with · Move: reply
  > and ask for intros · Risk: the offer goes stale and a free candidate pipeline
  > closes.
- **Dormant relationships (2-3 people):** high-value contacts she hasn't spoken to in
  60+ days, worth a light reconnect.

### Use case B — Someone from her goals is missing

Say the CEO mentions "a16z" as a target investor, but no one from a16z is in the
spreadsheet.
**You do:** type `/network-brief` as usual.
**You get:** the normal brief, plus a clear note in **Data notes**:

> ⚠️ Your goals mention **a16z**, but they aren't in the roster. I couldn't include
> them this week. Add a row for them so they can be scored next week.

That's your cue to add a row for that contact before next Monday.

---

## Part 4 — What to do when it breaks

The tool speaks plain English and will **never invent a brief** from bad data — it
tells you what's wrong and how to fix it.

| Message you see                                           | What it means                             | What to do                                                                            |
| --------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| "I couldn't find a spreadsheet in `~/Documents/reports`"  | No file is in the watch folder            | Save your roster there as a `.csv` or `.xlsx` file and run the brief again            |
| "Found more than one spreadsheet"                         | Two or more files are in the watch folder | Delete the old one(s) so only the current roster remains in that folder               |
| "Your goals mention **X**, but they aren't in the roster" | Someone named in the goals has no row     | Add a row for that person in the spreadsheet                                          |
| "**X** has very old / very thin history"                  | Little recent info on them                | The brief still runs — just double-check that person before reaching out              |
| "matches multiple contacts"                               | Two people share a name                   | Note which one she means; the brief will ask rather than guess                        |
| "Settings file… is not valid JSON"                        | The settings file got mistyped            | Make sure it looks exactly like: `{ "rosterPath": "…" }` — quotes and braces included |
| "Could not read the Excel file…"                          | The Excel file is an odd format           | Open it, **Save As → CSV**, and save that into the watch folder instead               |

**Still stuck?** Copy the exact message you saw and send it over — it says precisely
what to fix.

---

## Removing the tool

Paste into Terminal:

```
npx github:migodlcrz/claude-network-skills uninstall
```

This removes the skill and its settings. It does **not** touch your spreadsheet or
the rest of your Claude Code setup.
