# OTTv2 — Oẳn Tù Tì v2 (Cờ Búa–Bao–Kéo 9x9)

Code base cho 2 bài tập:

1. **`local/`** — Trang web cho 2 người chơi trên cùng 1 máy (hotseat), không cần server.
2. **`server/`** — Server (Node.js + WebSocket) cho phép nhiều người chơi thật, mỗi
   người 1 máy/1 trình duyệt, vào chung 1 "phòng" để đấu với nhau.

Luật chơi lõi được viết **một lần duy nhất** trong `shared/gameLogic.js` và dùng
chung cho cả hai bản (local dùng trực tiếp, server dùng để xác thực nước đi,
client của server import lại qua route tĩnh `/shared/gameLogic.js`) — tránh
viết luật chơi 2 lần, dễ bảo trì và đảm bảo 2 bản chơi giống hệt nhau.

```
OTTv2/
├── shared/
│   └── gameLogic.js      # Luật chơi thuần (board, di chuyển, ăn quân, thắng/thua)
├── local/                 # Bài 1: web 2 người chơi (hotseat, không server)
│   ├── index.html
│   ├── style.css
│   └── game.js
└── server/                 # Bài 2: multiplayer qua server
    ├── package.json
    ├── server.js           # Node + Express + WebSocket (ws)
    └── public/
        ├── index.html
        ├── style.css
        └── client.js
```

## Luật chơi (OTTv2)

- Bàn cờ **9x9**, cột `a..i`, hàng `1..9` (giống ký hiệu cờ vua).
- Mỗi quân di chuyển **1 ô theo 8 hướng**, giống quân Vua trong cờ vua.
- 3 loại quân: **Búa ✊ > Kéo ✌️ > Bao ✋ > Búa** (đấm lá kéo cổ điển).
- Hai quân **cùng loại** (kể cả cùng phe hay khác phe) **không ăn được nhau**,
  chỉ đứng chặn đường — không thể đi vào ô đó.
- Chỉ được đi vào ô có quân địch nếu quân của mình **thắng** loại quân đó
  (ăn quân). Nếu quân mình sẽ **thua**, nước đi không hợp lệ (không tự sát).
- **Điều kiện thắng:**
  1. Ăn sạch hoàn toàn **1 loại quân** bất kỳ của đối phương, hoặc
  2. Đưa được quân của mình vào ô **`a1`** hoặc **`i9`** (2 ô góc, đánh dấu ★
     trên bàn cờ).

> Đề bài không quy định chi tiết cách bố trí quân lúc bắt đầu, nên nhóm đã
> chọn bố trí: mỗi bên 9 quân (3 Búa, 3 Bao, 3 Kéo), xếp gần hàng xuất phát
> của mình, đối xứng 180° qua tâm bàn cờ, và luôn chừa 2 ô `a1`/`i9` trống
> lúc bắt đầu. Có thể chỉnh lại trong `createInitialBoard()` của
> `shared/gameLogic.js` nếu nhóm/giảng viên muốn bố trí khác.

## Bài 1 — Chạy bản 2 người chơi (local)

Không cần cài gì, không cần server — chỉ cần mở file HTML:

```bash
# Cách 1: mở trực tiếp
open local/index.html         # macOS
xdg-open local/index.html     # Linux
start local/index.html        # Windows

# Cách 2 (khuyên dùng, để import ES module chạy chuẩn qua http://):
cd local
python3 -m http.server 5500
# rồi mở http://localhost:5500
```

2 người chơi thay phiên click chọn quân (chỉ chọn được quân của người đang
tới lượt) rồi click ô đích được tô sáng để đi.

## Bài 2 — Chạy bản multiplayer (server)

```bash
cd server
npm install
npm start
# Server chạy tại http://localhost:8080
```

Mở trình duyệt (2 máy khác nhau, hoặc 2 tab/2 trình duyệt khác nhau để mô
phỏng 2 người chơi):

```
http://localhost:8080/?room=nhom5
http://localhost:8080/?room=nhom5
```

- Người vào phòng đầu tiên là **P1**, người thứ hai là **P2**, từ người thứ
  ba trở đi là **khán giả** (xem, không đi được quân).
- Server giữ trạng thái ván đấu "chuẩn" và tự kiểm tra lại mọi nước đi gửi
  lên bằng đúng luật trong `shared/gameLogic.js` — client gian lận (sửa code
  JS ở trình duyệt) gửi nước đi sai vẫn bị server từ chối.
- Nút **"Yêu cầu ván mới"** reset lại ván đấu trong phòng đó.
- Có thể deploy `server/` lên bất kỳ host Node.js nào (Render, Railway,
  Fly.io, VPS...) để chơi qua Internet thật, không chỉ localhost.

### Giao thức WebSocket (tóm tắt)

| Chiều | Message | Ý nghĩa |
|---|---|---|
| Client → Server | `{ type: 'move', from: 'b1', to: 'b2' }` | Yêu cầu đi quân |
| Client → Server | `{ type: 'reset' }` | Yêu cầu chơi lại |
| Server → Client | `{ type: 'welcome', you, room }` | Xác nhận vai trò khi vừa kết nối |
| Server → Client | `{ type: 'state', state, players }` | Trạng thái ván đấu mới nhất |
| Server → Client | `{ type: 'error', message }` | Nước đi/ hành động bị từ chối |

> **Ghi chú về thư viện `playfull.html`:** đề bài yêu cầu dùng thư viện này
> để có server nhiều người chơi. Vì đây là thư viện đặc thù của môn học mà
> nhóm không có sẵn tài liệu, code base này dựng một server WebSocket
> (Node.js + `ws`) tương đương về mặt chức năng (phòng chơi, đồng bộ real-time,
> xác thực nước đi phía server) để nhóm có ngay một bản chạy được. Nếu môn
> học bắt buộc dùng đúng `playfull.html`, chỉ cần thay phần kết nối/phòng
> trong `server/server.js` và `server/public/client.js` bằng API của thư
> viện đó — toàn bộ luật chơi (`shared/gameLogic.js`) và giao diện
> (`public/index.html`, `style.css`) có thể giữ nguyên.

## Nộp bài lên Git

```bash
cd OTTv2
git init
git add .
git commit -m "OTTv2: bai 1 (2 nguoi choi local) + bai 2 (multiplayer server)"
git branch -M main
git remote add origin <URL repo cua nhom>
git push -u origin main
```

Sau đó nộp link repository theo yêu cầu của đề bài.

## Nhóm thực hiện

| STT | Họ tên | MSSV | Công việc |
|---|---|---|---|
| 1 |  |  |  |
| 2 |  |  |  |
| 3 |  |  |  |
| 4 |  |  |  |

*(Điền thông tin nhóm trước khi nộp bài.)*
