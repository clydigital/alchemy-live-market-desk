import { handleProductionSchemaDriftWithDependencies } from "@/lib/production-schema-drift";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleProductionSchemaDriftWithDependencies(request);
}
