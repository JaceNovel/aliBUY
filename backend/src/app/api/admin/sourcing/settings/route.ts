import { updateSourcingSettings } from "@/lib/sourcing-service";
import { getSourcingSettings } from "@/lib/sourcing-store";

export async function GET() {
  const settings = await getSourcingSettings();
  return Response.json({ settings });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const settings = await updateSourcingSettings({
    currencyCode: String(body?.currencyCode ?? "XOF"),
    airRatePerKgFcfa: Number(body?.airRatePerKgFcfa ?? 10000),
    airEstimatedDays: String(body?.airEstimatedDays ?? "5-10 jours"),
    seaRealCostPerCbmFcfa: Number(body?.seaRealCostPerCbmFcfa ?? 180000),
    seaSellRatePerCbmFcfa: Number(body?.seaSellRatePerCbmFcfa ?? 210000),
    seaEstimatedDays: String(body?.seaEstimatedDays ?? "20-40 jours"),
    freeAirThresholdFcfa: Number(body?.freeAirThresholdFcfa ?? 15000),
    freeAirEnabled: Boolean(body?.freeAirEnabled),
    airWeightThresholdKg: Number(body?.airWeightThresholdKg ?? 1),
    containerTargetCbm: Number(body?.containerTargetCbm ?? 1),
    defaultMarginMode: body?.defaultMarginMode === "fixed" ? "fixed" : "percent",
    defaultMarginValue: Number(body?.defaultMarginValue ?? 10),
  });

  return Response.json({ settings });
}