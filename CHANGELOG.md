# Changelog

## 0.2.0 (2026-10-23)

- **Breaking:** the package is renamed from `@xnicklaj/knotwork` to `@nicklaj/knotwork` (npm account `nicklaj`). Change the dependency name and every import. The code is otherwise identical to 0.1.0, which stays as released under its old name.

## 0.1.0 (2026-10-23)

First extraction from the Achievement Injector editor.

- Graph indexes: `nodeIndex`, `incoming`, `outgoing` (memoized on array identity).
- Pin grammar (`<kind>-in`, `<kind>-out`, `<kind>:<field>`), `walk`, `wiredFields`.
- Composable connection rules: `composeRules`, `pinsMatch`, `noSelfLink`, `pinUsedOnce`, `noLoop`, `onePerChain`.
- Undo: `createHistory` (30 ms entry merging, per-word typing, one entry per drag).
- Validation: `Issue<X>`, `groupIssues`, `parseNodeStatus`, `graphChanged`, `createValidation`.
- Spawn: `spawnOptions`, `matchesSpawn`, `SpawnMenu`. Clipboard: `createClipboard`.
- Canvas: `NAVIGATION_PROPS`, `useWheelNavigation`, `useSpaceMenu`, `FindBar`, `HaloEdge`, wheel classifier.
- `knotwork.css` with `--kw-*` variables.
