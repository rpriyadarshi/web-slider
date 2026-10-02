import type { HighlighterCore } from "@shikijs/core";

let pending: Promise<HighlighterCore> | null = null;

function highlighter(): Promise<HighlighterCore> {
  pending ??= loadHighlighter();
  return pending;
}

async function loadHighlighter(): Promise<HighlighterCore> {
  const [
    { createHighlighterCore },
    { createJavaScriptRegexEngine },
    githubDark,
    githubLight,
    bash,
    cssLang,
    html,
    javascript,
    json,
    jsx,
    markdown,
    python,
    tsx,
    typescript,
    yaml,
  ] = await Promise.all([
    import("@shikijs/core"),
    import("@shikijs/engine-javascript"),
    import("@shikijs/themes/github-dark"),
    import("@shikijs/themes/github-light"),
    import("@shikijs/langs/bash"),
    import("@shikijs/langs/css"),
    import("@shikijs/langs/html"),
    import("@shikijs/langs/javascript"),
    import("@shikijs/langs/json"),
    import("@shikijs/langs/jsx"),
    import("@shikijs/langs/markdown"),
    import("@shikijs/langs/python"),
    import("@shikijs/langs/tsx"),
    import("@shikijs/langs/typescript"),
    import("@shikijs/langs/yaml"),
  ]);

  return createHighlighterCore({
    themes: [githubDark.default, githubLight.default],
    langs: [bash, cssLang, html, javascript, json, jsx, markdown, python, tsx, typescript, yaml].flatMap(
      (language) => language.default,
    ),
    engine: createJavaScriptRegexEngine(),
  });
}

export async function highlightCode(code: string, language: string | undefined, dark: boolean): Promise<string> {
  const engine = await highlighter();
  const theme = dark ? "github-dark" : "github-light";
  if (!language) {
    return engine.codeToHtml(code, { lang: "text", theme });
  }
  const loaded = engine.getLoadedLanguages();
  if (!loaded.includes(language)) {
    throw new Error(`Cannot highlight language "${language}".`);
  }
  return engine.codeToHtml(code, { lang: language, theme });
}

export function isDarkHex(hex: string): boolean {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 < 0.62;
}
