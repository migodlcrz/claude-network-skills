---
description: Generate this week's Network Focus brief for the CEO.
---

Generate the weekly **Network Focus brief** using the `network-focus` skill.

Follow the skill's workflow exactly:
1. Run `node scripts/load_roster.js` to load and validate the roster. Do not read
   the spreadsheet yourself.
2. If the loader returns `"ok": false`, explain the problem to the operator in plain
   language and stop — do not fabricate a brief.
3. Otherwise, reason over the roster and quality report and emit the markdown brief:
   3-5 people to invest in this week, each tied to a goal with a concrete action.
4. Surface any data-quality flags (missing goal contacts, stale/thin data, ambiguous
   matches) in a **Data notes** section.
