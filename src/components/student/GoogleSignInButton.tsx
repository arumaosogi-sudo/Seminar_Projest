import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GoogleLoginBody, Me } from "@shared/contract";
import { api } from "@/lib/api";
import { useAppConfig } from "@/lib/auth";
import { cx, Spinner } from "@/components/ui";

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
  // Google's `hd` hint can only name one domain — use it only when a single student domain is allowed.
  const studentDomains = config.data?.allowedStudentDomains ?? [];
  const hd = as === "student" && studentDomains.length === 1 ? studentDomains[0] : undefined;

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

  /*
   * The visible button is drawn to the Figma spec (48 px, 12 px radius, zinc-300 border, "G" badge).
   * When a client id exists, Google's own button (an iframe we can't restyle) is laid over it
   * fully transparent, so clicks still go through the official GIS flow.
   */
  const unavailable = config.isPending || !clientId || status === "failed";
  return (
    <div>
      <div className="relative">
        <div
          aria-hidden={!!clientId && !unavailable}
          className={cx(
            "relative flex h-12 w-full items-center justify-center rounded-xl border border-zinc-300 bg-surface text-[15px] font-medium text-ink",
            unavailable && "opacity-60",
          )}
        >
          <span className="absolute left-[15px] grid size-[25px] place-items-center rounded-full border border-line text-[13px] font-bold text-[#4285f4]">G</span>
          Sign in with Google
        </div>
        {clientId && (
          // GIS renders its own iframe button inside this box (invisible, but it receives the click).
          <div ref={containerRef} className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.01]" />
        )}
        {status === "loading" && clientId && <div className="absolute inset-0 animate-pulse rounded-xl bg-zinc-100/60" aria-hidden="true" />}
        {pending && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-surface/90 text-sm font-medium" role="status">
            <Spinner className="size-4" /> Signing in…
          </div>
        )}
      </div>
      {!config.isPending && !clientId && <p className="mt-2 text-center text-xs text-muted">Google sign-in isn't configured yet.</p>}
      {status === "failed" && loadError && <p className="mt-2 text-center text-xs text-danger">{loadError}</p>}
    </div>
  );
}

export default GoogleSignInButton;
