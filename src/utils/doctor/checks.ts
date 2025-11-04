import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export interface CheckContext {
  cwd: string;
  flags: {
    app?: string;
    json?: boolean;
    fix?: boolean;
    ci?: boolean;
    deep?: boolean;
    verbose?: boolean;
  };
}

export interface CheckResult {
  status: "pass" | "warn" | "fail";
  message: string;
}

export interface Check {
  id: string;
  title: string;
  run: (ctx: CheckContext) => Promise<CheckResult>;
}

function ok(msg: string): CheckResult {
  return { status: "pass", message: msg };
}

function warn(msg: string): CheckResult {
  return { status: "warn", message: msg };
}

function fail(msg: string): CheckResult {
  return { status: "fail", message: msg };
}

export const nodeVersionCheck: Check = {
  id: "node-version",
  title: "Node.js version",
  async run() {
    const version = process.version;
    const versionParts = version.replace(/^v/, "").split(".");
    const major = parseInt(versionParts[0] ?? "0", 10);
    if (major < 18) {
      return fail(`Node ${version} is too old. Minimum 18 required.`);
    }
    return ok(`Running Node ${version}`);
  },
};

export const tsxLoaderCheck: Check = {
  id: "tsx-loader",
  title: "NextForge config (tsx loader)",
  async run(ctx: CheckContext) {
    const configTs = path.join(ctx.cwd, "nextforge.config.ts");
    try {
      await fs.access(configTs);
    } catch {
      return ok("No nextforge.config.ts found");
    }

    // Check for package.json
    const pkgPath = path.join(ctx.cwd, "package.json");
    let pkgContent: string;
    try {
      pkgContent = await fs.readFile(pkgPath, "utf8");
    } catch {
      // No package.json - this is fine for test workspaces
      return ok("nextforge.config.ts found but no package.json (test workspace?)");
    }

    try {
      const pkg = JSON.parse(pkgContent);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (!deps.tsx) {
        return fail("nextforge.config.ts found but 'tsx' not installed.");
      }

      // Try to verify tsx is actually installed
      // Check node_modules directly for cross-platform compatibility
      const nodeModulesPath = path.join(ctx.cwd, "node_modules", "tsx");
      try {
        await fs.access(nodeModulesPath);
        return ok("tsx dependency detected and working.");
      } catch {
        // Fallback: try to check via package manager (may fail in some environments)
        try {
          // Try pnpm first, then npm, then yarn
          let output = "";
          try {
            output = execSync("pnpm ls tsx --depth 0 --json", {
              cwd: ctx.cwd,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "ignore"],
            });
          } catch {
            try {
              output = execSync("npm ls tsx --depth 0 --json", {
                cwd: ctx.cwd,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "ignore"],
              });
            } catch {
              output = execSync("yarn list --pattern tsx --depth 0 --json", {
                cwd: ctx.cwd,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "ignore"],
              });
            }
          }

          if (output && output.includes("tsx")) {
            return ok("tsx dependency detected and working.");
          }
          return fail("tsx package not properly installed or incompatible.");
        } catch {
          // If all checks fail, assume it's installed if listed in package.json
          return warn("tsx listed in package.json but unable to verify installation.");
        }
      }
    } catch (err) {
      return fail(`Error verifying tsx: ${(err as Error).message}`);
    }
  },
};

export const appDirCheck: Check = {
  id: "app-dir",
  title: "Next.js app directory",
  async run(ctx: CheckContext) {
    // If user specified an app path, check only that
    if (ctx.flags.app) {
      const appPath = path.isAbsolute(ctx.flags.app)
        ? ctx.flags.app
        : path.join(ctx.cwd, ctx.flags.app);
      try {
        await fs.access(appPath);
        return ok(`Found app directory at ${ctx.flags.app}`);
      } catch {
        return fail(`App directory not found at ${ctx.flags.app}`);
      }
    }

    // Otherwise, check common locations
    const commonLocations = ["app", "apps/web/app", "src/app", "apps/next/app"];
    for (const loc of commonLocations) {
      const appPath = path.join(ctx.cwd, loc);
      try {
        await fs.access(appPath);
        return ok(`Found app directory at ${loc}`);
      } catch {
        // Continue to next location
      }
    }

    // Check if we're in a Next.js project context before warning
    let isNextProject = false;
    try {
      const pkgPath = path.join(ctx.cwd, "package.json");
      const pkgContent = await fs.readFile(pkgPath, "utf8");
      const pkg = JSON.parse(pkgContent);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      isNextProject = Boolean(deps.next);
    } catch {
      // No package.json or can't read it - assume not a Next.js project
    }

    // Only warn if we're in a Next.js project but no app directory found
    if (isNextProject) {
      return warn(
        `No app directory found in common locations (${commonLocations.join(", ")}). Use --app to specify.`
      );
    }

    // Not a Next.js project, so this check doesn't apply
    return ok("Not a Next.js project (no 'next' in package.json), skipping app directory check");
  },
};

export const zshQuotingCheck: Check = {
  id: "zsh-quoting",
  title: "zsh quoting issues",
  async run() {
    if (!process.env.SHELL?.includes("zsh")) {
      return ok("Not running zsh");
    }
    return warn(
      'Detected zsh. Remember to quote page args like: npx nextforge add:group auth --pages "signin,signup,[slug]"'
    );
  },
};

export function getChecks(): Check[] {
  return [nodeVersionCheck, tsxLoaderCheck, appDirCheck, zshQuotingCheck];
}
