import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { safeOwnerReturnPath } from "../lib/supabase/owner-return-path.ts";

test("Google OAuth returns to an internal owner route and preserves valid deep links", () => {
  assert.equal(safeOwnerReturnPath(null), "/owner/live");
  assert.equal(safeOwnerReturnPath(""), "/owner/live");
  assert.equal(safeOwnerReturnPath("/"), "/");
  assert.equal(safeOwnerReturnPath("/owner/live"), "/owner/live");
  assert.equal(safeOwnerReturnPath("/dossier?edition=abc#test"), "/dossier?edition=abc#test");
  assert.equal(safeOwnerReturnPath("/owner/live?source=https%3A%2F%2Fexample.com"), "/owner/live?source=https%3A%2F%2Fexample.com");
});

test("Google OAuth never redirects a completed login to an external host", () => {
  for (const raw of [
    "https://example.org", "http://example.org", "//example.org",
    "/\\example.org", "/\\\\example.org", "/\t/example.org", "/\n/example.org",
    "/%5cexample.org", "/%5Cexample.org", "/%2fexample.org", "/%2Fexample.org",
    "/%0dexample.org", "/auth/callback?next=%2Fowner%2Flive",
    "/auth/google", "/auth/signout", "/login?next=%2Fowner%2Flive",
    "javascript:alert(1)", " owner/live", "/" + "a".repeat(2100),
  ]) {
    assert.equal(safeOwnerReturnPath(raw), "/owner/live", JSON.stringify(raw));
  }
});

test("login, OAuth start and code exchange all enforce the same return-path boundary", () => {
  for (const path of [
    "../app/login/page.tsx",
    "../app/auth/google/route.ts",
    "../app/auth/callback/route.ts",
  ]) {
    const contents = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(contents, /safeOwnerReturnPath\(rawNext\)/, path);
    assert.doesNotMatch(contents, /rawNext\.startsWith\("\/"\)/, path);
  }
  const callback = readFileSync(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(callback, /\.eq\("active", true\)/);
  assert.match(callback, /await supabase\.auth\.signOut\(\)/);
  assert.match(callback, /return NextResponse\.redirect\(new URL\(next, requestUrl\.origin\)\)/);
});
