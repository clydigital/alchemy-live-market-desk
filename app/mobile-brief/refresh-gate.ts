/**
 * Controls in-flight browser refreshes of the read-only Mobile Intelligence Brief.
 *
 * A later request supersedes the prior one, while unmount cancels outstanding
 * work. This prevents React Strict Mode's effect replay or a rapid refresh
 * from replacing a newer, verified Dossier with an older response.
 */
export function createLatestMobileBriefRequestGate() {
  let active: AbortController | null = null;

  return {
    begin(): AbortController {
      active?.abort();
      active = new AbortController();
      return active;
    },

    isCurrent(request: AbortController): boolean {
      return active === request && !request.signal.aborted;
    },

    cancel(): void {
      active?.abort();
      active = null;
    },
  };
}
