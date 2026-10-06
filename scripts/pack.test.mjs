import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { PACK_USAGE, readPackArgs, reportPack } from "./pack.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const dirs = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("pack command", () => {
  it("requires a yaml talk and a zip output", () => {
    expect(readPackArgs(["--deck", "talks/pd-dv.yaml"]).deck).toMatch(/talks\/pd-dv\.yaml$/);
    expect(() => readPackArgs([])).toThrow(PACK_USAGE);
    expect(() => readPackArgs(["--deck", "talks/pd-dv.zip"])).toThrow(/--deck must be a \.yaml talk/);
    expect(() => readPackArgs(["--deck", "talk.yaml", "--out", "talk.tar"])).toThrow(/--out must end in \.zip/);
  });

  it("prints every problem and a success on stdout", () => {
    const errors = [];
    const lines = [];
    const error = console.error;
    const log = console.log;
    console.error = (line) => errors.push(String(line));
    console.log = (line) => lines.push(String(line));
    try {
      expect(reportPack({ ok: false, problems: ["Deck failed validation:\ntitle: Required", "diagrams/a.png: missing"] })).toBe(1);
      expect(reportPack({ ok: true, wroteZip: false, deckPath: "/talk.yaml", message: "Talk is valid. It names no package files, so no zip was written." })).toBe(0);
    } finally {
      console.error = error;
      console.log = log;
    }
    expect(errors.join("\n")).toMatch(/The talk was not packed/);
    expect(errors.join("\n")).toMatch(/title: Required/);
    expect(errors.join("\n")).toMatch(/diagrams\/a\.png/);
    expect(lines.join("\n")).toMatch(/no zip was written/);
  });

  it("runs the presenter packer", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "web-slider-pack-cli-"));
    dirs.push(dir);
    const deck = path.join(dir, "talk.yaml");
    await writeFile(deck, "id: packed\ntitle: Packed\nslides:\n  - id: one\n    title: One\n    layout: content\n");
    const child = spawn(process.execPath, [path.join(repoRoot, "scripts", "pack.mjs"), "--deck", deck], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = await new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
    expect(output.stderr).toBe("");
    expect(output.code).toBe(0);
    expect(output.stdout).toMatch(/no zip was written/);
    expect(output.stdout).toContain(deck);
  }, 30000);
});
