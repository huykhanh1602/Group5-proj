/**
 * OTTv2 multiplayer bằng thư viện playhtml.fun
 * -------------------------------------------------------------
 * Dùng dynamic import cho playhtml để board luôn hiện ngay lập tức.
 * Nếu playhtml chậm / lỗi, game vẫn chạy được local (hot-seat).
 */

import * as G from "../shared/gameLogic.js";

// --- DOM refs -----------------------------------------------------------
const boardCoords = document.getElementById("boardCoords");
const turnIndicator = document.getElementById("turnIndicator");
const winnerBanner = document.getElementById("winnerBanner");
const piecesCount = document.getElementById("piecesCount");
const moveLog = document.getElementById("moveLog");
const resetBtn = document.getElementById("resetBtn");
const roomInput = document.getElementById("roomInput");
const joinBtn = document.getElementById("joinBtn");
const connStatus = document.getElementById("connStatus");
const roleBadge = document.getElementById("roleBadge");
const roomInfo = document.getElementById("roomInfo");

// --- Phòng chơi ---------------------------------------------------------
function currentRoomFromUrl() {
    return new URLSearchParams(location.search).get("room") || "ottv2-default";
}
const ROOM = currentRoomFromUrl();
roomInput.value = ROOM;

joinBtn.addEventListener("click", () => {
    const room = roomInput.value.trim() || "ottv2-default";
    const url = new URL(location.href);
    url.searchParams.set("room", room);
    location.href = url.toString();
});

// --- Local state (luôn sẵn sàng, không cần chờ playhtml) ----------------
const EMPTY_SEATS = { P1: null, P2: null };

const DEFAULT_GAME_STATE = {
    ...G.createInitialState(),
    seats: { ...EMPTY_SEATS },
};

let state = structuredClone(DEFAULT_GAME_STATE);
let myPid = "local-" + Math.random().toString(36).slice(2);
let online = false; // true khi playhtml đã kết nối thành công

/**
 * Copy trạng thái ván đấu ra plain object — KHÔNG dùng structuredClone().
 *
 * Lý do: setData(fn) của playhtml truyền vào callback một Proxy "sống"
 * (CRDT/Yjs) cho mọi object/array lồng nhau. structuredClone() ném
 * DataCloneError khi gặp Proxy, mà lỗi đó xảy ra NGAY TRONG lúc ghi nước đi
 * -> nước đi không bao giờ được ghi và người chơi thấy "không di chuyển được
 * quân". Vì vậy mọi chỗ cần dữ liệu dạng plain đều copy thủ công ở đây.
 */
function plainStateOf(src) {
    const s = src || {};

    const board = Array.from({ length: G.SIZE }, (_, r) =>
        Array.from({ length: G.SIZE }, (_, c) => {
            const p = s.board?.[r]?.[c];
            return p ? { owner: p.owner, type: p.type } : null;
        }),
    );

    const toCaptured = (c) => (c ? { owner: c.owner, type: c.type } : null);
    const toMove = (m) => ({
        from: m.from,
        to: m.to,
        mover: m.mover,
        captured: toCaptured(m.captured),
    });

    return {
        board,
        turn: s.turn === "P2" ? "P2" : "P1",
        winner: s.winner ?? null,
        winReason: s.winReason ?? null,
        lastMove: s.lastMove ? toMove(s.lastMove) : null,
        history: Array.from(s.history ?? [], toMove),
        seats: { P1: s.seats?.P1 ?? null, P2: s.seats?.P2 ?? null },
    };
}

// game: ban đầu dùng stub local (hot-seat), sau đó được thay bằng playhtml thật.
// Cả hai bản dùng chung đúng 2 hàm:
//   read()   -> trạng thái plain để kiểm tra luật (không dính Proxy của playhtml)
//   commit() -> ghi trạng thái mới (dùng value-form setData của playhtml)
let game = {
    read: () => plainStateOf(state),
    commit: (nextState) => {
        state = nextState;
        render();
    },
};

function getRoleOf(data, pid) {
    const seats = data?.seats ?? EMPTY_SEATS;
    if (seats.P1 === pid) return "P1";
    if (seats.P2 === pid) return "P2";
    return "spectator";
}

// --- Board + Render (chạy ngay, không cần playhtml) ---------------------
let selected = null;
let localValidMoves = [];

function buildBoardSkeleton() {
    boardCoords.innerHTML = "";

    const board = document.createElement("div");
    board.className = "board";
    board.id = "board";

    for (let displayRow = G.SIZE - 1; displayRow >= 0; displayRow--) {
        for (let col = 0; col < G.SIZE; col++) {
            const cell = document.createElement("div");
            cell.className = `cell ${(displayRow + col) % 2 === 0 ? "light" : "dark"}`;
            cell.dataset.row = displayRow;
            cell.dataset.col = col;
            if (G.isWinSquare(displayRow, col)) cell.classList.add("win-square");
            cell.addEventListener("click", () => onCellClick(displayRow, col));
            board.appendChild(cell);
        }
    }

    // Nhãn hàng (9 → 1) ở cột 1
    for (let displayRow = G.SIZE - 1; displayRow >= 0; displayRow--) {
        const coord = document.createElement("div");
        coord.className = "coord";
        coord.textContent = displayRow + 1;
        coord.style.gridColumn = "1";
        coord.style.gridRow = `${G.SIZE - displayRow}`;
        boardCoords.appendChild(coord);
    }

    // Nhãn cột (a → i) ở hàng 10
    for (let col = 0; col < G.SIZE; col++) {
        const coord = document.createElement("div");
        coord.className = "coord";
        coord.textContent = G.COLS[col];
        coord.style.gridColumn = `${col + 2}`;
        coord.style.gridRow = `${G.SIZE + 1}`;
        boardCoords.appendChild(coord);
    }

    boardCoords.appendChild(board);
}

function render() {
    if (!state || !state.board) state = structuredClone(DEFAULT_GAME_STATE);

    const board =
        document.getElementById("board") ||
        (buildBoardSkeleton(), document.getElementById("board"));

    for (const cellEl of board.children) {
        const row = parseInt(cellEl.dataset.row, 10);
        const col = parseInt(cellEl.dataset.col, 10);
        cellEl.classList.remove("selected", "move-hint", "capture-hint", "last-move");
        cellEl.innerHTML = "";

        const piece = state.board[row][col];
        if (piece) {
            const p = document.createElement("div");
            p.className = `piece ${piece.owner}`;
            p.textContent = G.TYPE_ICON[piece.type];
            p.title = `${piece.owner} - ${G.TYPE_LABEL[piece.type]}`;
            cellEl.appendChild(p);
        }

        if (selected && selected.row === row && selected.col === col)
            cellEl.classList.add("selected");

        const moveHere = localValidMoves.find((m) => m.row === row && m.col === col);
        if (moveHere) cellEl.classList.add(moveHere.capture ? "capture-hint" : "move-hint");

        if (state.lastMove) {
            const lm = state.lastMove;
            if (G.posToStr({ row, col }) === lm.from || G.posToStr({ row, col }) === lm.to)
                cellEl.classList.add("last-move");
        }
    }

    const myRole = getRoleOf(state, myPid);
    roleBadge.textContent = myRole === "spectator" ? "Khán giả" : `Bạn là ${myRole}`;
    roleBadge.className = `role-badge ${myRole}`;

    renderTurn();
    renderCounts();
    renderLog();
    renderRoomInfo();
}

function renderTurn() {
    if (state.winner) {
        turnIndicator.textContent = "Ván đấu kết thúc";
        const reasonText =
            state.winReason === "corner"
                ? "đưa quân vào ô đích (a1/i9)"
                : state.winReason === "surrender"
                  ? "đối phương đầu hàng"
                  : "ăn sạch một loại quân của đối phương";
        winnerBanner.textContent = `🏆 ${state.winner} THẮNG — ${reasonText}!`;
        winnerBanner.classList.add("show");
    } else {
        const myRole = getRoleOf(state, myPid);
        const youText = myRole === state.turn ? " (lượt của bạn!)" : "";
        turnIndicator.innerHTML = `Lượt của <b>${state.turn}</b>${youText}`;
        winnerBanner.classList.remove("show");
    }
}

function renderCounts() {
    piecesCount.innerHTML = "";
    for (const player of G.PLAYERS) {
        const col = document.createElement("div");
        col.className = "col";
        const h = document.createElement("h4");
        h.textContent = player;
        col.appendChild(h);
        for (const type of G.TYPES) {
            const n = G.countPiecesByType(state.board, player, type);
            const row = document.createElement("div");
            row.textContent = `${G.TYPE_ICON[type]} ${G.TYPE_LABEL[type]}: ${n}`;
            if (n === 0) row.style.color = "#ff6b6b";
            col.appendChild(row);
        }
        piecesCount.appendChild(col);
    }
}

function renderLog() {
    moveLog.innerHTML = "";
    state.history.forEach((m, i) => {
        const line = document.createElement("div");
        const capText = m.captured
            ? ` (ăn ${G.TYPE_LABEL[m.captured.type]} của ${m.captured.owner})`
            : "";
        line.textContent = `${i + 1}. ${m.mover}: ${m.from} → ${m.to}${capText}`;
        moveLog.appendChild(line);
    });
}

function renderRoomInfo() {
    // Sẽ được ghi đè khi playhtml kết nối; hiển thị trạng thái local tạm thời
    const seats = state?.seats ?? EMPTY_SEATS;
    roomInfo.innerHTML = `
    P1: ${seats.P1 ? "🟢 đã vào" : "⚪ trống"}<br/>
    P2: ${seats.P2 ? "🟢 đã vào" : "⚪ trống"}<br/>
    <i style="font-size:0.75rem">(đang kết nối playhtml…)</i>
  `;
}

function onCellClick(row, col) {
    if (state.winner) return;

    const myRole = getRoleOf(state, myPid);

    // Trong phòng online: chỉ người đã ngồi vào ghế P1/P2 mới đi được quân của
    // mình, người thứ 3 trở đi là khán giả (chỉ xem). Nếu chưa ai nhận ghế (vừa
    // mở trang, playhtml chưa kịp gán ghế, hoặc chạy offline) thì rơi về chế độ
    // hot-seat như bản local -> không bao giờ chặn nhầm người chơi thật.
    const seats = state.seats ?? EMPTY_SEATS;
    const restricted = online && !!(seats.P1 || seats.P2);

    let actingRole = state.turn;
    if (restricted) {
        if (myRole === "spectator") return flashError("Bạn là khán giả, không đi được quân.");
        if (myRole !== state.turn) return flashError("Chưa tới lượt của bạn.");
        actingRole = myRole;
    }

    const piece = state.board[row][col];

    if (selected) {
        const target = localValidMoves.find((m) => m.row === row && m.col === col);
        if (target) {
            attemptMove(selected, { row, col });
            selected = null;
            localValidMoves = [];
            render();
            return;
        }
    }

    if (piece && piece.owner === actingRole) {
        selected = { row, col };
        localValidMoves = G.getValidMoves(state, row, col);
    } else {
        selected = null;
        localValidMoves = [];
    }
    render();
}

function flashError(text) {
    turnIndicator.textContent = `⚠️ ${text}`;
    turnIndicator.style.color = "#ff6b6b";
    setTimeout(() => {
        turnIndicator.style.color = "";
        renderTurn();
    }, 1500);
}

function attemptMove(from, to) {
    // Kiểm tra luật trên bản plain (game.read() trả về object thuần), rồi ghi
    // lại TOÀN BỘ trạng thái bằng value-form setData(plainObject).
    // Tuyệt đối không structuredClone draft của playhtml: draft là Proxy nên
    // structuredClone ném DataCloneError -> nước đi không được ghi.
    const snapshot = game.read();
    if (snapshot.winner) return;

    if (!G.isValidMove(snapshot, from, to)) {
        flashError("Nước đi không hợp lệ.");
        return;
    }

    try {
        const next = G.applyMove(snapshot, from, to);
        game.commit({
            board: next.board,
            turn: next.turn,
            winner: next.winner,
            winReason: next.winReason,
            lastMove: next.lastMove,
            history: next.history,
            seats: snapshot.seats, // giữ nguyên chỗ ngồi đang có, không ghi đè
        });
    } catch (err) {
        console.error("[OTTv2] Không ghi được nước đi:", err);
        flashError("Không ghi được nước đi (xem console).");
    }
}

resetBtn.addEventListener("click", () => {
    try {
        const seats = game.read().seats; // giữ nguyên chỗ ngồi của phòng
        game.commit({ ...G.createInitialState(), seats });
    } catch (err) {
        console.error("[OTTv2] Không reset được ván đấu:", err);
        flashError("Không reset được ván đấu (xem console).");
    }
});

const surrenderBtn = document.getElementById("surrenderBtn");
surrenderBtn.addEventListener("click", () => {
    const myRole = getRoleOf(state, myPid);
    if (state.winner) return;
    // Trong chế độ playhtml, cho phép người dùng click Đầu hàng nếu đang là P1, P2 (hoặc cả hai ở hotseat local)
    const effectiveRole = myRole === "spectator" ? state.turn : myRole;
    if (confirm(`Xác nhận đầu hàng?`)) {
        game.setData((draft) => {
            const snapshot = structuredClone({
                board: draft.board,
                turn: draft.turn,
                winner: draft.winner,
                winReason: draft.winReason,
                lastMove: draft.lastMove,
                history: draft.history,
            });
            const next = G.applySurrender(snapshot, effectiveRole);
            draft.board = next.board;
            draft.turn = next.turn;
            draft.winner = next.winner;
            draft.winReason = next.winReason;
            draft.lastMove = next.lastMove;
            draft.history = next.history;
        });
    }
});

// ========== Render ngay lập tức (không chờ playhtml) ====================
buildBoardSkeleton();
render();

// ========== Load playhtml bất đồng bộ sau khi board đã hiện =============
(async () => {
    try {
        connStatus.textContent = "● Đang kết nối playhtml…";
        connStatus.className = "status-pill disconnected";

        const { playhtml } = await import("https://unpkg.com/playhtml@latest");

        await playhtml.init({ room: ROOM });

        myPid = playhtml.users.me?.pid ?? myPid;

        const DEFAULT_WITH_SEATS = structuredClone(DEFAULT_GAME_STATE);
        const ph_game = playhtml.createPageData("ottv2-game-state-v2", DEFAULT_WITH_SEATS);

        // Thay stub local bằng playhtml thật.
        // Dùng value-form setData(plainObject) thay vì mutate draft bên trong
        // callback: vừa tránh DataCloneError, vừa là cách playhtml khuyến nghị khi
        // cần ghi "toàn bộ snapshot" (trạng thái ván đấu của mình luôn là snapshot).
        game = {
            read: () => plainStateOf(ph_game.getData()),
            commit: (nextState) => {
                ph_game.setData(nextState); // nếu playhtml từ chối -> attemptMove báo lỗi rõ ràng
                state = nextState;
                render();
            },
        };

        // Ghi chỗ ngồi, luôn kèm toàn bộ dữ liệu hiện có để không làm mất field nào
        function writeSeats(nextSeats) {
            const current = ph_game.getData() ?? {};
            ph_game.setData({ ...current, seats: nextSeats });
        }

        // Nhận state từ server (getData() của playhtml đã trả về bản plain)
        const serverData = ph_game.getData();
        if (serverData?.board) {
            state = plainStateOf(serverData);
            render();
        }

        ph_game.onUpdate((data) => {
            state = plainStateOf(data);
            render();
        });

        online = true;

        // Nhận chỗ ngồi (P1 trước, P2 sau, còn lại là khán giả)
        setTimeout(() => {
            try {
                const current = plainStateOf(ph_game.getData());
                if (current.seats.P1 === myPid || current.seats.P2 === myPid) return;
                const seats = { ...current.seats };
                if (!seats.P1) seats.P1 = myPid;
                else if (!seats.P2) seats.P2 = myPid;
                else return;
                writeSeats(seats);
            } catch (err) {
                console.warn("[OTTv2] Không nhận được chỗ ngồi:", err);
            }
        }, 400);

        playhtml.users.onChange((users) => {
            const activePids = new Set((users ?? []).map((u) => u.pid));
            try {
                const current = plainStateOf(ph_game.getData());
                const seats = { ...current.seats };
                let changed = false;
                if (seats.P1 && !activePids.has(seats.P1)) {
                    seats.P1 = null;
                    changed = true;
                }
                if (seats.P2 && !activePids.has(seats.P2)) {
                    seats.P2 = null;
                    changed = true;
                }
                if (changed) writeSeats(seats);
            } catch (err) {
                console.warn("[OTTv2] Không dọn được chỗ ngồi:", err);
            }
            // Cập nhật roomInfo với số người thật
            const seats = state?.seats ?? EMPTY_SEATS;
            roomInfo.innerHTML = `
        P1: ${seats.P1 ? "🟢 đã vào" : "⚪ trống"}<br/>
        P2: ${seats.P2 ? "🟢 đã vào" : "⚪ trống"}<br/>
        Tổng người trong phòng: ${(users ?? []).length}
      `;
        });

        connStatus.textContent = `● Đã kết nối (phòng "${ROOM}")`;
        connStatus.className = "status-pill connected";
    } catch (err) {
        console.warn("playhtml không khả dụng, chạy chế độ local:", err);
        connStatus.textContent = "● Offline (chế độ local)";
        connStatus.className = "status-pill disconnected";
        // Game vẫn chạy được bình thường ở chế độ hot-seat local
    }
})();
