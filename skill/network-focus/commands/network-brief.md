---
description: Generate this week's Network Focus brief for the CEO.
---

Generate the weekly **Network Focus brief** using the `network-focus` skill.

Follow the skill's workflow exactly (see `SKILL.md` for full detail):
1. Run `node scripts/load_roster.js` to load and validate the roster. Do not read
   the spreadsheet yourself.
2. If the loader returns `"ok": false`, explain the problem to the operator in plain
   language and stop — do not fabricate a brief.
3. Otherwise, run the pipeline: **Select** (you decide who/why as structured JSON)
   → **Verify** (the `verify-brief` sub-agent independently checks grounding and
   goal balance) → **Write** (the `write-brief` sub-agent renders the final
   markdown) → emit the result unmodified.
4. The brief must include an executive summary, 3-5 "This week's focus" picks, a
   "Dormant relationships" section (2-3 people), and any data-quality flags
   (missing goal contacts, stale/thin data, ambiguous matches, unresolved verify
   issues) in **Data notes**.
5. Also save the brief as a dated `.md` file under `~/Documents/network-focus-briefs/`
   and tell the operator where it went. The saved file is a snapshot only — keep
   answering any follow-up questions from the live data in this conversation, not
   by re-reading the file.
