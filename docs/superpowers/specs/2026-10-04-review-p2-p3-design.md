# Design review P2/P3 fixes (design, 2026-10-04)

Release 1.9.0, part B (part A: `2026-10-04-compare-fingers-design.md`). Builds on 1.8.1 (P0/P1 fixes, commit f81c5b8). Item numbers refer to the 1.8.0 design review.

Audience: children 4–7 (mostly non-readers) and their parents; tablet, phone and PC.

## Decisions (agreed with the user)
- P2 and P3 go into 1.9.0, except **#27** (design tokens: refactor without visible benefit, later as its own clean-up) and **#36** (skip link: few focus stops, not needed).
- Items with an obvious fix are implemented as the review proposes; four items got a design decision (#11, #13, #14, #16), plus the shape of #12 and #20.

## Items with a design decision

**#11 Repeat (H10, WCAG 2.2.1)**
- A 🔊 button next to the stage re-speaks the current prompt; it is shown in speech modes "little" and "lots" and hidden with speech "off".
- A 👁 button shows the flash **once more per task**, same duration, same stimulus; afterwards it is disabled for this task.
- A correct answer after a replay earns the star but is **neutral for the adaptive engine** (does not count toward the "faster" streak; a wrong answer counts as usual).
- Both buttons are only active while the choices are waiting for an answer.

**#12 Back confirmation (H3)**
- "Zurück" during a round opens a dialog only if at least one task of the round was answered: robot picture, text "Weiter üben?", a big ▶ "Weiter" button (default focus) and a small 🏠 "Beenden" button. Escape = "Weiter".
- No answered task yet → back immediately, as now.

**#13 Demo run (H1)**
- On the first start of each exercise per profile (`profile.intro[exerciseId]`, stored once seen) a demo task runs before the round: the robot says "Schau genau hin – gleich ist es weg!", the stimulus flashes slowly (3 s), then the choices appear; the demo answer gives no star and does not count for the round or the adaptive engine.
- Applies to all four exercises. Old profiles count as "not seen" (one demo after the update is acceptable).

**#14 Album worlds (H8)**
- The album opens on the "world" of the most recently played exercise (fallback: Mengen).
- At the top 4 chips (Mengen, Zahlen, Buchstaben, Silben) plus "Bonus" (only when at least one bonus page is unlocked) and the secret page as before; below only the pages of the chosen world as tabs.
- Medals, locks and the pack button keep their current behaviour, scoped to the visible world.

**#16 Round end (visual hierarchy)**
- One central element: a large star with the number of stars earned in this round, surrounded by a progress ring showing stars owned vs. the price of the next pack of the current level (full ring = a pack can be bought).
- The second star display is removed; the trade hint (1.8.0) stays below the ring.

**#20 Create profile (H2)**
- Name and avatar choice come first; the parent information moves into its own boxed block below.

## Items implemented as proposed by the review
- **#10** Answer buttons with long words at 320 px: the measure-and-shrink fit from 1.8.1 (#1) also applies to answer buttons at narrow widths.
- **#15** Album page tabs: fade-out at the scroll edge when more tabs are off-screen; badges stay inside the tab.
- **#17** Quantity objects scale with `cqw` to use the stage better; the answer row keeps ≥ 16 px bottom spacing plus `env(safe-area-inset-bottom)`.
- **#18** Candy gloss stripe clipped to the button shape (`overflow: hidden`) on round buttons and avatars.
- **#19** Digits on answer buttons in weight 700; disabled digits keep contrast ≥ 4.5:1.
- **#21** `.board-waiting` "?" and empty header stars ≥ 3:1 contrast.
- **#22** `--tile-ink` darkened so `.tile-quantity` and `.tile-syllables` reach ≥ 4.5:1.
- **#23** Visually hidden `<h1>` on menu, round and album; the tab navigation gets an `aria-label`.
- **#24** Stickers get a German text name (`alt` / `aria-label`), from a name table per sticker id.
- **#25** Pack-opening overlay becomes a dialog: `role="dialog"`, `aria-modal`, Escape closes, focus moves in and back to the pack button.
- **#26** With `prefers-reduced-motion` the gear hold ring stays visible (static fill instead of animation).
- **#28** Menu tile labels 18–20 px at 390 px width.
- **#29** Counter on the album button shows a mini sticker icon.
- **#30** Gate input: `type="text" inputmode="numeric" pattern="[0-9]*"` instead of `type="number"`.
- **#31** Zahlenblitz, wrong answer on an arithmetic task: the solution shows the full equation briefly, e.g. "9 − 5 = 4".
- **#32** Menu icons for Zahlen and Buchstaben distinguishable by colour/shape (tile tint differs clearly).
- **#33** Round-end "Fertig" button shows a house icon instead of the check mark.
- **#34** Album: missing stickers are marked with a symbol/text (e.g. "?" silhouette plus `aria-label` "fehlt"), not only opacity.
- **#35** Looping `bob` / `breathe` animations limited to a few iterations.

## Testing
- Unit: replay neutrality in the adaptive engine; `intro` flag defaults and persistence; sticker name table covers every sticker id; album world selection (last played exercise, fallback).
- E2E: back confirmation (with and without answered tasks, Escape); 🔊/👁 buttons (replay once, then disabled); demo run on first start only; album chips switch worlds; pack dialog Escape + focus return; gate input numeric; contrast checks via computed colours for #19/#21/#22; 320 px answer button fit; round-end ring visible.
- Screenshots at 360×640, 640×360 and 1024×700 of menu, round, round end, album.
