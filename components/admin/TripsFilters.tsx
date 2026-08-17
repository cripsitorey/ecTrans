"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface TripsFiltersProps {
  vehicles: { id: string; plate: string }[];
  drivers: { id: string; fullName: string }[];
  current: {
    vehicleId?: string;
    driverId?: string;
    year?: string;
    month?: string;
  };
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function TripsFilters({ vehicles, drivers, current }: TripsFiltersProps) {
  const router = useRouter();

  const apply = (formData: FormData) => {
    const params = new URLSearchParams();
    const vehicleId = formData.get("vehicleId") as string;
    const driverId = formData.get("driverId") as string;
    const year = formData.get("year") as string;
    const month = formData.get("month") as string;

    if (vehicleId) params.set("vehicleId", vehicleId);
    if (driverId) params.set("driverId", driverId);
    if (year) params.set("year", year);
    if (month) params.set("month", month);

    router.push(`/admin/trips?${params.toString()}`);
  };

  const now = new Date();

  return (
    <form action={apply} className="flex flex-wrap items-end gap-4 rounded-lg border p-4">
      <div>
        <Label htmlFor="vehicleId">Vehículo</Label>
        <select
          id="vehicleId"
          name="vehicleId"
          defaultValue={current.vehicleId ?? ""}
          className="mt-1 flex h-10 w-40 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="driverId">Conductor</Label>
        <select
          id="driverId"
          name="driverId"
          defaultValue={current.driverId ?? ""}
          className="mt-1 flex h-10 w-48 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.fullName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="month">Mes</Label>
        <select
          id="month"
          name="month"
          defaultValue={current.month ?? String(now.getMonth() + 1)}
          className="mt-1 flex h-10 w-36 rounded-md border border-input bg-background px-3 text-sm"
        >
          {MONTHS.map((name, i) => (
            <option key={name} value={String(i + 1)}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="year">Año</Label>
        <select
          id="year"
          name="year"
          defaultValue={current.year ?? String(now.getFullYear())}
          className="mt-1 flex h-10 w-28 rounded-md border border-input bg-background px-3 text-sm"
        >
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(
            (y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            )
          )}
        </select>
      </div>
      <Button type="submit">Filtrar</Button>
    </form>
  );
}
