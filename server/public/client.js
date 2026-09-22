import {
  SIZE, TYPE_ICON, TYPE_LABEL, TYPES, PLAYERS,
  createInitialState, isWinSquare, countPiecesByType, posToStr,
} from '/shared/gameLogic.js';

// --- DOM refs -----------------------------------------------------------
const boardCoords = document.getElementById('boardCoords');
const turnIndicator = document.getElementById('turnIndicator');
const winnerBanner = document.getElementById('winnerBanner');
const piecesCount = document.getElementById('piecesCount');
const moveLog = document.getElementById('moveLog');
const resetBtn = document.getElementById('resetBtn');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const connStatus = document.getElementById('connStatus');
const roleBadge = document.getElementById('roleBadge');
const roomInfo = document.getElementById('roomInfo');

// --- Client state ---------------------------------------------------------
let ws = null;
let myRole = null; // 'P1' | 'P2' | 'spectator'
let currentRoom = null;
let state = createInitialState(); // sẽ bị server ghi đè ngay khi có 'state' đầu tiên
let selected = null;
let localValidMoves = []; // tính lại ở client chỉ để tô sáng UI (server vẫn là nguồn xác thực chính)

function paramRoom() {
  const p = new URLSearchParams(location.search);
  return p.get('room') || '';
}

roomInput.value = paramRoom() || 'phong1';

joinBtn.addEventListener('click', () => connect(roomInput.value.trim() || 'phong1'));
resetBtn.addEventListener('click', () => ws && ws.readyState === 1 && ws.send(JSON.stringify({ type: 'reset' })));

function connect(room) {
  if (ws) ws.close();
  currentRoom = room || 'default';
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/?room=${encodeURIComponent(currentRoom)}`);
  const url = new URL(location.href);
  url.searchParams.set('room', currentRoom);
  history.replaceState({}, '', url);

  connStatus.textContent = '● Đang kết nối...';
  connStatus.className = 'status-pill';

  ws.onopen = () => {
    connStatus.textContent = `● Đã kết nối (phòng "${currentRoom}")`;
    connStatus.className = 'status-pill connected';
  };
  ws.onclose = () => {
    connStatus.textContent = '● Mất kết nối';
    connStatus.className = 'status-pill disconnected';
  };
  ws.onerror = () => {
    connStatus.textContent = '● Lỗi kết nối';
    connStatus.className = 'status-pill disconnected';
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'welcome') {
      myRole = msg.you;
      roleBadge.textContent = myRole === 'spectator' ? 'Khán giả' : `Bạn là ${myRole}`;
      roleBadge.className = `role-badge ${myRole}`;
    } else if (msg.type === 'state') {
      state = msg.state;
      selected = null;
      localValidMoves = [];
      renderRoomInfo(msg.players);
      render();
    } else if (msg.type === 'error') {
      flashError(msg.message);
    }
  };
}

function flashError(text) {
  turnIndicator.textContent = `⚠️ ${text}`;
  turnIndicator.style.color = '#ff6b6b';
  setTimeout(() => {
    turnIndicator.style.color = '';
    renderTurn();
  }, 1500);
}

function renderRoomInfo(players) {
  if (!players) { roomInfo.textContent = '—'; return; }
  roomInfo.innerHTML = `
    P1: ${players.P1 ? '🟢 đã vào' : '⚪ trống'}<br/>
    P2: ${players.P2 ? '🟢 đã vào' : '⚪ trống'}<br/>
    Khán giả: ${players.spectators}
  `;
}

// --- Board rendering (giống bản local, nhưng nước đi hợp lệ do server tính khi thực đi) ---

function buildBoardSkeleton() {
  boardCoords.innerHTML = '';
  const board = document.createElement('div');
  board.className = 'board';
  board.id = 'board';

  for (let displayRow = SIZE - 1; displayRow >= 0; displayRow--) {
    for (let col = 0; col < SIZE; col++) {
      const cell = document.createElement('div');
      cell.className = `cell ${(displayRow + col) % 2 === 0 ? 'light' : 'dark'}`;
      cell.dataset.row = displayRow;
      cell.dataset.col = col;
      if (isWinSquare(displayRow, col)) cell.classList.add('win-square');
      cell.addEventListener('click', () => onCellClick(displayRow, col));
      board.appendChild(cell);
    }
  }
  boardCoords.appendChild(board);
}

// Tính nước đi hợp lệ ở client CHỈ để gợi ý UI (server vẫn kiểm tra lại khi nhận move)
function localGetValidMoves(row, col) {
  const piece = state.board[row][col];
  if (!piece || piece.owner !== state.turn) return [];
  const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const beats = (a, b) => (a === 'rock' && b === 'scissors') || (a === 'scissors' && b === 'paper') || (a === 'paper' && b === 'rock');
  const moves = [];
  for (const [dr, dc] of dirs) {
    const nr = row + dr, nc = col + dc;
    if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) continue;
    const target = state.board[nr][nc];
    if (!target) { moves.push({ row: nr, col: nc, capture: false }); continue; }
    if (target.owner === piece.owner) continue;
    if (target.type === piece.type) continue;
    if (beats(piece.type, target.type)) moves.push({ row: nr, col: nc, capture: true });
  }
  return moves;
}

function onCellClick(row, col) {
  if (!ws || ws.readyState !== 1) return flashError('Chưa kết nối tới phòng.');
  if (state.winner) return;
  if (myRole !== 'P1' && myRole !== 'P2') return flashError('Bạn đang là khán giả.');
  if (myRole !== state.turn) return flashError('Chưa tới lượt của bạn.');

  const piece = state.board[row][col];

  if (selected) {
    const target = localValidMoves.find((m) => m.row === row && m.col === col);
    if (target) {
      ws.send(JSON.stringify({ type: 'move', from: posToStr(selected), to: posToStr({ row, col }) }));
      selected = null;
      localValidMoves = [];
      render();
      return;
    }
  }

  if (piece && piece.owner === myRole) {
    selected = { row, col };
    localValidMoves = localGetValidMoves(row, col);
  } else {
    selected = null;
    localValidMoves = [];
  }
  render();
}

function render() {
  const board = document.getElementById('board') || (buildBoardSkeleton(), document.getElementById('board'));

  for (const cellEl of board.children) {
    const row = parseInt(cellEl.dataset.row, 10);
    const col = parseInt(cellEl.dataset.col, 10);
    cellEl.classList.remove('selected', 'move-hint', 'capture-hint', 'last-move');
    cellEl.innerHTML = '';

    const piece = state.board[row][col];
    if (piece) {
      const p = document.createElement('div');
      p.className = `piece ${piece.owner}`;
      p.textContent = TYPE_ICON[piece.type];
      p.title = `${piece.owner} - ${TYPE_LABEL[piece.type]}`;
      cellEl.appendChild(p);
    }

    if (selected && selected.row === row && selected.col === col) cellEl.classList.add('selected');
    const moveHere = localValidMoves.find((m) => m.row === row && m.col === col);
    if (moveHere) cellEl.classList.add(moveHere.capture ? 'capture-hint' : 'move-hint');

    if (state.lastMove) {
      const lm = state.lastMove;
      if (posToStr({ row, col }) === lm.from || posToStr({ row, col }) === lm.to) {
        cellEl.classList.add('last-move');
      }
    }
  }

  renderTurn();
  renderCounts();
  renderLog();
}

function renderTurn() {
  if (state.winner) {
    turnIndicator.innerHTML = `Ván đấu kết thúc`;
    const reasonText = state.winReason === 'corner'
      ? 'đưa quân vào ô đích (a1/i9)'
      : 'ăn sạch một loại quân của đối phương';
    winnerBanner.textContent = `🏆 ${state.winner} THẮNG — ${reasonText}!`;
    winnerBanner.classList.add('show');
  } else {
    const youText = myRole === state.turn ? ' (lượt của bạn!)' : '';
    turnIndicator.innerHTML = `Lượt của <b>${state.turn}</b>${youText}`;
    winnerBanner.classList.remove('show');
  }
}

function renderCounts() {
  piecesCount.innerHTML = '';
  for (const player of PLAYERS) {
    const col = document.createElement('div');
    col.className = 'col';
    const h = document.createElement('h4');
    h.textContent = player;
    col.appendChild(h);
    for (const type of TYPES) {
      const n = countPiecesByType(state.board, player, type);
      const row = document.createElement('div');
      row.textContent = `${TYPE_ICON[type]} ${TYPE_LABEL[type]}: ${n}`;
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
    const capText = m.captured ? ` (ăn ${TYPE_LABEL[m.captured.type]} của ${m.captured.owner})` : '';
    line.textContent = `${i + 1}. ${m.mover}: ${m.from} → ${m.to}${capText}`;
    moveLog.appendChild(line);
  });
}

buildBoardSkeleton();
render();
connect(roomInput.value);
