import Link from "next/link";
import { AuthNav } from "@/components/auth/AuthNav";

export function AppNavbar() {
  return (
    <header className="border-b">
      <div className="flex h-14 items-center justify-between px-6">
        <Link href="/" className="font-semibold">
          Architecta
        </Link>

        <AuthNav />
      </div>
    </header>
  );
}
