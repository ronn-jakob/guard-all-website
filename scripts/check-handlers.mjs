// Static guard for the guard-auth Edge Function.
//
// esbuild cannot catch an undefined global inside a handler (e.g. reading
// `body.status` after `body` was dropped from the signature), and the 401 boot
// smoke never executes a handler body. This script checks:
//   1. every handler that touches body/session/db declares it;
//   2. every router call passes every parameter the handler destructures.
//
// Run with: npm run check:handlers

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "supabase", "functions", "guard-auth");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

function declaredKeys(params) {
  return params
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(/[:=]/)[0].trim())
    .filter(Boolean);
}

function passedKeys(args) {
  return args
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(":")[0].trim())
    .filter(Boolean);
}

const signaturePattern =
  /export\s+(?:async\s+)?function\s+(\w+)\s*\(\s*\{([^}]*)\}/gs;

const problems = [];
const signatures = new Map();

const files = await walk(ROOT);
for (const file of files) {
  const text = await readFile(file, "utf8");
  if (file.endsWith("index.ts")) continue;

  const matches = [...text.matchAll(signaturePattern)];
  for (const match of matches) {
    const name = match[1];
    const params = match[2];
    const keys = declaredKeys(params);
    signatures.set(name, keys);

    const bodyStart = match.index + match[0].length;
    const nextExport = text.indexOf("\nexport ", bodyStart);
    const body =
      nextExport === -1 ? text.slice(bodyStart) : text.slice(bodyStart, nextExport);

    for (const binding of ["body", "session", "db"]) {
      const accessed = new RegExp(`\\b${binding}\\s*(?:\\.|\\[|\\?\\.)`).test(body);
      if (accessed && !keys.includes(binding)) {
        problems.push(
          `${relative(ROOT, file)}: ${name} reads '${binding}' but does not declare it`,
        );
      }
    }
  }
}

const router = await readFile(join(ROOT, "index.ts"), "utf8");
for (const match of router.matchAll(/return\s+(\w+)\(\{\s*([^}]*)\}\s*\)/gs)) {
  const name = match[1];
  const passed = passedKeys(match[2]);
  const declared = signatures.get(name);
  if (!declared) {
    problems.push(`index.ts: calls ${name} but no such exported handler was found`);
    continue;
  }
  for (const key of declared) {
    if (!passed.includes(key)) {
      problems.push(
        `index.ts: ${name} declares '${key}' but the call passes only: ${passed.join(", ") || "(nothing)"}`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error("Handler binding check failed:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`Handler binding check passed (${signatures.size} handlers).`);
