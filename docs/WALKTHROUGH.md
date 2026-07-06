# Video Walkthrough — Script & Outline (10-12 min)

Maps to the assignment's required video structure. Timings are targets. Keep the
recording unedited — visible file paths, real timestamps, live errors, and typing
(not reading) are what verify the build is real.

**Segment map:**
1. PRD-to-build trace (1-2 min) — §A
2. Live demo on the provided spreadsheet (3-4 min) — §B
3. Architecture decisions, code visible (2-3 min) — §C
4. Failure-mode walkthrough, code visible (2-3 min) — §D
5. Honest limitations & production next steps (1-2 min) — §E

---

## A. PRD-to-build trace (1-2 min)

Open `docs/PRD.md` on screen. Walk through **two** decisions and show where each
lives in the build:

1. **Trust boundary (PRD §5.1).** "Deterministic code owns the data; the LLM owns
   the judgment." → open `skill/network-focus/scripts/load_roster.js` and show it's
   plain parsing/validation, no model. Then open `SKILL.md` and show the instruction
   *"you must never read the spreadsheet yourself."*
2. **Single agent vs. sub-agents, decided per-seam (PRD §5.2).** → open
   `SKILL.md`'s "Pipeline shape" line and the Step 2/3/4 headers: Select stays in
   the main thread (one coherent judgment), but Verify and Write are separate
   sub-agents (`skill/network-focus/agents/verify-brief.md`,
   `agents/write-brief.md`) because they're genuinely different jobs — an
   adversarial check and a constrained render. Show the two agent files briefly.

---

## B–E narrative (also serves as the CEO-facing story)

The sections below are the plain-language narrative — read them for the demo voiceover.

---

## 1. The problem, in your words

You have hundreds of contacts but your week gets eaten by whoever's already on your
calendar — not the relationships that actually move your three goals: Series C, the
CTO hire, and getting into the AI-safety conversation. You don't have time to audit
your network by hand every week. So I built a tool that does that audit for you and
hands your chief of staff a ranked shortlist every Monday.

## 2. The one decision that shaped everything

Everything hinges on one question: **will you trust the brief enough to plan your
week on it?**

If an AI reads your spreadsheet directly, it can quietly get a date wrong, misread a
relationship score, or blur two people together — and you'd never know. Once that
happens once, you stop trusting the whole thing.

So I drew a hard line:

> **Plain code owns the facts. The AI owns the judgment.**

A small, deterministic script reads and checks your spreadsheet and produces clean,
verified data. The AI never opens the spreadsheet — it only reasons over the checked
facts: which contact serves which goal, who's worth a reconnect, what the specific
opening is. Every recommendation traces back to a real row you can point at.

This also makes it debuggable for a non-technical operator: if something looks off,
it's either the data (the script says so, in plain English) or the judgment (one
place to look) — never a murky mix.

**On Claude Code primitives (architecture — §C).** I use skills packaging, a slash
command (`/network-brief`), deterministic structured I/O, and two sub-agents — but
I drew the line on *where* deliberately, not by adding agents everywhere I could:

- **Parsing stays deterministic code, no agent.** An agent that parses the
  spreadsheet can misread a date or blur two similarly-named contacts, and because
  it's a model call, I might never notice. That reintroduces exactly the trust
  problem I was trying to eliminate — so parsing is plain code, full stop.
- **Selecting who matters this week stays one reasoning pass, no additional agent.**
  Ranking contacts against three goals — strength × recency × timing together — is
  one coherent judgment, not independently-decomposable sub-tasks. Splitting the
  selection itself across agents would add a handoff with no new capability.
- **Verifying the selection and writing it up ARE two separate sub-agents,** because
  those genuinely are different jobs: `verify-brief` is an *adversarial* check —
  deliberately a different context from the one that made the picks, so it isn't
  defending its own reasoning, and it independently confirms every citation and the
  goal balance. `write-brief` is a constrained render — it turns verified facts into
  prose without being allowed to add a new claim of its own. Separating "decide"
  from "check" from "phrase persuasively" means each stage has a narrow,
  checkable job instead of one pass doing everything and grading its own work.

Production data sourcing (Calendar/Gmail/CRM) is where MCP would belong — see PRD §7
— not built for this trial since it's a thinking exercise, not a building one.

## 3. How your chief of staff uses it

Non-technical, one command:
1. One-time: run the installer, point it at the roster file.
2. Every Monday: open Claude Code, type `/network-brief`, read the brief.

No code, ever. Errors come back as plain-language instructions ("the file moved,
here's how to fix it"), never stack traces.

## 4. What the brief looks like (live demo — §B)

Run `/network-brief` on the provided 25-contact roster. Real output (full copy in
`docs/BRIEF.md`), abridged here:

> **Executive summary:** This week leans CTO-hire and Series C, with one concrete
> AI-safety opening. Most time-sensitive: Maya Patel's self-set "revisit" window
> opened weeks ago and is closing. Reid Hoffman (Greylock) is her strongest investor
> tie, gone quiet 4 months — worth reviving before the raise heats up.
>
> **This week's focus (5)**
> 1. **Diana Chen — CTO, Stripe** · CTO hire · *offered to help with the search,
>    knows 3-4 candidates, never followed up* · Move: reply, ask for intros · Risk:
>    the offer goes stale, a free pipeline closes.
> 2. **Maya Patel — VP Eng, Slack** · CTO hire · *scaled eng 40→180; "revisit in a
>    month" window opened June 15* · Move: book the revisit now · Risk: the window
>    lapses.
> 3. **Marcus Wei — Sequoia** · Series C · *asked to see the full pitch* · Move: send
>    deck + propose Q3 meeting · Risk: an investor leaning in loses momentum.
> 4. **Reid Hoffman — Greylock** · Series C · *strongest investor tie, 121 days cold*
>    · Move: send the overdue note · Risk: the best lead-investor signal fades.
> 5. **Paul Christiano — ARC Evals** · AI safety · *interested, wants concrete
>    questions* · Move: follow up with 2-3 · Risk: the only path into ARC/MIRI cools.
>
> **Dormant relationships:** Sophia Lee (Pinterest, 63d, can surface CTO candidates),
> Lin Wang (Anthropic, 99d, seed of the AI-safety network), Priya Mehta (Index, 168d,
> Series C fit gone cold).
>
> **Data notes:** ⚠️ a16z named in goals but missing from roster. ⚠️ Reid flagged
> stale (121d). Focus skews CTO+Series C; dormant section rebalances all three goals.

Every pick names the goal, cites a real line from the row, gives a specific move, and
states what's at risk if she waits. It balances across all three goals rather than
handing her five investors and nothing on the CTO search.

## 5. When the data is imperfect (failure modes — §D, show code)

For the video: show `computeSignals()` and `buildQualityReport()` in the loader, then
run one input that triggers a mode live. On the provided roster, **a16z missing** and
**7 stale contacts** trigger naturally — show those in the real output. For the
unparseable-file mode, point `rosterPath` at a missing file on camera and show the
plain-language error (no stack trace).

I built four honest failure modes instead of pretending the data is clean:
- **Someone named in the goals isn't in the roster** (a16z) → flagged in Data notes,
  brief continues.
- **Stale or thin history** → still recommendable, but marked low-confidence.
- **The spreadsheet can't be read** → no brief is faked; the operator gets a clear
  fix in plain English.
- **A name is ambiguous** → it asks rather than guessing.

The rule throughout: **never fabricate a result.** A brief you can't trust is worse
than a brief that admits what it doesn't know.

## 6. Honest limitations & what I'd do differently in production (§E)

- **Keyword goal-matching is coarse.** It uses word-boundary keyword scans; it can
  miss a goal-relevant contact with unusual phrasing. The LLM pass partly compensates,
  but production should use embeddings or a richer taxonomy.
- **Relationship strength is trusted as-is.** If the human-entered 1-5 is wrong, the
  brief inherits that. Deliberate — strength is a human judgment — but a limitation.
- **No memory across weeks.** It can't yet see "recommended last week, still no
  contact." A feedback loop (below) fixes this.
- **Verify is a single independent pass, not a panel.** `verify-brief` catches
  ungrounded citations and goal imbalance well, but it's one adversarial check, not
  three-vote consensus. At higher stakes or larger rosters, I'd run 2-3 verify
  agents and require majority agreement before a pick survives.
- **No deterministic shortlist stage yet.** At 500+ contacts, handing the full
  roster to Select would bloat context and risk "lost in the middle" inconsistency.
  I'd add a pre-filter stage in the loader — still deterministic code, same trust
  boundary — before Select ever sees the roster (see PRD §9).

## 7. What I'd build next

- Live data: pull last-contact info from Calendar and Gmail automatically, keep
  relationship strength and notes human-owned (the PRD's Data Sourcing Strategy
  lays this out).
- A feedback loop: track who you actually contacted vs. who was recommended, and
  tune from there.
- Delivery beyond chat: a formatted PDF or a Slack message Monday morning.

## 8. Why this is the right scope for a v1

It ships, it's trustworthy, and a non-engineer can run it Monday morning. Everything
fancier (live integrations, feedback loops, richer delivery) sits on top of this
same trust boundary without changing it — which is exactly what a good v1 should do.
