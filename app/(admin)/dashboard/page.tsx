import { getDashboardStats } from "@/lib/actions/trips";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const now = new Date();
  const stats = await getDashboardStats(
    now.getFullYear(),
    now.getMonth() + 1
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen del mes actual
        </p>
      </div>

      {(stats.needsReview > 0 || stats.incompleteTrips > 0) && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <h2 className="font-semibold text-yellow-900">Alertas</h2>
          <ul className="mt-2 space-y-1 text-sm text-yellow-800">
            {stats.needsReview > 0 && (
              <li>
                {stats.needsReview} documento(s) requieren revisión —{" "}
                <Link href="/admin/documents" className="underline">
                  Ver cola
                </Link>
              </li>
            )}
            {stats.incompleteTrips > 0 && (
              <li>{stats.incompleteTrips} viaje(s) con datos incompletos</li>
            )}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Viajes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.tripCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Diésel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(stats.totals.diesel)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Viáticos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(stats.totals.viaticos)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Anticipos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(stats.totals.advance)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por conductor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byDriver.map((d) => (
                <div key={d.name} className="flex justify-between text-sm">
                  <span>{d.name}</span>
                  <span className="text-muted-foreground">
                    D: {formatCurrency(d.diesel)} | V:{" "}
                    {formatCurrency(d.viaticos)}
                  </span>
                </div>
              ))}
              {stats.byDriver.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin datos</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por vehículo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byVehicle.map((v) => (
                <div key={v.plate} className="flex justify-between text-sm">
                  <span>{v.plate}</span>
                  <span className="text-muted-foreground">
                    D: {formatCurrency(v.diesel)} | V:{" "}
                    {formatCurrency(v.viaticos)}
                  </span>
                </div>
              ))}
              {stats.byVehicle.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin datos</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link href="/admin/documents">
          <Button>Revisar documentos</Button>
        </Link>
        <Link href="/admin/trips">
          <Button variant="outline">Ver bitácoras</Button>
        </Link>
      </div>
    </div>
  );
}
