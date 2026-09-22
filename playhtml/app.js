/**
 * OTTv2 multiplayer bằng thư viện playhtml.fun
 * -------------------------------------------------------------
 * Dùng dynamic import cho playhtml để board luôn hiện ngay lập tức.
 * Nếu playhtml chậm / lỗi, game vẫn chạy được local (hot-seat).
 */

import * as G from '../shared/gameLogic.js';

// --- DOM refs -----------------------------------------------------------
const boardCoords  = document.getElementById('boardCoords');
const turnIndicator = document.getElementById('turnIndicator');
const winnerBanner  = document.getElementById('winnerBanner');
const piecesCount   = document.getElementById('piecesCount');
const moveLog       = document.getElementById('moveLog');
const resetBtn      = document.getElementById('resetBtn');
const roomInput     = document.getElementById('roomInput');
const joinBtn       = document.getElementById('joinBtn');
const connStatus    = document.getElementById('connStatus');
const roleBadge     = document.getElementById('roleBadge');
const roomInfo      = document.getElementById('roomInfo');

// --- Phòng chơi ---------------------------------------------------------
function currentRoomFromUrl() {
  return new URLSearchParams(location.search).get('room') || 'ottv2-default';
}
const ROOM = currentRoomFromUrl();
roomInput.value = ROOM;

joinBtn.addEventListener('click', () => {
  const room = roomInput.value.trim() || 'ottv2-default';
  const url  = new URL(location.href);
  url.searchParams.set('room', room);
  location.href = url.toString();
});

// --- Local state (luôn sẵn sàng, không cần chờ playhtml) ----------------
const DEFAULT_GAME_STATE = {
  ...G.createInitialState(),
  seats: { P1: null, P2: null },
};

let state = structuredClone(DEFAULT_GAME_STATE);
let myPid = 'local-' + Math.random().toString(36).slice(2);

// game object: ban đầu dùng stub local, sẽ được thay bằng playhtml sau
let game = {
  setData: (fn) => {
    const draft = structuredClone(state);
    fn(draft);
    state = draft;
    render();
  },
};

function getRoleOf(data, pid) {
  if (data.seats.P1 === pid) return 'P1';
  if (data.seats.P2 === pid) return 'P2';
  return 'spectator';
}

// --- Board + Render (chạy ngay, không cần playhtml) ---------------------
let selected = null;
let localValidMoves = [];

function buildBoardSkeleton() {
  boardCoords.innerHTML = '';

  const board = document.createElement('div');
  board.className = 'board';
  board.id = 'board';

  for (let displayRow = G.SIZE - 1; displayRow >= 0; displayRow--) {
    for (let col = 0; col < G.SIZE; col++) {
      const cell = document.createElement('div');
      cell.className = `cell ${(displayRow + col) % 2 === 0 ? 'light' : 'dark'}`;
      cell.dataset.row = displayRow;
      cell.dataset.col = col;
      if (G.isWinSquare(displayRow, col)) cell.classList.add('win-square');
      cell.addEventListener('click', () => onCellClick(displayRow, col));
      board.appendChild(cell);
    }
  }

  // Nhãn hàng (9 → 1) ở cột 1
  for (let displayRow = G.SIZE - 1; displayRow >= 0; displayRow--) {
    const coord = document.createElement('div');
    coord.className = 'coord';
    coord.textContent = displayRow + 1;
    coord.style.gridColumn = '1';
    coord.style.gridRow    = `${G.SIZE - displayRow}`;
    boardCoords.appendChild(coord);
  }

  // Nhãn cột (a → i) ở hàng 10
  for (let col = 0; col < G.SIZE; col++) {
    const coord = document.createElement('div');
    coord.className = 'coord';
    coord.textContent = G.COLS[col];
    coord.style.gridColumn = `${col + 2}`;
    coord.style.gridRow    = `${G.SIZE + 1}`;
    boardCoords.appendChild(coord);
  }

  boardCoords.appendChild(board);
}

function render() {
  if (!state || !state.board) state = structuredClone(DEFAULT_GAME_STATE);

  const board = document.getElementById('board')
    || (buildBoardSkeleton(), document.getElementById('board'));

  for (const cellEl of board.children) {
    const row = parseInt(cellEl.dataset.row, 10);
    const col = parseInt(cellEl.dataset.col, 10);
    cellEl.classList.remove('selected', 'move-hint', 'capture-hint', 'last-move');
    cellEl.innerHTML = '';

    const piece = state.board[row][col];
    if (piece) {
      const p = document.createElement('div');
      p.className  = `piece ${piece.owner}`;
      p.textContent = G.TYPE_ICON[piece.type];
      p.title       = `${piece.owner} - ${G.TYPE_LABEL[piece.type]}`;
      cellEl.appendChild(p);
    }

    if (selected && selected.row === row && selected.col === col)
      cellEl.classList.add('selected');

    const moveHere = localValidMoves.find((m) => m.row === row && m.col === col);
    if (moveHere) cellEl.classList.add(moveHere.capture ? 'capture-hint' : 'move-hint');

    if (state.lastMove) {
      const lm = state.lastMove;
      if (G.posToStr({ row, col }) === lm.from || G.posToStr({ row, col }) === lm.to)
        cellEl.classList.add('last-move');
    }
  }

  const myRole = getRoleOf(state, myPid);
  roleBadge.textContent = myRole === 'spectator' ? 'Khán giả' : `Bạn là ${myRole}`;
  roleBadge.className   = `role-badge ${myRole}`;

  renderTurn();
  renderCounts();
  renderLog();
  renderRoomInfo();
}

function renderTurn() {
  if (state.winner) {
    turnIndicator.textContent = 'Ván đấu kết thúc';
    const reasonText = state.winReason === 'corner'
      ? 'đưa quân vào ô đích (a1/i9)'
      : state.winReason === 'surrender'
        ? 'đối phương đầu hàng'
        : 'ăn sạch một loại quân của đối phương';
    winnerBanner.textContent = `🏆 ${state.winner} THẮNG — ${reasonText}!`;
    winnerBanner.classList.add('show');
  } else {
    const myRole  = getRoleOf(state, myPid);
    const youText = myRole === state.turn ? ' (lượt của bạn!)' : '';
    turnIndicator.innerHTML = `Lượt của <b>${state.turn}</b>${youText}`;
    winnerBanner.classList.remove('show');
  }
}

function renderCounts() {
  piecesCount.innerHTML = '';
  for (const player of G.PLAYERS) {
    const col = document.createElement('div');
    col.className = 'col';
    const h = document.createElement('h4');
    h.textContent = player;
    col.appendChild(h);
    for (const type of G.TYPES) {
      const n   = G.countPiecesByType(state.board, player, type);
      const row = document.createElement('div');
      row.textContent = `${G.TYPE_ICON[type]} ${G.TYPE_LABEL[type]}: ${n}`;
      if (n === 0) row.style.color = '#ff6b6b';
      col.appendChild(row);
    }
    piecesCount.appendChild(col);
  }
}

function renderLog() {
  moveLog.innerHTML = '';
  state.history.forEach((m, i) => {
    const line = document.createElement('div');
    if (m.type === 'surrender') {
      line.textContent = `${i + 1}. ${m.mover} đã đầu hàng 🏳`;
    } else {
      const capText = m.captured
        ? ` (ăn ${G.TYPE_LABEL[m.captured.type]} của ${m.captured.owner})`
        : '';
      line.textContent = `${i + 1}. ${m.mover}: ${m.from} → ${m.to}${capText}`;
    }
    moveLog.appendChild(line);
  });
}

function renderRoomInfo() {
  // Sẽ được ghi đè khi playhtml kết nối; hiển thị trạng thái local tạm thời
  roomInfo.innerHTML = `
    P1: ${state.seats.P1 ? '🟢 đã vào' : '⚪ trống'}<br/>
    P2: ${state.seats.P2 ? '🟢 đã vào' : '⚪ trống'}<br/>
    <i style="font-size:0.75rem">(đang kết nối playhtml…)</i>
  `;
}

function onCellClick(row, col) {
  if (state.winner) return;
  const myRole = getRoleOf(state, myPid);

  // Chế độ local: P1 và P2 đều có thể đi (hot-seat) nếu chưa có playhtml
  const effectiveRole = myRole === 'spectator' ? state.turn : myRole;
  if (effectiveRole !== state.turn) return flashError('Chưa tới lượt.');

  const piece = state.board[row][col];

  if (selected) {
    const target = localValidMoves.find((m) => m.row === row && m.col === col);
    if (target) {
      attemptMove(selected, { row, col });
      selected = null;
      localValidMoves = [];
      return;
    }
  }

  if (piece && piece.owner === effectiveRole) {
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
  turnIndicator.style.color = '#ff6b6b';
  setTimeout(() => {
    turnIndicator.style.color = '';
    renderTurn();
  }, 1500);
}

function attemptMove(from, to) {
  game.setData((draft) => {
    if (draft.winner) return;
    const snapshot = structuredClone({
      board: draft.board, turn: draft.turn,
      winner: draft.winner, winReason: draft.winReason,
      lastMove: draft.lastMove, history: draft.history,
    });
    if (!G.isValidMove(snapshot, from, to)) return;
    const next = G.applyMove(snapshot, from, to);
    draft.board     = next.board;
    draft.turn      = next.turn;
    draft.winner    = next.winner;
    draft.winReason = next.winReason;
    draft.lastMove  = next.lastMove;
    draft.history   = next.history;
  });
}

resetBtn.addEventListener('click', () => {
  game.setData((draft) => {
    const fresh  = G.createInitialState();
    draft.board     = fresh.board;
    draft.turn      = fresh.turn;
    draft.winner    = fresh.winner;
    draft.winReason = fresh.winReason;
    draft.lastMove  = fresh.lastMove;
    draft.history   = fresh.history;
  });
});

const surrenderBtn = document.getElementById('surrenderBtn');
surrenderBtn.addEventListener('click', () => {
  const myRole = getRoleOf(state, myPid);
  if (state.winner) return;
  // Trong chế độ playhtml, cho phép người dùng click Đầu hàng nếu đang là P1, P2 (hoặc cả hai ở hotseat local)
  const effectiveRole = myRole === 'spectator' ? state.turn : myRole;
  if (confirm(`Xác nhận đầu hàng?`)) {
    game.setData((draft) => {
      const snapshot = structuredClone({
        board: draft.board, turn: draft.turn,
        winner: draft.winner, winReason: draft.winReason,
        lastMove: draft.lastMove, history: draft.history,
      });
      const next = G.applySurrender(snapshot, effectiveRole);
      draft.board     = next.board;
      draft.turn      = next.turn;
      draft.winner    = next.winner;
      draft.winReason = next.winReason;
      draft.lastMove  = next.lastMove;
      draft.history   = next.history;
    });
  }
});

// ========== Render ngay lập tức (không chờ playhtml) ====================
buildBoardSkeleton();
render();

// ========== Load playhtml bất đồng bộ sau khi board đã hiện =============
(async () => {
  try {
    connStatus.textContent = '● Đang kết nối playhtml…';
    connStatus.className   = 'status-pill disconnected';

    const { playhtml } = await import('https://unpkg.com/playhtml@latest');

    await playhtml.init({ room: ROOM });

    myPid = playhtml.users.me?.pid ?? myPid;

    const DEFAULT_WITH_SEATS = structuredClone(DEFAULT_GAME_STATE);
    const ph_game = playhtml.createPageData('ottv2-game-state-v2', DEFAULT_WITH_SEATS);

    // Thay stub local bằng playhtml thật
    game = {
      setData: (fn) => ph_game.setData(fn),
    };

    // Nhận state từ server
    const serverData = ph_game.getData();
    if (serverData?.board) { state = serverData; render(); }

    ph_game.onUpdate((data) => {
      state = data;
      render();
    });

    // Nhận chỗ ngồi
    setTimeout(() => {
      ph_game.setData((draft) => {
        if (draft.seats.P1 === myPid || draft.seats.P2 === myPid) return;
        if (!draft.seats.P1) draft.seats.P1 = myPid;
        else if (!draft.seats.P2) draft.seats.P2 = myPid;
      });
    }, 400);

    playhtml.users.onChange((users) => {
      const activePids = new Set(users.map((u) => u.pid));
      ph_game.setData((draft) => {
        if (draft.seats.P1 && !activePids.has(draft.seats.P1)) draft.seats.P1 = null;
        if (draft.seats.P2 && !activePids.has(draft.seats.P2)) draft.seats.P2 = null;
      });
      // Cập nhật roomInfo với số người thật
      roomInfo.innerHTML = `
        P1: ${state.seats.P1 ? '🟢 đã vào' : '⚪ trống'}<br/>
        P2: ${state.seats.P2 ? '🟢 đã vào' : '⚪ trống'}<br/>
        Tổng người trong phòng: ${users.length}
      `;
    });

    connStatus.textContent = `● Đã kết nối (phòng "${ROOM}")`;
    connStatus.className   = 'status-pill connected';

  } catch (err) {
    console.warn('playhtml không khả dụng, chạy chế độ local:', err);
    connStatus.textContent = '● Offline (chế độ local)';
    connStatus.className   = 'status-pill disconnected';
    // Game vẫn chạy được bình thường ở chế độ hot-seat local
  }
})();
