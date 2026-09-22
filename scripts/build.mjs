#!/usr/bin/env node
/**
 * playhtml.fun OTTv2 — build tĩnh để deploy lên Vercel.
 * ------------------------------------------------------------------
 * Trang này là site tĩnh thuần (không backend): chỉ có 4 file công khai.
 * Vercel chỉ cần phục vụ đúng 4 file đó, nên script này gom chúng vào
 * `dist/` và KHÔNG publish các file nội bộ:
 *
 *   server.mjs, game.test.js, package.json, README.md, .gitignore
 *
 * Danh sách công khai ở đây phải khớp với `publicFiles` trong server.mjs.
 *
 * Chạy: npm run build
 */

import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

/** Khớp đúng `publicFiles` trong server.mjs — chỉ 4 file này được publish. */
const PUBLIC_FILES = ["index.html", "style.css", "app.js", "game.js"];

async function main() {
    console.log("\n\u25b6 Build t\u0129nh cho Vercel (playhtml.fun OTTv2)\n");

    await rm(DIST, { recursive: true, force: true });
    await mkdir(DIST, { recursive: true });

    for (const name of PUBLIC_FILES) {
        await copyFile(path.join(ROOT, name), path.join(DIST, name));
        console.log(`  \u2713 ${name}`);
    }

    // Chốt chặn: không để file nội bộ nào lọt vào dist/.
    const built = (await readdir(DIST)).sort();
    const expected = [...PUBLIC_FILES].sort();
    const missing = expected.filter((f) => !built.includes(f));
    const leaked = built.filter((f) => !expected.includes(f));

    if (missing.length || leaked.length) {
        if (missing.length) console.error(`\n\u2716 Thi\u1ebfu file: ${missing.join(", ")}`);
        if (leaked.length)
            console.error(
                `\u2716 File ngo\u00e0i danh s\u00e1ch trong dist/: ${leaked.join(", ")}`,
            );
        process.exitCode = 1;
        return;
    }

    console.log(
        `\n\u2714 dist/ c\u00f3 \u0111\u00fang ${built.length} file c\u00f4ng khai: ${built.join(", ")}\n`,
    );
}

main().catch((err) => {
    console.error("\n\u2716 Build l\u1ed7i:", err.message);
    process.exitCode = 1;
});
