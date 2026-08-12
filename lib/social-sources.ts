import socialConfig from "../config/social-sources.json" with { type: "json" };

export interface SocialAccount {
  handle: string;
  displayName: string;
  sourceType: string;
  category: string;
  topics: string[];
  priority: string;
  evidenceClass: string;
  requiresCorroboration: boolean;
  enabled: boolean;
  lastChecked: string | null;
  lastSuccess: string | null;
}

export function getSocialWatchlist(): SocialAccount[] {
  return socialConfig.accounts as SocialAccount[];
}

export function matchSocialAccount(handleOrUrl: string | null | undefined): SocialAccount | null {
  if (!handleOrUrl) return null;
  const cleaned = handleOrUrl.toLowerCase().trim();
  const watchlist = getSocialWatchlist();

  // Try matching by handle directly
  for (const account of watchlist) {
    const handleLower = account.handle.toLowerCase();
    if (cleaned === handleLower || cleaned === `@${handleLower}`) {
      return account;
    }
  }

  // Try matching by URL path
  try {
    const url = new URL(handleOrUrl);
    if (url.hostname.includes("x.com") || url.hostname.includes("twitter.com")) {
      const pathParts = url.pathname.split("/").filter(Boolean);
      const firstPart = pathParts[0]?.toLowerCase();
      if (firstPart) {
        for (const account of watchlist) {
          if (firstPart === account.handle.toLowerCase()) {
            return account;
          }
        }
      }
    }
  } catch {
    // If not a valid URL, search if handle is a substring of the handleOrUrl
    for (const account of watchlist) {
      if (cleaned.includes(account.handle.toLowerCase())) {
        return account;
      }
    }
  }

  return null;
}
