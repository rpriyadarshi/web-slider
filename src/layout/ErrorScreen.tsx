export function ErrorScreen({
  message,
  eyebrow = "Cannot open this deck",
  heading = "The file failed validation.",
  canReturn,
  storageBroken,
  showOpen = true,
  onOpen,
  onReturn,
  onDiscard,
  onReload,
}: {
  message: string;
  eyebrow?: string;
  heading?: string;
  canReturn: boolean;
  storageBroken: boolean;
  showOpen?: boolean;
  onOpen: () => void;
  onReturn: () => void;
  onDiscard: () => void;
  onReload?: () => void;
}) {
  return (
    <main className="start">
      <section className="start-card">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{heading}</h1>
        <pre className="error-body">{message}</pre>
        <div className="start-actions">
          {showOpen ? (
            <button type="button" className="primary" onClick={onOpen}>
              Open another file
            </button>
          ) : null}
          {onReload ? (
            <button type="button" className="primary" onClick={onReload}>
              Reload
            </button>
          ) : null}
          {canReturn ? (
            <button type="button" onClick={onReturn}>
              Return to the open deck
            </button>
          ) : null}
          {storageBroken ? (
            <button type="button" onClick={onDiscard}>
              Discard stored deck
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
