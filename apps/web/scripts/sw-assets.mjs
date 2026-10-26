// Runs after `next build`: lists every file of .next/static into
// .next/static/sw-assets-<build>.json, which the service worker precaches on install so the
// whole app — lazy dialogs and other routes' chunks included — works offline.
// <build> matches NEXT_PUBLIC_BUILD_ID in next.config.ts (the worker's ?v=).
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = new URL("../.next/static/", import.meta.url).pathname;
const build = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "dev").slice(0, 12);

const files = (await readdir(root, { recursive: true, withFileTypes: true }))
	.filter((f) => f.isFile() && !f.name.startsWith("sw-assets-") && !f.name.endsWith(".map"))
	.map((f) => `/_next/static/${path.relative(root, path.join(f.parentPath, f.name))}`)
	.sort();

await writeFile(path.join(root, `sw-assets-${build}.json`), JSON.stringify(files));
console.log(`sw-assets: ${files.length} files for build ${build}`);
