type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionEvent = {
  results: ArrayLike<{ 0: { transcript: string } }>;
};

type RecognitionConstructor = new () => Recognition;

export function startCaptions(onText: (text: string) => void, onError: (message: string) => void): () => void {
  const scope = window as Window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  const Constructor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  if (!Constructor) {
    onError("This browser has no speech recognition, so captions cannot start.");
    return () => undefined;
  }

  const recognition = new Constructor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  let stopped = false;
  recognition.onresult = (event) => {
    const text = [...Array.from({ length: event.results.length }, (_, index) => event.results[index]?.[0]?.transcript ?? "")]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) onText(text);
  };
  recognition.onerror = (event) => {
    if (event.error === "aborted" || event.error === "no-speech") return;
    stopped = true;
    onError(captionError(event.error));
  };
  recognition.onend = () => {
    if (stopped) return;
    try {
      recognition.start();
    } catch (error) {
      stopped = true;
      onError(error instanceof Error ? error.message : "Captions stopped.");
    }
  };
  try {
    recognition.start();
  } catch (error) {
    onError(error instanceof Error ? error.message : "Captions could not start.");
    return () => undefined;
  }
  return () => {
    stopped = true;
    recognition.onend = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.stop();
  };
}

function captionError(code: string): string {
  if (code === "not-allowed" || code === "service-not-allowed") {
    return "The microphone was blocked, so captions cannot start.";
  }
  if (code === "audio-capture") return "No microphone is available for captions.";
  if (code === "network") return "Speech recognition could not reach its service.";
  return `Captions stopped (${code}).`;
}
