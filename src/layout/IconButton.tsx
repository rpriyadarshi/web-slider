import type { ReactNode } from "react";

export type IconName =
  | "previous"
  | "next"
  | "overview"
  | "fullscreen"
  | "exit"
  | "open"
  | "theme"
  | "export"
  | "outline"
  | "examples"
  | "notes"
  | "hide"
  | "yaml"
  | "pdf"
  | "word"
  | "powerpoint"
  | "package"
  | "light"
  | "dark"
  | "pin";

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

const paths: Record<IconName, ReactNode> = {
  previous: <polyline points="14 6 8 12 14 18" />,
  next: <polyline points="10 6 16 12 10 18" />,
  overview: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  fullscreen: (
    <>
      <polyline points="9 4 4 4 4 9" />
      <polyline points="15 4 20 4 20 9" />
      <polyline points="20 15 20 20 15 20" />
      <polyline points="4 15 4 20 9 20" />
    </>
  ),
  exit: (
    <>
      <polyline points="9 9 4 9 4 4" />
      <polyline points="15 9 20 9 20 4" />
      <polyline points="20 15 20 20 15 20" />
      <polyline points="4 15 4 20 9 20" />
    </>
  ),
  open: (
    <>
      <path d="M4 8h6l2 2h8v9H4z" />
      <path d="M4 8V6h5l2 2" />
    </>
  ),
  theme: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </>
  ),
  export: (
    <>
      <path d="M12 4v10" />
      <polyline points="8 11 12 15 16 11" />
      <path d="M5 19h14" />
    </>
  ),
  outline: (
    <>
      <line x1="9" y1="7" x2="20" y2="7" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="17" x2="20" y2="17" />
      <circle cx="5.5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  examples: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  notes: (
    <>
      <path d="M7 4h8l4 4v12H7z" />
      <path d="M15 4v4h4M9 13h6M9 17h4" />
    </>
  ),
  hide: (
    <>
      <line x1="7" y1="7" x2="17" y2="17" />
      <line x1="17" y1="7" x2="7" y2="17" />
    </>
  ),
  yaml: (
    <>
      <path d="M8 8 5 12l3 4" />
      <path d="M16 8l3 4-3 4" />
      <path d="M13 7l-2 10" />
    </>
  ),
  pdf: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
    </>
  ),
  word: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  powerpoint: (
    <>
      <rect x="4" y="5" width="16" height="12" rx="1.5" />
      <path d="M12 17v3M9 20h6" />
    </>
  ),
  package: (
    <>
      <path d="M4 8l8-4 8 4-8 4z" />
      <path d="M4 8v8l8 4 8-4V8" />
      <path d="M12 12v8" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
    </>
  ),
  dark: <path d="M16 13.5A6.5 6.5 0 1 1 10.5 4 5 5 0 0 0 16 13.5z" />,
  pin: (
    <>
      <path d="M9 4h6l-1 6 3 3H7l3-3z" />
      <path d="M12 13v7" />
    </>
  ),
};

export function IconMark({ label, name }: { label: string; name: IconName }) {
  return (
    <span className="icon-mark" title={label}>
      <Icon name={name} />
    </span>
  );
}

export function IconButton({
  label,
  pressed,
  disabled,
  onClick,
  className,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className ? `icon-button ${className}` : "icon-button"}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
