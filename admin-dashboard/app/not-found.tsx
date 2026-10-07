import Link from "next/link";
export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <p className="text-6xl font-extrabold text-amber-brand">404</p>
        <p className="mt-2 font-semibold">This page took a wrong turn.</p>
        <Link href="/" className="mt-4 inline-block font-semibold underline">Back to dashboard</Link>
      </div>
    </div>
  );
}
