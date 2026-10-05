import { isDarkHex } from "../highlight";
import type { Block, ResolvedTheme } from "../model/schema";
import { Blocks } from "../slides/Blocks";
import { control } from "../help/controls";
import { hideTip, pinTip } from "../help/tips";
import { Icon, IconButton, IconMark } from "./IconButton";

export function SidePanel({
  blocks,
  theme,
  pinned,
  onPin,
  onHide,
  className,
}: {
  blocks: Block[] | undefined;
  theme: ResolvedTheme;
  pinned: boolean;
  onPin: () => void;
  onHide: () => void;
  className: string;
}) {
  return (
    <aside
      className={className}
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
        <IconMark label="Examples" name="examples" tip={control("examples").about} />
        <div className="panel-actions">
          <IconButton label={pinned ? "Unpin" : "Pin"} tip={pinTip(pinned, "Examples")} pressed={pinned} onClick={onPin}>
            <Icon name="pin" />
          </IconButton>
          <IconButton label="Hide" tip={hideTip("Examples")} onClick={onHide}>
            <Icon name="hide" />
          </IconButton>
        </div>
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
