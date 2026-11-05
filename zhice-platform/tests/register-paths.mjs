import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const target = new URL("../src/" + specifier.slice(2), import.meta.url);
    return { url: existsSync(fileURLToPath(target) + ".ts") ? target.href + ".ts" : target.href + "/index.ts", shortCircuit: true };
  }
  if (specifier.startsWith(".") && !path.extname(specifier)) { try { return nextResolve(specifier + ".ts", context); } catch { /* Standard resolution follows. */ } }
  return nextResolve(specifier, context);
} });
