import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, canMove, move, replay, coord } from './game.js';
test('initial board, coordinates and eight directions', () => {
  const s = initialState(); assert.equal(s.board.filter(Boolean).length, 18); assert.equal(coord(72), 'a1'); assert.equal(coord(8), 'i9');
  for (const side of [0,1]) for (const type of ['rock','scissors','paper']) assert.equal(s.board.filter(p => p?.side === side && p.type === type).length,3);
  s.board[40] = { side: 0, type: 'rock' };
  for (const to of [30,31,32,39,41,48,49,50]) assert.ok(canMove(s,40,to));
  for (const to of [40,42,-1,81,0]) assert.ok(!canMove(s,40,to));
  assert.ok(!canMove(s,9,18));
});
test('complete capture matrix and allies', () => {
  for (const a of ['rock','scissors','paper']) for (const b of ['rock','scissors','paper']) {
    const s = initialState(); s.board[40] = { side:0,type:a }; s.board[41] = { side:1,type:b };
    assert.equal(canMove(s,40,41), { rock:'scissors',scissors:'paper',paper:'rock' }[a] === b);
    s.board[41].side = 0; assert.equal(canMove(s,40,41),false);
  }
});
test('capturing the last member of any type wins, partial capture does not', () => {
  for (const [a,b] of [['rock','scissors'],['scissors','paper'],['paper','rock']]) {
    const s = initialState(); s.board = s.board.map(p => p?.side === 1 && p.type === b ? null : p);
    s.board[40] = { side:0,type:a }; s.board[41] = { side:1,type:b };
    assert.equal(move(s,40,41).winner,0);
    s.board[42] = { side:1,type:b }; assert.equal(move(s,40,41).winner,null);
  }
});
test('corners are ordinary squares and finished games reject moves', () => {
  for (const side of [0,1]) for (const [from,to] of [[73,72],[7,8]]) {
    const s = initialState(); s.turn = side; s.board[from] = { side,type:'rock' };
    const n = move(s,from,to); assert.equal(n.winner,null);
    n.winner = side; assert.equal(move(n,63,54),n);
  }
});
test('move is immutable and alternates turns', () => { const s = initialState(), n = move(s,63,54); assert.equal(n.turn,1); assert.equal(n.ply,1); assert.equal(s.ply,0); assert.ok(s.board[63]); assert.equal(n.history.length,1); });
test('concurrent seat claims and stale moves converge independent of key order', () => {
  const ops = [
    { id:'a',clock:1,actor:'A',kind:'join',side:0 }, { id:'b',clock:1,actor:'B',kind:'join',side:0 },
    { id:'c',clock:2,actor:'C',kind:'join',side:1 },
    { id:'d',clock:3,actor:'B',kind:'move',round:0,ply:0,from:63,to:54 },
    { id:'e',clock:4,actor:'A',kind:'move',round:0,ply:0,from:63,to:54 },
    { id:'f',clock:4,actor:'A',kind:'move',round:0,ply:0,from:64,to:55 }
  ];
  const log = Object.fromEntries(ops.map(o => [o.id,o])); const a = replay(log);
  assert.equal(a.seats[0].id,'A'); assert.equal(a.game.ply,1);
  assert.deepEqual(a,replay(Object.fromEntries(Object.entries(log).reverse())));
  log.g = { id:'g',clock:5,actor:'A',kind:'reset',round:0 }; assert.equal(replay(log).game.ply,1);
  log.h = { id:'h',clock:6,actor:'C',kind:'reset',round:0 }; assert.equal(replay(log).round,1); assert.equal(replay(log).game.ply,0);
});
