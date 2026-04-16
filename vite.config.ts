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
    minify: "esbuild",
    cssMinify: true,
    sourcemap: false,
    cssCodeSplit: true,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom")) return "vendor-react";
            if (id.includes("react-router")) return "vendor-react";
            if (id.includes("react/")) return "vendor-react";
            if (id.includes("@radix-ui")) return "vendor-ui";
            if (id.includes("@tanstack")) return "vendor-query";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("hls.js")) return "vendor-hls";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("@stripe")) return "vendor-stripe";
            if (id.includes("react-markdown") || id.includes("remark") || id.includes("rehype") || id.includes("unified") || id.includes("mdast") || id.includes("micromark")) return "vendor-markdown";
          }
        },
        compact: true,
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
