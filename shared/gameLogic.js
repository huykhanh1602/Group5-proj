/**
 * OTTv2 - Oẳn Tù Tì v2 (Rock–Paper–Scissors Chess)
 * ----------------------------------------------------------
 * Luật chơi (theo đề bài):
 *  - Bàn cờ 9x9, cột a..i, hàng 1..9 (giống ký hiệu cờ vua).
 *  - Mỗi quân đi 1 ô theo 8 hướng như quân Vua.
 *  - 3 loại quân: Búa (rock) > Kéo (scissors) > Bao (paper) > Búa.
 *  - Hai quân CÙNG LOẠI không ăn được nhau, chỉ đứng chặn đường
 *    (không thể đi/ăn vào ô có quân cùng loại, dù là quân địch hay quân mình).
 *  - Một quân chỉ được đi vào ô có quân địch nếu quân của mình THẮNG
 *    loại quân địch đó (ăn quân). Nếu quân mình sẽ THUA loại quân địch,
 *    nước đi đó không hợp lệ (không được "tự sát").
 *  - Điều kiện thắng:
 *      (1) Ăn sạch hoàn toàn 1 loại quân bất kỳ của đối phương
 *          (đối phương không còn quân Búa, hoặc không còn quân Kéo,
 *           hoặc không còn quân Bao nào trên bàn), HOẶC
 *      (2) Đưa được bất kỳ quân nào của mình vào ô a1 hoặc i9.
 *
 * Ghi chú thiết kế (giả định hợp lý vì đề không nêu chi tiết bố trí quân):
 *  - Mỗi bên có 9 quân: 3 Búa, 3 Bao, 3 Kéo.
 *  - Người chơi 1 (P1) xếp quân ở 2 hàng gần hàng 1, người chơi 2 (P2)
 *    xếp quân đối xứng 180 độ ở 2 hàng gần hàng 9.
 *  - Ô a1 và ô i9 luôn để trống lúc bắt đầu (đây là 2 ô "đích thắng").
 * Có thể chỉnh lại bố trí quân trong hàm createInitialBoard() nếu nhóm
 * muốn theo luật khác.
 */

export const SIZE = 9;
export const COLS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
export const TYPES = ['rock', 'paper', 'scissors'];

export const TYPE_LABEL = {
  rock: 'Búa',
  paper: 'Bao',
  scissors: 'Kéo',
};

export const TYPE_ICON = {
  rock: '✊',
  paper: '✋',
  scissors: '✌️',
};

export const PLAYERS = ['P1', 'P2'];

// col index (0..8) <-> letter
export function colToLetter(c) {
  return COLS[c];
}
export function letterToCol(l) {
  return COLS.indexOf(l);
}

// {row,col} (0-indexed) -> "b3" ; row 0 = hàng "1"
export function posToStr(pos) {
  return `${COLS[pos.col]}${pos.row + 1}`;
}
export function strToPos(s) {
  const col = letterToCol(s[0]);
  const row = parseInt(s.slice(1), 10) - 1;
  return { row, col };
}

export function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

export function samePos(a, b) {
  return a && b && a.row === b.row && a.col === b.col;
}

// rock thắng scissors, scissors thắng paper, paper thắng rock
export function beats(typeA, typeB) {
  return (
    (typeA === 'rock' && typeB === 'scissors') ||
    (typeA === 'scissors' && typeB === 'paper') ||
    (typeA === 'paper' && typeB === 'rock')
  );
}

const WIN_SQUARES = [
  { row: 0, col: 0 }, // a1
  { row: 8, col: 8 }, // i9
];

export function isWinSquare(row, col) {
  return WIN_SQUARES.some((p) => p.row === row && p.col === col);
}

/**
 * Sinh bàn cờ khởi tạo.
 * board[row][col] = null | { owner: 'P1'|'P2', type: 'rock'|'paper'|'scissors' }
 */
export function createInitialBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

  // Bố trí quân P1 (gần hàng 1), chừa a1 trống.
  const p1Layout = [
    ['b1', 'rock'], ['c1', 'rock'], ['d1', 'rock'],
    ['e1', 'paper'], ['f1', 'paper'], ['g1', 'paper'],
    ['h1', 'scissors'], ['i1', 'scissors'], ['e2', 'scissors'],
  ];

  for (const [sq, type] of p1Layout) {
    const { row, col } = strToPos(sq);
    board[row][col] = { owner: 'P1', type };
  }

  // Bố trí quân P2 = đối xứng 180 độ với P1 (col a<->i, row1<->row9),
  // chừa i9 trống.
  for (const [sq, type] of p1Layout) {
    const { row, col } = strToPos(sq);
    const mRow = SIZE - 1 - row;
    const mCol = SIZE - 1 - col;
    board[mRow][mCol] = { owner: 'P2', type };
  }

  return board;
}

export function createInitialState() {
  return {
    board: createInitialBoard(),
    turn: 'P1',
    winner: null, // null | 'P1' | 'P2'
    winReason: null, // null | 'corner' | 'elimination'
    lastMove: null, // { from, to, captured }
    history: [],
  };
}

export function otherPlayer(p) {
  return p === 'P1' ? 'P2' : 'P1';
}

export function getPiece(board, row, col) {
  if (!inBounds(row, col)) return null;
  return board[row][col];
}

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

/**
 * Trả về danh sách nước đi hợp lệ (mảng {row,col}) cho quân tại (row,col).
 */
export function getValidMoves(state, row, col) {
  const { board, turn } = state;
  const piece = getPiece(board, row, col);
  if (!piece || piece.owner !== turn || state.winner) return [];

  const moves = [];
  for (const [dr, dc] of DIRECTIONS) {
    const nr = row + dr;
    const nc = col + dc;
    if (!inBounds(nr, nc)) continue;
    const target = board[nr][nc];

    if (!target) {
      moves.push({ row: nr, col: nc, capture: false });
      continue;
    }
    if (target.owner === piece.owner) continue; // quân mình chặn đường
    if (target.type === piece.type) continue; // cùng loại: chỉ chặn, không ăn
    if (beats(piece.type, target.type)) {
      moves.push({ row: nr, col: nc, capture: true });
    }
    // nếu quân mình sẽ thua -> không thêm (không được tự sát)
  }
  return moves;
}

export function isValidMove(state, from, to) {
  const moves = getValidMoves(state, from.row, from.col);
  return moves.some((m) => m.row === to.row && m.col === to.col);
}

/** Đếm số quân theo loại còn lại của 1 bên. */
export function countPiecesByType(board, owner, type) {
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (p && p.owner === owner && p.type === type) n++;
    }
  }
  return n;
}

/**
 * Áp dụng nước đi from -> to lên state (immutable: trả về state mới).
 * Ném lỗi nếu nước đi không hợp lệ.
 */
export function applyMove(state, from, to) {
  if (state.winner) throw new Error('Ván đấu đã kết thúc.');
  if (!isValidMove(state, from, to)) throw new Error('Nước đi không hợp lệ.');

  const board = state.board.map((row) => row.slice());
  const mover = state.turn;
  const piece = board[from.row][from.col];
  const captured = board[to.row][to.col]; // null hoặc quân địch bị ăn

  board[to.row][to.col] = piece;
  board[from.row][from.col] = null;

  let winner = null;
  let winReason = null;

  if (isWinSquare(to.row, to.col)) {
    winner = mover;
    winReason = 'corner';
  } else if (captured) {
    const remaining = countPiecesByType(board, captured.owner, captured.type);
    if (remaining === 0) {
      winner = mover;
      winReason = 'elimination';
    }
  }

  const lastMove = {
    from: posToStr(from),
    to: posToStr(to),
    captured: captured ? { owner: captured.owner, type: captured.type } : null,
    mover,
  };

  return {
    board,
    turn: winner ? state.turn : otherPlayer(state.turn),
    winner,
    winReason,
    lastMove,
    history: [...state.history, lastMove],
  };
}

/** Có còn nước đi hợp lệ nào cho 1 bên không (dùng để phát hiện hết nước đi, tuỳ chọn mở rộng). */
export function hasAnyMove(state, owner) {
  const { board } = state;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const p = board[r][c];
      if (p && p.owner === owner) {
        const savedTurn = state.turn;
        const moves = getValidMoves({ ...state, turn: owner }, r, c);
        if (moves.length > 0) return true;
      }
    }
  }
  return false;
}
