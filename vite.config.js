import { defineConfig } from "vite";
import { existsSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function copyDir(src, dest) {
  if (!existsSync(src)) return;
  cpSync(src, dest, { recursive: true });
}

export default defineConfig({
  root: ".",
  base: "./",
  server: {
    open: "/dev.html",
  },
  preview: {
    open: "/dev.html",
  },
  /** Audio lives under root `assets/`; copy into build output explicitly. */
  publicDir: false,
  plugins: [
    {
      name: "silence-root-favicon-404",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/favicon.ico") {
            res.statusCode = 204;
            res.end();
            return;
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/favicon.ico") {
            res.statusCode = 204;
            res.end();
            return;
          }
          next();
        });
      },
    },
    {
      name: "copy-root-assets",
      closeBundle() {
        copyDir(join(__dirname, "assets"), join(__dirname, "dist", "assets"));
      },
    },
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        index: join(__dirname, "index.html"),
        dev: join(__dirname, "dev.html"),
      },
    },
  },
});
