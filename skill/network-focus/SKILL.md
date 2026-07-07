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

**Pipeline shape:** Load (deterministic) → **Select** (you, in this conversation)
→ **Verify** (independent sub-agent) → **Write** (independent sub-agent) → emit.
Select, Verify, and Write are three separate, narrower jobs on purpose: Select
decides *who and why* (structured facts only, no prose), Verify is an adversarial
second look that catches ungrounded or unbalanced picks before anyone reads them,
and Write turns the verified facts into the polished brief without being allowed
to introduce new claims of its own. Splitting them this way means each stage has a
narrow, checkable job — instead of one pass trying to rank, self-check, and write
well all at once.

### Step 1 — Load and validate the roster (deterministic, not you)

Run the loader script. It finds and parses the spreadsheet, validates it, and
prints clean JSON plus a data-quality report. You reason only over its output —
you never open the CSV/XLSX directly.

```
node scripts/load_roster.js
```

The loader has zero dependencies (Node built-ins only) and reads both CSV and XLSX,
so nothing extra needs to be installed.

**The operator never has to type a file path.** The script resolves the roster in
this order:
1. `NETWORK_ROSTER_PATH` environment variable, if set (power-user override).
2. `rosterPath` in the operator's settings, if explicitly set (manual override —
   for when more than one spreadsheet lives in the watch folder, or the file is
   kept somewhere unusual).
3. **Auto-discovery (the default path for a non-technical operator):** the loader
   looks in the watch folder — `~/Documents/reports` by default, or `rosterFolder`
   in settings — and uses the file there if there's exactly one CSV/XLSX. The
   operator's whole "setup" is dropping the spreadsheet into that folder.

It prints a single JSON object to stdout with this shape:

```json
{
  "ok": true,
  "brief_output_dir": "/Users/.../Documents/network-focus-briefs",
  "roster": [
    {
      "name": "...", "role": "...", "company": "...", "relationship": "...",
      "last_contact_date": "...", "last_contact_channel": "...",
      "last_contact_summary": "...", "strength": 4, "tags": "...", "notes": "...",
      "signals": {
        "goal_matches": ["series_c"],
        "goal_match_labels": ["Series C"],
        "days_since_contact": 120,
        "recency_bucket": "aging",
        "dormant_but_strong": true,
        "goal_aligned_but_weak": false,
        "dormant_candidate": true
      }
    }
  ],
  "quality": {
    "total_contacts": 42,
    "missing_goal_contacts": ["..."],
    "stale_contacts": ["..."],
    "thin_contacts": ["..."],
    "warnings": ["..."]
  }
}
```

**About `signals` (pre-computed by the loader — objective, not judgment):**
The script pre-computes these features so you reason over structured facts instead
of re-deriving them from raw text. They are *inputs to your judgment*, not a ranking:
- `goal_matches` / `goal_match_labels` — which of the three goals this contact's
  tags/role/notes plausibly relate to. Empty means no keyword match — but use your
  own judgment too; the keyword scan can miss things.
- `recency_bucket` — `fresh` (≤14d), `recent` (≤45d), `warm` (≤90d), `aging`
  (≤180d), `dormant` (>180d), or `unknown` (no date).
- `dormant_but_strong` — strong relationship (4-5) gone cold (>90d): a high-value,
  low-cost reconnect. A prime candidate for the brief.
- `goal_aligned_but_weak` — relates to a goal but strength ≤2: needs a warmer path
  or a specific reason to be worth the week.
- `dormant_candidate` — 60+ days since contact AND still goal-aligned (any strength):
  the pool for the **Dormant relationships** section of the brief.

**`brief_output_dir`** — where to save the brief file in Step 5. Resolved by the
loader from (in order) the `NETWORK_BRIEF_OUTPUT_DIR` env var, `briefOutputDir` in
the operator's settings, or a default of `~/Documents/network-focus-briefs`. Always
use this value as given — never hardcode a path yourself.

If the top-level `"ok"` is `false`, STOP the normal flow and handle it per
**Failure modes** below. Do not fabricate a brief from missing data.

### Step 2 — Select (you, in this conversation — structured output only)

Using the loaded roster (including each contact's `signals`) and the quality
report, decide **who and why**. This is the one genuine judgment call in the
pipeline — the loader already did objective feature extraction; this step is
holistic weighing that a keyword scan can't do.

Work in three sub-steps so the reasoning is sound, auditable, and fast:

**2a. Pre-filter using `signals` (cheap, mechanical — do this first).** Narrow the
roster to a **candidate pool**: every contact with a non-empty `goal_matches` OR
`dormant_candidate: true`. This is a plain filter on fields the loader already
computed, not a judgment call — do not spend reasoning effort re-evaluating
contacts with no goal match and no dormant flag; they cannot win a focus or dormant
slot, so exclude them from the pool without weighing them individually. If the pool
looks suspiciously small (fewer than ~5) relative to `quality.total_contacts`,
double-check a few excluded contacts' `tags`/`notes` in case the keyword scan missed
something real — but this is a spot-check, not a full re-scan.

**2b. Shortlist the candidate pool against a rubric** (this is where your judgment
goes — only the pool from 2a, not the full roster). For each contact in the pool,
weigh:
- **Goal alignment** — reaching out plausibly advances one of the three goals this
  week. Use `signals.goal_match_labels` as a starting point, but apply your own
  judgment (the keyword scan can miss or over-match).
- **Leverage over comfort** — prefer the contact who *unlocks* a goal (a warm intro
  to a Series C firm, a CTO candidate, an AI-safety researcher, someone who opens a
  pipeline) over a strong but goal-irrelevant relationship.
- **Timing / openings** — a live thread with a ball in her court ("asked for the
  deck," "revisit in a month" window now open) beats a cold outreach.
- **Strength × recency** — `dormant_but_strong` contacts are high-value, low-cost
  reconnects. `goal_aligned_but_weak` contacts need a warmer path or a specific
  reason. A `dormant`/`aging` warm relationship is often a better use of a week than
  someone contacted yesterday.

**2c. Select 3-5 for "focus" and 2-3 for "dormant"** (from contacts flagged
`signals.dormant_candidate`, no overlap with focus picks). Aim to serve all three
goals across the focus picks rather than five of one, unless the data clearly
justifies a skew.

**Grounding rule (do not skip):** every pick must be justified by *specific evidence
that exists in that contact's roster row* — quote or closely paraphrase a real
`last_contact_summary`, `notes`, `strength`, or date. If you cannot point to a
concrete field that supports a claim, do not make the claim. Never invent a reason,
a past interaction, or a detail that is not in the data.

**Output of this step — structured JSON only, no prose brief yet:**
```json
{
  "picks": [
    { "section": "focus", "name": "...", "goal": "...",
      "evidence_field": "last_contact_summary", "evidence_quote": "...",
      "move": "...", "risk": "..." }
  ],
  "skew_note": "..."   // only if goals are deliberately unbalanced; else omit
}
```
This is deliberately terse — no "why now" essay yet. Keeping this stage to bare
facts is what makes it possible for Verify to check every claim mechanically.

### Step 3 — Verify (independent sub-agent, `agents/verify-brief.md`)

Pass the sub-agent: the Step 2 JSON, the full loader output (roster + signals +
quality), and the three goals. It has no memory of *why* you picked anyone — it
only sees the claims and the raw data, and tries to find problems: ungrounded
citations, goal mismatches, duplicate picks across sections, dormant picks that
aren't actually eligible, or goal imbalance. It returns
`{ verified, issues[], goal_coverage }` — see the agent's own spec for the schema.

**If `verified: false`:** do not silently discard the issues. For anything fixable
(e.g. a citation that was slightly misquoted but a correct one exists in the same
field), fix it and re-verify. For anything not fixable in this run, keep the flagged
picks but make sure Write surfaces the issue in **Data notes** rather than
presenting it as fully confirmed. Never suppress a Verify finding.

### Step 4 — Write (independent sub-agent, `agents/write-brief.md`)

Pass the sub-agent: the (possibly corrected) Step 2 JSON, the Step 3 verify result,
and the quality report. It renders the final markdown brief — executive summary,
"This week's focus," "Dormant relationships," "Data notes" — using only facts
already in that input. It does not re-open the roster and cannot add a claim that
wasn't already in the Select output. See the agent's own spec for the exact output
template.

### Step 5 — Emit

Post the Write stage's markdown output to the chat, unmodified. That is the brief.

Then also save it to a file so the operator has something to open, share, or attach
without retyping it: write the same markdown, unmodified, to
`<brief_output_dir>/YYYY-MM-DD-network-focus.md`, using the loader's
`brief_output_dir` value (never hardcode the folder) and Monday's date for that
week. Create the folder if it doesn't exist. After saving, tell the operator in
plain language where it went, e.g.:
> Saved a copy to `~/Documents/network-focus-briefs/2026-07-06-network-focus.md` —
> open it anytime, or attach it directly if you want to send it to her.

If the operator has set a custom `briefOutputDir` in settings, the path will
reflect that instead of the default.

This saved file is a **snapshot** of this run — it is not re-read or re-opened by
this skill later. If the operator asks a follow-up question afterward (Step 6),
answer from the live roster/signals/picks already in this conversation, the same
as if no file had been saved. The file is for her convenience, not a data source.

### Step 6 — Handling follow-up questions and revision requests

The brief is not the end of the conversation. The operator or CEO may push back,
ask why someone was or wasn't included, or ask for a change. The same grounding
rule from Step 2 still applies — never relax it just because the ask came after
the brief was already produced. For a substantive swap or addition, re-run Steps
2-4 (Select → Verify → Write) for the changed pick rather than editing prose by
hand — that keeps the same trust guarantees on any revision.

**"Why is/isn't X in the brief?"** — Re-derive the answer from the already-loaded
roster and `signals`, never from memory or a plausible-sounding guess. Answer in
this structured form:

```
**<Name>** — <included / not included>
- **Goal fit:** <which goal(s) they match, per `signals.goal_match_labels`, or
  "none" if empty>
- **Signals:** <strength, recency_bucket/days_since_contact, and any flags like
  dormant_but_strong / goal_aligned_but_weak / dormant_candidate>
- **Evidence:** <the actual last_contact_summary / notes line, or "none on file"
  if thin>
- **Why this led to the decision:** <how the above did or didn't clear the bar in
  Step 2's rubric — e.g. outranked by a stronger-leverage pick, or excluded because
  there's no goal alignment / no real evidence to cite>
```

If the person **isn't in the roster at all**, say so plainly — do not invent a row
for them. If the roster may be out of date (the operator says they updated the
spreadsheet), re-run `node scripts/load_roster.js` rather than trusting stale
context from earlier in the conversation.

**"Swap in X instead of Y" / "add X"** — Before adding anyone, run them through the
same grounding rule as the original brief: find their actual row and signals, and
only add them if you can cite real evidence for the goal they'd serve. If they have
no goal alignment or no usable evidence, say so and explain why they don't clear the
bar, using the structured form above, instead of adding them anyway to be agreeable.

**"That reasoning seems off" / disputes a pick** — Re-check the specific row and
signals for that person and either (a) show the evidence again and stand by the
pick, or (b) if the pushback reveals the evidence was misread, correct the brief and
say what changed. Never defend a pick you can't currently point to real data for.

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
to fix it, using the `error`/`hint` fields from the loader. These already speak in
plain language (no path jargon), so relay them directly rather than rephrasing.
Example, when no file was found in the watch folder:
> I couldn't find a spreadsheet in `~/Documents/reports`. Please save your roster
> there as a `.csv` or `.xlsx` file and run the brief again.

### D. Ambiguous name match
If a goal references a name that matches multiple roster rows (loader reports this
in `quality.warnings`), do not guess. List the candidates in **Data notes** and ask
the operator to disambiguate next run.

### E. More than one spreadsheet in the watch folder
If the loader's `error` says it found multiple files, do NOT guess which one is
current. Relay its `hint` plainly: ask the operator to either delete the old
file(s) so only the current roster remains in the folder, or set `rosterPath` in
settings to the exact file to use. This is a variant of failure mode C
(`ok: false`) — same rule: no brief until it's resolved.
