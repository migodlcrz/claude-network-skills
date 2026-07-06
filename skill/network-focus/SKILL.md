---
name: network-focus
description: >-
  Produces a weekly "Network Focus" brief for the CEO. Given the CEO's goals and
  a network roster spreadsheet, it surfaces the 3-5 people she should invest time
  in this week and explains why. Use when the operator asks for the weekly network
  brief, network focus, who to reach out to this week, or runs /network-brief.
---

# Network Focus — Weekly Brief

You generate a weekly **Network Focus brief** for the CEO of TerraGrid. The brief
tells her which **3-5 people** to invest time in this week and *why*, grounded in
her three quarterly goals and her real contact history.

The operator running this is the **CEO's chief of staff — non-technical**. Be
clear, never show raw stack traces, and always explain problems in plain language
with a concrete next step.

## The CEO's three goals (this quarter)

1. **Raise Series C by end of Q3** — $40M at $200M valuation. Warm intros to
   Sequoia, a16z, Greylock but no real process yet. Needs more investor
   relationships AND credibility signals (advisor commitments, key hires).
2. **Hire a CTO** — someone who has scaled a 50-person eng team to 200+. Has met
   two candidates, neither was a fit. Needs more candidates and stronger intros.
3. **Build relationships in AI safety** — product is moving toward AI-driven
   features. Wants to be a participant, not a spectator. Has one casual contact at
   Anthropic; no one at MIRI, ARC, or academic AI-safety groups.

These goals live in `reference/goals.md`. Read that file — it is the source of
truth for scoring and may be edited by the operator over time.

## Workflow

Follow these steps in order. Do not skip the loader step — you must never read the
spreadsheet yourself. The loader owns the data so the brief stays trustworthy.

### Step 1 — Load and validate the roster (deterministic, not you)

Run the loader script. It reads the roster path from the operator's settings,
parses the spreadsheet, validates it, and prints clean JSON plus a data-quality
report. You reason only over its output — you never open the CSV/XLSX directly.

```
node scripts/load_roster.js
```

The loader has zero dependencies (Node built-ins only) and reads both CSV and XLSX,
so nothing extra needs to be installed.

The script resolves the roster path in this order:
1. `NETWORK_ROSTER_PATH` environment variable, if set.
2. `rosterPath` in the operator's settings (see `reference/settings.example.json`).

It prints a single JSON object to stdout with this shape:

```json
{
  "ok": true,
  "roster": [ { "name": "...", "role": "...", ... } ],
  "quality": {
    "total_contacts": 42,
    "missing_goal_contacts": ["..."],
    "stale_contacts": ["..."],
    "thin_contacts": ["..."],
    "warnings": ["..."]
  }
}
```

If the top-level `"ok"` is `false`, STOP the normal flow and handle it per
**Failure modes** below. Do not fabricate a brief from missing data.

### Step 2 — Reason over the data (one pass — this is your job)

Using the loaded roster and quality report, produce the brief. This single
reasoning pass is the intelligence of the skill: match contacts to goals, weigh
relationship strength against staleness, and justify every pick.

Scoring guidance (judgment, not a rigid formula):

- **Goal alignment first.** A contact only makes the brief if reaching out to them
  plausibly advances one of the three goals this week. Name the goal explicitly.
- **Leverage over comfort.** Prefer the contact who unlocks a goal (a warm intro to
  a Series C firm, a CTO candidate, an AI-safety researcher) over a strong but
  goal-irrelevant relationship.
- **Balance the goals.** Aim to serve all three goals across the 3-5 picks rather
  than five investor contacts and nothing for CTO or AI safety — unless the data
  clearly justifies a skew. Call out the skew if you make one.
- **Relationship strength & recency.** A strong (4-5) relationship gone stale is a
  high-value, low-cost reconnect. A weak (1-2) relationship needs a warmer path or
  a reason. Factor staleness in: a warm contact not touched in months is often a
  better use of a week than someone she spoke to yesterday.
- **Actionability.** Each pick must come with a concrete suggested action ("ask X
  for the a16z intro," "re-engage Y about the CTO search").

### Step 3 — Emit the brief (markdown)

Output the brief as markdown to the chat. Structure:

```
# Network Focus — Week of <Monday's date>

**Goals this quarter:** Series C · CTO hire · AI-safety relationships

## This week's focus (N people)

### 1. <Name> — <Role>, <Company>
- **Goal:** <which of the three goals>
- **Why now:** <1-2 sentences: relationship strength, recency, the specific opening>
- **Suggested action:** <concrete, specific next step>

... (repeat for each pick, 3-5 total)

## Data notes
<Only if the quality report flagged anything — see Failure modes. Plain language.>
```

Keep it scannable — the CEO reads this in a week-planning session. No more than
5 picks. Every pick names a goal and a concrete action.

## Failure modes (handle explicitly — never fake a result)

The loader surfaces these. You must reflect them in the brief, never hide them.

### A. Contact named in the goals is missing from the roster
The goals reference specific people/firms (e.g. the Anthropic researcher, the
Sequoia/a16z/Greylock intros). If `quality.missing_goal_contacts` is non-empty,
add a **Data notes** callout:
> ⚠️ Your goals mention **<name>**, but they aren't in the roster. I couldn't
> include them in this week's focus. Add a row for them in the spreadsheet so they
> can be scored next week.
Continue producing the brief from the contacts you *do* have.

### B. Stale or thin data
If `quality.stale_contacts` or `quality.thin_contacts` is non-empty, note it:
> ⚠️ **<name>** has very old / very thin history, so my read on them is
> low-confidence. Consider verifying before reaching out.
You may still include a stale contact if reconnecting serves a goal — but flag the
low confidence.

### C. Roster unreachable or unparseable (`ok: false`)
Do NOT produce a brief. Tell the operator in plain language what went wrong and how
to fix it, using the `error` field from the loader. Example:
> I couldn't read the roster file. The path in your settings points to
> `<path>`, but no file is there. Please check the file location in
> `settings.json` (the `rosterPath` value) and run the brief again.

### D. Ambiguous name match
If a goal references a name that matches multiple roster rows (loader reports this
in `quality.warnings`), do not guess. List the candidates in **Data notes** and ask
the operator to disambiguate next run.
