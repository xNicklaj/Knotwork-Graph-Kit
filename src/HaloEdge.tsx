// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

/** The selection colour of a node (--kw-select-soft is its glow), wide enough to read around the 2px line. */
const HALO = { stroke: "var(--kw-select-soft)", strokeWidth: 10 };

/** The default curve, with a halo under it while selected. The line keeps its own colour and width. */
export function HaloEdge({ id, selected, style, markerEnd, markerStart, interactionWidth, sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (
    <>
      {selected && <path d={path} fill="none" strokeLinecap="round" pointerEvents="none" style={HALO} />}
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} markerStart={markerStart} interactionWidth={interactionWidth} />
    </>
  );
}
