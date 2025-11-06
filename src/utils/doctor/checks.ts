import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { satisfies } from "semver";

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
  details?: string;
  fix?: string[];
}

export interface Check {
  id: string;
  title: string;
  run: (ctx: CheckContext) => Promise<CheckResult>;
}

function ok(msg: string, details?: string): CheckResult {
  const result: CheckResult = { status: "pass", message: msg };
  if (details) result.details = details;
  return result;
}

function warn(msg: string, opts?: { details?: string; fix?: string[] }): CheckResult {
  const result: CheckResult = { status: "warn", message: msg };
  if (opts?.details) result.details = opts.details;
  if (opts?.fix) result.fix = opts.fix;
  return result;
}

function fail(msg: string, opts?: { details?: string; fix?: string[] }): CheckResult {
  const result: CheckResult = { status: "fail", message: msg };
  if (opts?.details) result.details = opts.details;
  if (opts?.fix) result.fix = opts.fix;
  return result;
}

/**
 * Detect if a package is locally installed using Node's module resolution
 */
function hasLocal(dep: string, cwd = process.cwd()): boolean {
  try {
    const require = createRequire(path.join(cwd, "package.json"));
    require.resolve(dep);
    return true;
  } catch {
    return false;
  }
}

export const nodeVersionCheck: Check = {
  id: "node-version",
  title: "Node.js version",
  async run(ctx: CheckContext) {
    const v = process.version.replace(/^v/, "");
    let range = ">=18.0.0";

    try {
      const pkgPath = path.join(ctx.cwd, "package.json");
      const pkgContent = await fs.readFile(pkgPath, "utf8");
      const pkg = JSON.parse(pkgContent);
      if (pkg.engines?.node) {
        range = pkg.engines.node;
      }
    } catch {
      // No package.json or can't parse it - use default
    }

    if (!satisfies(v, range)) {
      return fail(`Node ${v} does not satisfy engines.node "${range}"`, {
        fix: [
          `Upgrade Node.js to satisfy "${range}"`,
          `nvm install ${range.replace(">=", "")}`,
          `nvm use ${range.replace(">=", "")}`,
        ],
      });
    }

    return ok(`Node ${v} satisfies engines.node "${range}"`);
  },
};

export const tsxLoaderCheck: Check = {
  id: "tsx-loader",
  title: "NextForge config (tsx loader)",
  async run(ctx: CheckContext) {
    const cwd = ctx.cwd;
    const ts = path.join(cwd, "nextforge.config.ts");
    const mjs = path.join(cwd, "nextforge.config.mjs");
    const js = path.join(cwd, "nextforge.config.js");

    const present = await Promise.all(
      [ts, mjs, js].map(async (p) => {
        try {
          await fs.access(p);
          return p;
        } catch {
          return null;
        }
      })
    ).then((list) => list.filter(Boolean) as string[]);

    if (!present.length) return ok("No nextforge.config.* found");

    if (present.includes(ts)) {
      // TS config: require tsx locally installed
      if (!hasLocal("tsx", cwd)) {
        return fail("Found nextforge.config.ts but 'tsx' is not installed locally.", {
          fix: ["npm i -D tsx", "npx nextforge init --yes --force"],
        });
      }
      return ok("nextforge.config.ts with local 'tsx' detected.");
    }

    // ESM config: validate Node ESM mode when using .mjs or "type": "module"
    const firstConfig = present[0];
    return ok(`Using ${firstConfig ? path.basename(firstConfig) : "config file"}`);
  },
};

/**
 * Detect app directory with flexible fallbacks
 */
async function detectAppDir(
  cwd: string,
  preferred?: string
): Promise<{ found: string | null; all: string[] }> {
  const candidates: string[] = [];
  const pushIfDir = async (p: string) => {
    try {
      const stats = await fs.stat(p);
      if (stats.isDirectory()) candidates.push(p);
    } catch {
      // Directory doesn't exist
    }
  };

  // If user provided a preferred path, validate it
  if (preferred) {
    const resolved = path.resolve(cwd, preferred);
    await pushIfDir(resolved);
    return { found: candidates[0] ?? null, all: candidates };
  }

  // Check if Nx monorepo
  const nxJsonPath = path.join(cwd, "nx.json");
  let hasNx = false;
  try {
    await fs.access(nxJsonPath);
    hasNx = true;
  } catch {
    // Not an Nx workspace
  }

  if (hasNx) {
    // Lightweight globbing for Nx workspaces
    const appsDir = path.join(cwd, "apps");
    try {
      const apps = await fs.readdir(appsDir);
      for (const a of apps) {
        await pushIfDir(path.join(appsDir, a, "app"));
        await pushIfDir(path.join(appsDir, a, "src", "app"));
      }
    } catch {
      // apps directory doesn't exist
    }
  }

  // Try monorepo-lite defaults
  await pushIfDir(path.join(cwd, "app"));
  await pushIfDir(path.join(cwd, "src", "app"));

  return { found: candidates[0] ?? null, all: candidates };
}

export const appDirCheck: Check = {
  id: "app-dir",
  title: "Next.js app directory",
  async run(ctx: CheckContext) {
    const { found, all } = await detectAppDir(ctx.cwd, ctx.flags.app);

    if (!found) {
      // Check if this is a Next.js project before failing hard
      let isNextProject = false;
      try {
        const pkgPath = path.join(ctx.cwd, "package.json");
        const pkgContent = await fs.readFile(pkgPath, "utf8");
        const pkg = JSON.parse(pkgContent);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        isNextProject = Boolean(deps.next);
      } catch {
        // No package.json or can't read it
      }

      if (isNextProject) {
        return fail(
          "No Next.js app directory found. Pass --app <path> or create an app/ folder (or apps/<name>/app in Nx).",
          {
            fix: [
              "mkdir -p app",
              "mkdir -p src/app",
              "Or pass: --app <path>",
              "In Nx: mkdir -p apps/<name>/app",
            ],
          }
        );
      }

      // Not a Next.js project, so just warn
      return warn(
        "No Next.js app directory found (not a Next.js project or missing 'next' dependency)."
      );
    }

    // If multiple candidates found, warn and list them
    if (all.length > 1) {
      const relPaths = all.map((p) => path.relative(ctx.cwd, p));
      return warn(`Multiple app directories found. Using first: ${path.relative(ctx.cwd, found)}`, {
        details: `Found: ${relPaths.join(", ")}`,
        fix: [`Pass --app <path> to specify which one to use`],
      });
    }

    return ok(`Found app directory at ${path.relative(ctx.cwd, found)}`);
  },
};

export const zshQuotingCheck: Check = {
  id: "zsh-quoting",
  title: "zsh quoting issues",
  async run() {
    const shell = process.env.SHELL || "";
    if (!/zsh/.test(shell)) {
      return ok("Not running zsh");
    }

    // Check for setopt no_nomatch in .zshrc
    try {
      const home = process.env.HOME;
      if (home) {
        const zshrcPath = path.join(home, ".zshrc");
        const zshrc = await fs.readFile(zshrcPath, "utf8");
        if (/setopt\s+no_nomatch/.test(zshrc)) {
          return ok("zsh with no_nomatch configured; bracket args are safe.");
        }
      }
    } catch {
      // .zshrc unreadable or doesn't exist - treat as best-effort
    }

    return warn(
      'Detected zsh. Quote page args to avoid globbing: `--pages "signin,signup,[slug]"`',
      {
        fix: ['echo "setopt no_nomatch" >> ~/.zshrc', "Or always quote bracket arguments"],
      }
    );
  },
};

export function getChecks(): Check[] {
  return [nodeVersionCheck, tsxLoaderCheck, appDirCheck, zshQuotingCheck];
}
