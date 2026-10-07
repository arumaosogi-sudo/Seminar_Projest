import { safeStorage } from "./format";

const METHOD_KEY = "dm_admin_login_method";
export type LoginMethod = "google" | "dev" | "password";

/** AdminMe doesn't say how the admin signed in, so the login page remembers it for the sidebar label. */
export const loginMethodStore = {
  get: (): LoginMethod | null => {
    const v = safeStorage.get(METHOD_KEY);
    return v === "google" || v === "dev" || v === "password" ? v : null;
  },
  set: (m: LoginMethod) => safeStorage.set(METHOD_KEY, m),
  clear: () => safeStorage.set(METHOD_KEY, null),
};
