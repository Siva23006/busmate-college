"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "@/components/Logo";
import { Button, ErrorBox, Field, Input } from "@/components/ui";
import { errorMessage } from "@/lib/api";

export default function LoginPage() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (ready && user) router.replace("/"); }, [ready, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(identifier.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <div>
            <div className="text-xl font-extrabold tracking-wide">BUSMATE</div>
            <div className="text-xs uppercase tracking-[0.2em] text-amber-brand">Smart College Transport</div>
          </div>
        </div>
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">Know your bus.<br /><span className="text-amber-brand">Know your time.</span></h1>
          <p className="mt-4 max-w-md text-slate-400">Live tracking, estimated arrivals and fleet management for your college buses, in one place.</p>
        </div>
        <svg className="absolute -right-24 bottom-10 h-[420px] w-[420px] opacity-20" viewBox="0 0 200 200" fill="none" aria-hidden>
          <path d="M10 180 C 60 120, 40 80, 100 70 S 170 40, 190 10" stroke="#F5B301" strokeWidth="3" strokeDasharray="8 8" />
          {[[10, 180], [100, 70], [190, 10]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="7" fill="#F5B301" />)}
        </svg>
        <p className="text-xs text-slate-500">College transportation technology prototype.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden"><Logo size={44} /></div>
          <div>
            <h2 className="text-2xl font-bold">Administrator login</h2>
            <p className="text-muted mt-1 text-sm">Sign in to monitor buses, routes and trips.</p>
          </div>
          {error && <ErrorBox message={error} />}
          <Field label="Email">
            <div className="relative">
              <Mail className="text-muted absolute left-3 top-2.5 h-4 w-4" />
              <Input className="pl-9" type="text" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required placeholder="admin@college.edu" />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <Lock className="text-muted absolute left-3 top-2.5 h-4 w-4" />
              <Input className="pl-9" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </Field>
          <Button type="submit" loading={busy} className="w-full py-2.5">LOGIN</Button>
        </form>
      </div>
    </div>
  );
}
