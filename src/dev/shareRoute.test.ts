import { describe, expect, it } from "vitest";
import { shareCommand, shareCommandDisplay } from "../export/runnable";
import { isAllowedDiskPath } from "./localFile";
import { exportErrorText, shareRefusal } from "./shareRoute";

describe("runnable package route", () => {
  it("builds only for a server started with an absolute config and a talk id that is a file name", () => {
    expect(shareRefusal("/home/author/theme/web-slider.config.yaml", "pd-dv")).toBeNull();
    expect(shareRefusal("", "pd-dv")).toMatch(/started with no --config/);
    expect(shareRefusal("samples/examples/northwind/web-slider.config.yaml", "pd-dv")).toMatch(/theme on disk/);
    expect(shareRefusal("/home/author/theme/web-slider.config.yaml", "../pd-dv")).toMatch(/not a file name/);
    expect(shareRefusal("/home/author/theme/web-slider.config.yaml", null)).toMatch(/talk id/);
  });

  it("keeps the missing-file failure and drops the scratch path", () => {
    const shown = exportErrorText(
      "The talk names files it does not carry: diagrams/landscape.png. Open the talk's .zip so those files travel with it. (/tmp/web-slider-export-4K1bz/C/deck.zip)",
    );
    expect(shown).toMatch(/diagrams\/landscape\.png/);
    expect(shown).not.toMatch(/\/tmp/);
  });

  it("prints the node share command as one shell line", () => {
    expect(
      shareCommand("/usr/bin/node", "/repo/scripts/share.mjs", [
        "--config",
        "/home/author/theme/web-slider.config.yaml",
        "--deck",
        "/tmp/web-slider-export-1/deck.zip",
        "--out",
        "/tmp/web-slider-export-1/pd-dv-presenter.zip",
      ]),
    ).toBe(
      "/usr/bin/node /repo/scripts/share.mjs --config /home/author/theme/web-slider.config.yaml --deck /tmp/web-slider-export-1/deck.zip --out /tmp/web-slider-export-1/pd-dv-presenter.zip",
    );
  });

  it("breaks the share command onto one flag per line for the banner", () => {
    const line = shareCommand("/usr/bin/node", "/repo/scripts/share.mjs", [
      "--config",
      "/home/author/theme/web-slider.config.yaml",
      "--deck",
      "/tmp/web-slider-export-1/deck.zip",
      "--out",
      "/tmp/web-slider-export-1/pd-dv-presenter.zip",
    ]);
    expect(shareCommandDisplay(line)).toBe(
      [
        "/usr/bin/node /repo/scripts/share.mjs \\",
        "  --config /home/author/theme/web-slider.config.yaml \\",
        "  --deck /tmp/web-slider-export-1/deck.zip \\",
        "  --out /tmp/web-slider-export-1/pd-dv-presenter.zip",
      ].join("\n"),
    );
  });

  it("lets the dev server read a talk zip beside a config on disk, but not as a config", () => {
    expect(isAllowedDiskPath("file", "/home/author/theme/talk.zip")).toBe(true);
    expect(isAllowedDiskPath("config", "/home/author/theme/talk.zip")).toBe(false);
    expect(isAllowedDiskPath("file", "/home/author/../talk.zip")).toBe(false);
  });
});
