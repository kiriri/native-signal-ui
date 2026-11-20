import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  // Classic JSX for the .tsx tests (the library itself contains no JSX).
  esbuild: {
    jsxFactory: "h",
    jsxFragment: "Fragment"
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        // Its own subpath (`native-signal-ui/i18n`): no DOM, so apps that
        // don't translate don't carry it.
        i18n: resolve(__dirname, "src/i18n/index.ts"),
      },
      formats: ["es"]
    },
    rollupOptions: {
      // native-signal is a peer dep — don't bundle it into our output.
      external: [/^native-signal($|\/)/],
      output: {
        preserveModules: false,
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js"
      }
    },
    target: "es2022",
    sourcemap: true,
    minify: false
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"]
  }
});
