import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
if (!existsSync(viteBin)) {
  console.error(`Vite CLI not found: ${viteBin}`);
  process.exit(1);
}
const [mode, ...rest] = process.argv.slice(2);

if (mode !== "dev" && mode !== "preview" && mode !== "build") {
  console.error("Usage: node scripts/launch.mjs <dev|preview|build> [--config <site-path>] [vite args]");
  process.exit(1);
}

let configPath = "";
let sawConfig = false;
const viteArgs = [];
for (let index = 0; index < rest.length; index += 1) {
  const arg = rest[index];
  if (arg === "--config" || arg.startsWith("--config=")) {
    if (sawConfig) {
      console.error("--config was given more than once.");
      process.exit(1);
    }
    sawConfig = true;
    const value = arg === "--config" ? rest[index + 1] : arg.slice("--config=".length);
    if (arg === "--config") index += 1;
    if (!value || value.startsWith("-")) {
      console.error("--config requires a site path, for example samples/examples/northwind/web-slider.config.yaml");
      process.exit(1);
    }
    configPath = value;
    continue;
  }
  viteArgs.push(arg);
}

const commandArgs = mode === "dev" ? viteArgs : [mode, ...viteArgs];
const child = spawn(process.execPath, [viteBin, ...commandArgs], {
  env: { ...process.env, SLIDER_CONFIG: configPath },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
