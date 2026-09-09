import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: pathToFileURL(
        path.join(
          root,
          "node_modules",
          "next",
          "dist",
          "compiled",
          "server-only",
          "empty.js",
        ),
      ).href,
    };
  }
  if (specifier.startsWith("next/") && !path.extname(specifier)) {
    return nextResolve(`${specifier}.js`, context);
  }
  if (specifier.startsWith(".") && !path.extname(specifier) && context.parentURL) {
    const candidate = fileURLToPath(new URL(specifier, context.parentURL));
    const resolved = [`${candidate}.ts`, `${candidate}.tsx`, path.join(candidate, "index.ts")]
      .find((value) => existsSync(value));
    if (resolved) return { shortCircuit: true, url: pathToFileURL(resolved).href };
  }
  if (!specifier.startsWith("@/")) return nextResolve(specifier, context);

  const candidate = path.join(root, specifier.slice(2));
  const resolved = [candidate, `${candidate}.ts`, `${candidate}.tsx`, path.join(candidate, "index.ts")]
    .find((value) => existsSync(value));
  return resolved
    ? { shortCircuit: true, url: pathToFileURL(resolved).href }
    : nextResolve(specifier, context);
}
