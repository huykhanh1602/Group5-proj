/**
 * OTTv2 multiplayer server
 * -------------------------------------------------------------
 * - Phục vụ giao diện tĩnh trong /public
 * - Quản lý nhiều "phòng" (room), mỗi phòng tối đa 2 người chơi
 *   (P1, P2) + không giới hạn khán giả (spectator).
 * - Server giữ trạng thái ván đấu "chuẩn" (authoritative state) và
 *   dùng lại đúng luật trong shared/gameLogic.js để xác thực mọi
 *   nước đi gửi lên từ client -> chống gian lận / lệch trạng thái.
 *
 * Chạy:
 *   cd server && npm install && npm start
 *   Mở http://localhost:8080/?room=abc  (2 tab/2 máy khác nhau
 *   cùng ?room=abc sẽ là 2 đối thủ, người thứ 3 trở đi là khán giả)
 *
 * Ghi chú: nếu môn học yêu cầu dùng thư viện "playfull.html" cụ
 * thể để dựng server, hãy thay lớp WebSocketServer/room bên dưới
 * bằng API của thư viện đó — phần luật chơi (shared/gameLogic.js)
 * và giao diện client (public/) có thể tái sử dụng nguyên vẹn.
 */

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import {
  createInitialState, applyMove, strToPos, posToStr,
} from '../shared/gameLogic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
// Cho phép client fetch shared/gameLogic.js trực tiếp (dùng chung code luật chơi)
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/** rooms: Map<roomId, RoomData> */
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      state: createInitialState(),
      players: { P1: null, P2: null }, // ws instance đang giữ slot đó
      spectators: new Set(),
    });
  }
  return rooms.get(roomId);
}

function roomStatus(room) {
  return {
    P1: !!room.players.P1,
    P2: !!room.players.P2,
    spectators: room.spectators.size,
  };
}

function broadcast(room, roomId) {
  const payload = JSON.stringify({
    type: 'state',
    room: roomId,
    state: room.state,
    players: roomStatus(room),
  });
  const all = [room.players.P1, room.players.P2, ...room.spectators].filter(Boolean);
  for (const ws of all) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = (url.searchParams.get('room') || 'default').trim().slice(0, 40) || 'default';
  const room = getOrCreateRoom(roomId);

  // Gán vai trò: P1 trống -> P1, P2 trống -> P2, ngược lại -> khán giả
  let role;
  if (!room.players.P1) {
    room.players.P1 = ws;
    role = 'P1';
  } else if (!room.players.P2) {
    room.players.P2 = ws;
    role = 'P2';
  } else {
    room.spectators.add(ws);
    role = 'spectator';
  }

  ws._role = role;
  ws._roomId = roomId;

  send(ws, { type: 'welcome', you: role, room: roomId });
  broadcast(room, roomId);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { type: 'error', message: 'JSON không hợp lệ.' });
    }

    if (msg.type === 'move') {
      if (ws._role !== 'P1' && ws._role !== 'P2') {
        return send(ws, { type: 'error', message: 'Khán giả không thể đi quân.' });
      }
      if (room.state.winner) {
        return send(ws, { type: 'error', message: 'Ván đấu đã kết thúc.' });
      }
      if (room.state.turn !== ws._role) {
        return send(ws, { type: 'error', message: 'Chưa tới lượt của bạn.' });
      }
      try {
        const from = strToPos(msg.from);
        const to = strToPos(msg.to);
        room.state = applyMove(room.state, from, to);
        broadcast(room, roomId);
      } catch (err) {
        send(ws, { type: 'error', message: err.message });
      }
      return;
    }

    if (msg.type === 'reset') {
      // Cho phép P1 hoặc P2 yêu cầu chơi lại (đơn giản hoá: không cần cả 2 đồng ý)
      if (ws._role !== 'P1' && ws._role !== 'P2') return;
      room.state = createInitialState();
      broadcast(room, roomId);
      return;
    }
  });

  ws.on('close', () => {
    if (room.players.P1 === ws) room.players.P1 = null;
    else if (room.players.P2 === ws) room.players.P2 = null;
    else room.spectators.delete(ws);
    broadcast(room, roomId);
  });
});

server.listen(PORT, () => {
  console.log(`OTTv2 server đang chạy tại http://localhost:${PORT}`);
  console.log(`Mở nhiều tab với ?room=<tên phòng> để chơi nhiều người cùng lúc.`);
});
