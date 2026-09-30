import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GoogleLoginBody, Me } from "@shared/contract";
import { api } from "@/lib/api";
import { useAppConfig } from "@/lib/auth";
import { Spinner } from "@/components/ui";

/* ── Minimal typings for Google Identity Services (only what we use) ── */
type GisCredentialResponse = { credential?: string };
type GisIdConfig = {
  client_id: string;
  callback: (res: GisCredentialResponse) => void;
  hd?: string;
  ux_mode?: "popup" | "redirect";
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  context?: "signin" | "signup" | "use";
};
type GisButtonConfig = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
};
type GisId = {
  initialize: (config: GisIdConfig) => void;
  renderButton: (parent: HTMLElement, config: GisButtonConfig) => void;
  disableAutoSelect: () => void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GisId } };
  }
}

const GIS_SRC = "https://accounts.google.com/gsi/client";
let gisPromise: Promise<GisId> | null = null;

/** Load the GIS script once per page (only when a client id exists — keeps it off the critical path). */
function loadGis(): Promise<GisId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  if (!gisPromise) {
    gisPromise = new Promise<GisId>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        const id = window.google?.accounts?.id;
        if (id) resolve(id);
        else reject(new Error("Google sign-in failed to start."));
      };
      script.onerror = () => {
        gisPromise = null; // allow a retry on the next mount
        script.remove();
        reject(new Error("Couldn't load Google sign-in. Check your connection or disable blockers for accounts.google.com."));
      };
      document.head.appendChild(script);
    });
  }
  return gisPromise;
}

/*
 * GIS keeps ONE global configuration. Calling initialize() repeatedly logs a console warning, so we
 * initialize once per (client id, hd) and route the credential to whichever button is mounted now.
 */
let initializedKey: string | null = null;
let activeHandler: ((credential: string) => void) | null = null;

export type GoogleSignInButtonProps = {
  as: "student" | "admin";
  joinCode?: string;
  onSuccess: (me: Me) => void;
  onError?: (error: unknown) => void;
  /** Fires with true while the credential is being exchanged with our API. */
  onPendingChange?: (pending: boolean) => void;
};

export function GoogleSignInButton({ as, joinCode, onSuccess, onError, onPendingChange }: GoogleSignInButtonProps) {
  const config = useAppConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Always call the latest props from the (long-lived) GIS callback.
  const latest = useRef({ as, joinCode, onSuccess, onError, onPendingChange });
  useLayoutEffect(() => {
    latest.current = { as, joinCode, onSuccess, onError, onPendingChange };
  });

  const clientId = config.data?.googleClientId ?? "";
  const hd = as === "student" ? config.data?.allowedStudentDomain || undefined : undefined;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    const handleCredential = async (credential: string) => {
      const p = latest.current;
      setPending(true);
      p.onPendingChange?.(true);
      try {
        const body: GoogleLoginBody = { credential, joinCode: p.joinCode, as: p.as };
        const me = await api.post<Me>("/auth/google", body);
        latest.current.onSuccess(me);
      } catch (e) {
        latest.current.onError?.(e);
      } finally {
        setPending(false);
        latest.current.onPendingChange?.(false);
      }
    };

    loadGis()
      .then((gis) => {
        if (cancelled || !containerRef.current) return;
        const key = `${clientId}|${hd ?? ""}`;
        if (initializedKey !== key) {
          gis.initialize({
            client_id: clientId,
            callback: (res) => {
              if (res.credential) activeHandler?.(res.credential);
            },
            hd,
            ux_mode: "popup",
            auto_select: false,
            context: "signin",
          });
          initializedKey = key;
        }
        activeHandler = (credential) => void handleCredential(credential);
        const width = Math.min(400, Math.max(200, Math.round(containerRef.current.clientWidth)));
        containerRef.current.replaceChildren();
        gis.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "pill",
          logo_alignment: "left",
          width,
          locale: "en",
        });
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setStatus("failed");
        setLoadError(e instanceof Error ? e.message : "Couldn't load Google sign-in.");
      });

    return () => {
      cancelled = true;
      activeHandler = null;
    };
  }, [clientId, hd]);

  if (config.isPending) {
    return <div className="h-11 w-full animate-pulse rounded-full bg-zinc-100" aria-hidden="true" />;
  }

  if (!clientId) {
    return (
      <div>
        <button
          type="button"
          disabled
          className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-3 rounded-full border border-line bg-surface text-sm font-medium text-muted opacity-70"
        >
          <GoogleG />
          Sign in with Google
        </button>
        <p className="mt-2 text-center text-xs text-muted">Google sign-in isn't configured yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* GIS renders its own iframe button inside this box. */}
      <div ref={containerRef} className="flex min-h-11 w-full justify-center" />
      {status === "loading" && (
        <div className="absolute inset-0 animate-pulse rounded-full bg-zinc-100" aria-hidden="true" />
      )}
      {pending && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-surface/90 text-sm font-medium" role="status">
          <Spinner className="size-4" /> Signing in…
        </div>
      )}
      {status === "failed" && loadError && <p className="mt-2 text-center text-xs text-danger">{loadError}</p>}
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default GoogleSignInButton;
