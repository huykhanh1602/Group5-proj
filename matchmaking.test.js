import test from 'node:test';
import assert from 'node:assert/strict';
import { queuePlayers, partnerFor, mutualMatch, Matchmaker } from './matchmaking.js';
function fixture(n) {
  const data = {}, presence = new Map();
  for (let i = 0; i < n; i++) {
    const id = `ticket-${i}`;
    data[id] = { kind:'ticket', id, actor:`actor-${i}`, name:`Player ${i}`, choice:null };
    presence.set(id, { ottQueue:{ ticket:id, at:10000 } });
  }
  return {data,presence};
}
test('six visitors form three disjoint pairs; shuffled input gives same pairs', () => {
  const {data,presence} = fixture(6);
  const players = queuePlayers(data,presence,10000);
  for (const p of players) data[p.id].choice = partnerFor(players,p.id).id;
  const matches = new Map(players.map(p => { const m = mutualMatch(data,players,p.id); return [m.id,m]; }));
  assert.equal(matches.size,3);
  assert.equal(new Set([...matches.values()].flatMap(m => m.tickets)).size,6);
  assert.deepEqual(queuePlayers(data,new Map([...presence].reverse()),10000),players);
});
test('odd visitor waits and absent, stale, cancelled and matched players are excluded', () => {
  const {data,presence} = fixture(5);
  let players = queuePlayers(data,presence,10000);
  assert.equal(partnerFor(players,'ticket-4'),null);
  data['ticket-0'].cancelled = true; presence.delete('ticket-1');
  presence.get('ticket-2').ottQueue.at = -3000;
  data.m = { kind:'match', tickets:['ticket-3'] };
  assert.deepEqual(queuePlayers(data,presence,10000).map(p => p.id),['ticket-4']);
});
test('one-sided and conflicting offers never produce a match', () => {
  const {data,presence} = fixture(4);
  const players = queuePlayers(data,presence,10000);
  players[0].choice = players[1].id; players[1].choice = players[2].id; players[2].choice = players[1].id;
  assert.equal(mutualMatch(data,players,players[0].id),null);
  assert.ok(mutualMatch(data,players,players[1].id));
  players[2].actor = players[1].actor;
  assert.equal(mutualMatch(data,players,players[1].id),null);
});
test('per-tab leases work when browser presence is shared and expire after disconnect', () => {
  const {data} = fixture(2);
  data['ticket-0'].lastSeen = 10000; data['ticket-1'].lastSeen = 10000;
  assert.equal(queuePlayers(data,new Map(),11000).length,2);
  assert.equal(queuePlayers(data,new Map(),23000).length,0);
});
test('two clients commit once, cancel cleanly and requeue with fresh tickets', () => {
  const state = {}, presence = new Map(), delivered = [];
  function client(id) { return {
    createPageData: () => ({getData:() => state,setData: fn => fn(state)}),
    presence:{getPresences:() => presence,setMyPresence:(_channel,value) => value ? presence.set(id,{ottQueue:value}) : presence.delete(id)}
  }; }
  const a = new Matchmaker(client('a'),'a',()=>{},(m,s)=>delivered.push([m.room,s]));
  const b = new Matchmaker(client('b'),'b',()=>{},(m,s)=>delivered.push([m.room,s]));
  try {
    a.start('A'); b.start('B');
    for (let i=0;i<4;i++) { a.tick(); b.tick(); }
    assert.equal(delivered.length,2); assert.equal(delivered[0][0],delivered[1][0]); assert.notEqual(delivered[0][1],delivered[1][1]);
    const old = a.ticket; a.start('A'); assert.notEqual(a.ticket,old); a.stop();
    assert.equal(state[a.ticket].cancelled,true); assert.equal(presence.size,0);
  } finally { a.stop(); b.stop(); }
});
