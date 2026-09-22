import { initialState, canMove, move, replay, ICON, LABEL, TYPES, BASES, coord } from './game.js';
import { Matchmaker } from './matchmaking.js';
const $ = id => document.getElementById(id);
const team = side => side === 0 ? 'Xanh' : 'Cam';
let game = initialState(), selected = null, channel = null, shared = null, connected = false;
const params = new URLSearchParams(location.search), room = params.get('room');
let mode = room || params.has('match') ? 'online' : 'local', localGame = game;
let matchmaker = null, lobbyPromise = null, searchRequested = false;
const actor = sessionStorage.getItem('ott-player') || crypto.randomUUID();
sessionStorage.setItem('ott-player', actor);
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').style.display = 'none', 4000); }
function mySide() { return mode === 'local' ? game.turn : shared?.seats.findIndex(s => s?.id === actor) ?? -1; }
function render() {
  const online = mode === 'online';
  $('connection').textContent = !online ? '● 2 người · cùng một máy' : !room ? '● Trực tuyến · chưa vào phòng' : connected ? '● Đã kết nối playhtml' : '● Chưa kết nối';
  $('room-form').hidden = !online || !!room;
  $('room-info').hidden = !online || !room;
  $('local-info').hidden = online;
  $('local').classList.toggle('active', !online);
  $('online').classList.toggle('active', online);
  $('local').setAttribute('aria-pressed', String(!online));
  $('online').setAttribute('aria-pressed', String(online));
  const focused = document.activeElement?.dataset?.index;
  const board = $('board'); board.replaceChildren();
  for (let i = 0; i < 81; i++) {
    const p = game.board[i], button = document.createElement('button');
    button.className = `cell ${(Math.floor(i / 9) + i % 9) % 2 ? 'dark' : ''} ${selected === i ? 'selected' : ''} ${selected !== null && canMove(game, selected, i) ? 'legal' : ''}`;
    button.dataset.index = i;
    const baseSide = BASES.indexOf(i);
    if (baseSide >= 0) {
      button.classList.add('base', `base-${baseSide}`);
      const marker = document.createElement('span');
      marker.className = 'base-marker'; marker.textContent = '⚑';
      marker.setAttribute('aria-hidden', 'true'); button.append(marker);
    }
    button.disabled = online && (!connected || !shared?.seats.every(Boolean) || mySide() !== game.turn);
    button.setAttribute('aria-label', `${coord(i)}${p ? `, ${LABEL[p.type]} đội ${team(p.side)}` : ', ô trống'}${baseSide >= 0 ? `, ô bảo vệ đội ${team(baseSide)}` : ''}`);
    button.setAttribute('aria-pressed', String(selected === i));
    if (i % 9 === 0) { const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = 9 - Math.floor(i / 9); button.append(rank); }
    if (p) { const piece = document.createElement('span'); piece.className = `piece side-${p.side} ${p.type}`; piece.textContent = ICON[p.type]; button.append(piece); }
    button.onclick = () => select(i); board.append(button);
  }
  if (focused !== undefined) board.children[Number(focused)]?.focus({ preventScroll: true });
  for (const side of [0, 1]) {
    $('player-' + side).textContent = online ? shared?.seats[side]?.name || `Đội ${team(side)} · chưa có người` : `Người chơi ${side + 1} · Đội ${team(side)}`;
    $('count-' + side).textContent = TYPES.map(t => `${ICON[t]} ${game.board.filter(p => p?.side === side && p.type === t).length}`).join('  ');
  }
  $('turn').textContent = game.winner !== null ? `Đội ${team(game.winner)} thắng!` : `Lượt đội ${team(game.turn)}`;
  $('turn-symbol').textContent = game.winner !== null ? '★' : '✳';
  $('status').textContent = online && !room ? 'Tạo phòng hoặc nhập mã phòng để chơi với người khác.' : online && !connected ? 'Đang chờ kết nối phòng chơi. Nếu mất mạng, hãy tải lại trang.' : game.winner !== null ? game.reason : online && !shared?.seats.every(Boolean) ? 'Cần đủ hai người chọn đội để bắt đầu.' : selected !== null ? `${LABEL[game.board[selected].type]} ${coord(selected)} · chọn ô được đánh dấu.` : online ? (mySide() < 0 ? 'Bạn đang xem trận đấu.' : mySide() !== game.turn ? 'Đang chờ đối thủ đi.' : 'Đến lượt bạn. Chọn quân của đội mình.') : `Người chơi ${game.turn + 1}: chọn quân đội ${team(game.turn)}. Hai người dùng chung chuột hoặc bàn phím.`;
  $('ply').textContent = String(game.ply).padStart(2, '0');
  $('history').replaceChildren();
  if (!game.history.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Những nước đi hay bắt đầu từ đây.'; $('history').append(li); }
  game.history.slice().reverse().forEach((h, i) => { const li = document.createElement('li'); li.textContent = `${game.ply - i}. ${team(h.side)} · ${h.text}`; $('history').append(li); });
  if (online && shared) {
    const side = mySide(); $('role').textContent = side < 0 ? 'Bạn đang là khán giả.' : `Bạn chơi đội ${team(side)}.`;
    for (const s of [0, 1]) $('join-' + s).disabled = !connected || !!shared.seats[s] || side >= 0;
    $('leave').disabled = side < 0 || !connected;
    $('reset').disabled = side < 0 || !connected || !shared.seats.every(Boolean) || shared.votes.includes(side);
    $('reset').textContent = shared.votes.includes(side) ? 'Đã yêu cầu · chờ đối thủ' : shared.votes.length ? 'Đồng ý chơi lại' : '↻ Chơi lại';
  } else {
    $('reset').disabled = online;
    $('reset').textContent = '↻ Chơi lại';
    for (const side of [0, 1]) $('join-' + side).disabled = !!room;
    $('leave').disabled = !!room;
  }
}
function select(i) {
  if (game.winner !== null) return;
  if (mode === 'online' && (!connected || !shared?.seats.every(Boolean) || mySide() !== game.turn)) return toast('Hãy vào phòng, đợi đủ hai người và đến lượt của bạn.');
  if (selected === i) { selected = null; return render(); }
  if (game.board[i]?.side === game.turn) { selected = i; return render(); }
  if (selected === null) return toast('Chọn quân của đội đang đi trước.');
  if (!canMove(game, selected, i)) return toast('Nước đi không hợp lệ. Chọn ô được đánh dấu.');
  if (mode === 'online') send({ kind: 'move', from: selected, to: i, ply: game.ply });
  else { game = move(game, selected, i); localGame = game; }
  selected = null; render();
}
function send(data) {
  if (!connected || !channel) return;
  const log = channel.getData();
  const clock = Math.max(0, ...Object.values(log).map(o => Number.isSafeInteger(o?.clock) ? o.clock : 0)) + 1;
  const id = crypto.randomUUID();
  channel.setData(draft => { draft[id] = { ...data, id, actor, clock, round: shared?.round || 0 }; });
}
function showMode(online) {
  if (!online) cancelSearch();
  if (mode === 'local') localGame = game;
  if (!online && mode === 'online' && mySide() >= 0) send({ kind: 'leave' });
  mode = online ? 'online' : 'local';
  game = online ? shared?.game || initialState() : localGame;
  selected = null;
  render();
}
$('online').onclick = () => { showMode(true); if (!room) startSearch(); };
$('local').onclick = () => showMode(false);
function enter(code) { cancelSearch(); const url = new URL(location.href); url.search = ''; url.searchParams.set('room', code); sessionStorage.setItem('ott-name', $('name').value.trim() || 'Người chơi'); location.href = url.href; }
$('room-form').onsubmit = e => { e.preventDefault(); enter($('room').value.trim().toLowerCase()); };
$('create').onclick = () => enter(crypto.randomUUID().slice(0, 8));
$('name').value = sessionStorage.getItem('ott-name') || 'Người chơi';
function cancelSearch() {
  searchRequested = false; matchmaker?.stop();
  $('find-match').disabled = false; $('cancel-match').hidden = true;
  $('match-status').textContent = 'Chọn Tìm đối thủ hoặc tạo phòng riêng bên dưới.';
}
async function startSearch() {
  if (searchRequested || room) return;
  searchRequested = true; $('find-match').disabled = true; $('cancel-match').hidden = false;
  $('match-status').textContent = 'Đang kết nối sảnh ghép trận…';
  try {
    lobbyPromise ||= (async () => {
      const { playhtml } = await import('https://unpkg.com/playhtml@2.14.1/dist/playhtml.es.js');
      await playhtml.init({ room:'group5-ottv2-matchmaking-v1', onError: () => {
        cancelSearch(); $('match-status').textContent = 'Không kết nối được sảnh. Hãy tải lại để thử lại.';
      } });
      return playhtml;
    })();
    const client = await Promise.race([lobbyPromise, new Promise((_,reject) => setTimeout(() => reject(new Error('Timeout')), 20000))]);
    if (!searchRequested || mode !== 'online') return;
    matchmaker ||= new Matchmaker(client, actor, message => $('match-status').textContent = message, (match, side) => {
      if (!searchRequested || mode !== 'online') return;
      sessionStorage.setItem('ott-auto-seat', JSON.stringify({ room:match.room, side }));
      $('match-status').textContent = 'Đã tìm được đối thủ. Đang vào phòng…';
      enter(match.room);
    });
    const name = $('name').value.trim() || 'Người chơi'; sessionStorage.setItem('ott-name',name);
    matchmaker.start(name);
  } catch (error) { cancelSearch(); $('match-status').textContent = 'Không kết nối được sảnh. Hãy tải lại trang để thử lại.'; console.error(error); }
}
$('find-match').onclick = startSearch;
$('cancel-match').onclick = cancelSearch;
$('back-lobby').onclick = () => {
  if (mySide() >= 0) send({ kind:'leave' });
  const url = new URL(location.href); url.search = '?match=1'; location.href = url.href;
};
window.addEventListener('pagehide', cancelSearch);
window.addEventListener('offline', cancelSearch);
$('copy').onclick = async () => {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  try {
    await navigator.clipboard.writeText(location.href);
    toast(local ? 'Đã sao chép link chạy thử trên máy này. Để mời người ở xa, hãy mở bản web HTTPS công khai rồi tạo phòng.' : 'Đã sao chép liên kết mời. Gửi link này cho bạn để vào cùng phòng.');
  } catch { toast('Hãy sao chép địa chỉ trang trên thanh trình duyệt.'); }
};
for (const side of [0, 1]) $('join-' + side).onclick = () => {
  const name = $('room-name').value.trim() || 'Người chơi';
  sessionStorage.setItem('ott-name', name);
  send({ kind: 'join', side, name });
};
$('room-name').value = sessionStorage.getItem('ott-name') || 'Người chơi';
$('leave').onclick = () => send({ kind: 'leave' });
$('reset').onclick = () => { if (mode === 'online') send({ kind: 'reset' }); else if (confirm('Bắt đầu ván mới?')) { game = initialState(); localGame = game; selected = null; render(); } };
$('rules-button').onclick = () => $('rules').showModal(); $('close-rules').onclick = () => $('rules').close();
$('board').onkeydown = e => { const i = Number(e.target.dataset.index); const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key]; if (delta && Number.isInteger(i)) { e.preventDefault(); $('board').children[Math.max(0, Math.min(80, i + delta))].focus(); } };
function fail() { connected = false; $('connection').textContent = '● Mất kết nối'; toast('Không kết nối được playhtml. Kiểm tra mạng rồi tải lại trang.'); render(); }
render();
if (!room && params.has('match')) startSearch();
if (room) {
  showMode(true); $('room-info').hidden = false; $('room-label').textContent = `Phòng / ${room}`; $('connection').textContent = '● Đang kết nối…';
  try {
    const { playhtml } = await Promise.race([import('https://unpkg.com/playhtml@2.14.1/dist/playhtml.es.js'), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 20000))]);
    await Promise.race([playhtml.init({ room: `group5-ottv2-${room}`, onError: fail }), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 20000))]);
    channel = playhtml.createPageData('ott-v2-operations-v3', {});
    const update = log => { shared = replay(log); if (mode === 'online') { game = shared.game; selected = null; } render(); };
    connected = true; channel.onUpdate(update); update(channel.getData());
    let autoSeat;
    try { autoSeat = JSON.parse(sessionStorage.getItem('ott-auto-seat') || 'null'); } catch { /* Ignore invalid saved preference. */ }
    if (autoSeat?.room === room && [0,1].includes(autoSeat.side) && !shared.seats.some(s => s?.id === actor)) {
      send({ kind:'join', side:autoSeat.side, name:sessionStorage.getItem('ott-name') || 'Người chơi' });
    }
    render();
    playhtml.users.me.name = sessionStorage.getItem('ott-name') || 'Người chơi';
    const updateUsers = users => $('presence').textContent = `${users.length} người trong phòng`;
    updateUsers(playhtml.users.getAll()); playhtml.users.onChange(updateUsers);
    window.addEventListener('offline', fail);
  } catch (error) { console.error(error); fail(); }
}
