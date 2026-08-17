import { CameraCapture } from "@/components/driver/CameraCapture";
import { getDriverVehicle } from "@/lib/actions/trips";

export default async function CapturePage() {
  const vehicle = await getDriverVehicle();

  if (!vehicle) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p>No hay vehículo asignado. Contacte al administrador.</p>
      </div>
    );
  }

  return <CameraCapture vehicleId={vehicle.id} />;
}
