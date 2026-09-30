import { useEffect, useState } from "react";

export const QR_EXPORT_SIZE = 1024;

/** Render `text` as a PNG data URL. `qrcode` is loaded on demand (own chunk). */
export async function qrDataUrl(text: string, width = QR_EXPORT_SIZE): Promise<string> {
  const { toDataURL } = await import("qrcode");
  return toDataURL(text, { width, margin: 2, errorCorrectionLevel: "M", color: { dark: "#18181b", light: "#ffffff" } });
}

export function useQrDataUrl(text: string | null) {
  const [state, setState] = useState<{ text: string | null; url: string | null; error: string | null }>({ text: null, url: null, error: null });
  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    qrDataUrl(text)
      .then((url) => !cancelled && setState({ text, url, error: null }))
      .catch(() => !cancelled && setState({ text, url: null, error: "Couldn’t generate the QR code." }));
    return () => {
      cancelled = true;
    };
  }, [text]);
  // Ignore results for a previous text while the new one renders.
  return state.text === text ? state : { text, url: null, error: null };
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
