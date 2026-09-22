import {
  SIZE, COLS, TYPE_ICON, TYPE_LABEL, TYPES, PLAYERS,
  createInitialState, getValidMoves, applyMove, isWinSquare,
  countPiecesByType, posToStr,
} from '../shared/gameLogic.js';

let state = createInitialState();
let selected = null; // {row,col} | null
let validMoves = [];

const boardCoords = document.getElementById('boardCoords');
const turnIndicator = document.getElementById('turnIndicator');
const winnerBanner = document.getElementById('winnerBanner');
const piecesCount = document.getElementById('piecesCount');
const moveLog = document.getElementById('moveLog');
const resetBtn = document.getElementById('resetBtn');

resetBtn.addEventListener('click', () => {
  state = createInitialState();
  selected = null;
  validMoves = [];
  render();
});

function buildBoardSkeleton() {
  boardCoords.innerHTML = '';

  const board = document.createElement('div');
  board.className = 'board';
  board.id = 'board';

  // hàng 9 -> 1 (trên xuống dưới), cột a -> i (trái sang phải)
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

function onCellClick(row, col) {
  if (state.winner) return;
  const piece = state.board[row][col];

  // Nếu đang chọn quân, và click vào 1 nước đi hợp lệ -> thực hiện
  if (selected) {
    const isValidTarget = validMoves.some((m) => m.row === row && m.col === col);
    if (isValidTarget) {
      state = applyMove(state, selected, { row, col });
      selected = null;
      validMoves = [];
      render();
      return;
    }
  }

  // Chọn quân mới (phải là quân của người đang tới lượt)
  if (piece && piece.owner === state.turn) {
    selected = { row, col };
    validMoves = getValidMoves(state, row, col);
  } else {
    selected = null;
    validMoves = [];
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

    if (selected && selected.row === row && selected.col === col) {
      cellEl.classList.add('selected');
    }
    const moveHere = validMoves.find((m) => m.row === row && m.col === col);
    if (moveHere) {
      cellEl.classList.add(moveHere.capture ? 'capture-hint' : 'move-hint');
    }
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
    turnIndicator.innerHTML = `<span class="dot ${state.winner}"></span> Ván đấu kết thúc`;
    const reasonText = state.winReason === 'corner'
      ? 'đưa quân vào ô đích (a1/i9)'
      : 'ăn sạch một loại quân của đối phương';
    winnerBanner.textContent = `🏆 ${state.winner === 'P1' ? 'Người chơi 1' : 'Người chơi 2'} THẮNG — ${reasonText}!`;
    winnerBanner.classList.add('show');
  } else {
    const name = state.turn === 'P1' ? 'Người chơi 1' : 'Người chơi 2';
    turnIndicator.innerHTML = `<span class="dot ${state.turn}"></span> Lượt của <b>${name}</b>`;
    winnerBanner.classList.remove('show');
  }
}

function renderCounts() {
  piecesCount.innerHTML = '';
  for (const player of PLAYERS) {
    const col = document.createElement('div');
    col.className = 'col';
    const h = document.createElement('h4');
    h.textContent = player === 'P1' ? 'Người chơi 1' : 'Người chơi 2';
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
