# Knotwork Graph Kit

Generic node-graph foundations for [React Flow](https://reactflow.dev) (`@xyflow/react`) editors. Extracted from the
[Achievement Injector](https://github.com/xNicklaj/Achievement-Injector) config editor so a second editor can share the same
behaviour: fast graph indexes, connection rules you compose from small functions, undo that behaves like a text editor, a
context-sensitive spawn menu, copy/paste, and one canvas navigation scheme for mouse and touchpad.

The kit knows nothing about your nodes. You supply the pin kinds, the node definitions, the rules and the validation.

**License: not decided yet, so there is no LICENSE file. Do not reuse this code until one is added.**
The package name `@xnicklaj/knotwork` is a placeholder; it is **not** published to npm.

## Install

`main` holds TypeScript source only. Every push to `main` also gets a build commit (the same tree plus `dist/`) on the branch
`build/<main sha>`; releases are tags on such commits. Depend on a tag, or on a build commit's SHA:

```json
"@xnicklaj/knotwork": "github:xNicklaj/Knotwork-Graph-Kit#v0.1.0"
```

Nothing builds on install. Peer dependencies: `react`, `react-dom`, `@xyflow/react` ^12.12, `zustand` ^5, `zundo` ^2.3.

```ts
import "@xnicklaj/knotwork/knotwork.css"; // defaults for the --kw-* variables
```

Styling is CSS variables only, namespaced `--kw-*` (`--kw-bg-panel`, `--kw-bg-app`, `--kw-border`, `--kw-text`, `--kw-text-dim`,
`--kw-select`, `--kw-select-soft`); category colours are yours: pass `accent` to `SpawnMenu` and `FindBar`. Map your own variables onto them, after the import:
`:root { --kw-select: var(--select); }`. There is no Tailwind dependency.

## Pin grammar

Handle ids are `<kind>-in`, `<kind>-out` or `<kind>:<field>` (a typed input for one field). Kind names contain no `-` or `:`.
`flow-out`, `exec-in`, `Number:x` and `loc:title` are all fine. What a kind means is up to your rules.

## API

| Export | What it is |
|---|---|
| `nodeIndex(nodes)`, `incoming(edges, id)`, `outgoing(edges, id)` | Lookups built once per array and cached on its identity. |
| `pinKind(handle)`, `pinField(handle)`, `wiredFields(edges, id)` | Parse the pin grammar; fields fed by a wire. |
| `walk(edges, start, kind, dir)` | Every node upstream (`"up"`) or downstream (`"down"`) along `<kind>-out` wires. |
| `composeRules(...rules)` | Combine rules into `(nodes, edges, link, extra?) => reason or null`. `extra` is a node not in `nodes` yet. |
| `pinsMatch`, `noSelfLink`, `pinUsedOnce`, `noLoop`, `onePerChain` | Built-in rules; pick the ones your app needs, write the rest as a `Rule`. |
| `createHistory({ partialize, key, slices })` | zundo options plus `edit`, `beginDrag`, `endDrag`, `reset`. |
| `Issue<X>`, `groupIssues`, `parseNodeStatus` | Validation issues pinned to nodes, with room for your own references in `X`. |
| `createValidation({ compute, wait })` | One debounced validation source: a store `use` and `start(watchers)`. |
| `graphChanged(a, b)` | Did anything validation reads change? Ignores selection and measuring. |
| `PinDef`, `NodeDef` | The minimal definition shape the spawn menu reads; extend it with your own fields. |
| `spawnOptions({ defs, from, order, refuse })`, `matchesSpawn`, `SPAWN_NEW` | Node types (and pins) that can take a dropped wire. |
| `SpawnMenu` | Searchable menu at the cursor; `accent(def)` colours each row's swatch. |
| `createClipboard({ store, edge, exclude, copy, paste })` | Copy, paste, duplicate; one undo step. |
| `NAVIGATION_PROPS`, `MIN_ZOOM`, `MAX_ZOOM` | The `<ReactFlow>` props for the navigation scheme. |
| `useWheelNavigation(ref)`, `useSpaceMenu(ref, open)`, `isTyping(e)` | Wheel pan/zoom (inside the React Flow provider) and Space-to-open-menu. |
| `createWheelClassifier`, `wheelPixels`, `zoomFactor` | The mouse-or-touchpad heuristic. |
| `FindBar`, `findNodes`, `FIND_LABEL` | Ctrl+F node search by title and, via `valuesOf(node)`, field values. |
| `HaloEdge` | Bezier edge with a selection halo. |

Known limit: `spawnOptions` offers only pins of the same kind as the dragged pin, even if your `pinsMatch` accepts conversions (e.g. Number to String); add a `compatible` option when an app needs it.

## Examples

Connection rules: pick what your editor needs.

```ts
import { composeRules, noLoop, noSelfLink, pinsMatch, pinUsedOnce, onePerChain } from "@xnicklaj/knotwork";

const refuse = composeRules<MyNode>(
  pinsMatch((from, to) => from === to || (from === "Number" && to === "String")),
  noSelfLink(),
  pinUsedOnce("exec", "both", "Exec pin already connected"),
  noLoop("exec"),
  onePerChain<MyNode>("exec", (n) => (defs[n.data.kind].unique ? { key: n.data.kind, title: defs[n.data.kind].title } : undefined)),
);
const isValidConnection = (c) => !refuse(nodes, edges, c);
```

Undo that coalesces typing and keeps one entry per drag:

```ts
const history = createHistory<State, Snap>({
  partialize: (s) => ({ nodes: s.nodes, edges: s.edges }), // keep `measured`, or undo remounts every node
  key: (p) => JSON.stringify({ n: p.nodes.map(({ id, position, data }) => ({ id, position, data })), e: p.edges }),
  slices: (s) => [s.nodes],
});
const useStore = create<State>()(temporal((set, get) => ({ /* ... */ }), history.options));
// text edits: history.edit(`${id}:${field}`, value, get, () => set(...));  drags: history.beginDrag(useStore) / history.endDrag(useStore)
```

Canvas:

```tsx
<ReactFlow {...NAVIGATION_PROPS} /* nodes, edges, handlers */ />
```

## Development

`npm run typecheck`, `npm test`, `npm run build` (tsup; ESM plus `.d.ts`). See [CLAUDE.md](CLAUDE.md) before changing behaviour.
