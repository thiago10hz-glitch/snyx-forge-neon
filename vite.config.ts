import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  base: "./",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    target: "esnext",
    minify: "terser",
    cssMinify: true,
    sourcemap: false,
    cssCodeSplit: true,
    modulePreload: {
      polyfill: false,
    },
    terserOptions: {
      compress: {
        drop_console: mode === "production",
        drop_debugger: true,
        passes: 2,
        dead_code: true,
        conditionals: true,
        evaluate: true,
        booleans: true,
      },
      mangle: {
        toplevel: true,
        properties: {
          regex: /^_snyx_/,
        },
      },
      format: {
        comments: false,
        ascii_only: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-tooltip", "@radix-ui/react-popover"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-supabase": ["@supabase/supabase-js"],
        },
        compact: true,
        // Obfuscate chunk names
        chunkFileNames: "assets/s-[hash].js",
        entryFileNames: "assets/s-[hash].js",
        assetFileNames: "assets/s-[hash][extname]",
      },
    },
    chunkSizeWarningLimit: 600,
  },
  css: {
    devSourcemap: false,
  },
}));
