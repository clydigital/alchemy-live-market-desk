import { isIntelligenceDatabaseConflict } from "./database-error.ts";

export async function persistOrReuseCanonicalArtifact<T>({
  readExisting,
  insert,
  isValid,
  missingMessage,
}: {
  readExisting: () => Promise<T | null>;
  insert: () => Promise<T>;
  isValid: (value: T) => boolean;
  missingMessage: string;
}) {
  const existing = await readExisting();
  if (existing !== null && isValid(existing)) {
    return { value: existing, reused: true as const };
  }

  try {
    const inserted = await insert();
    if (!isValid(inserted)) throw new Error(missingMessage);
    return { value: inserted, reused: false as const };
  } catch (error) {
    if (!isIntelligenceDatabaseConflict(error)) throw error;

    // A uniqueness conflict is only success if the competing transaction left
    // behind the exact canonical artifact this operation was trying to create.
    const winner = await readExisting();
    if (winner !== null && isValid(winner)) {
      return { value: winner, reused: true as const };
    }
    throw error;
  }
}
