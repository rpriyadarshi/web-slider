import { isDarkHex } from "../highlight";
import type { Block, ResolvedTheme } from "../model/schema";
import { Blocks } from "../slides/Blocks";
import { Icon, IconButton, IconMark } from "./IconButton";

export function SidePanel({
  blocks,
  theme,
  onHide,
}: {
  blocks: Block[] | undefined;
  theme: ResolvedTheme;
  onHide: () => void;
}) {
  return (
    <aside
      className="side-popup"
      aria-label="Examples"
      style={{
        ["--slide-surface" as string]: theme.surface,
        ["--slide-text" as string]: theme.text,
        ["--slide-muted" as string]: theme.muted,
        ["--slide-accent" as string]: theme.accent,
        ["--slide-heading" as string]: `"${theme.fontHeading}"`,
        ["--slide-body" as string]: `"${theme.fontBody}"`,
        ["--slide-mono" as string]: `"${theme.fontMono}"`,
        ["--slide-radius" as string]: `${theme.radius}px`,
      }}
    >
      <div className="panel-head">
        <IconMark label="Examples" name="examples" />
        <IconButton label="Hide" onClick={onHide}>
          <Icon name="hide" />
        </IconButton>
      </div>
      <div className="side-body">
        {blocks && blocks.length > 0 ? (
          <Blocks blocks={blocks} revealed={Number.MAX_SAFE_INTEGER} dark={isDarkHex(theme.background)} />
        ) : (
          <p className="empty-note">No examples on this slide.</p>
        )}
      </div>
    </aside>
  );
}
