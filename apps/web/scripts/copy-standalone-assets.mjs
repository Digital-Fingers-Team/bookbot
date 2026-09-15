import { cp, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copy the assets a standalone build leaves behind.
 *
 * `output: "standalone"` emits a self-contained server bundle but deliberately
 * omits `.next/static` and `public/`, expecting the deploy step to bring them
 * along. Miss that step and the server still starts and serves HTML, so the
 * failure looks like a styling bug rather than a missing build artefact: every
 * asset 404s and the site renders as unstyled markup with broken images.
 */
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = resolve(webRoot, ".next/standalone/apps/web");

const exists = async (path) => access(path).then(() => true, () => false);

if (!(await exists(standalone))) {
  console.log("[postbuild] no standalone output; nothing to copy.");
  process.exit(0);
}

for (const [from, to] of [
  [resolve(webRoot, ".next/static"), resolve(standalone, ".next/static")],
  [resolve(webRoot, "public"), resolve(standalone, "public")]
]) {
  if (!(await exists(from))) continue;
  await cp(from, to, { recursive: true, force: true });
  console.log(`[postbuild] copied ${from} -> ${to}`);
}
