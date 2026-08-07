import { NextResponse } from "next/server";

import { getDeskData } from "@/lib/data";
import { CANONICAL_RESEARCH_SLOTS, getFourSlotResearchHealth } from "@/lib/research-schedule-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getDeskData();
  const health = getFourSlotResearchHealth(data.researchRuns);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Kuala_Lumpur",
    canonicalSlots: CANONICAL_RESEARCH_SLOTS.map((slot) => ({
      key: slot.key,
      label: slot.label,
      time: `${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`,
    })),
    health,
  }, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
