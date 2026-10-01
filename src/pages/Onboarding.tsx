import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Me } from "@shared/contract";
import { api } from "@/lib/api";
import { meKey } from "@/lib/auth";
import { cx, ErrorNote, Spinner } from "@/components/ui";
import { AuthShell, CardChip } from "@/components/student/AuthShell";
import { RequireStudent, useStudentMe } from "@/components/student/RequireStudent";
import { useDocumentTitle } from "@/components/student/useDocumentTitle";
import { describeAuthError, safeRedirect } from "@/components/student/authHelpers";

const MAX_NAME = 60;

export default function Onboarding() {
  return (
    <RequireStudent allowOnboarding>
      <OnboardingForm />
    </RequireStudent>
  );
}

function OnboardingForm() {
  const me = useStudentMe();
  useDocumentTitle("Welcome");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const from = safeRedirect((location.state as { from?: unknown } | null)?.from);
  const [firstName, setFirstName] = useState(me.student.firstName ?? "");
  const [fieldError, setFieldError] = useState<string | undefined>();

  const save = useMutation({
    mutationFn: (name: string) => api.patch<unknown>("/me", { firstName: name }),
    onSuccess: async (_data, name) => {
      // Optimistically mark onboarding done so the guard doesn't bounce back before the refetch lands.
      qc.setQueryData<Me | null>(meKey, (prev) =>
        prev?.role === "student" ? { ...prev, student: { ...prev.student, firstName: name, needsOnboarding: false } } : prev,
      );
      await qc.invalidateQueries({ queryKey: meKey });
      navigate(from, { replace: true });
    },
  });

  // Returning student who already has a name (e.g. pressed Back) → nothing to do here.
  if (!me.student.needsOnboarding && !save.isPending && !save.isSuccess) return <Navigate to={from} replace />;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = firstName.trim().replace(/\s+/g, " ");
    if (!name) return setFieldError("Please enter your first name.");
    if (name.length > MAX_NAME) return setFieldError(`Please keep it under ${MAX_NAME} characters.`);
    setFieldError(undefined);
    save.mutate(name);
  };

  return (
    <AuthShell>
      <CardChip>Step 2 of 2</CardChip>
      <h2 className="mt-3.5 text-[22px] font-semibold leading-7 text-ink">Welcome!</h2>
      <p className="mt-[5px] text-[15px] leading-[22px] text-muted">Tell us your first name to get started.</p>

      <form onSubmit={submit} noValidate className="mt-4">
        <p className="text-[13px] font-semibold leading-[18px] text-ink" id="student-id-label">
          Student ID
        </p>
        <div
          aria-labelledby="student-id-label"
          className="mt-2.5 flex h-[46px] items-center justify-between gap-3 rounded-xl bg-[#f0f0f2] px-[15px]"
        >
          <span className="text-[15px] text-muted">{me.student.studentCode}</span>
          <span className="text-[12px] text-faint">from your email</span>
        </div>

        <label htmlFor="firstName" className="mt-3 block text-[13px] font-semibold leading-[18px] text-ink">
          First name
        </label>
        <input
          id="firstName"
          name="firstName"
          autoFocus
          required
          maxLength={MAX_NAME}
          autoComplete="given-name"
          placeholder="e.g. Somchai"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? "firstName-error" : undefined}
          className={cx(
            "mt-3 h-11 w-full rounded-[11px] border bg-surface px-[15px] text-[15px] text-ink outline-none transition-colors placeholder:text-faint focus:border-gray-800",
            fieldError ? "border-danger" : "border-zinc-300",
          )}
        />
        {fieldError && (
          <p id="firstName-error" className="mt-1 text-xs text-danger">
            {fieldError}
          </p>
        )}
        {save.isError && (
          <div className="mt-3">
            <ErrorNote>{describeAuthError(save.error)}</ErrorNote>
          </div>
        )}
        <button
          type="submit"
          disabled={save.isPending}
          className="mt-[19px] flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gray-800 text-[15px] font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-60"
        >
          {save.isPending && <Spinner className="size-4" />}
          Continue
        </button>
        <p className="mt-[15px] text-[12px] leading-4 text-muted">Your teacher sees this name with your scores.</p>
      </form>
    </AuthShell>
  );
}
