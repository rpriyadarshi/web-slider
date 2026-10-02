export function ErrorScreen({
  message,
  canReturn,
  storageBroken,
  onOpen,
  onReturn,
  onDiscard,
}: {
  message: string;
  canReturn: boolean;
  storageBroken: boolean;
  onOpen: () => void;
  onReturn: () => void;
  onDiscard: () => void;
}) {
  return (
    <main className="start">
      <section className="start-card">
        <p className="eyebrow">Cannot open this deck</p>
        <h1>The file failed validation.</h1>
        <pre className="error-body">{message}</pre>
        <div className="start-actions">
          <button type="button" className="primary" onClick={onOpen}>
            Open another file
          </button>
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
