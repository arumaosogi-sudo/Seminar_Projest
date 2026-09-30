import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Me } from "@shared/contract";
import { api } from "@/lib/api";
import { meKey } from "@/lib/auth";
import { Button, ErrorNote, Input } from "@/components/ui";
import { AuthShell, CardChip } from "@/components/student/AuthShell";
import { RequireStudent, useStudentMe } from "@/components/student/RequireStudent";
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
      <h2 className="mt-5 text-[28px] font-bold tracking-tight">Welcome!</h2>
      <p className="mt-1.5 text-[15px] text-muted">Tell us your first name to get started.</p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <Input label="Student ID" name="studentCode" value={me.student.studentCode} readOnly hint="from your email" />
        <Input
          label="First name"
          name="firstName"
          autoFocus
          required
          maxLength={MAX_NAME}
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          error={fieldError}
        />
        {save.isError && <ErrorNote>{describeAuthError(save.error)}</ErrorNote>}
        <Button type="submit" size="lg" block loading={save.isPending}>
          Continue
        </Button>
        <p className="text-center text-xs text-muted">Your teacher sees this name with your scores.</p>
      </form>
    </AuthShell>
  );
}
