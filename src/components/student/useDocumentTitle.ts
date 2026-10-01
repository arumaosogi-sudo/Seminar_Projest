import { useEffect } from "react";

const APP = "Digital Muscle";

/** Sets `document.title` to "<title> · Digital Muscle" while the page is mounted. */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} · ${APP}` : APP;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
