import { readFile } from "node:fs/promises";
import path from "node:path";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const sliderConfig = process.env.SLIDER_CONFIG?.trim() ?? "";

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function applyConfigAttribute(html: string, configPath: string): string {
  if (!configPath) return html;
  const attr = `data-slider-config="${escapeAttr(configPath)}"`;
  if (html.includes("data-slider-config=")) return html.replace(/data-slider-config="[^"]*"/, attr);
  return html.replace("<html", `<html ${attr}`);
}

function sliderConfigPlugin(): Plugin {
  return {
    name: "web-slider-config",
    config() {
      return {
        define: {
          "import.meta.env.VITE_SLIDER_CONFIG": JSON.stringify(sliderConfig),
        },
      };
    },
    transformIndexHtml(html) {
      return applyConfigAttribute(html, sliderConfig);
    },
    configurePreviewServer(server) {
      if (!sliderConfig) return;
      const indexFile = path.resolve(server.config.root, server.config.build.outDir, "index.html");
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0];
        if (pathname !== "/" && pathname !== "/index.html") {
          next();
          return;
        }
        void readFile(indexFile, "utf8")
          .then((html) => {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(applyConfigAttribute(html, sliderConfig));
          })
          .catch((error: unknown) => {
            next(error);
          });
      });
    },
  };
}

export default defineConfig({
  plugins: [sliderConfigPlugin(), react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
