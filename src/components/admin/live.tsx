import { useEffect, useState } from "react";
import type { AdminStudentRow } from "@shared/contract";

/** Admin lists that change during class (students scanning the QR code) refresh this often. */
export const LIVE_REFRESH_MS = 15_000;

/** Joined within the last 30 minutes → highlighted as "New" so the instructor sees who just arrived. */
const RECENT_JOIN_MS = 30 * 60 * 1000;

export function isRecentJoin(r: Pick<AdminStudentRow, "status" | "joinedAt">, now = Date.now()): boolean {
  if (r.status !== "active" || !r.joinedAt) return false;
  const t = Date.parse(r.joinedAt);
  return Number.isFinite(t) && now - t >= 0 && now - t < RECENT_JOIN_MS;
}

/** "● Live · updated 8 s ago" — tells the instructor the list refreshes by itself. */
export function LiveIndicator({ updatedAt, fetching }: { updatedAt: number; fetching: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(t);
  }, []);
  if (!updatedAt) return null;
  const secs = Math.max(0, Math.round((now - updatedAt) / 1000));
  const ago = secs < 5 ? "just now" : secs < 60 ? `${secs} s ago` : `${Math.round(secs / 60)} min ago`;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted" title="Updates automatically every 15 seconds">
      <span className="relative flex size-2" aria-hidden="true">
        {fetching && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60" />}
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      Live · updated {ago}
    </span>
  );
}
