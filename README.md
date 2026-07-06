# Network Focus — Weekly Brief

Each Monday, this tool looks at the CEO's network roster and her three quarterly
goals, and produces a short **Network Focus brief**: the 3-5 people she should
invest time in this week, and *why*. Bring the brief to her week-planning session.

You do **not** need to write any code to use this.

---

## What you need once (setup)

1. **A roster spreadsheet** — a CSV or Excel file where each row is one contact.
   Columns: Name, Role, Company, How she knows them, Last contact date, Last
   contact channel, Last contact summary, Relationship strength (1-5), Tags, Notes.
   Save it somewhere on your computer you can find again (e.g. your Documents
   folder).

2. **Claude Code installed** — if it's open and you can type to it, you're set.
   (Claude Code runs on Node/npm, so you already have everything this needs.)

### Install (once) — one line

1. Open the **Terminal** app.
2. Paste this line and press **Enter**:
   ```
   npx github:migodlcrz/claude-network-skills install
   ```
   > This is the same kind of one-line install you used for Claude Code itself.
   > It downloads nothing to manage — it just copies the skill into your `~/.claude`
   > folder and leaves the rest of your setup untouched.
3. The installer confirms each step with a green ✓. At the end it tells you to set
   your roster path.

If you were given a project folder instead, you can also run it from inside that
folder with `npx . install`.

### Point it at your spreadsheet (once)

The installer creates a small settings file at:
```
~/.claude/network-focus.settings.json
```
Open it in any text editor and set `rosterPath` to the full location of your file:
```json
{ "rosterPath": "~/Documents/terragrid-network-roster.csv" }
```
Save the file. That's it — you won't need to touch this again unless the
spreadsheet moves.

---

## Every Monday (run it)

1. Open **Claude Code**.
2. Type:
   ```
   /network-brief
   ```
3. Read the brief it produces. Copy it into the CEO's week-planning doc.

That's the whole weekly routine.

---

## If something looks off

The tool is designed to **tell you in plain language** what's wrong and how to fix
it — it will never invent a brief from missing data. Common messages:

| What you see | What it means | What to do |
|--------------|---------------|------------|
| "I couldn't read the roster file… no file is there" | The spreadsheet moved or the path is wrong | Check the file's location and update `rosterPath` in the settings file |
| "Could not read the Excel file…" | The Excel file is corrupted or an unusual format | Open the sheet, **Save As → CSV**, and point `rosterPath` at the `.csv` |
| "Your goals mention **X**, but they aren't in the roster" | Someone named in the goals has no row yet | Add a row for that person in the spreadsheet before next Monday |
| "**X** has very old / very thin history" | We have little recent info on them | The brief still runs; just double-check before reaching out |
| "Settings file … is not valid JSON" | The settings file got mistyped | Make sure it looks exactly like: `{ "rosterPath": "…" }` with the quotes and braces |

If you're stuck, save the message you saw and share it — it says exactly what to fix.

---

## Removing the tool

To remove the skill and all the files it created, paste this into Terminal:
```
npx github:migodlcrz/claude-network-skills uninstall
```
This deletes the skill, the `/network-brief` command, and its settings file. It
leaves the rest of your Claude Code setup — and your roster spreadsheet — untouched.

To remove the skill but keep your saved roster path (e.g. you plan to reinstall),
add `--keep-settings`:
```
npx github:migodlcrz/claude-network-skills uninstall --keep-settings
```

---

## Changing the CEO's goals

The goals live in `skill/network-focus/reference/goals.md` (and, after install, in
`~/.claude/skills/network-focus/reference/goals.md`). If a goal changes, edit that
file. Keep the **goal_contacts** list at the bottom accurate — that's how the tool
knows to flag someone named in a goal who's missing from the roster.

---

## For the technically curious

See [`docs/PRD.md`](docs/PRD.md) for the full design, the trust boundary between the
data loader and the reasoning step, the failure-mode handling, and how this data
would be sourced live (Calendar / Gmail / CRM) in production. See
[`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md) for the stakeholder walkthrough.
