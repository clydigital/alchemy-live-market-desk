import { captureFinraSensorMemory } from "./finra-sensor-memory";
import { persistSensorMemory } from "./sensor-memory-supabase";

export async function captureFinraSensorMemoryToSupabase(
  tradeDate: string | Date,
  symbols?: string[],
) {
  return captureFinraSensorMemory(tradeDate, symbols, {
    persist: persistSensorMemory,
  });
}
