#!/usr/bin/env node
/**
 * Scans git-tracked files for secret-looking values and verifies that local
 * credential files are ignored. Exits non-zero when a finding is present.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";

const root = resolve(import.meta.dirname, "..");
const patterns = [
  { name: "PBKDF2 hash", regex: /pbkdf2-sha256\$\d{6}\$[A-Za-z0-9+/=]{10,}/ },
  { name: "GitHub token", regex: /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})\b/ },
  { name: "Cloudflare API token", regex: /\b[A-Za-z0-9_-]{40}\b(?=[\s\S]{0,80}cloudflare)/i },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Private key block", regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "Generic secret assignment", regex: /(api[_-]?token|client[_-]?secret|password)\s*[:=]\s*["'][^"'\s]{16,}["']/i },
];

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

const hasGit = existsSync(resolve(root, ".git"));
function sourceFiles(directory = root) {
  const excluded = new Set([".git", "node_modules", ".wrangler", "secrets", "dist", "release", "test-results", "playwright-report"]);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink() || excluded.has(entry.name) || entry.name === ".dev.vars" || /^\.env(?:\.|$)/.test(entry.name)) return [];
    const absolute = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(absolute) : [relative(root, absolute)];
  });
}
// A Drive/source archive intentionally has no Git metadata. It must still be
// possible to run the same source scan without initializing a repository.
const files = hasGit ? git(["ls-files", "-z"]).split("\0").filter(Boolean) : sourceFiles();
const findings = [];

for (const file of files) {
  const absolute = resolve(root, file);
  let stat;
  try {
    stat = statSync(absolute);
  } catch {
    continue;
  }
  if (!stat.isFile() || stat.size > 1_000_000) continue;
  if (/\.(png|jpg|jpeg|gif|webp|ico|woff2?|pdf|zip)$/i.test(file)) continue;
  let content;
  try {
    content = readFileSync(absolute, "utf8");
  } catch {
    continue;
  }
  for (const pattern of patterns) {
    const match = content.match(pattern.regex);
    if (match) {
      findings.push(`${file}: ${pattern.name}`);
    }
  }
}

for (const ignored of [".dev.vars", "secrets/owner-credentials.txt"]) {
  try {
    if (hasGit) git(["check-ignore", "-q", ignored]);
    else {
      const rules = readFileSync(resolve(root, ".gitignore"), "utf8").split(/\r?\n/).map(line => line.trim());
      if (!rules.includes(ignored) && !(ignored.startsWith("secrets/") && rules.includes("secrets/"))) throw new Error("Missing ignore rule");
    }
  } catch {
    findings.push(`${ignored}: not ignored by git`);
  }
}

if (findings.length > 0) {
  console.error("Secret scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log(`Secret scan passed: ${files.length} ${hasGit ? "tracked" : "archive source"} files checked, credential files ignored.`);
