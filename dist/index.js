// src/graphIndex.ts
var cache = /* @__PURE__ */ new WeakMap();
function memo(list, build) {
  const hit = cache.get(list);
  if (hit && hit.len === list.length) return hit.value;
  const value = build();
  cache.set(list, { len: list.length, value });
  return value;
}
var nodeIndex = (nodes) => memo(nodes, () => new Map(nodes.map((n) => [n.id, n])));
var wires = (edges) => memo(edges, () => {
  const into = /* @__PURE__ */ new Map();
  const outOf = /* @__PURE__ */ new Map();
  for (const e of edges) {
    (into.get(e.target) ?? into.set(e.target, []).get(e.target)).push(e);
    (outOf.get(e.source) ?? outOf.set(e.source, []).get(e.source)).push(e);
  }
  return { into, outOf };
});
var NONE = [];
var incoming = (edges, id) => wires(edges).into.get(id) ?? NONE;
var outgoing = (edges, id) => wires(edges).outOf.get(id) ?? NONE;

// src/wheel.ts
function createWheelClassifier(now = () => performance.now()) {
  let lastPad = -Infinity;
  return (e) => {
    if (e.deltaMode !== 0) return "zoom";
    const t = now();
    const looksPad = e.deltaX !== 0 || Math.abs(e.deltaY) < 100 || !Number.isInteger(e.deltaY);
    const pad = looksPad || t - lastPad < 300;
    if (pad) lastPad = t;
    return pad ? "pan" : "zoom";
  };
}
var wheelPixels = (e) => e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
var zoomFactor = (e) => 2 ** (-wheelPixels(e) * 2e-3);

// src/HaloEdge.tsx
import { BaseEdge, getBezierPath } from "@xyflow/react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var HALO = { stroke: "var(--kw-select-soft)", strokeWidth: 10 };
function HaloEdge({ id, selected, style, markerEnd, markerStart, interactionWidth, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    selected && /* @__PURE__ */ jsx("path", { d: path, fill: "none", strokeLinecap: "round", pointerEvents: "none", style: HALO }),
    /* @__PURE__ */ jsx(BaseEdge, { id, path, style, markerEnd, markerStart, interactionWidth })
  ] });
}

// src/pins.ts
var pinKind = (h) => h ? h.split(/[-:]/, 1)[0] || null : null;
var pinField = (h) => {
  const i = h ? h.indexOf(":") : -1;
  return h && i >= 0 ? h.slice(i + 1) : null;
};
var wiredFields = (edges, id) => new Set(incoming(edges, id).flatMap((e) => pinField(e.targetHandle) ?? []));
function walk(edges, start, kind, dir) {
  const out = `${kind}-out`;
  const next = (id) => dir === "up" ? incoming(edges, id).filter((e) => e.sourceHandle === out).map((e) => e.source) : outgoing(edges, id).filter((e) => e.sourceHandle === out).map((e) => e.target);
  const seen = /* @__PURE__ */ new Set();
  const stack = [start];
  while (stack.length) for (const n of next(stack.pop())) if (!seen.has(n)) seen.add(n), stack.push(n);
  return seen;
}

// src/rules.ts
var composeRules = (...rules) => (nodes, edges, link, extra) => {
  const ctx = { nodes, edges, node: (id) => extra && id === extra.id ? extra : nodeIndex(nodes).get(id) };
  for (const r of rules) {
    const why = r(link, ctx);
    if (why) return why;
  }
  return null;
};
var pinsMatch = (compatible = (a, b) => a === b, msg = "Pin types differ") => (l) => {
  const a = pinKind(l.sourceHandle);
  const b = pinKind(l.targetHandle);
  return a && b && compatible(a, b) ? null : msg;
};
var noSelfLink = (msg = "Cannot connect a node to itself") => (l) => l.source === l.target ? msg : null;
var pinUsedOnce = (kind, side, msg) => (l, { edges }) => {
  const src = side !== "target" && pinKind(l.sourceHandle) === kind && outgoing(edges, l.source).some((e) => e.sourceHandle === l.sourceHandle);
  const dst = side !== "source" && pinKind(l.targetHandle) === kind && incoming(edges, l.target).some((e) => e.targetHandle === l.targetHandle);
  return src || dst ? msg : null;
};
var noLoop = (kind, msg = "Would create a loop") => (l, { edges }) => pinKind(l.sourceHandle) === kind && walk(edges, l.source, kind, "up").add(l.source).has(l.target) ? msg : null;
var onePerChain = (kind, unique) => (l, { edges, node }) => {
  if (pinKind(l.sourceHandle) !== kind) return null;
  const ids = [...walk(edges, l.source, kind, "up").add(l.source), ...walk(edges, l.target, kind, "down").add(l.target)];
  const count = /* @__PURE__ */ new Map();
  for (const id of ids) {
    const n = node(id);
    const u = n && unique(n);
    if (u) count.set(u.key, { n: (count.get(u.key)?.n ?? 0) + 1, title: u.title });
  }
  for (const { n, title } of count.values()) if (n > 1) return `A chain can have only one ${title}`;
  return null;
};

// src/history.ts
function createHistory(o) {
  let lastRecorded = -Infinity;
  let typing = null;
  let coalesce = false;
  let dragStart = null;
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const typed = (v) => typeof v === "string" || typeof v === "number" || Array.isArray(v);
  const joinsTyping = (field, s) => !!typing && typing.field === field && performance.now() - typing.at < 1500 && !typing.space && same(typing.slices, o.slices(s));
  const markTyping = (field, value, s) => {
    typing = typed(value) ? { field, at: performance.now(), space: typeof value === "string" && /\s$/.test(value), slices: o.slices(s) } : null;
  };
  return {
    options: {
      partialize: o.partialize,
      equality: (a, b) => o.key(a) === o.key(b),
      // Updates within 30ms of the last recorded one share its entry, so one Delete (several store updates) is one undo step.
      handleSet: (handleSet) => {
        return (pastState, replace, ...rest) => {
          if (coalesce) return;
          const t = performance.now();
          if (t - lastRecorded < 30) return;
          lastRecorded = t;
          handleSet(pastState, replace, ...rest);
        };
      }
    },
    /** Run an update that continues the current word, so history does not record it separately. */
    edit(field, value, get, update) {
      coalesce = typed(value) && joinsTyping(field, get());
      update();
      coalesce = false;
      markTyping(field, value, get());
    },
    /** Pause history while a drag runs. */
    beginDrag(store) {
      dragStart = o.partialize(store.getState());
      store.temporal.getState().pause();
    },
    /** Resume; if the document changed, push one past entry holding the pre-drag positions. */
    endDrag(store) {
      const t = store.temporal.getState();
      t.resume();
      const now = o.partialize(store.getState());
      if (dragStart && o.key(dragStart) !== o.key(now)) {
        const start = new Map(dragStart.nodes.map((n) => [n.id, n.position]));
        const snapshot = { ...now, nodes: now.nodes.map((n) => ({ ...n, position: start.get(n.id) ?? n.position })) };
        store.temporal.setState({ pastStates: [...t.pastStates, snapshot], futureStates: [] });
      }
      dragStart = null;
    },
    reset(store) {
      store.temporal.getState().clear();
      lastRecorded = -Infinity;
    }
  };
}

// src/validation.ts
import { create } from "zustand";
function groupIssues(issues) {
  const grouped = /* @__PURE__ */ new Map();
  for (const i of issues) if (i.nodeId) grouped.set(i.nodeId, [...grouped.get(i.nodeId) ?? [], i]);
  const byNode = {};
  const fieldsByNode = {};
  for (const [id, list] of grouped) {
    byNode[id] = `${list.some((i) => i.level === "error") ? "error" : "warning"}|${list.map((i) => i.detail ?? i.message).join("\n")}`;
    const bad = [...new Set(list.flatMap((i) => i.level === "error" && i.field ? [i.field] : []))].sort();
    if (bad.length) fieldsByNode[id] = bad.join(",");
  }
  return { byNode, fieldsByNode };
}
function parseNodeStatus(v) {
  if (!v) return { level: null, messages: [] };
  const sep = v.indexOf("|");
  return { level: v.slice(0, sep) === "error" ? "error" : "warning", messages: v.slice(sep + 1).split("\n") };
}
var sameWire = (a, b) => a === b || a.id === b.id && a.source === b.source && a.target === b.target && a.sourceHandle === b.sourceHandle && a.targetHandle === b.targetHandle;
var sameNode = (a, b) => a === b || a.id === b.id && a.data === b.data && a.position.x === b.position.x && a.position.y === b.position.y;
var sameList = (a, b, same) => a === b || a.length === b.length && a.every((x, i) => same(x, b[i]));
var graphChanged = (a, b) => !sameList(a.nodes, b.nodes, sameNode) || !sameList(a.edges, b.edges, sameWire);
function createValidation(o) {
  const use = create(() => o.compute());
  return {
    use,
    start(watchers) {
      let t;
      const run = () => use.setState(o.compute(), true);
      const later = () => (clearTimeout(t), t = setTimeout(run, o.wait ?? 150));
      const offs = watchers.map((w) => w(later));
      run();
      return () => (offs.forEach((f) => f()), clearTimeout(t));
    }
  };
}

// src/spawn.ts
var SPAWN_NEW = "__new__";
function spawnOptions(o) {
  const { defs, from, order, refuse } = o;
  const sort = (list) => {
    const rank = (x) => order.indexOf(x.def.category);
    return [...list].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
  };
  if (!from) return sort(defs.map((def) => ({ def, label: def.title })));
  const kind = pinKind(from.handleId);
  const side = from.handleType === "source" ? "in" : "out";
  const out = [];
  for (const def of defs)
    for (const p of def.pins) {
      if (p.side !== side || pinKind(p.id) !== kind) continue;
      const link = from.handleType === "source" ? { source: from.nodeId, sourceHandle: from.handleId, target: SPAWN_NEW, targetHandle: p.id } : { source: SPAWN_NEW, sourceHandle: p.id, target: from.nodeId, targetHandle: from.handleId };
      if (refuse(link, def) !== null) continue;
      const f = pinField(p.id);
      out.push({ def, pin: p.id, label: f ? `${def.title} \xB7 ${f[0].toUpperCase()}${f.slice(1)}` : def.title });
    }
  return sort(out);
}
var matchesSpawn = (o, q) => {
  const hay = [o.label, o.def.kind, ...o.def.keywords].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
};

// src/SpawnMenu.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var WIDTH = 300;
var HEIGHT = 380;
function SpawnMenu({ x, y, options, categories, accent, onPick, onClose, title }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const list = useRef(null);
  const shown = useMemo(() => options.filter((o) => matchesSpawn(o, q)), [options, q]);
  const left = Math.max(8, Math.min(x, window.innerWidth - WIDTH - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - HEIGHT - 8));
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector("[data-active=true]")?.scrollIntoView({ block: "nearest" });
  }, [active, shown]);
  useEffect(() => {
    const away = (e) => !e.target.closest("[data-spawn-menu]") && onClose();
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [onClose]);
  const key = (e) => {
    if (e.key === "Escape") return onClose();
    if (e.key === "ArrowDown") return e.preventDefault(), setActive((a) => Math.min(a + 1, shown.length - 1));
    if (e.key === "ArrowUp") return e.preventDefault(), setActive((a) => Math.max(a - 1, 0));
    if (e.key === "Enter" && shown[active]) return e.preventDefault(), onPick(shown[active]);
  };
  let lastCategory = "";
  return /* @__PURE__ */ jsxs2("div", { "data-spawn-menu": true, role: "dialog", "aria-label": title, className: "nowheel nodrag kw-spawn", style: { left, top, width: WIDTH, maxHeight: HEIGHT }, onKeyDown: key, children: [
    /* @__PURE__ */ jsxs2("div", { className: "kw-spawn-head", children: [
      /* @__PURE__ */ jsx2("div", { className: "kw-spawn-title", children: title }),
      /* @__PURE__ */ jsx2("input", { autoFocus: true, value: q, onChange: (e) => setQ(e.target.value), placeholder: "Search nodes", className: "kw-spawn-search" })
    ] }),
    /* @__PURE__ */ jsxs2("ul", { ref: list, className: "kw-spawn-list", role: "listbox", children: [
      shown.map((o, i) => {
        const cat = o.def.category;
        const header = cat !== lastCategory ? (lastCategory = cat, categories.find((c) => c.id === cat)?.label) : null;
        return /* @__PURE__ */ jsxs2("li", { role: "presentation", children: [
          header && /* @__PURE__ */ jsx2("div", { className: "kw-spawn-cat", children: header }),
          /* @__PURE__ */ jsxs2("button", { role: "option", "aria-selected": i === active, "data-active": i === active, className: "kw-spawn-item", onMouseMove: () => setActive(i), onClick: () => onPick(o), children: [
            /* @__PURE__ */ jsx2("span", { className: "kw-spawn-swatch", style: { background: accent?.(o.def) } }),
            /* @__PURE__ */ jsx2("span", { className: "kw-spawn-label", children: o.label })
          ] })
        ] }, `${o.def.kind}:${o.pin ?? ""}`);
      }),
      shown.length === 0 && /* @__PURE__ */ jsx2("li", { className: "kw-spawn-empty", children: options.length ? "No matching nodes" : "Nothing can connect to this pin" })
    ] })
  ] });
}

// src/clipboard.ts
function createClipboard(o) {
  let clip = null;
  const copy = () => {
    const s = o.store.getState();
    const picked = s.nodes.filter((n) => n.selected && !o.exclude?.(n));
    if (!picked.length) return 0;
    const ids = new Set(picked.map((n) => n.id));
    const clones = picked.map((n) => ({ ...n, selected: false, data: structuredClone(n.data) }));
    clip = {
      nodes: o.copy ? o.copy(clones, s) : clones,
      edges: s.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
      pastes: 0
    };
    return picked.length;
  };
  const paste = () => {
    if (!clip) return 0;
    const s = o.store.getState();
    const offset = 40 * ++clip.pastes;
    const ids = new Map(clip.nodes.map((n) => [n.id, crypto.randomUUID()]));
    let fresh = clip.nodes.map((n) => ({ id: ids.get(n.id), type: n.type, position: { x: n.position.x + offset, y: n.position.y + offset }, data: structuredClone(n.data), selected: true }));
    if (o.paste) fresh = o.paste(fresh, s);
    const wires2 = clip.edges.map((e) => o.edge(ids.get(e.source), e.sourceHandle, ids.get(e.target), e.targetHandle));
    o.store.setState({ nodes: [...s.nodes.map((n) => n.selected ? { ...n, selected: false } : n), ...fresh], edges: [...s.edges, ...wires2] });
    return fresh.length;
  };
  return { copy, paste, duplicate: () => copy() ? paste() : 0, has: () => clip !== null };
}

// src/canvas.ts
import { SelectionMode, useReactFlow } from "@xyflow/react";
import { useEffect as useEffect2, useRef as useRef2 } from "react";
var MIN_ZOOM = 0.1;
var MAX_ZOOM = 2;
var NAVIGATION_PROPS = {
  // Only nodes and wires in view are mounted, so a big group costs what is on screen. A node is always mounted until it has been
  // measured once (so a freshly opened file mounts everything one time), and undo keeps the measured sizes.
  onlyRenderVisibleElements: true,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  // A touchpad tap jitters; without a threshold it nudges nodes. A double-tap must not zoom.
  nodeDragThreshold: 4,
  zoomOnDoubleClick: false,
  connectionRadius: 32,
  // Same for every device: left-drag on empty space selects; right-drag, middle-drag or Space+drag pans; pinch and
  // ctrl+wheel zoom. Plain wheel is handled by useWheelNavigation, so React Flow's own scroll handling is off.
  zoomOnScroll: false,
  panOnScroll: false,
  zoomOnPinch: true,
  selectionOnDrag: true,
  panOnDrag: [1, 2],
  selectionMode: SelectionMode.Partial
};
function useWheelNavigation(ref) {
  const { getViewport, setViewport } = useReactFlow();
  useEffect2(() => {
    const el = ref.current;
    if (!el) return;
    const classify = createWheelClassifier();
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) return;
      if (e.target.closest(".nowheel, .react-flow__minimap, .react-flow__controls")) return;
      e.preventDefault();
      e.stopPropagation();
      const { x, y, zoom } = getViewport();
      if (classify(e) === "pan") return void setViewport({ x: x - e.deltaX, y: y - e.deltaY, zoom });
      if (e.shiftKey) return void setViewport({ x: x - wheelPixels(e), y, zoom });
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * zoomFactor(e)));
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      setViewport({ x: cx - (cx - x) * next / zoom, y: cy - (cy - y) * next / zoom, zoom: next });
    };
    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => el.removeEventListener("wheel", onWheel, { capture: true });
  }, [ref, getViewport, setViewport]);
}
var isTyping = (e) => !!e.target.closest("input, textarea, select, button, [contenteditable]");
function useSpaceMenu(ref, open) {
  const pointer = useRef2(null);
  const armed = useRef2(false);
  const openRef = useRef2(open);
  openRef.current = open;
  useEffect2(() => {
    const move = (e) => pointer.current = { x: e.clientX, y: e.clientY };
    const down = (e) => {
      if (e.code !== "Space" || e.repeat || isTyping(e)) return;
      armed.current = !e.ctrlKey && !e.metaKey && !e.altKey;
    };
    const up = (e) => {
      if (e.code !== "Space" || !armed.current) return;
      armed.current = false;
      const el2 = ref.current;
      if (!el2) return;
      const r = el2.getBoundingClientRect();
      openRef.current({ x: pointer.current?.x ?? r.left + r.width / 2, y: pointer.current?.y ?? r.top + r.height / 2 });
    };
    const el = ref.current;
    el?.addEventListener("pointermove", move);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => (el?.removeEventListener("pointermove", move), window.removeEventListener("keydown", down), window.removeEventListener("keyup", up));
  }, [ref]);
  return { cancel: () => void (armed.current = false) };
}

// src/FindBar.tsx
import { useReactFlow as useReactFlow2 } from "@xyflow/react";
import { useEffect as useEffect3, useMemo as useMemo2, useState as useState2 } from "react";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var MAX = 50;
var FIND_LABEL = "Find nodes";
var text = (v) => typeof v === "string" ? v : JSON.stringify(v);
function findNodes(nodes, hidden, q, titleOf, max = MAX, valuesOf) {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const out = [];
  for (const node of nodes) {
    if (hidden?.has(node.id)) continue;
    let snippet = null;
    for (const [k, v] of Object.entries(valuesOf?.(node) ?? {})) {
      const s = v == null ? "" : text(v);
      if (s.toLowerCase().includes(needle)) {
        snippet = `${k}: ${s}`;
        break;
      }
    }
    if (snippet === null && titleOf(node).toLowerCase().includes(needle)) snippet = "";
    if (snippet !== null && out.push({ node, snippet }) >= max) break;
  }
  return out;
}
function FindBar({ nodes, hidden, titleOf, valuesOf, accent, onPick, onClose }) {
  const [q, setQ] = useState2("");
  const [active, setActive] = useState2(0);
  const [shift, setShift] = useState2({ x: 0, y: 0 });
  const { fitView } = useReactFlow2();
  const found = useMemo2(() => findNodes(nodes, hidden, q, titleOf, MAX), [q, nodes, hidden, titleOf]);
  useEffect3(() => setActive(0), [q]);
  const go = (id) => {
    onPick(id);
    void fitView({ nodes: [{ id }], duration: 300, maxZoom: 1.2, padding: 0.3 });
  };
  const key = (e) => {
    if (e.key === "Escape") return onClose();
    if (e.key === "ArrowDown") return e.preventDefault(), setActive((a) => Math.min(a + 1, found.length - 1));
    if (e.key === "ArrowUp") return e.preventDefault(), setActive((a) => Math.max(a - 1, 0));
    if (e.key === "Enter" && found[active]) return e.preventDefault(), go(found[active].node.id);
  };
  return /* @__PURE__ */ jsxs3("div", { role: "search", className: "nowheel nodrag kw-find", style: { transform: `translate(calc(-50% + ${shift.x}px), ${shift.y}px)` }, onKeyDown: key, children: [
    /* @__PURE__ */ jsx3(
      "div",
      {
        title: "Drag to move",
        className: "kw-find-drag",
        onMouseDown: (e) => e.preventDefault(),
        onPointerDown: (e) => e.currentTarget.setPointerCapture(e.pointerId),
        onPointerMove: (e) => e.buttons && setShift((s) => ({ x: s.x + e.movementX, y: s.y + e.movementY }))
      }
    ),
    /* @__PURE__ */ jsx3("input", { autoFocus: true, value: q, onChange: (e) => setQ(e.target.value), onFocus: (e) => e.currentTarget.select(), placeholder: "Find nodes by title or value", "aria-label": FIND_LABEL, className: "kw-find-input" }),
    q.trim() && /* @__PURE__ */ jsxs3("ul", { className: "kw-find-list", role: "listbox", children: [
      found.map(({ node, snippet }, i) => /* @__PURE__ */ jsx3("li", { role: "presentation", children: /* @__PURE__ */ jsxs3("button", { role: "option", "aria-selected": i === active, "data-active": i === active, className: "kw-find-item", onMouseMove: () => setActive(i), onClick: () => go(node.id), children: [
        /* @__PURE__ */ jsx3("span", { className: "kw-find-swatch", style: { background: accent?.(node) } }),
        /* @__PURE__ */ jsx3("span", { className: "kw-find-title", children: titleOf(node) }),
        snippet && /* @__PURE__ */ jsx3("span", { className: "kw-find-snippet", children: snippet })
      ] }) }, node.id)),
      found.length === 0 && /* @__PURE__ */ jsx3("li", { className: "kw-find-empty", children: "No matching nodes" }),
      found.length === MAX && /* @__PURE__ */ jsxs3("li", { className: "kw-find-more", children: [
        "First ",
        MAX,
        " shown; type more to narrow"
      ] })
    ] })
  ] });
}
export {
  FIND_LABEL,
  FindBar,
  HaloEdge,
  MAX_ZOOM,
  MIN_ZOOM,
  NAVIGATION_PROPS,
  SPAWN_NEW,
  SpawnMenu,
  composeRules,
  createClipboard,
  createHistory,
  createValidation,
  createWheelClassifier,
  findNodes,
  graphChanged,
  groupIssues,
  incoming,
  isTyping,
  matchesSpawn,
  noLoop,
  noSelfLink,
  nodeIndex,
  onePerChain,
  outgoing,
  parseNodeStatus,
  pinField,
  pinKind,
  pinUsedOnce,
  pinsMatch,
  spawnOptions,
  useSpaceMenu,
  useWheelNavigation,
  walk,
  wheelPixels,
  wiredFields,
  zoomFactor
};
//# sourceMappingURL=index.js.map