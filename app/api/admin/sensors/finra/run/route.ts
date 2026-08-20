import { handleManualFinraSensorRunWithDependencies } from "@/lib/manual-finra-sensor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleManualFinraSensorRunWithDependencies(request);
}
