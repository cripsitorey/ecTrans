import { getAdminTrips, getFilterOptions } from "@/lib/actions/trips";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TripsFilters } from "@/components/admin/TripsFilters";

interface PageProps {
  searchParams: {
    vehicleId?: string;
    driverId?: string;
    year?: string;
    month?: string;
  };
}

export default async function AdminTripsPage({ searchParams }: PageProps) {
  const now = new Date();
  const year = parseInt(searchParams.year ?? String(now.getFullYear()));
  const month = parseInt(searchParams.month ?? String(now.getMonth() + 1));

  const [trips, filters] = await Promise.all([
    getAdminTrips({
      vehicleId: searchParams.vehicleId,
      driverId: searchParams.driverId,
      year,
      month,
    }),
    getFilterOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bitácoras</h1>
        <p className="text-muted-foreground">
          Hoja de ruta digital — columnas originales
        </p>
      </div>

      <TripsFilters
        vehicles={filters.vehicles}
        drivers={filters.drivers}
        current={{ ...searchParams, year: String(year), month: String(month) }}
      />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Día</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Producto / No. Guía</TableHead>
              <TableHead>Empresa / Nombre</TableHead>
              <TableHead>Viáticos</TableHead>
              <TableHead>Diésel</TableHead>
              <TableHead>No. Fac</TableHead>
              <TableHead>Anticipo</TableHead>
              <TableHead>Novedades</TableHead>
              <TableHead>Conductor</TableHead>
              <TableHead>Placa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.map((trip) => (
              <TableRow key={trip.id}>
                <TableCell>{formatDate(trip.date)}</TableCell>
                <TableCell>{trip.origin ?? "—"}</TableCell>
                <TableCell>{trip.destination ?? "—"}</TableCell>
                <TableCell>{trip.productOrGuideNumber ?? "—"}</TableCell>
                <TableCell>{trip.clientNameOrCompany ?? "—"}</TableCell>
                <TableCell>{formatCurrency(trip.viaticos?.toString())}</TableCell>
                <TableCell>{formatCurrency(trip.diesel?.toString())}</TableCell>
                <TableCell>{trip.invoiceNumber ?? "—"}</TableCell>
                <TableCell>{formatCurrency(trip.advance?.toString())}</TableCell>
                <TableCell>{trip.notes ?? "—"}</TableCell>
                <TableCell>{trip.driver.fullName}</TableCell>
                <TableCell>{trip.vehicle.plate}</TableCell>
              </TableRow>
            ))}
            {trips.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground">
                  No hay viajes para el periodo seleccionado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
