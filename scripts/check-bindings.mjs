import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const generated = new URL("../src/git/bindings.ts", import.meta.url);
const current = readFileSync(generated, "utf8");
const expected = execFileSync("cargo", ["run", "-q", "-p", "git-gui-core", "--example", "bindings"], { encoding: "utf8" });

if (current !== expected) {
  console.error("Git bindings are out of date. Run pnpm bindings:generate.");
  process.exitCode = 1;
}
