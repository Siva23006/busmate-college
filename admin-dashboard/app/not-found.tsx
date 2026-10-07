import Link from "next/link";
import { Credit, RouteDash } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div className="anim-fade-up">
        <RouteDash className="mx-auto mb-4 h-14 w-56" />
        <p className="text-[44px] font-extrabold leading-none tracking-tight text-amber-brand">404</p>
        <p className="mt-2 text-[15px] font-semibold">This page took a wrong turn.</p>
        <p className="text-muted mt-1 text-[13px]">The link may be old, or the page was moved.</p>
        <Link href="/" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-primary-hover">Back to dashboard</Link>
        <Credit className="text-subtle mt-8" />
      </div>
    </div>
  );
}
