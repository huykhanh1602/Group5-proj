export const TYPES = ['rock', 'scissors', 'paper'];
export const LABEL = { rock: 'Búa', scissors: 'Kéo', paper: 'Bao', king: 'Vua' };
export const ICON = { rock: '✊', scissors: '✌', paper: '✋', king: '♛' };
export const coord = i => 'abcdefghi'[i % 9] + (9 - Math.floor(i / 9));
export function initialState() {
  const board = Array(81).fill(null);
  for (let x = 0; x < 9; x++) {
    board[9 + x] = { side: 1, type: TYPES[x % 3] };
    board[63 + x] = { side: 0, type: TYPES[(8 - x) % 3] };
  }
  board[4] = { side: 1, type: 'king' };
  board[76] = { side: 0, type: 'king' };
  return { board, turn: 0, ply: 0, winner: null, reason: '', history: [] };
}
export function canMove(state, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from > 80 || to > 80 || from === to || state.winner !== null) return false;
  const a = state.board[from], b = state.board[to];
  if (!a || a.side !== state.turn || Math.max(Math.abs(from % 9 - to % 9), Math.abs(Math.floor(from / 9) - Math.floor(to / 9))) !== 1) return false;
  if (!b) return true;
  if (a.side === b.side || a.type === 'king' || b.type === 'king') return false;
  return { rock: 'scissors', scissors: 'paper', paper: 'rock' }[a.type] === b.type;
}
export function move(state, from, to) {
  if (!canMove(state, from, to)) return state;
  const next = structuredClone(state), piece = next.board[from], captured = next.board[to];
  next.board[to] = piece; next.board[from] = null; next.ply++;
  next.history.push({ side: piece.side, text: `${LABEL[piece.type]} ${coord(from)} → ${coord(to)}${captured ? ` · ăn ${LABEL[captured.type]}` : ''}` });
  if (piece.type === 'king' && (to === 72 || to === 8)) {
    next.winner = piece.side; next.reason = `Vua đã tới ${coord(to)}`;
  } else {
    const missing = TYPES.find(type => !next.board.some(p => p && p.side !== piece.side && p.type === type));
    if (missing) { next.winner = piece.side; next.reason = `Đối thủ đã hết quân ${LABEL[missing]}`; }
  }
  next.turn = 1 - state.turn;
  return next;
}
// Immutable operation IDs let concurrent writes merge without overwriting a board.
// Replay validates seats, turns and revision; stale or duplicate moves are ignored.
export function replay(log) {
  let game = initialState(), round = 0, seats = [null, null], votes = [];
  const ops = Object.values(log).filter(o => o && typeof o.id === 'string' && Number.isSafeInteger(o.clock) && o.clock >= 0 && typeof o.actor === 'string')
    .sort((a, b) => a.clock - b.clock || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const o of ops) {
    if (o.kind === 'join' && (o.side === 0 || o.side === 1) && !seats[o.side] && !seats.some(s => s?.id === o.actor)) seats[o.side] = { id: o.actor, name: String(o.name || 'Người chơi').slice(0, 24) };
    if (o.kind === 'leave') { seats = seats.map(s => s?.id === o.actor ? null : s); votes = []; }
    const side = seats.findIndex(s => s?.id === o.actor);
    if (side < 0 || o.round !== round) continue;
    if (o.kind === 'move' && seats.every(Boolean) && side === game.turn && o.ply === game.ply) game = move(game, o.from, o.to);
    if (o.kind === 'reset' && !votes.includes(side)) {
      votes.push(side);
      if (votes.length === 2) { game = initialState(); round++; votes = []; }
    }
  }
  return { game, seats, round, votes };
}
