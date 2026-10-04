# "Wo ist mehr?" and finger pictures in Mengenblitz (design, 2026-10-04)

Release 1.9.0. Audience: children in Vorschule / Klasse 1 playing Mengenblitz; parents who control it.

## Goal
Mengenblitz gets two new kinds of content without changing its four levels:
1. **Compare tasks ("Wo ist mehr?")** — two groups of different objects flash side by side; the child taps the side that had more (later also "gleich viel").
2. **Finger pictures** — a cartoon hand (or two) as a further structured way to show a quantity, next to the dice/double-dice patterns.

## Decisions (agreed with the user)
- Compare tasks are **mixed into existing levels**, not a new level: since 1.7 every exercise has a fixed `LEVEL_COUNT = 4` per grade, tied to album pages and medals.
- Roughly 30 % of tasks on a level with compare are compare tasks, **at most 2 per round** (`ROUND_LENGTH = 5`).
- Parent toggle "Vergleiche einmischen" (`settings.quantity.compare`), **default on**.
- "Gleich viel" as a third answer only on levels marked `equal`.
- Finger pictures are drawn as **inline SVG in code** (exact finger count guaranteed), not as generated raster art.
- Out of scope (own specs later): Wort-Bild-Blitz and Merk-Blitz (package 2), automatic letter unlocking (package 3).

## Level table (compare)
Each ladder level in `js/exercises/quantity.js` gets an optional `compare` field. Steps and the adaptive engine stay untouched.

| Grade | Level 0 | Level 1 | Level 2 | Level 3 |
|---|---|---|---|---|
| `pre` | – | `{ max: 6, minDiff: 3 }` | `{ max: 10, minDiff: 2 }` | `{ max: 10, minDiff: 1, equal: true }` |
| `g1` | `{ max: 10, minDiff: 2 }` | `{ max: 10, minDiff: 1, equal: true }` | – (Plus level) | `{ max: 10, minDiff: 1, equal: true, area: true }` |

`session.createRound` passes the played level definition to the exercise: `ex.prepareRound(rng, ladderOf(exerciseId, settings)[played])`. `quantity.prepareRound` stores `compare: levelDef.compare ?? null` and `compareCount: 0` in the round context; other exercises ignore the extra argument.

## Compare tasks
New module `js/exercises/compare.js` (pure logic, no DOM):

- `compareCounts(rng, { max, minDiff, equal })` → `{ left, right }`:
  - with `equal`: 20 % chance `left === right`, value in `2..max`;
  - otherwise two values in `1..max` with `|left − right| ≥ minDiff` (never equal).
- `createCompareTask(rng, cfg, ctx)` returns
  ```
  { exercise: 'quantity',
    stimulus: { compare: true, left, right, objectLeft, objectRight, positionsLeft, positionsRight, scaleLeft, scaleRight },
    answer: 'left' | 'right' | 'equal',
    choices: equal ? ['left', 'equal', 'right'] : ['left', 'right'],
    durationFactor: 1.5 }
  ```
- Objects: one side uses the round's object (`ctx.object`), the other a different object drawn from `OBJECTS` per task.
- Positions: scattered (`layoutPositions(n, 'random', rng)`), each side in its own field.
- `area: true`: the side with fewer objects gets `scale` 1.4 (the other 1); positions for the scaled side use a minimum distance scaled by the same factor so objects never overlap. For equal counts, a random side is scaled.

**Mixing** in `quantity.createTask`: if `ctx.compare` is set, `settings.quantity.compare` is true and `ctx.compareCount < 2`, then with probability 0.3 a compare task is created and `ctx.compareCount` is incremented.

## Rendering and answering
- Stimulus: `div.compare-row` with two `.field`s side by side (like `.plus-row`, without a sign); objects scaled via CSS custom property `--obj-scale`.
- Choices: two large empty field-shaped candy buttons (left / right), `data-testid="compare-left|right"`; on `equal` levels a "=" button between them (`compare-equal`).
- Both fields stay side by side in **every** orientation (also phone portrait); fields shrink instead of stacking.
- Speech: prompt "Wo waren mehr?"; solution "Links waren mehr: 7 gegen 4." / "Rechts waren mehr: …" / "Es waren gleich viele."

## Finger pictures
- New module `js/ui/hands.js`: `handSvg(n)` → SVG of one hand with `n` (0–5) raised fingers (thumb + four), simple cartoon style matching the pastel UI.
- In `quantity-layout.js` a new structured representation `fingers` (counts 1–10): one hand for 1–5, two hands for 6–10 with the first hand always full (5 + n).
- `structuredPositions` picks `fingers` with ~25 % probability among the patterns for the count; the existing "not the same pattern twice in a row" rule includes `fingers`.
- The stimulus carries `fingers: true` instead of positions; `renderStimulus` draws the hand(s) instead of objects. Twenty-frame and random layouts never use fingers.

## Stats, adaptivity, settings
- Compare results count toward streaks and the adaptive engine like any task (faster/slower within the level; steps unchanged).
- Result records get a general flag `noConfusion` (replacing the plus-only `add` check in `session.js`), set for addition and compare tasks; such results are excluded from confusion stats.
- Fixed-duration mode: compare tasks use the level's `compare` config and fixed duration × 1.5.
- `DEFAULT_SETTINGS.quantity = { compare: true }`; `sanitizeSettings` fills it for old profiles (boolean, default true).
- Parent area, Mengenblitz section: toggle "Vergleiche einmischen (Wo ist mehr?)", `data-testid="quantity-compare"`.

## Testing
**Unit**
- `compareCounts`: values within range, `|diff| ≥ minDiff`, equal only with `equal`, equal frequency roughly 20 % over many seeds.
- `createCompareTask`: the two objects differ; `answer` matches counts; `choices` contain `'equal'` only on equal levels; `area` scales the smaller side.
- Mixing: never more than 2 compare tasks per round; none with the toggle off or on levels without `compare`.
- Fingers: `handSvg(n)` raises exactly `n` fingers for 0–5; the fingers layout yields correct hand split for 1–10; never two finger pictures in a row.
- Session: compare/addition results excluded from confusions.
- Profiles: old profiles get `quantity.compare = true`.

**E2E (Playwright)**
- A round with a forced compare task: tapping the correct side counts as correct.
- Parent toggle off → no compare tasks appear.
- Screenshot check of the compare stimulus and choices in phone portrait and landscape.
