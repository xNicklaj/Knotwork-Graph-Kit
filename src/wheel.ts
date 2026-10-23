// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

export type WheelLike = { deltaX: number; deltaY: number; deltaMode: number };

/**
 * One canvas for mice and touchpads. A mouse notch is a single large jump (about 100px, or lines in Firefox),
 * a touchpad sends many small, often fractional or horizontal events. This is a heuristic: once a gesture looks like
 * a touchpad it stays one for 300ms, so a big mid-flick or inertia event does not suddenly zoom.
 * Ctrl+wheel and pinch never come through here; they always zoom.
 */
export function createWheelClassifier(now: () => number = () => performance.now()) {
  let lastPad = -Infinity;
  return (e: WheelLike): "zoom" | "pan" => {
    if (e.deltaMode !== 0) return "zoom";
    const t = now();
    const looksPad = e.deltaX !== 0 || Math.abs(e.deltaY) < 100 || !Number.isInteger(e.deltaY);
    const pad = looksPad || t - lastPad < 300;
    if (pad) lastPad = t;
    return pad ? "pan" : "zoom";
  };
}

/** Wheel delta in pixels, whatever unit the browser reports. */
export const wheelPixels = (e: WheelLike) => e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);

/** Zoom factor for one wheel event, the same curve d3-zoom (React Flow's default) uses. */
export const zoomFactor = (e: WheelLike) => 2 ** (-wheelPixels(e) * 0.002);
