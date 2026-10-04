# Addition as higher stages (design, 2026-10-04)

Audience: children ~4–6 who already count/read digits reliably; parents who control it.

## Goal
Children who master the existing "Mengen" and "Zahlen" stages move on to simple addition, in the same flash-then-answer format. No new menu tile; the menu stays at four exercises.

## Decisions (agreed with the user)
- Addition is appended as the **highest stages** of the existing exercises `quantity` and `digits`; the adaptive engine reaches them after the regular stages.
- Addition tasks are shown **longer**: the current flash duration × 2.5.
- Per exercise a parent toggle "Rechnen", **default on**.
- Out of scope: subtraction, sums above 10.

## Stages
Stages stay index-based (`level.complexity`); addition stages are appended after the existing ones, so stored levels keep their meaning.

**quantity** — after the existing stages: `{ add: true, sum: 5 }`, `{ add: true, sum: 10 }`, each only if `sum <= settings.quantity.max`.
**digits** — after the existing digit stages: `{ add: true, sum: 5 }`, `{ add: true, sum: 10 }`, independent of `settings.digits.range`.

Both only if `settings.<exercise>.addition` is true. Turning it off shrinks `maxComplexity`; the existing `clampLevel` pulls a stored level back to the top regular stage.

## Tasks
Common: `a = randInt(1, sum - 1)`, `b = randInt(1, sum - a)`, `answer = a + b` (so 2 ≤ answer ≤ sum). Tasks carry `durationFactor: 2.5`; regular tasks carry none (= 1).

**quantity addition**
- Stimulus `{ add: true, a, b, object, positionsA, positionsB }`: two structured groups (`layoutPositions(n, 'structured', rng)`) of the round's object, left and right, with a large "+" between them inside the fixed white stage.
- Choices: `1 … sum` with the existing number + dots buttons.
- Prompt: "Wie viele waren es zusammen?" Solution: "`a` und `b` sind `answer`."

**digits addition**
- Stimulus `{ text: 'a + b' }` rendered like the existing flash text.
- Choices: 4 via `buildChoices(answer, [answer + 1, answer - 1, a, b, answer + 2, answer - 2], pool 0…sum)`.
- Prompt: "Wie viel ist das zusammen?" Solution: "`a` plus `b` ist `answer`."

`speakPrompt(task)` / `speakSolution(task)` branch on `task.stimulus.add`.

## Display duration
`session.nextTask` sets `durationMs = round(eff.durationMs × (task.durationFactor ?? 1))`. The adaptive engine keeps working on the unscaled base value; nothing else in `adaptive.js` changes. At a stage change the base resets to 600 ms → 1.5 s for addition; the cap is 3 s × 2.5 = 7.5 s.

## Settings and parent area
- `DEFAULT_SETTINGS.quantity.addition = true`, `DEFAULT_SETTINGS.digits.addition = true`; sanitizer reads them with `bool(…, default)` so existing profiles get `true`.
- Parent area: a checkbox "Rechnen (Plus-Aufgaben auf den höchsten Stufen)" in the Mengen and Zahlen sections (Package 2 will restyle it as a toggle).
- `describeLevel` for addition stages: "Plus bis 5" / "Plus bis 10". The shown "Anzeigedauer" stays the base duration.

## Testing
- Unit: stage lists with/without addition and for `quantity.max` 3/5/10; addition tasks have 1 ≤ a, b and a + b ≤ sum, answer among choices, `durationFactor` 2.5; digits choices unique and in range; `nextTask` scales the duration; sanitizer defaults `addition` to true; turning addition off clamps a stored addition level.
- E2E: a profile whose quantity and digits levels sit on the top addition stage shows a "+" stimulus and accepts the sum.
