// Random ticket IDs shuffle the queue. A ticket chooses only one opponent;
// a match is committed only when both tickets choose each other.
export function queuePlayers(data, presences, now) {
  const tickets = new Set([...presences.values()].map(p => p.ottQueue)
    .filter(p => p && now - p.at < 12000 && now >= p.at - 12000).map(p => p.ticket));
  // Presence may group tabs under one browser identity. Per-ticket leases keep
  // each game session visible and expire closed tabs without relying on unload.
  for (const p of Object.values(data)) {
    if (p?.kind === 'ticket' && Number.isFinite(p.lastSeen) && now - p.lastSeen < 12000 && now >= p.lastSeen - 12000) tickets.add(p.id);
  }
  const used = new Set(Object.values(data).filter(v => v?.kind === 'match').flatMap(v => v.tickets));
  return [...tickets].map(id => data[id]).filter(p => p?.kind === 'ticket' && !p.cancelled && !used.has(p.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}
export function partnerFor(players, ticket) {
  const index = players.findIndex(p => p.id === ticket);
  return index < 0 ? null : players[index % 2 ? index - 1 : index + 1] || null;
}
export function mutualMatch(data, players, ticket) {
  const a = players.find(p => p.id === ticket), b = players.find(p => p.id === a?.choice);
  if (!a || !b || a.id === b.id || a.actor === b.actor || b.choice !== a.id) return null;
  const pair = [a,b].sort((x,y) => x.id.localeCompare(y.id));
  return { kind: 'match', id: `match-${pair[0].id}-${pair[1].id}`, room: `auto-${pair[0].id.slice(0,12)}-${pair[1].id.slice(0,12)}`,
    tickets: pair.map(p => p.id), players: pair.map(p => ({ id:p.actor, name:p.name })) };
}
export class Matchmaker {
  constructor(client, actor, onStatus, onMatch) {
    this.client = client; this.actor = actor; this.onStatus = onStatus; this.onMatch = onMatch;
    this.data = client.createPageData('ott-matchmaking-v1', {});
  }
  start(name) {
    this.stop(); this.name = name; this.active = true; this.newTicket();
    this.timer = setInterval(() => this.tick(), 500);
  }
  newTicket() {
    this.ticket = crypto.randomUUID(); this.chosenAt = 0;
    this.write(this.ticket, { kind:'ticket', id:this.ticket, actor:this.actor, name:this.name, choice:null });
    this.heartbeat();
  }
  write(key, value) { this.data.setData(draft => { draft[key] = value; }); }
  heartbeat() {
    const at = Date.now(), own = this.data.getData()[this.ticket];
    if (own && !own.cancelled) this.write(this.ticket, { ...own, lastSeen:at });
    this.client.presence.setMyPresence('ottQueue', { ticket:this.ticket, at });
  }
  stop() {
    clearInterval(this.timer);
    if (this.active) {
      const current = this.data.getData()[this.ticket];
      if (current) this.write(this.ticket, { ...current, cancelled:true });
      this.client.presence.setMyPresence('ottQueue', null);
    }
    this.active = false;
  }
  tick() {
    if (!this.active) return;
    try {
      const now = Date.now(), data = this.data.getData();
      const committed = Object.values(data).find(m => m?.kind === 'match' && m.tickets.includes(this.ticket));
      if (committed) {
        const side = committed.tickets.indexOf(this.ticket);
        this.stop(); this.onMatch(committed, side); return;
      }
      if (!this.lastBeat || now - this.lastBeat >= 2000) { this.heartbeat(); this.lastBeat = now; }
      const players = queuePlayers(data, this.client.presence.getPresences(), now);
      this.onStatus(`Đang tìm đối thủ… ${players.length} người đang chờ. Bạn có thể hủy để tạo phòng riêng.`);
      const match = mutualMatch(data, players, this.ticket);
      if (match) { this.write(match.id, match); return; }
      const own = data[this.ticket];
      if (!own) return;
      if (own.choice) {
        // A disconnected or differently paired peer cannot hold the queue forever.
        if (now - this.chosenAt > 8000) {
          this.write(this.ticket, { ...own, cancelled:true }); this.newTicket();
        }
        return;
      }
      const partner = partnerFor(players, this.ticket);
      if (partner && partner.actor !== this.actor) {
        this.chosenAt = now; this.write(this.ticket, { ...own, choice:partner.id });
      }
    } catch (error) { this.stop(); this.onStatus('Mất kết nối khi tìm trận. Hãy tải lại trang để thử lại.'); console.error(error); }
  }
}
