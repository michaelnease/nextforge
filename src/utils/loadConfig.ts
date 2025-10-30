import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export type NextForgeConfig = {
  useTailwind?: boolean;
  useChakra?: boolean;
  defaultLayout?: string;
  pagesDir?: string;
};

function evaluateObjectLiteral(source: string): unknown {
  const trimmed = source.trim().replace(/;\s*$/, "");
  const wrapped = `(${trimmed})`;
  return vm.runInNewContext(wrapped, {}, { timeout: 50 });
}

function tryLoadFromText(filePath: string): NextForgeConfig | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    // Handle ESM default export: export default {...}
    const esmMatch = raw.match(/export\s+default\s+([\s\S]*)/);
    if (esmMatch && esmMatch[1]) {
      const obj = evaluateObjectLiteral(esmMatch[1]);
      if (obj && typeof obj === "object") return obj as NextForgeConfig;
    }

    // Handle CommonJS: module.exports = {...}
    const cjsMatch = raw.match(/module\.exports\s*=\s*([\s\S]*)/);
    if (cjsMatch && cjsMatch[1]) {
      const obj = evaluateObjectLiteral(cjsMatch[1]);
      if (obj && typeof obj === "object") return obj as NextForgeConfig;
    }

    // Handle CommonJS named default: exports.default = {...}
    const cjsDefaultMatch = raw.match(/exports\.default\s*=\s*([\s\S]*)/);
    if (cjsDefaultMatch && cjsDefaultMatch[1]) {
      const obj = evaluateObjectLiteral(cjsDefaultMatch[1]);
      if (obj && typeof obj === "object") return obj as NextForgeConfig;
    }
  } catch {
    // swallow and return null
  }
  return null;
}

export function loadConfig(): NextForgeConfig {
  const cwd = process.cwd();
  const configPaths = [
    path.join(cwd, "nextforge.config.ts"),
    path.join(cwd, "nextforge.config.js"),
    path.join(cwd, "nextforge.config.mjs"),
    path.join(cwd, "nextforge.config.cjs"),
    path.join(cwd, "nextforge.config.json"),
  ];

  for (const configPath of configPaths) {
    if (!fs.existsSync(configPath)) continue;

    // JSON can be parsed directly
    if (configPath.endsWith(".json")) {
      try {
        const json = fs.readFileSync(configPath, "utf8");
        const obj = JSON.parse(json);
        console.log("🧩 Loaded NextForge config:", obj);
        return obj as NextForgeConfig;
      } catch {
        // fall through to defaults
        break;
      }
    }

    // Try to load JS/TS by simple textual extraction of the exported object
    const fromText = tryLoadFromText(configPath);
    if (fromText) {
      console.log("🧩 Loaded NextForge config:", fromText);
      return fromText;
    }
  }

  const defaults: NextForgeConfig = {
    useTailwind: true,
    useChakra: false,
    defaultLayout: "main",
    pagesDir: "app",
  };
  console.log("🧩 Loaded NextForge config:", defaults);
  return defaults;
}
