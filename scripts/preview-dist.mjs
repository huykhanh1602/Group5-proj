#!/usr/bin/env node
/**
 * OTTv2 - Preview / kiểm tra dist/ đúng như Vercel sẽ phục vụ file tĩnh.
 * ------------------------------------------------------------------
 * Vercel (static) tự phục vụ `index.html` cho URL kết thúc bằng '/',
 * nên script này mô phỏng đúng hành vi đó để nhóm tự tin trước khi push.
 *
 *   node scripts/preview-dist.mjs          # mở http://localhost:5000
 *   node scripts/preview-dist.mjs --check   # tự gọi thử vài URL rồi thoát
 *
 * Không phụ thuộc package nào (chỉ dùng module built-in của Node).
 */

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "dist");
const PORT = Number(process.env.PREVIEW_PORT || 5000);
const CHECK = process.argv.includes("--check");

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
};

/** Giải URL -> file thật trong dist/, mô phỏng directory index của Vercel. */
async function resolveFile(urlPath) {
    let rel = decodeURIComponent(urlPath.split("?")[0]);
    if (rel.endsWith("/")) rel += "index.html";

    const abs = path.join(DIST, rel);
    if (abs !== DIST && !abs.startsWith(DIST + path.sep)) return null; // chặn traversal

    try {
        const st = await stat(abs);
        return st.isDirectory() ? path.join(abs, "index.html") : abs;
    } catch {
        return null;
    }
}

const server = http.createServer(async (req, res) => {
    const file = await resolveFile(req.url || "/");
    if (!file) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 Not Found");
        return;
    }
    try {
        const body = await readFile(file);
        res.writeHead(200, {
            "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
        });
        res.end(body);
    } catch {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 Not Found");
    }
});

const CHECK_PATHS = [
    "/",
    "/local/",
    "/local/index.html",
    "/local/style.css",
    "/local/game.js",
    "/playhtml/",
    "/playhtml/index.html",
    "/playhtml/style.css",
    "/playhtml/app.js",
    "/multiplayer/",
    "/multiplayer/index.html",
    "/multiplayer/style.css",
    "/multiplayer/client.js",
    "/multiplayer/runtime-config.js",
    "/shared/gameLogic.js",
];

async function runCheck() {
    const base = `http://127.0.0.1:${PORT}`;
    let failed = 0;

    console.log(
        "\n\u25b6 Ki\u1ec3m tra HTTP dist/ (m\u00f4 ph\u1ecfng c\u00e1ch Vercel ph\u1ee5c v\u1ee5)\n",
    );

    for (const p of CHECK_PATHS) {
        const res = await fetch(base + p);
        const body = await res.text();
        const type = (res.headers.get("content-type") || "").split(";")[0];
        const ok = res.status === 200 && body.length > 0;
        if (!ok) failed++;
        console.log(
            `  ${ok ? "\u2713" : "\u2716"} ${res.status}  ${type.padEnd(24)} ${p}  (${body.length} bytes)`,
        );
    }

    console.log(
        `\n${failed === 0 ? "\u2714 PASS" : "\u2716 FAIL"} - ${CHECK_PATHS.length - failed}/${CHECK_PATHS.length} \u0111\u01b0\u1eddng d\u1eabn tr\u1ea3 200\n`,
    );
    return failed;
}

async function main() {
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(PORT, resolve);
    });

    if (!CHECK) {
        console.log(`\n\u25b6 Preview dist/ t\u1ea1i http://localhost:${PORT}`);
        console.log("  /            -> trang ch\u1ee7 ch\u1ecdn ch\u1ebf \u0111\u1ed9");
        console.log("  /local/      -> b\u1ea3n 2 ng\u01b0\u1eddi c\u00f9ng m\u00e1y");
        console.log("  /multiplayer/-> b\u1ea3n nhi\u1ec1u ng\u01b0\u1eddi qua m\u1ea1ng");
        console.log("\n  (Ctrl+C \u0111\u1ec3 d\u1eebng)\n");
        return;
    }

    const failed = await runCheck();

    // Đóng server rồi để Node tự thoát qua process.exitCode, KHÔNG gọi
    // process.exit() ngay: fetch() giữ kết nối keep-alive nên thoát tức thời
    // sẽ đụng assertion libuv trên Windows (UV_HANDLE_CLOSING).
    await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections?.();
    });
    process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
    console.error("\n\u2716 L\u1ed7i preview dist:", err.message);
    process.exitCode = 1;
});
