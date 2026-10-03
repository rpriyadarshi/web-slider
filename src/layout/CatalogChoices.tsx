import { useEffect, useState } from "react";
import { loadCatalog, type Catalog } from "../model/catalog";

export function CatalogChoices({
  list,
  label,
  onChoose,
}: {
  list: "installs" | "examples";
  label: string;
  onChoose: (path: string) => void;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    void loadCatalog({
      fetch: (input, init) => window.fetch(input, init),
      origin: window.location.origin,
    })
      .then((loaded) => {
        if (!cancel) setCatalog(loaded);
      })
      .catch((caught: unknown) => {
        if (!cancel) setError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div className="sample-block">
      <p className="sample-label">{label}</p>
      {error ? <pre className="error-body">{error}</pre> : null}
      {catalog ? (
        <div className="sample-list">
          {catalog[list].map((entry) => (
            <button key={entry.id} type="button" onClick={() => onChoose(entry.path)}>
              {entry.title}
            </button>
          ))}
        </div>
      ) : error ? null : (
        <p className="empty-note">Loading the catalog.</p>
      )}
    </div>
  );
}
