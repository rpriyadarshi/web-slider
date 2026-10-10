import { describe, expect, it } from "vitest";
import { parsePickOutput, zenityArgs } from "./pickFile";

describe("file dialog", () => {
  it("asks zenity for a yaml file or a talk", () => {
    expect(zenityArgs("yaml")).toEqual(["--file-selection", "--title=Open", "--file-filter=Files | *.yaml *.yml"]);
    expect(zenityArgs("talk").at(-1)).toContain("*.pptx");
  });

  it("keeps an absolute path and treats cancel as no file", () => {
    expect(parsePickOutput(0, "/home/rohit/src/emporion_ai/Presentation/Themes/emporion/manifest.yaml\n")).toBe(
      "/home/rohit/src/emporion_ai/Presentation/Themes/emporion/manifest.yaml",
    );
    expect(parsePickOutput(1, "")).toBeNull();
    expect(parsePickOutput(0, "manifest.yaml\n")).toBeNull();
  });
});
