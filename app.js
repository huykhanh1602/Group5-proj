import { initialState, canMove, move, replay, ICON, LABEL, TYPES, coord } from './game.js';
const $ = id => document.getElementById(id);
const team = side => side === 0 ? 'Xanh' : 'Cam';
let game = initialState(), selected = null, channel = null, shared = null, connected = false;
const params = new URLSearchParams(location.search), room = params.get('room');
const actor = sessionStorage.getItem('ott-player') || crypto.randomUUID();
sessionStorage.setItem('ott-player', actor);
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').style.display = 'none', 4000); }
function mySide() { return shared ? shared.seats.findIndex(s => s?.id === actor) : game.turn; }
function render() {
  const focused = document.activeElement?.dataset?.index;
  const board = $('board'); board.replaceChildren();
  for (let i = 0; i < 81; i++) {
    const p = game.board[i], button = document.createElement('button');
    button.className = `cell ${(Math.floor(i / 9) + i % 9) % 2 ? 'dark' : ''} ${i === 72 || i === 8 ? 'goal' : ''} ${selected === i ? 'selected' : ''} ${selected !== null && canMove(game, selected, i) ? 'legal' : ''}`;
    button.dataset.index = i;
    button.setAttribute('aria-label', `${coord(i)}${p ? `, ${LABEL[p.type]} đội ${team(p.side)}` : ', ô trống'}${i === 72 || i === 8 ? ', ô đích' : ''}`);
    button.setAttribute('aria-pressed', String(selected === i));
    if (i % 9 === 0) { const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = 9 - Math.floor(i / 9); button.append(rank); }
    if (i === 72 || i === 8) { const star = document.createElement('span'); star.className = 'goal-mark'; star.textContent = '✦'; button.append(star); }
    if (p) { const piece = document.createElement('span'); piece.className = `piece side-${p.side} ${p.type}`; piece.textContent = ICON[p.type]; button.append(piece); }
    button.onclick = () => select(i); board.append(button);
  }
  if (focused !== undefined) board.children[Number(focused)]?.focus({ preventScroll: true });
  for (const side of [0, 1]) {
    $('player-' + side).textContent = shared ? shared.seats[side]?.name || `Đội ${team(side)} · chưa có người` : `Đội ${team(side)}`;
    $('count-' + side).textContent = TYPES.map(t => `${ICON[t]} ${game.board.filter(p => p?.side === side && p.type === t).length}`).join('  ');
  }
  $('turn').textContent = game.winner !== null ? `Đội ${team(game.winner)} thắng!` : `Lượt đội ${team(game.turn)}`;
  $('turn-symbol').textContent = game.winner !== null ? '♛' : '✳';
  $('status').textContent = game.winner !== null ? game.reason : room && !connected ? 'Đang chờ kết nối phòng chơi…' : shared && !shared.seats.every(Boolean) ? 'Cần đủ hai người chọn đội để bắt đầu.' : selected !== null ? `${LABEL[game.board[selected].type]} ${coord(selected)} · chọn ô được đánh dấu.` : shared && mySide() !== game.turn ? 'Theo dõi nước đi của người chơi.' : 'Chọn một quân của bạn để bắt đầu.';
  $('ply').textContent = String(game.ply).padStart(2, '0');
  $('history').replaceChildren();
  if (!game.history.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Những nước đi hay bắt đầu từ đây.'; $('history').append(li); }
  game.history.slice().reverse().forEach((h, i) => { const li = document.createElement('li'); li.textContent = `${game.ply - i}. ${team(h.side)} · ${h.text}`; $('history').append(li); });
  if (shared) {
    const side = mySide(); $('role').textContent = side < 0 ? 'Bạn đang là khán giả.' : `Bạn chơi đội ${team(side)}.`;
    for (const s of [0, 1]) $('join-' + s).disabled = !connected || !!shared.seats[s] || side >= 0;
    $('leave').disabled = side < 0 || !connected;
    $('reset').disabled = side < 0 || !connected || !shared.seats.every(Boolean);
    $('reset').textContent = shared.votes.includes(side) ? 'Đã yêu cầu · chờ đối thủ' : shared.votes.length ? 'Đồng ý chơi lại' : '↻ Chơi lại';
  } else {
    $('reset').disabled = !!room;
    for (const side of [0, 1]) $('join-' + side).disabled = !!room;
    $('leave').disabled = !!room;
  }
}
function select(i) {
  if (game.winner !== null) return;
  if (room && (!connected || !shared?.seats.every(Boolean) || mySide() !== game.turn)) return toast('Hãy đợi đủ hai người và đến lượt của bạn.');
  if (selected === i) { selected = null; return render(); }
  if (game.board[i]?.side === game.turn) { selected = i; return render(); }
  if (selected === null) return toast('Chọn quân của đội đang đi trước.');
  if (!canMove(game, selected, i)) return toast('Nước đi không hợp lệ. Chọn ô được đánh dấu.');
  if (shared) send({ kind: 'move', from: selected, to: i, ply: game.ply });
  else game = move(game, selected, i);
  selected = null; render();
}
function send(data) {
  if (!connected || !channel) return;
  const log = channel.getData();
  const clock = Math.max(0, ...Object.values(log).map(o => Number.isSafeInteger(o?.clock) ? o.clock : 0)) + 1;
  const id = crypto.randomUUID();
  channel.setData(draft => { draft[id] = { ...data, id, actor, clock, round: shared?.round || 0 }; });
}
function showMode(online) { $('room-form').hidden = !online || !!room; $('local-info').hidden = online; $('local').classList.toggle('active', !online); $('online').classList.toggle('active', online); }
$('online').onclick = () => showMode(true);
$('local').onclick = () => { if (room) location.href = location.pathname; else showMode(false); };
function enter(code) { const url = new URL(location.href); url.search = ''; url.searchParams.set('room', code); sessionStorage.setItem('ott-name', $('name').value.trim() || 'Người chơi'); location.href = url.href; }
$('room-form').onsubmit = e => { e.preventDefault(); enter($('room').value.trim().toLowerCase()); };
$('create').onclick = () => enter(crypto.randomUUID().slice(0, 8));
$('name').value = sessionStorage.getItem('ott-name') || 'Người chơi';
$('copy').onclick = async () => { try { await navigator.clipboard.writeText(location.href); toast('Đã sao chép liên kết mời.'); } catch { toast('Hãy sao chép địa chỉ trang trên thanh trình duyệt.'); } };
for (const side of [0, 1]) $('join-' + side).onclick = () => send({ kind: 'join', side, name: sessionStorage.getItem('ott-name') || 'Người chơi' });
$('leave').onclick = () => send({ kind: 'leave' });
$('reset').onclick = () => { if (shared) send({ kind: 'reset' }); else if (confirm('Bắt đầu ván mới?')) { game = initialState(); selected = null; render(); } };
$('rules-button').onclick = () => $('rules').showModal(); $('close-rules').onclick = () => $('rules').close();
$('board').onkeydown = e => { const i = Number(e.target.dataset.index); const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[e.key]; if (delta && Number.isInteger(i)) { e.preventDefault(); $('board').children[Math.max(0, Math.min(80, i + delta))].focus(); } };
function fail() { connected = false; $('connection').textContent = '● Mất kết nối'; toast('Không kết nối được playhtml. Kiểm tra mạng rồi tải lại trang.'); render(); }
render();
if (room) {
  showMode(true); $('room-info').hidden = false; $('room-label').textContent = `Phòng / ${room}`; $('connection').textContent = '● Đang kết nối…';
  try {
    const { playhtml } = await Promise.race([import('https://unpkg.com/playhtml@2.14.1/dist/playhtml.es.js'), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 20000))]);
    await Promise.race([playhtml.init({ room: `group5-ottv2-${room}`, onError: fail }), new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 20000))]);
    channel = playhtml.createPageData('ott-v2-operations-v1', {});
    const update = log => { shared = replay(log); game = shared.game; selected = null; render(); };
    connected = true; channel.onUpdate(update); update(channel.getData());
    $('connection').textContent = '● Đã kết nối playhtml';
    playhtml.users.me.name = sessionStorage.getItem('ott-name') || 'Người chơi';
    const updateUsers = users => $('presence').textContent = `${users.length} người trong phòng`;
    updateUsers(playhtml.users.getAll()); playhtml.users.onChange(updateUsers);
    window.addEventListener('offline', fail);
  } catch (error) { console.error(error); fail(); }
}
