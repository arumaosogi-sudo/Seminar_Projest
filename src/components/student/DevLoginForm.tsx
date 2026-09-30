import { useId, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import type { DevLoginBody, Me } from "@shared/contract";
import { api } from "@/lib/api";
import { useAppConfig } from "@/lib/auth";
import { Button, ErrorNote, Input } from "@/components/ui";
import { describeAuthError } from "./authHelpers";

export type DevLoginFormProps = {
  as: "student" | "admin";
  joinCode?: string;
  onSuccess: (me: Me) => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Developer mode" sign-in (POST /api/auth/dev). Renders nothing unless the server reports
 * `devLogin: true` (DEV_LOGIN=true in .dev.vars — never in production).
 * Props are part of the contract with the admin login page: keep them stable.
 */
export function DevLoginForm({ as, joinCode, onSuccess }: DevLoginFormProps) {
  const config = useAppConfig();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const inputId = useId();

  const login = useMutation({
    mutationFn: (body: DevLoginBody) => api.post<Me>("/auth/dev", body),
    onSuccess,
  });

  if (!config.data?.devLogin) return null;

  const placeholder = as === "admin" ? "instructor@mfu.ac.th" : `6531501234@${config.data.allowedStudentDomain || "lamduan.mfu.ac.th"}`;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setFieldError("Enter a full e-mail address.");
      return;
    }
    setFieldError(undefined);
    login.mutate({ email: value, joinCode, as });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4"
      aria-labelledby={`${inputId}-title`}
    >
      <p id={`${inputId}-title`} className="text-xs font-bold uppercase tracking-wide text-muted">
        Developer mode
      </p>
      <p className="mt-0.5 text-xs text-muted">Local testing only — type any allowed e-mail.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Input
            id={inputId}
            type="email"
            inputMode="email"
            autoComplete="off"
            aria-label="E-mail (developer sign-in)"
            placeholder={placeholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError}
          />
        </div>
        <Button type="submit" variant="outline" className="h-11 shrink-0" loading={login.isPending}>
          Sign in (dev)
        </Button>
      </div>
      {login.isError && (
        <div className="mt-3">
          <ErrorNote>{describeAuthError(login.error)}</ErrorNote>
        </div>
      )}
    </form>
  );
}

export default DevLoginForm;
