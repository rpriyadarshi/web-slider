export const SHARE_ROUTE = "/__slider/share";

const NO_SERVER =
  "Runnable package is built by the Web Slider dev or preview server. Start it with npm run dev -- --config /absolute/path/to/web-slider.config.yaml, open the talk, and export again.";

/** Sends the open talk's package to the dev server, which builds the presenter and this theme around it. */
export async function requestRunnablePackage(
  fetchImpl: typeof fetch,
  origin: string,
  deckPackage: Blob,
  deckId: string,
): Promise<Blob> {
  const url = new URL(SHARE_ROUTE, origin.endsWith("/") ? origin : `${origin}/`);
  url.searchParams.set("name", deckId);
  const response = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/zip" }, body: deckPackage });
  const type = response.headers.get("content-type") ?? "";
  if (response.status === 404 || response.status === 405 || type.includes("text/html")) throw new Error(NO_SERVER);
  if (!response.ok) {
    const text = (await response.text()).trim();
    throw new Error(text || `Runnable package failed (${response.status}).`);
  }
  if (!type.includes("application/zip")) throw new Error(NO_SERVER);
  return response.blob();
}
