import { Edge, EdgeProps, Node, SelectionMode } from '@xyflow/react';
import * as react from 'react';
import { RefObject } from 'react';
import { StoreApi, UseBoundStore } from 'zustand';
import { TemporalState } from 'zundo';

/** Node by id. */
declare const nodeIndex: <N extends {
    id: string;
}>(nodes: N[]) => Map<string, N>;
/** Wires ending at node `id`, in the order they were made (the order the app made them). */
declare const incoming: (edges: Edge[], id: string) => Edge[];
/** Wires starting at node `id`. */
declare const outgoing: (edges: Edge[], id: string) => Edge[];

type WheelLike = {
    deltaX: number;
    deltaY: number;
    deltaMode: number;
};
/**
 * One canvas for mice and touchpads. A mouse notch is a single large jump (about 100px, or lines in Firefox),
 * a touchpad sends many small, often fractional or horizontal events. This is a heuristic: once a gesture looks like
 * a touchpad it stays one for 300ms, so a big mid-flick or inertia event does not suddenly zoom.
 * Ctrl+wheel and pinch never come through here; they always zoom.
 */
declare function createWheelClassifier(now?: () => number): (e: WheelLike) => "zoom" | "pan";
/** Wheel delta in pixels, whatever unit the browser reports. */
declare const wheelPixels: (e: WheelLike) => number;
/** Zoom factor for one wheel event, the same curve d3-zoom (React Flow's default) uses. */
declare const zoomFactor: (e: WheelLike) => number;

/** The default curve, with a halo under it while selected. The line keeps its own colour and width. */
declare function HaloEdge({ id, selected, style, markerEnd, markerStart, interactionWidth, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }: EdgeProps): react.JSX.Element;

/** Handle ids are `<kind>-in`, `<kind>-out` or `<kind>:<field>`; kind names contain no `-` or `:`. */
declare const pinKind: (h?: string | null) => string | null;
/** The text after the first `:`, or null when the handle has none. */
declare const pinField: (h?: string | null) => string | null;
/** Names of the fields of node `id` that have a wire into a `<kind>:<field>` handle. */
declare const wiredFields: (edges: Edge[], id: string) => Set<string>;
/** Nodes reached from `start` (not including it) along wires leaving a `<kind>-out` handle, going up (against the wires) or down. */
declare function walk(edges: Edge[], start: string, kind: string, dir: "up" | "down"): Set<string>;

type Link = {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
};
/** `node()` also sees the virtual node passed to the composed rule, which is not in `nodes`. */
type RuleCtx<N extends Node> = {
    nodes: N[];
    edges: Edge[];
    node(id: string): N | undefined;
};
type Rule<N extends Node> = (l: Link, ctx: RuleCtx<N>) => string | null;
/** Runs the rules in order and returns the first reason. `extra` is a node that does not exist yet (a spawn candidate). */
declare const composeRules: <N extends Node>(...rules: Rule<N>[]) => (nodes: N[], edges: Edge[], link: Link, extra?: N) => string | null;
declare const pinsMatch: (compatible?: (from: string, to: string) => boolean, msg?: string) => Rule<Node>;
declare const noSelfLink: (msg?: string) => Rule<Node>;
/** A pin of `kind` takes one wire: refuses when the pin on that side (or either, for "both") already has one. */
declare const pinUsedOnce: (kind: string, side: "source" | "target" | "both", msg: string) => Rule<Node>;
/** Refuses a wire of `kind` that would close a loop. */
declare const noLoop: (kind: string, msg?: string) => Rule<Node>;
/** A chain may hold one node per `unique(n).key`; `title` names it in the message. */
declare const onePerChain: <N extends Node>(kind: string, unique: (n: N) => {
    key: string;
    title: string;
} | undefined) => Rule<N>;

type TemporalHost<S, P> = StoreApi<S> & {
    temporal: StoreApi<TemporalState<P>>;
};
/** Undo plumbing for a zundo store: 30ms entry merging, per-word typing coalescing, one entry per drag. State is per instance. */
declare function createHistory<S, P extends {
    nodes: Node[];
}>(o: {
    partialize: (s: S) => P;
    key: (p: P) => string;
    slices: (s: S) => unknown[];
}): {
    options: {
        partialize: (s: S) => P;
        equality: (a: P, b: P) => boolean;
        handleSet: (handleSet: unknown) => (pastState: unknown, replace: unknown, ...rest: unknown[]) => void;
    };
    /** Run an update that continues the current word, so history does not record it separately. */
    edit(field: string, value: unknown, get: () => S, update: () => void): void;
    /** Pause history while a drag runs. */
    beginDrag(store: TemporalHost<S, P>): void;
    /** Resume; if the document changed, push one past entry holding the pre-drag positions. */
    endDrag(store: TemporalHost<S, P>): void;
    reset(store: TemporalHost<S, P>): void;
};

/** A problem pinned to a node (and optionally one of its fields). `X` carries the app's own references, e.g. a design-tool node id. */
type Issue<X = unknown> = {
    level: "error" | "warning";
    message: string;
    detail?: string;
    nodeId?: string;
    field?: string;
} & X;
/**
 * Issues per node as two maps of strings, so a node's selector returns a primitive and re-renders only when its own text changes.
 * `byNode`: `error|warning`, then `|`, then the messages joined by newlines. `fieldsByNode`: comma-joined names of fields with an
 * error (a warning, such as a missing required value, does not turn a field red).
 */
declare function groupIssues(issues: Issue[]): {
    byNode: Record<string, string>;
    fieldsByNode: Record<string, string>;
};
/** Split a `byNode` entry into its level and messages. */
declare function parseNodeStatus(v: string | undefined): {
    level: "error" | "warning" | null;
    messages: string[];
};
/**
 * Could the graph differ in anything validation reads? Selecting, measuring and a drag in progress replace node and wire objects
 * without changing their id, data, position or ends, and a pass costs milliseconds per hundred nodes.
 */
declare const graphChanged: (a: {
    nodes: Node[];
    edges: Edge[];
}, b: {
    nodes: Node[];
    edges: Edge[];
}) => boolean;
/**
 * The one source of validation (CLAUDE.md "Validation has one source"): `compute` runs once per change, debounced, and every
 * node, minimap and view reads `use`. `start` takes watchers: each subscribes to something and calls `schedule` when validation
 * may be stale; it returns the function that stops them.
 */
declare function createValidation<R extends object>(o: {
    compute: () => R;
    wait?: number;
}): {
    use: UseBoundStore<StoreApi<R>>;
    start(watchers: ((schedule: () => void) => () => void)[]): () => void;
};

type PinDef = {
    id: string;
    side: "in" | "out";
    label?: string;
};
type NodeDef = {
    kind: string;
    category: string;
    title: string;
    keywords: string[];
    pins: PinDef[];
};

declare const SPAWN_NEW = "__new__";
/** The pin a wire was dragged from. `source` is an output pin, `target` an input pin. */
type SpawnFrom = {
    nodeId: string;
    handleId: string;
    handleType: "source" | "target";
};
/** One thing the menu can create: a node type, and (when a wire is attached) the pin on it that the wire ends at. */
type SpawnOption<D extends NodeDef> = {
    def: D;
    pin?: string;
    label: string;
};
/**
 * Node types that can be created for a wire dragged from `from`, or every type when there is no wire.
 * Each candidate is tried with `refuse` as a hand-drawn wire to a new node with id `SPAWN_NEW`.
 */
declare function spawnOptions<D extends NodeDef>(o: {
    defs: D[];
    from: SpawnFrom | null;
    order: string[];
    refuse: (l: Link, def: D) => string | null;
}): SpawnOption<D>[];
/** Does `q` match this option by title, type name, keyword or field? Every word of `q` must match. */
declare const matchesSpawn: (o: SpawnOption<NodeDef>, q: string) => boolean;

/** Searchable node menu at the cursor. Arrow keys move, Enter creates, Escape closes, a pointer-down outside closes. */
declare function SpawnMenu<D extends NodeDef>({ x, y, options, categories, accent, onPick, onClose, title }: {
    x: number;
    y: number;
    title: string;
    options: SpawnOption<D>[];
    categories: {
        id: string;
        label: string;
    }[];
    accent?: (def: D) => string | undefined;
    onPick: (o: SpawnOption<D>) => void;
    onClose: () => void;
}): react.JSX.Element;

/**
 * An in-memory clipboard over a store of `nodes` and `edges`, one per call. Copy takes the selected nodes and the wires between
 * them; paste adds them again with new ids, a little further down and right on each paste, selected, as ONE store update (one undo step).
 */
declare function createClipboard<N extends Node, S extends {
    nodes: N[];
    edges: Edge[];
}>(o: {
    store: StoreApi<S>;
    /** The app's wire factory, so wire ids stay in the app's format. */
    edge: (source: string, sourceHandle: string, target: string, targetHandle: string) => Edge;
    /** Nodes that are never copied. */
    exclude?: (n: N) => boolean;
    /** After cloning: rewrite the copied nodes (the clones) given the state they were copied from. */
    copy?: (picked: N[], state: S) => N[];
    /** Before insertion: rewrite the fresh nodes given the state they are pasted into. */
    paste?: (fresh: N[], state: S) => N[];
}): {
    copy(): number;
    paste(): number;
    duplicate(): number;
    has(): boolean;
};

declare const MIN_ZOOM = 0.1;
declare const MAX_ZOOM = 2;
/** ReactFlow props for the navigation model; spread them on <ReactFlow>. */
declare const NAVIGATION_PROPS: {
    onlyRenderVisibleElements: boolean;
    minZoom: number;
    maxZoom: number;
    nodeDragThreshold: number;
    zoomOnDoubleClick: boolean;
    connectionRadius: number;
    zoomOnScroll: boolean;
    panOnScroll: boolean;
    zoomOnPinch: boolean;
    selectionOnDrag: boolean;
    panOnDrag: number[];
    selectionMode: SelectionMode;
};
/**
 * Mouse and touchpad share one canvas: a touchpad scroll pans, a mouse notch zooms at the cursor.
 * Ctrl+wheel and pinch fall through to React Flow, which always zooms. Fields and the minimap keep their own wheel.
 * Call inside the ReactFlow provider.
 */
declare function useWheelNavigation(ref: RefObject<HTMLElement | null>): void;
/** True while the key event comes from a text field or button, where shortcuts must not fire. */
declare const isTyping: (e: KeyboardEvent) => boolean;
/**
 * Space opens a menu at the pointer (or the middle of `ref` when it has not been over it).
 * It opens on release, and only if not cancelled meanwhile, because Space + drag pans: call `cancel()` from onMoveStart.
 */
declare function useSpaceMenu(ref: RefObject<HTMLElement | null>, open: (p: {
    x: number;
    y: number;
}) => void): {
    cancel: () => undefined;
};

declare const FIND_LABEL = "Find nodes";
/** Nodes whose field values (or title) contain `q`, each with a "key: value" snippet (empty for a title-only match). Stops at `max`; `hidden` ids are skipped. */
declare function findNodes<N extends Node>(nodes: N[], hidden: Set<string> | undefined, q: string, titleOf: (n: N) => string, max?: number, valuesOf?: (n: N) => Record<string, unknown> | undefined): {
    node: N;
    snippet: string;
}[];
/** Ctrl+F on the graph: find existing nodes by title or field value; Enter or a click picks the node (`onPick`) and zooms to it. */
declare function FindBar<N extends Node>({ nodes, hidden, titleOf, valuesOf, accent, onPick, onClose }: {
    nodes: N[];
    hidden?: Set<string>;
    titleOf: (n: N) => string;
    valuesOf?: (n: N) => Record<string, unknown> | undefined;
    accent?: (n: N) => string | undefined;
    onPick: (id: string) => void;
    onClose: () => void;
}): react.JSX.Element;

export { FIND_LABEL, FindBar, HaloEdge, type Issue, type Link, MAX_ZOOM, MIN_ZOOM, NAVIGATION_PROPS, type NodeDef, type PinDef, type Rule, type RuleCtx, SPAWN_NEW, type SpawnFrom, SpawnMenu, type SpawnOption, type TemporalHost, type WheelLike, composeRules, createClipboard, createHistory, createValidation, createWheelClassifier, findNodes, graphChanged, groupIssues, incoming, isTyping, matchesSpawn, noLoop, noSelfLink, nodeIndex, onePerChain, outgoing, parseNodeStatus, pinField, pinKind, pinUsedOnce, pinsMatch, spawnOptions, useSpaceMenu, useWheelNavigation, walk, wheelPixels, wiredFields, zoomFactor };
