#!/usr/bin/env node
/**
 * OTTv2 - Build thư mục tĩnh `dist/` để deploy lên Vercel.
 * ------------------------------------------------------------------
 * Vercel chỉ host file tĩnh + function ngắn hạn, KHÔNG chạy được server
 * WebSocket giữ trạng thái trong RAM của `server/server.js`. Vì vậy:
 *
 *   - Vercel  -> phục vụ dist/ (local hotseat + multiplayer UI + shared)
 *   - Render / Railway / VPS -> chạy `server/server.js` (WebSocket)
 *
 * Script này gom các thư mục rời của repo thành 1 cây tĩnh duy nhất:
 *
 *   dist/
 *   ├── index.html                    # trang chủ chọn chế độ chơi
 *   ├── local/                        # từ  local/            (hotseat)
 *   │   ├── index.html
 *   │   ├── style.css
 *   │   └── game.js
 *   ├── multiplayer/                  # từ  server/public/    (UI + WS client)
 *   │   ├── index.html
 *   │   ├── style.css
 *   │   ├── client.js
 *   │   └── runtime-config.js         # SINH RA Ở ĐÂY, chứa WS_URL
 *   └── shared/
 *       └── gameLogic.js              # từ  shared/           (luật chơi)
 *
 * Vì sao phải giữ đúng cây này:
 *   - local/game.js      import '../shared/gameLogic.js'  -> cần local/ và
 *     shared/ là anh em ruột cùng cấp trong dist/.
 *   - multiplayer/client.js import '/shared/gameLogic.js' (đường dẫn tuyệt
 *     đối) -> cần shared/ nằm ngay gốc dist/.
 *
 * Biến môi trường:
 *   WS_URL  (build-time, set trong Vercel Project Settings) - ví dụ:
 *           https://ottv2-ws-server.onrender.com
 *           hoặc wss://ottv2-ws-server.onrender.com
 *           Để trống -> client tự dùng same-origin (chạy local).
 *
 * Chạy tay:  npm run build:static
 */

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const WS_URL = (process.env.WS_URL || "").trim();

/** Các cặp [nguồn, đích] cần copy vào dist/. */
const COPY_MAP = [
    ["local", "local"],
    ["server/public", "multiplayer"],
    ["shared", "shared"],
];

async function copyIntoDist(from, to) {
    const src = path.join(ROOT, from);
    const dest = path.join(DIST, to);
    await cp(src, dest, { recursive: true });
    console.log(`  \u2713 ${from}/ \u2192 dist/${to}/`);
}

/** Nội dung runtime-config.js được sinh theo WS_URL lúc build. */
function runtimeConfigSource() {
    return `// TỰ SINH bởi scripts/build-static.mjs - KHÔNG SỬA TAY.
// Giá trị đến từ biến môi trường WS_URL khi build trên Vercel.
window.__OTT_CONFIG__ = {
  wsUrl: ${JSON.stringify(WS_URL)}
};
`;
}

/** Trang chủ phân nhánh giữa bản hotseat và bản multiplayer. */
function landingPage() {
    const wsHint = WS_URL
        ? ""
        : "\n      <br />\u26a0\ufe0f Ch\u01b0a c\u1ea5u h\u00ecnh <code>WS_URL</code> - trang Nhi\u1ec1u ng\u01b0\u1eddi qua m\u1ea1ng s\u1ebd th\u1eed k\u1ebft n\u1ed1i same-origin.";

    return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>OTTv2 \u2014 O\u1eb3n T\u00f9 T\u00ec v2</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: radial-gradient(1200px 600px at 50% -10%, #1e293b, #0b1120 60%);
    color: #e2e8f0;
  }
  .card { max-width: 760px; width: 100%; text-align: center; }
  h1 { font-size: clamp(1.6rem, 4vw, 2.4rem); margin: 0 0 10px; }
  p.sub { color: #93a1b6; margin: 0 0 28px; }
  .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  a.mode {
    display: block; padding: 24px 20px; border-radius: 14px; text-decoration: none;
    background: #111827; border: 1px solid #253049; color: #e2e8f0;
    transition: transform .15s ease, border-color .15s ease, background .15s ease;
  }
  a.mode:hover { transform: translateY(-3px); border-color: #d4af37; background: #16203a; }
  a.mode .icon { font-size: 2rem; display: block; margin-bottom: 10px; }
  a.mode .title { font-weight: 700; font-size: 1.05rem; display: block; margin-bottom: 6px; }
  a.mode .desc { font-size: .875rem; color: #93a1b6; line-height: 1.5; display: block; }
  footer { margin-top: 30px; font-size: .8rem; color: #64748b; line-height: 1.7; }
  code { background: #1e293b; padding: 1px 5px; border-radius: 4px; }
</style>
</head>
<body>
  <main class="card">
    <h1>\ud83c\udfae OTTv2 \u2014 O\u1eb3n T\u00f9 T\u00ec v2</h1>
    <p class="sub">B\u00e0n c\u1edd 9\u00d79 \u00b7 \u270a B\u00faa \u2013 \u270b Bao \u2013 \u270c\ufe0f K\u00e9o \u00b7 \u0110i nh\u01b0 qu\u00e2n Vua</p>
    <div class="grid">
      <a class="mode" href="./local/">
        <span class="icon">\ud83d\udc65</span>
        <span class="title">2 ng\u01b0\u1eddi c\u00f9ng m\u00e1y</span>
        <span class="desc">B\u1ea3n hotseat, kh\u00f4ng c\u1ea7n server. Hai ng\u01b0\u1eddi thay phi\u00ean \u0111i tr\u00ean c\u00f9ng m\u1ed9t m\u00e0n h\u00ecnh.</span>
      </a>
      <a class="mode" href="./multiplayer/">
        <span class="icon">\ud83c\udf10</span>
        <span class="title">Nhi\u1ec1u ng\u01b0\u1eddi qua m\u1ea1ng</span>
        <span class="desc">V\u00e0o ph\u00f2ng b\u1eb1ng WebSocket \u0111\u1ec3 \u0111\u1ea5u v\u1edbi ng\u01b0\u1eddi ch\u01a1i kh\u00e1c, ho\u1eb7c v\u00e0o xem v\u1edbi vai tr\u00f2 kh\u00e1n gi\u1ea3.</span>
      </a>
    </div>
    <footer>Deploy t\u0129nh tr\u00ean Vercel \u00b7 Server WebSocket ch\u1ea1y ri\u00eang (Render / Railway)${wsHint}</footer>
  </main>
</body>
</html>
`;
}

async function main() {
    console.log("\u25b6 D\u1ef1ng dist/ \u0111\u1ec3 deploy l\u00ean Vercel...\n");

    await rm(DIST, { recursive: true, force: true });
    await mkdir(DIST, { recursive: true });

    for (const [from, to] of COPY_MAP) {
        await copyIntoDist(from, to);
    }

    await writeFile(
        path.join(DIST, "multiplayer", "runtime-config.js"),
        runtimeConfigSource(),
        "utf8",
    );
    console.log("  \u2713 sinh dist/multiplayer/runtime-config.js (wsUrl t\u1eeb WS_URL)");

    await writeFile(path.join(DIST, "index.html"), landingPage(), "utf8");
    console.log("  \u2713 sinh dist/index.html (trang ch\u1ee7)");

    console.log(
        `\n\u2714 Ho\u00e0n t\u1ea5t. WS_URL = ${WS_URL || "(tr\u1ed1ng \u2192 client d\u00f9ng same-origin)"}\n`,
    );
}

main().catch((err) => {
    console.error("\u2716 Build th\u1ea5t b\u1ea1i:", err);
    process.exit(1);
});
