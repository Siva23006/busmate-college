"use client";
// My profile: the signed-in admin's own name, email and phone (GET/PUT /me), password, theme and logout.
import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, KeyRound, LogOut, Mail, Palette, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChangePasswordForm } from "@/components/PasswordForms";
import { meApi } from "@/services/busmate";
import { errorMessage } from "@/lib/api";
import type { User } from "@/types";
import { Badge, Button, Card, CardHeader, ErrorBox, Field, Input, PageHeader } from "@/components/ui";

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const [me, setMe] = useState<User | null>(user);
  const [form, setForm] = useState({ name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "" });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Fresh copy from the server (also gives "member since").
  useEffect(() => {
    let cancelled = false;
    meApi.get().then(({ user: u }) => {
      if (cancelled) return;
      setMe(u);
      setForm((f) => (dirty ? f : { name: u.name ?? "", email: u.email ?? "", phone: u.phone ?? "" }));
    }).catch(() => { /* keep the cached user */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setDirty(true);
    setSaved(false);
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name) { setError("Name cannot be empty."); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid email address, or leave it empty."); return; }
    setBusy(true); setError(null); setSaved(false);
    try {
      const { user: u } = await meApi.update({ name, email, phone: form.phone.trim() });
      setMe(u);
      updateUser(u);
      setForm({ name: u.name ?? "", email: u.email ?? "", phone: u.phone ?? "" });
      setDirty(false);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const shown = me ?? user;
  const name = shown?.name ?? "Admin";
  const initials = name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "A";
  const since = shown?.created_at ? new Date(shown.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null;

  return (
    <>
      <PageHeader title="My profile" subtitle="Your own administrator account: name, contact details, password and theme." />
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card delay={0} className="p-5 text-[13px]">
            <div className="flex flex-col items-center text-center">
              <span className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-primary to-indigo-500 text-2xl font-bold text-white shadow-[var(--shadow-md)]">{initials}</span>
              <div className="mt-3 text-lg font-bold tracking-tight">{name}</div>
              <div className="mt-1.5"><Badge tone="blue"><ShieldCheck className="h-3 w-3" /> Administrator</Badge></div>
            </div>
            <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">
              <div className="flex items-center gap-2.5"><Mail className="text-subtle h-3.5 w-3.5" /><span className="truncate">{shown?.email || <span className="text-muted">No email</span>}</span></div>
              <div className="flex items-center gap-2.5"><Phone className="text-subtle h-3.5 w-3.5" /><span>{shown?.phone || <span className="text-muted">No phone</span>}</span></div>
              {since && <div className="flex items-center gap-2.5"><CalendarDays className="text-subtle h-3.5 w-3.5" /><span className="text-muted">Member since {since}</span></div>}
            </div>
          </Card>
          <Card delay={1} className="space-y-3 p-5 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-medium"><Palette className="text-muted h-4 w-4" /> Theme</span>
              <ThemeToggle />
            </div>
            <Button variant="danger" className="w-full" onClick={logout}><LogOut className="h-4 w-4" /> Log out</Button>
          </Card>
        </div>

        <div className="space-y-4">
          <Card delay={2}>
            <CardHeader title="Account details" icon={UserRound} subtitle="Shown in the top bar and on records you change" />
            <form onSubmit={save} className="space-y-4 p-5 text-[13px]">
              {error && <ErrorBox message={error} />}
              {saved && <p className="anim-fade-in rounded-lg bg-green-50 px-3 py-2 font-medium text-green-700 dark:bg-green-500/10 dark:text-green-300">Profile saved.</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name"><Input value={form.name} onChange={set("name")} autoComplete="name" required /></Field>
                <Field label="Phone"><Input type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" placeholder="Optional" /></Field>
                <div className="sm:col-span-2">
                  <Field label="Email" hint="Used for “Forgot password” reset links. Leave empty to remove it (you then can't reset your password by email).">
                    <Input type="email" value={form.email} onChange={set("email")} autoComplete="email" placeholder="admin@college.edu" />
                  </Field>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" loading={busy} disabled={!dirty}>Save changes</Button>
                {dirty && !busy && (
                  <Button type="button" variant="ghost" onClick={() => {
                    setForm({ name: shown?.name ?? "", email: shown?.email ?? "", phone: shown?.phone ?? "" });
                    setDirty(false); setError(null);
                  }}>Undo</Button>
                )}
              </div>
            </form>
          </Card>

          <Card delay={3}>
            <CardHeader title="Change password" icon={KeyRound} subtitle="Forgot it? Log out and use “Forgot password?” on the sign-in page." />
            <div className="p-5 text-[13px]"><ChangePasswordForm /></div>
          </Card>
        </div>
      </div>
    </>
  );
}
