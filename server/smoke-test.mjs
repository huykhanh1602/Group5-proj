#!/usr/bin/env node
/**
 * OTTv2 - Smoke test cho server multiplayer (WebSocket).
 * ------------------------------------------------------------------
 * Tự spawn `server.js` trên một port riêng, rồi kiểm tra end-to-end:
 *   1. Server boot được (xác nhận `shared/gameLogic.js` resolve đúng ESM).
 *   2. Vào phòng lần lượt được gán vai trò P1 -> P2 -> khán giả.
 *   3. P1 đi nước hợp lệ -> mọi người nhận 'state' mới, lượt chuyển sang P2.
 *   4. Khán giả đi quân -> bị từ chối.
 *   5. Đi sai lượt -> bị từ chối.
 *   6. Nước đi không hợp lệ -> bị từ chối.
 *
 * Chạy:  node server/smoke-test.mjs
 * (chạy từ repo root; script tự tìm `ws` trong server/node_modules)
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.SMOKE_PORT || 8099);
const BASE = `ws://127.0.0.1:${PORT}`;
const ROOM = `smoke-${Date.now()}`;

const results = [];

function check(name, ok, detail = "") {
    results.push({ name, ok });
    console.log(`${ok ? "  \u2713" : "  \u2716"} ${name}${detail ? ` \u2014 ${detail}` : ""}`);
}

/** Mở socket có buffer + truy vấn message theo điều kiện. */
function openSocket(room) {
    const ws = new WebSocket(`${BASE}/?room=${encodeURIComponent(room)}`);
    const inbox = [];
    const waiters = [];

    ws.on("message", (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            return;
        }
        inbox.push(msg);
        for (let i = waiters.length - 1; i >= 0; i--) {
            if (waiters[i].predicate(msg)) {
                waiters[i].resolve(msg);
                waiters.splice(i, 1);
            }
        }
    });

    function wait(predicate, timeoutMs = 4000, fresh = false) {
        // fresh=true: chỉ xét message đến SAU lời gọi này, tránh khớp lại state cũ
        // đã buffer (ví dụ state khởi tạo trùng điều kiện với state sau khi reset).
        const scanFrom = fresh ? inbox.length : 0;
        const hit = inbox.slice(scanFrom).find(predicate);
        if (hit) return Promise.resolve(hit);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(
                () =>
                    reject(
                        new Error(
                            "timeout: kh\u00f4ng nh\u1eadn \u0111\u01b0\u1ee3c message mong \u0111\u1ee3i",
                        ),
                    ),
                timeoutMs,
            );
            waiters.push({
                predicate,
                resolve: (m) => {
                    clearTimeout(timer);
                    resolve(m);
                },
            });
        });
    }

    const ready = new Promise((resolve, reject) => {
        ws.once("open", resolve);
        ws.once("error", reject);
    });

    return {
        ws,
        wait,
        ready,
        send: (obj) => ws.send(JSON.stringify(obj)),
        close: () => {
            try {
                ws.close();
            } catch {
                /* ignore */
            }
        },
    };
}

async function waitForServerBooting(child, deadlineMs) {
    const started = Date.now();
    let bootLog = "";
    child.stdout.on("data", (d) => {
        bootLog += d.toString();
    });
    child.stderr.on("data", (d) => {
        bootLog += d.toString();
    });

    while (Date.now() - started < deadlineMs) {
        if (child.exitCode !== null) {
            throw new Error(`server tho\u00e1t s\u1edbm (exit ${child.exitCode}).\n${bootLog}`);
        }
        try {
            await waitSocketable();
            return bootLog;
        } catch {
            await new Promise((r) => setTimeout(r, 250));
        }
    }
    throw new Error(`server kh\u00f4ng l\u00ean trong ${deadlineMs}ms.\n${bootLog}`);
}

function waitSocketable() {
    return new Promise((resolve, reject) => {
        const probe = new WebSocket(`${BASE}/?room=__probe__`);
        probe.once("open", () => {
            probe.close();
            resolve();
        });
        probe.once("error", reject);
    });
}

async function main() {
    console.log("\n\u25b6 OTTv2 - smoke test server WebSocket\n");

    const child = spawn(process.execPath, ["server.js"], {
        cwd: __dirname,
        env: { ...process.env, PORT: String(PORT) },
        stdio: ["ignore", "pipe", "pipe"],
    });

    let p1, p2, spec;
    try {
        const bootLog = await waitForServerBooting(child, 15000);
        check(
            "Server boot th\u00e0nh c\u00f4ng (shared/gameLogic.js resolve \u0111\u00fang ESM)",
            true,
            bootLog.trim().split("\n")[0] || `port ${PORT}`,
        );

        // --- Phân vai ---------------------------------------------------------
        p1 = openSocket(ROOM);
        const p1Welcome = await p1.ready.then(() => p1.wait((m) => m.type === "welcome"));
        check(
            "Client \u0111\u1ea7u ti\u00ean nh\u1eadn vai tr\u00f2 P1",
            p1Welcome.you === "P1",
            `you=${p1Welcome.you}`,
        );

        p2 = openSocket(ROOM);
        const p2Welcome = await p2.ready.then(() => p2.wait((m) => m.type === "welcome"));
        check(
            "Client th\u1ee9 hai nh\u1eadn vai tr\u00f2 P2",
            p2Welcome.you === "P2",
            `you=${p2Welcome.you}`,
        );

        spec = openSocket(ROOM);
        const specWelcome = await spec.ready.then(() => spec.wait((m) => m.type === "welcome"));
        check(
            "Client th\u1ee9 ba tr\u1edf th\u00e0nh kh\u00e1n gi\u1ea3",
            specWelcome.you === "spectator",
            `you=${specWelcome.you}`,
        );

        // Chờ state mà CẢ P1 lẫn P2 đã vào phòng (broadcast đầu tiên chỉ có P1).
        const fullState = await p1.wait((m) => m.type === "state" && m.players.P1 && m.players.P2);
        check(
            "Nh\u1eadn \u0111\u01b0\u1ee3c state v\u1edbi \u0111\u1ee7 2 ng\u01b0\u1eddi ch\u01a1i",
            fullState.state.turn === "P1" && fullState.players.P1 && fullState.players.P2,
            `turn=${fullState.state.turn}, P1=${fullState.players.P1}, P2=${fullState.players.P2}, spectators=${fullState.players.spectators}`,
        );

        // --- Khán giả không được đi ------------------------------------------
        spec.send({ type: "move", from: "b1", to: "b2" });
        const specErr = await spec.wait((m) => m.type === "error");
        check(
            "Kh\u00e1n gi\u1ea3 b\u1ecb t\u1eeb ch\u1ed1i khi \u0111i qu\u00e2n",
            /kh\u00e1n gi\u1ea3/i.test(specErr.message),
            specErr.message,
        );

        // --- Đi sai lượt bị từ chối ------------------------------------------
        p2.send({ type: "move", from: "h9", to: "h8" });
        const turnErr = await p2.wait((m) => m.type === "error");
        check(
            "\u0110i sai l\u01b0\u1ee3t b\u1ecb t\u1eeb ch\u1ed1i",
            /l\u01b0\u1ee3t/i.test(turnErr.message),
            turnErr.message,
        );

        // --- Nước đi hợp lệ của P1 -------------------------------------------
        p1.send({ type: "move", from: "b1", to: "b2" });
        const afterMove = await p2.wait((m) => m.type === "state" && m.state.history.length === 1);
        check(
            "N\u01b0\u1edbc \u0111i h\u1ee3p l\u1ec7 c\u1ee7a P1 \u0111\u01b0\u1ee3c \u00e1p d\u1ee5ng v\u00e0 broadcast",
            afterMove.state.lastMove.from === "b1" && afterMove.state.lastMove.to === "b2",
            `lastMove=${afterMove.state.lastMove.from}\u2192${afterMove.state.lastMove.to}`,
        );
        check(
            "L\u01b0\u1ee3t chuy\u1ec3n sang P2",
            afterMove.state.turn === "P2",
            `turn=${afterMove.state.turn}`,
        );
        // Khán giả cũng phải nhận được state sau nước đi. history.length === 1
        // là điều kiện duy nhất đúng với state sau nước đi đầu tiên.
        const specState = await spec.wait(
            (m) => m.type === "state" && m.state.history.length === 1,
        );
        check(
            "Kh\u00e1n gi\u1ea3 c\u0169ng nh\u1eadn \u0111\u01b0\u1ee3c state m\u1edbi",
            specState.state.lastMove.to === "b2",
            `lastMove=${specState.state.lastMove.from}\u2192${specState.state.lastMove.to}`,
        );

        // --- Nước đi không hợp lệ --------------------------------------------
        p2.send({ type: "move", from: "h9", to: "a1" });
        // fresh: bỏ qua error "Chưa tới lượt" đã buffer từ kiểm tra phía trên.
        const invalidErr = await p2.wait((m) => m.type === "error", 4000, true);
        check(
            "N\u01b0\u1edbc \u0111i kh\u00f4ng h\u1ee3p l\u1ec7 b\u1ecb t\u1eeb ch\u1ed1i",
            /kh\u00f4ng h\u1ee3p l\u1ec7/i.test(invalidErr.message),
            invalidErr.message,
        );

        // --- Reset ván --------------------------------------------------------
        p1.send({ type: "reset" });
        const afterReset = await p1.wait(
            (m) => m.type === "state" && m.state.history.length === 0 && m.state.turn === "P1",
            4000,
            true, // fresh: bỏ qua state khởi tạo đã buffer trước đó
        );
        check(
            "Reset v\u00e1n \u0111\u1ea5u ho\u1ea1t \u0111\u1ed9ng",
            !!afterReset,
            "history r\u1ed7ng, turn=P1",
        );
    } finally {
        p1 && p1.close();
        p2 && p2.close();
        spec && spec.close();
        child.kill();
    }

    const failed = results.filter((r) => !r.ok);
    console.log(
        `\n${failed.length === 0 ? "\u2714 PASS" : "\u2716 FAIL"} - ${results.length - failed.length}/${results.length} ki\u1ec3m tra \u0111\u1ea1t\n`,
    );
    process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
    console.error("\n\u2716 Smoke test l\u1ed7i:", err.message);
    process.exit(1);
});
