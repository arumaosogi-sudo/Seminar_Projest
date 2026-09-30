import { createContext, useContext, type ReactNode } from "react";

export type ToastTone = "info" | "success" | "error";

export const ToastContext = createContext<{ show: (message: ReactNode, tone?: ToastTone) => void } | null>(null);

/** Show a toast from any admin page. Falls back to a no-op outside the provider (e.g. tests). */
export function useToast() {
  return useContext(ToastContext) ?? { show: () => {} };
}
