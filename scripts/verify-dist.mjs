#!/usr/bin/env node
/**
 * OTTv2 - Kiểm tra tính toàn vẹn của dist/ sau khi build tĩnh.
 * ------------------------------------------------------------------
 * Rủi ro lớn nhất khi deploy tĩnh là đường dẫn import giữa các thư mục
 * (~2 kiểu khác nhau) hoặc trang quên nạp runtime-config.js. Script này
 * kiểm tra đúng những điểm đó mà không cần chạy HTTP server.
 *
 * Chạy:  npm run verify:dist   (sau khi npm run build:static)
 */

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "dist");

const results = [];

/**
 * @param {string} name
 * @param {boolean} ok
 * @param {string} [detail]
 */
function check(name, ok, detail = "") {
    results.push({ name, ok });
    console.log(`${ok ? "  \u2713" : "  \u2716"} ${name}${detail ? ` \u2014 ${detail}` : ""}`);
}

async function exists(rel) {
    try {
        await access(path.join(DIST, rel));
        return true;
    } catch {
        return false;
    }
}

/**
 * Kiểm tra một specifier import trong file `relFile` có trỏ tới file
 * thật sự tồn tại trong dist/ hay không.
 * Hỗ trợ cả đường dẫn tuyệt đối từ gốc site ('/shared/...') lẫn tương đối.
 */
async function checkImport(relFile, specifier) {
    const fileAbs = path.join(DIST, relFile);
    const targetAbs = specifier.startsWith("/")
        ? path.join(DIST, specifier)
        : path.resolve(path.dirname(fileAbs), specifier);
    const relTarget = path.relative(DIST, targetAbs);
    const ok = await exists(relTarget);
    check(
        `${relFile} import '${specifier}'`,
        ok,
        ok ? `\u2192 ${relTarget}` : `THI\u1ebeU ${relTarget}`,
    );
}

/** Lấy các specifier trong câu lệnh import ... from '...' của file. */
async function readImports(relFile) {
    const src = await readFile(path.join(DIST, relFile), "utf8");
    return [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

async function main() {
    console.log("\n\u25b6 Ki\u1ec3m tra dist/ sau khi build t\u0129nh\n");

    const required = [
        "index.html",
        "local/index.html",
        "local/style.css",
        "local/game.js",
        "playhtml/index.html",
        "playhtml/style.css",
        "playhtml/app.js",
        "multiplayer/index.html",
        "multiplayer/style.css",
        "multiplayer/client.js",
        "multiplayer/runtime-config.js",
        "shared/gameLogic.js",
    ];

    for (const rel of required) {
        check(`T\u1ed3n t\u1ea1i ${rel}`, await exists(rel));
    }

    // --- Đường dẫn import giữa các thư mục (điểm dễ vỡ nhất) ---------------
    for (const spec of await readImports("local/game.js")) {
        if (spec.startsWith(".") || spec.startsWith("/")) await checkImport("local/game.js", spec);
    }
    for (const spec of await readImports("playhtml/app.js")) {
        if (spec.startsWith(".") || spec.startsWith("/"))
            await checkImport("playhtml/app.js", spec);
    }
    for (const spec of await readImports("multiplayer/client.js")) {
        if (spec.startsWith(".") || spec.startsWith("/"))
            await checkImport("multiplayer/client.js", spec);
    }

    // --- runtime-config.js phải được nạp TRƯỚC client.js ------------------
    const mpHtml = await readFile(path.join(DIST, "multiplayer/index.html"), "utf8");
    // Chỉ so khớp thẻ <script src="..."> thật, KHÔNG dùng indexOf chuỗi thô
    // vì tên "client.js" còn xuất hiện trong phần chú thích HTML phía trên.
    const configTag = /<script[^>]*src=["'][^"']*runtime-config\.js["']/i.exec(mpHtml);
    const clientTag = /<script[^>]*src=["'][^"']*client\.js["']/i.exec(mpHtml);
    const iConfig = configTag ? configTag.index : -1;
    const iClient = clientTag ? clientTag.index : -1;
    check(
        "multiplayer/index.html n\u1ea1p runtime-config.js TR\u01af\u1edaC client.js",
        iConfig !== -1 && iClient !== -1 && iConfig < iClient,
        `config@${iConfig}, client@${iClient}`,
    );

    // --- runtime-config.js có chứa wsUrl ----------------------------------
    const cfg = await readFile(path.join(DIST, "multiplayer/runtime-config.js"), "utf8");
    const wsLine = cfg.match(/wsUrl:\s*(.*)/);
    check(
        "multiplayer/runtime-config.js c\u00f3 window.__OTT_CONFIG__.wsUrl",
        /__OTT_CONFIG__/.test(cfg) && /wsUrl:/.test(cfg),
        wsLine ? `wsUrl: ${wsLine[1].trim()}` : "",
    );

    // --- Trang chủ trỏ tới cả 3 chế độ ------------------------------------
    const home = await readFile(path.join(DIST, "index.html"), "utf8");
    check(
        "index.html c\u00f3 link t\u1edbi ./local/, ./playhtml/ v\u00e0 ./multiplayer/",
        home.includes("./local/") &&
            home.includes("./playhtml/") &&
            home.includes("./multiplayer/"),
    );

    const failed = results.filter((r) => !r.ok);
    console.log(
        `\n${failed.length === 0 ? "\u2714 PASS" : "\u2716 FAIL"} - ${results.length - failed.length}/${results.length} ki\u1ec3m tra \u0111\u1ea1t\n`,
    );
    process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
    console.error("\n\u2716 Ki\u1ec3m tra l\u1ed7i:", err.message);
    process.exit(1);
});
