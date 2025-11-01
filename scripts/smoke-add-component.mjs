// Run: node scripts/smoke-add-component.mjs
// Smoke test for add:component command across different config variants
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stdout, stderr }));
      resolve({ stdout, stderr });
    });
  });
}

function assertFileExists(filePath, description) {
  return fs
    .access(filePath)
    .then(() => {
      console.log(`✓ ${description}: ${path.basename(filePath)}`);
      return true;
    })
    .catch(() => {
      console.error(`✗ Missing ${description}: ${filePath}`);
      throw new Error(`Required file missing: ${filePath}`);
    });
}

async function testConfig(name, config, variantDir) {
  console.log(`\n📦 Testing ${name} config...`);
  const binPath = path.resolve(process.cwd(), "bin", "nextforge.js");

  await fs.writeFile(
    path.join(variantDir, "nextforge.config.json"),
    JSON.stringify(config, null, 2)
  );
  await fs.mkdir(path.join(variantDir, "app"), { recursive: true });

  const args = [
    binPath,
    "add:component",
    "Button",
    "--group",
    "ui",
    "--client",
    "--with-tests",
    "--app",
    "app",
  ];

  try {
    const { stdout, stderr } = await run(process.execPath, args, { cwd: variantDir });
    if (stdout) {
      process.stdout.write(stdout);
    }
    if (stderr) {
      process.stderr.write(stderr);
    }
  } catch (err) {
    console.error(`\nCLI failed: ${err.message}`);
    if (err.stdout) {
      console.error(`stdout:\n${err.stdout}`);
    }
    if (err.stderr) {
      console.error(`stderr:\n${err.stderr}`);
    }
    throw err;
  }

  // Assert files exist
  const componentPath = path.join(variantDir, "app", "components", "ui", "Button", "Button.tsx");
  const indexPath = path.join(variantDir, "app", "components", "ui", "Button", "index.ts");
  const testPath = path.join(variantDir, "app", "components", "ui", "Button", "Button.test.tsx");

  await assertFileExists(componentPath, "Component file");
  await assertFileExists(indexPath, "Index file");
  await assertFileExists(testPath, "Test file");

  // Assert content
  const componentCode = await fs.readFile(componentPath, "utf8");
  if (!componentCode.startsWith('"use client"')) {
    throw new Error("Component missing 'use client' directive");
  }

  console.log(`✓ ${name} config: All files created correctly`);
}

async function main() {
  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), "nextforge-smoke-"));
  console.log("Temp workspace base:", tmpBase);

  try {
    // Test Tailwind variant
    const tailwindDir = path.join(tmpBase, "tailwind");
    await fs.mkdir(tailwindDir, { recursive: true });
    await testConfig(
      "Tailwind",
      { useTailwind: true, useChakra: false, pagesDir: "app" },
      tailwindDir
    );

    // Test Chakra variant
    const chakraDir = path.join(tmpBase, "chakra");
    await fs.mkdir(chakraDir, { recursive: true });
    await testConfig("Chakra", { useTailwind: false, useChakra: true, pagesDir: "app" }, chakraDir);

    // Test both-on variant
    const bothDir = path.join(tmpBase, "both");
    await fs.mkdir(bothDir, { recursive: true });
    await testConfig("Both", { useTailwind: true, useChakra: true, pagesDir: "app" }, bothDir);

    console.log("\n✅ All smoke tests passed!");
  } catch (err) {
    console.error("\n❌ Smoke test failed:", err.message);
    process.exit(1);
  } finally {
    // Cleanup
    await fs.rm(tmpBase, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
