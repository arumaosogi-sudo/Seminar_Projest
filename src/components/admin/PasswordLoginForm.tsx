import { useId, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import type { AdminPasswordLoginBody, Me } from "@shared/contract";
import { api } from "@/lib/api";
import { Button, ErrorNote, Input } from "@/components/ui";
import { errorMessage, isApiStatus } from "./format";

/**
 * Username + password instructor sign-in (POST /api/auth/admin-password).
 * Shown when the server reports `adminPasswordLogin: true` (ADMIN_USERNAME + ADMIN_PASSWORD_HASH configured).
 */
export function PasswordLoginForm({ onSuccess }: { onSuccess: (me: Me) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<{ username?: string; password?: string }>({});
  const id = useId();

  const login = useMutation({
    mutationFn: (body: AdminPasswordLoginBody) => api.post<Me>("/auth/admin-password", body),
    onSuccess,
    onError: () => setPassword(""),
  });

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const u = username.trim();
    const errs = { username: u ? undefined : "Enter your username.", password: password ? undefined : "Enter your password." };
    setFieldError(errs);
    if (errs.username || errs.password) return;
    login.mutate({ username: u, password });
  };

  const message = login.isError
    ? isApiStatus(login.error, 401)
      ? "Incorrect username or password."
      : isApiStatus(login.error, 429)
        ? "Too many failed attempts. Please wait 15 minutes and try again."
        : errorMessage(login.error)
    : null;

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className="sr-only">
        Sign in with username and password
      </p>
      <Input
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={fieldError.username}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldError.password}
      />
      <Button type="submit" block size="lg" loading={login.isPending}>
        Sign in
      </Button>
      {message && <ErrorNote>{message}</ErrorNote>}
    </form>
  );
}

export default PasswordLoginForm;
