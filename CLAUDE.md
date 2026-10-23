# Knotwork Graph Kit

Generic node-graph foundations for React Flow editors, shared by the Achievement Injector editor and a future Electron editor (Inkwell). Source in `src/`, one entry point `src/index.ts`. Commands: `npm run typecheck`, `npm test`, `npm run build`. All three must pass before a change is done.

## Rules that are easy to break

- **No app assumptions.** No node kind names, no handle-id lists, no Tailwind, no colours except `--kw-*` CSS variables with defaults in `src/knotwork.css`. If something needs awkward options to serve both apps, it belongs in the app. Do not generalize ahead of need; widen an API only for a proven need and keep the public API small.
- **Pin grammar is the contract:** handle ids are `<kind>-in`, `<kind>-out`, `<kind>:<field>`; kind names contain no `-` or `:`. Edge and handle id strings are persisted by apps (drafts, saved files): never change their format; apps inject their own edge builder (`createClipboard({ edge })`).
- **Never scan `nodes` or `edges` once per node.** Use `nodeIndex`, `incoming`, `outgoing` (built once per array, keyed on its identity; arrays are replaced, never edited). Inside rules use `ctx.node(id)`, never `nodes.find`: it is also the only way a rule sees the virtual node a spawn candidate passes as `extra`. Keep helpers free of per-call `new Map(nodes...)`. `src/perf.test.ts` holds the budgets (5,000 nodes); do not loosen them.
- **Rules are pure and return a message or null.** Messages are only checked by tests, never shown; order changes the message, not the yes/no. Rules apply only to their own pin kind and return null otherwise.
- **Only visible nodes mount** (`onlyRenderVisibleElements` is in `NAVIGATION_PROPS`). Nothing a node needs may live in a component's `useState` past an unmount; never look a node up in the DOM.
- **History** (`createHistory`): all state is per instance (closure), never module-level. `partialize` must keep `measured` and `selected` while `key` ignores them, or every node remounts on undo. zundo checks `equality` before `handleSet`, so only real changes move the 30 ms merge window. `edit` sets `coalesce` synchronously before `update()` and `handleSet` reads it: no batching, async or shared flags in between. Typing continues a word only if the `slices` identities are unchanged and the previous value did not end in whitespace.
- **Validation has one source.** `createValidation` runs `compute` once, debounced, and everything reads its store. `byNode` is `error|warning`, then `|`, then messages joined by a newline; selectors return strings so nodes re-render only when their own text changes. Do not change the encoding without a major version.
- **Canvas navigation:** the wheel listener runs in the capture phase and must ignore `.nowheel`, `.react-flow__minimap`, `.react-flow__controls`; `useSpaceMenu.cancel()` must be called on `onMoveStart` so Space + drag pans without opening a menu. The classifier is a heuristic: a free-spinning mouse wheel reads as a touchpad.
- **Peer dependencies only** for `react`, `react-dom`, `@xyflow/react`, `zustand`, `zundo`. A second copy of `@xyflow/react` breaks `useReactFlow` (separate context). Match the apps' major versions.
- **No LICENSE file yet** (not decided). Do not add one, and do not publish to npm, until the owner decides licence and scope.

## Releases

`main` holds source only; `dist/` is never committed to `main`. A push to `main` runs `.github/workflows/build-ref.yml`, which commits the same tree plus `dist/` to `build/<main sha>`. An app pins that build commit's SHA. Only after the app's checks pass against it, push a branch `release/vX.Y.Z` pointing at that build commit: `release.yml` verifies it (has `dist/`, is a `build/*` commit, `package.json` version matches) and tags it. A tag therefore always means "known to work" and always contains `dist/`. Bump `package.json` and `CHANGELOG.md` before the commit you intend to release.

## Changing the kit

Make kit changes here, not in an app's copy. Test with the app by pinning the new build commit SHA, then release. Tests live next to the code (`src/*.test.ts`), Vitest, no DOM: keep logic in pure functions so it can be tested (e.g. `findNodes`).
