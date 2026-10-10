"use client";
// "Forgot password" (login page) and "Change password" (Settings).
// The server uses Firebase Authentication: it checks passwords and emails reset links.
import { useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { Button, ErrorBox, Field, Input, Modal } from "./ui";

export function ForgotPasswordModal({ open, onClose, initialId = "" }: { open: boolean; onClose: () => void; initialId?: string }) {
  const [identifier, setIdentifier] = useState(initialId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function close() {
    setDone(null);
    setError(null);
    onClose();
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!identifier.trim()) { setError("Enter your email or username."); return; }
    setBusy(true); setError(null);
    try {
      const res = await api<{ message: string }>("/auth/forgot-password", { method: "POST", body: { identifier: identifier.trim() } });
      setDone(res.message);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} title="Forgot password?" onClose={close}
      footer={done
        ? <Button onClick={close}>OK</Button>
        : <><Button variant="secondary" onClick={close}>Cancel</Button><Button loading={busy} onClick={() => send()}>Send reset link</Button></>}>
      {done ? (
        <div className="space-y-3 text-[13px]">
          <MailCheck className="h-10 w-10 text-green-600" />
          <p>{done}</p>
          <p className="text-muted">Open the link in the email, choose a new password, then sign in here with it.</p>
        </div>
      ) : (
        <form onSubmit={send} className="space-y-4">
          <p className="text-muted text-[13px]">Enter your email or username. We will email you a link to set a new password.</p>
          {error && <ErrorBox message={error} />}
          <Field label="Email or username">
            <Input autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="admin@college.edu" />
          </Field>
        </form>
      )}
    </Modal>
  );
}

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setOk(false);
    if (next.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (next !== confirm) { setError("The two new passwords do not match."); return; }
    setBusy(true); setError(null);
    try {
      await api("/me/password", { method: "PUT", body: { currentPassword: current, newPassword: next } });
      setOk(true); setCurrent(""); setNext(""); setConfirm("");
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      {error && <ErrorBox message={error} />}
      {ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-[13px] font-medium text-green-700 dark:bg-green-500/10 dark:text-green-300">Password changed.</p>}
      <Field label="Current password"><Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></Field>
      <Field label="New password" hint="At least 8 characters"><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
      <Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></Field>
      <Button type="submit" loading={busy}>Change password</Button>
    </form>
  );
}
