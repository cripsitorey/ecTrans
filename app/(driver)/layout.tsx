import Link from "next/link";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Camera, List } from "lucide-react";

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-lg font-bold text-primary">ecTrans</span>
        <nav className="flex gap-2">
          <Link href="/capture">
            <Button variant="ghost" size="sm">
              <Camera className="mr-1 h-4 w-4" />
              Capturar
            </Button>
          </Link>
          <Link href="/trips">
            <Button variant="ghost" size="sm">
              <List className="mr-1 h-4 w-4" />
              Bitácora
            </Button>
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button variant="outline" size="sm" type="submit">
              Salir
            </Button>
          </form>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
