import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { router } from "./router";
import { ApiRequestError } from "./lib/api";
import { meKey } from "./lib/auth";
import "./index.css";

/**
 * Any 401 from the API (expired or revoked session) marks the user as signed out, so the
 * route guards (RequireStudent / AdminLayout) send them to the right login page.
 * The /me query itself handles 401 by returning null, so it never loops here.
 */
function onApiError(error: unknown) {
  if (error instanceof ApiRequestError && error.status === 401 && queryClient.getQueryData(meKey)) {
    queryClient.setQueryData(meKey, null);
  }
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: {
    queries: { retry: (count, error) => !(error instanceof ApiRequestError && error.status < 500) && count < 1, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
