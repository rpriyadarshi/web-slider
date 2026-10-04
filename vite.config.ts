import { createReadStream, existsSync, statSync } from "node:fs";
import { cp, readFile } from "node:fs/promises";
import path from "node:path";
import type { ServerResponse } from "node:http";
import type { Connect } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const samplesRoot = path.resolve("samples");

const sampleTypes: Record<string, string> = {
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
};

function serveSamples(req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction): void {
  const pathname = decodeURIComponent((req.url ?? "").split("?")[0] ?? "");
  if (!pathname.startsWith("/samples/")) {
    next();
    return;
  }
  const relative = pathname.slice("/samples/".length);
  if (relative === "" || relative.split("/").includes("..")) {
    next();
    return;
  }
  const file = path.resolve(samplesRoot, relative);
  if (!file.startsWith(`${samplesRoot}${path.sep}`) || !existsSync(file) || !statSync(file).isFile()) {
    next();
    return;
  }
  const type = sampleTypes[path.extname(file).toLowerCase()];
  if (!type) {
    next();
    return;
  }
  res.setHeader("Content-Type", type);
  createReadStream(file).pipe(res);
}

function serveLocalConfig(req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction): void {
  const url = new URL(req.url ?? "", "http://localhost");
  if (url.pathname !== "/__slider/local-config") {
    next();
    return;
  }
  const filePath = url.searchParams.get("path") ?? "";
  if (!filePath.startsWith("/") || filePath.split("/").includes("..") || !/\.ya?ml$/.test(filePath)) {
    res.statusCode = 400;
    res.end("Config path must be a .yaml file on disk.");
    return;
  }
  const resolved = path.resolve(filePath);
  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    res.statusCode = 404;
    res.end(`Config not found: ${resolved}`);
    return;
  }
  res.setHeader("Content-Type", "text/yaml; charset=utf-8");
  createReadStream(resolved).pipe(res);
}

function localConfigPlugin(): Plugin {
  return {
    name: "web-slider-local-config",
    configureServer(server) {
      server.middlewares.use(serveLocalConfig);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveLocalConfig);
    },
  };
}

function samplesPlugin(): Plugin {
  return {
    name: "web-slider-samples",
    configureServer(server) {
      server.middlewares.use(serveSamples);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveSamples);
    },
    async writeBundle() {
      await cp(samplesRoot, path.resolve("dist/samples"), { recursive: true });
    },
  };
}

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
  plugins: [localConfigPlugin(), samplesPlugin(), sliderConfigPlugin(), react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
