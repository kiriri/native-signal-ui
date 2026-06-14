import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
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
    include: ["tests/**/*.test.ts"]
  }
});
