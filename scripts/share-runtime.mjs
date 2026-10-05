import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const serverDir = path.join(repoRoot, "scripts", "share-server");
const outDir = path.join(repoRoot, "scripts", "share", "runtime");

const targets = [
  { goos: "darwin", goarch: "arm64", out: "server-darwin-arm64" },
  { goos: "darwin", goarch: "amd64", out: "server-darwin-amd64" },
  { goos: "windows", goarch: "amd64", out: "server-windows-amd64.exe" },
  { goos: "linux", goarch: "amd64", out: "server-linux-amd64" },
];

function goBinary() {
  return process.env.GO || "go";
}

function runGo(args, envExtra) {
  return new Promise((resolve, reject) => {
    const go = goBinary();
    const env = { ...process.env, ...envExtra };
    if (env.GOTOOLCHAIN === undefined) {
      env.GOTOOLCHAIN = "local";
    }
    const child = spawn(go, args, {
      cwd: serverDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        process.stderr.write(stderr);
        reject(new Error(`go exited ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function verifyGo() {
  const go = goBinary();
  await new Promise((resolve, reject) => {
    const child = spawn(go, ["version"], { stdio: ["ignore", "pipe", "pipe"] });
    let ok = false;
    child.stdout.on("data", () => {
      ok = true;
    });
    child.on("error", () => reject(new Error("missing")));
    child.on("close", (code) => {
      if (code === 0 && ok) resolve();
      else reject(new Error("missing"));
    });
  }).catch(() => {
    console.error(
      "Go is required to build the share runtimes. Install Go 1.22 or newer, or set GO=/path/to/go.",
    );
    process.exit(1);
  });
}

async function main() {
  await verifyGo();
  fs.mkdirSync(outDir, { recursive: true });

  for (const { goos, goarch, out } of targets) {
    const outPath = path.join(outDir, out);
    await runGo(
      ["build", "-trimpath", "-ldflags", "-s -w", "-o", outPath, "."],
      {
        CGO_ENABLED: "0",
        GOOS: goos,
        GOARCH: goarch,
      },
    );
    const stat = fs.statSync(outPath);
    const mb = stat.size / (1024 * 1024);
    console.log(`${out} ${mb.toFixed(2)} MB`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
