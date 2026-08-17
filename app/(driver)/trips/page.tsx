import { getDriverTrips } from "@/lib/actions/trips";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DriverTripsPage() {
  const trips = await getDriverTrips();

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">Mi bitácora</h1>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Día</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Viáticos</TableHead>
              <TableHead>Diésel</TableHead>
              <TableHead>No. Fac</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.map((trip) => (
              <TableRow key={trip.id}>
                <TableCell>{formatDate(trip.date)}</TableCell>
                <TableCell>{trip.origin ?? "—"}</TableCell>
                <TableCell>{trip.destination ?? "—"}</TableCell>
                <TableCell>{formatCurrency(trip.viaticos?.toString())}</TableCell>
                <TableCell>{formatCurrency(trip.diesel?.toString())}</TableCell>
                <TableCell>{trip.invoiceNumber ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
