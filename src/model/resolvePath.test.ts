import { posix } from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePath } from "./resolvePath";

function posixJoin(containerFile: string, ref: string): string {
  return posix.normalize(posix.join(posix.dirname(containerFile), ref));
}

describe("resolvePath", () => {
  it("matches path.posix join and normalize", () => {
    const cases: [string, string][] = [
      ["/a/b/c/d/foo.yaml", "../../../Presentation/Themes/emporion/manifest.yaml"],
      ["/a/Presentation/Themes/emporion/manifest.yaml", "fonts/Inter-Regular.ttf"],
      ["/a/Presentation/Themes/emporion/manifest.yaml", "./mark.svg"],
      ["/a/Presentation/Themes/emporion/manifest.yaml", "marks/../mark.svg"],
      ["samples/themes/harbor/manifest.yaml", "../emporion/fonts/Inter-Regular.ttf"],
      ["samples/examples/northwind/web-slider.config.yaml", "manifest.yaml"],
      ["/var/house/talks/brief.yaml", "figures/a.png"],
    ];
    for (const [container, ref] of cases) {
      expect(resolvePath(container, ref)).toBe(posixJoin(container, ref));
    }
    expect(resolvePath("/a/b/c/d/foo.yaml", "../../../Presentation/Themes/emporion/manifest.yaml")).toBe(
      "/a/Presentation/Themes/emporion/manifest.yaml",
    );
    expect(resolvePath("/a/Presentation/Themes/emporion/manifest.yaml", "fonts/Inter-Regular.ttf")).toBe(
      "/a/Presentation/Themes/emporion/fonts/Inter-Regular.ttf",
    );
  });

  it("keeps absolute paths and non-file URLs, and does not join them", () => {
    expect(resolvePath("/a/b/foo.yaml", "/a/b/../c/mark.svg")).toBe("/a/c/mark.svg");
    expect(posix.isAbsolute("/a/c/mark.svg")).toBe(true);
    expect(resolvePath("/a/b/foo.yaml", "https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(resolvePath("/a/b/foo.yaml", "data:image/png;base64,aaaa")).toBe("data:image/png;base64,aaaa");
    expect(resolvePath("manifest.yaml", "mark.svg")).toBeNull();
  });
});
