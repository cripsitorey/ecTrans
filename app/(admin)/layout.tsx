import Link from "next/link";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileText, Route } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/trips", label: "Bitácoras", icon: Route },
  { href: "/admin/documents", label: "Documentos", icon: FileText },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 flex-col border-r bg-muted/30 p-4 md:flex">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-primary">ecTrans</h1>
          <p className="text-xs text-muted-foreground">Consola administrativa</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Button variant="ghost" className="w-full justify-start">
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </Button>
            </Link>
          ))}
        </nav>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="outline" className="w-full" type="submit">
            Cerrar sesión
          </Button>
        </form>
      </aside>
      <div className="flex-1">
        <header className="flex items-center gap-2 border-b p-4 md:hidden">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href}>
              <Button variant="ghost" size="sm">
                {label}
              </Button>
            </Link>
          ))}
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
