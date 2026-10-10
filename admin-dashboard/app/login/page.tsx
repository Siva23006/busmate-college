"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Clock3, Lock, Mail, Navigation, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Brand } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ForgotPasswordModal } from "@/components/PasswordForms";
import { Button, Credit, ErrorBox, Field, Input, stagger } from "@/components/ui";
import { errorMessage } from "@/lib/api";

const ROUTE = "M-20 470 C 90 470, 120 330, 230 320 S 380 380, 430 260 S 520 90, 640 70";
const STOPS: [number, number][] = [[230, 320], [430, 260], [560, 105]];

const FEATURES = [
  { icon: Navigation, title: "Live bus map", text: "See every college bus move in real time." },
  { icon: Clock3, title: "Arrival estimates", text: "Next stop and college ETA for each bus." },
  { icon: BellRing, title: "Instant alerts", text: "Offline buses, weak GPS and overspeed." },
];

export default function LoginPage() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

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
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel with the animated route motif */}
      <div className="relative hidden overflow-hidden bg-ink-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px" }} />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 600 560" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden>
          <path d={ROUTE} stroke="#F5B301" strokeOpacity="0.14" strokeWidth="16" strokeLinecap="round" />
          <path id="login-route" d={ROUTE} stroke="#F5B301" strokeWidth="2.5" className="route-dash" />
          {STOPS.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="11" fill="#F5B301" fillOpacity="0.15" className="anim-fade-in" style={stagger(i + 2, 200)} />
              <circle cx={x} cy={y} r="5" fill="#0C1322" stroke="#F5B301" strokeWidth="2.5" />
            </g>
          ))}
          <g className="motion-reduce:hidden">
            <circle r="7" fill="#F5B301">
              <animateMotion dur="9s" repeatCount="indefinite" rotate="auto"><mpath href="#login-route" /></animateMotion>
            </circle>
            <circle r="14" fill="#F5B301" fillOpacity="0.25">
              <animateMotion dur="9s" repeatCount="indefinite"><mpath href="#login-route" /></animateMotion>
            </circle>
          </g>
        </svg>

        <div className="relative anim-fade-up"><Brand size={40} inverted /></div>

        <div className="relative max-w-md">
          <h1 className="anim-fade-up text-[32px] font-extrabold leading-[1.15] tracking-tight" style={stagger(1, 80)}>
            Know your bus.<br /><span className="text-amber-brand">Know your time.</span>
          </h1>
          <p className="anim-fade-up mt-3 text-sm text-slate-400" style={stagger(2, 80)}>
            Live tracking, arrival estimates and fleet management for your college buses, in one place.
          </p>
          <ul className="mt-6 space-y-3">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="anim-fade-up flex items-start gap-3" style={stagger(i + 3, 80)}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-amber-brand ring-1 ring-white/10"><Icon className="h-4 w-4" /></span>
                <span>
                  <span className="block text-[13px] font-semibold">{title}</span>
                  <span className="block text-xs text-slate-400">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Credit className="relative text-slate-500" />
      </div>

      {/* Sign-in form */}
      <div className="relative flex flex-col p-6">
        <div className="flex items-center justify-between">
          <span className="lg:hidden"><Brand size={34} /></span>
          <span className="hidden lg:block" />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <form onSubmit={onSubmit} className="anim-fade-up w-full max-w-[360px]">
            <div className="mb-6">
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary-text">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin portal
              </span>
              <h2 className="text-[22px] font-bold tracking-tight">Sign in to BusMate</h2>
              <p className="text-muted mt-1 text-[13px]">Monitor buses, routes and trips for your college.</p>
            </div>
            <div className="space-y-4">
              {error && <ErrorBox message={error} />}
              <Field label="Email or username">
                <div className="relative">
                  <Mail className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input className="h-10 pl-9" type="text" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required placeholder="admin@college.edu" />
                </div>
              </Field>
              <Field label="Password">
                <div className="relative">
                  <Lock className="text-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input className="h-10 pl-9" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
                </div>
              </Field>
              <Button type="submit" loading={busy} className="h-10 w-full">Sign in</Button>
              <button type="button" onClick={() => setForgotOpen(true)} className="block w-full text-center text-[13px] font-semibold text-primary-text hover:underline">Forgot password?</button>
              <p className="text-muted text-center text-xs">Only college administrators can sign in here. Drivers and students use the BusMate mobile apps.</p>
            </div>
          </form>
        </div>
        <Credit className="text-subtle text-center lg:hidden" />
        {forgotOpen && <ForgotPasswordModal open onClose={() => setForgotOpen(false)} initialId={identifier} />}
      </div>
    </div>
  );
}
