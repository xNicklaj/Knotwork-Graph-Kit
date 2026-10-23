import { defineConfig } from "tsup";

// Peers stay external so the app and the kit share one React, React Flow, Zustand and zundo.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "react-dom", "react/jsx-runtime", "@xyflow/react", "zustand", "zundo"],
});
