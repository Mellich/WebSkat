# Plan 02: Remove the unused `reducedMotion` setting

User request: *"The reducedMotion setting is saved but has no control in Settings and nothing
reads it. Clean it up."*

Read first: `docs/ui.md` §6, `src/ui/AGENTS.md`.

## 1. Current state

- `src/ui/persist/settings.ts`: `SettingsSchema` has
  `reducedMotion: z.enum(['system', 'on', 'off'])`; `defaultSettings` sets `'system'`.
- Nothing else reads it (`grep -rn reducedMotion src` shows only `settings.ts`).
- Motion is already reduced for users who ask their system for it: `src/ui/styles/global.css` has a
  `@media (prefers-reduced-motion: reduce)` rule that shortens every transition and animation.
- `docs/ui.md` §6 lists the field as "no; currently unused"; `docs/overview.md` §2 lists it as an
  open item.

## 2. Decision (log it in `docs/decisions.md`)

*reducedMotion setting*: removed instead of adding a control. The app follows the operating
system's "reduce motion" preference through the `prefers-reduced-motion` CSS rule in
`global.css`, which covers all current and planned animations (trick hold, speech bubbles). Old
stored settings that still contain the field load fine because `z.object` drops unknown keys.

## 3. Steps

### Step 1: test first

- `src/ui/persist/persist.test.ts`: add
  `it('ignores the removed reducedMotion field of old settings')`: store
  `{ ...defaultSettings('en'), name: 'Anna', reducedMotion: 'on' }` as JSON under
  `webskat.settings`, load it, and expect the result to equal
  `{ ...defaultSettings('en'), name: 'Anna' }` (no `reducedMotion` key,
  `expect('reducedMotion' in loaded).toBe(false)`).
- Run `npx vitest run src/ui/persist/persist.test.ts`: the test fails today (the key is kept).

### Step 2: remove the field

- `src/ui/persist/settings.ts`: delete `reducedMotion` from `SettingsSchema` and from
  `defaultSettings`. zod 4 `z.object` strips unknown keys on parse, so stored values with the old
  key still parse and the key disappears on the next save.
- `grep -rn reducedMotion src e2e` must return nothing.
- Run the test again; it passes.

### Step 3: docs

- `docs/ui.md` §6: delete the `reducedMotion` row; under the table add one sentence: "Motion follows
  the system setting (`prefers-reduced-motion` rule in `styles/global.css`); there is no app
  setting for it."
- `docs/overview.md` §2: delete the "`reducedMotion` setting" row.
- `docs/decisions.md`: the row from §2.

## 4. Validation

- `npm run check` green. No e2e run needed (no visible change).

## 5. Pitfalls

- Do not touch `global.css`: the `prefers-reduced-motion` rule stays and is the replacement.
- Do not add a migration that rewrites storage; parsing already drops the key.
