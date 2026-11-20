import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const debDir = join(root, "src-tauri/target/release/bundle/deb");
const { productName, version } = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"));
const currentPrefix = `${productName}_${version}_`;

const build = spawnSync("pnpm", ["tauri", "build", "--bundles", "deb"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

for (const entry of readdirSync(debDir)) {
  if (entry.startsWith(currentPrefix)) continue;
  rmSync(join(debDir, entry), { recursive: true, force: true });
  console.log(`Removed old bundle: ${entry}`);
}
