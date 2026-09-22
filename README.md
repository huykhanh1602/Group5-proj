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
│   ├── package.json        # {"type":"module"} -> Node coi gameLogic.js là ESM
│   └── gameLogic.js        # Luật chơi thuần (board, di chuyển, ăn quân, thắng/thua)
├── local/                  # Bài 1: web 2 người chơi (hotseat, không server)
│   ├── index.html
│   ├── style.css
│   └── game.js
├── server/                 # Bài 2: multiplayer qua server
│   ├── package.json
│   ├── server.js           # Node + Express + WebSocket (ws)
│   ├── smoke-test.mjs      # Test end-to-end server WebSocket
│   └── public/
│       ├── index.html
│       ├── style.css
│       ├── client.js
│       └── runtime-config.js  # Địa chỉ WS server (build sinh lại khi deploy)
├── scripts/                # Công cụ build/kiểm tra bản tĩnh
│   ├── build-static.mjs    # Gom local/ + server/public/ + shared/ -> dist/
│   ├── verify-dist.mjs     # Kiểm tra đường dẫn import trong dist/
│   └── preview-dist.mjs    # Chạy thử dist/ đúng như Vercel phục vụ
├── vercel.json             # Cấu hình deploy phần tĩnh lên Vercel
├── render.yaml             # Blueprint deploy server WebSocket lên Render
└── package.json            # Script build/deploy ở gốc repo
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
  Fly.io, VPS...) để chơi qua Internet thật, không chỉ localhost. Xem mục
  **"Deploy lên Vercel (phần tĩnh) + Render/Railway (server WebSocket)"** bên
  dưới để triển khai hoàn chỉnh.

### Giao thức WebSocket (tóm tắt)

| Chiều           | Message                                  | Ý nghĩa                          |
| --------------- | ---------------------------------------- | -------------------------------- |
| Client → Server | `{ type: 'move', from: 'b1', to: 'b2' }` | Yêu cầu đi quân                  |
| Client → Server | `{ type: 'reset' }`                      | Yêu cầu chơi lại                 |
| Server → Client | `{ type: 'welcome', you, room }`         | Xác nhận vai trò khi vừa kết nối |
| Server → Client | `{ type: 'state', state, players }`      | Trạng thái ván đấu mới nhất      |
| Server → Client | `{ type: 'error', message }`             | Nước đi/ hành động bị từ chối    |

> **Ghi chú về thư viện `playfull.html`:** đề bài yêu cầu dùng thư viện này
> để có server nhiều người chơi. Vì đây là thư viện đặc thù của môn học mà
> nhóm không có sẵn tài liệu, code base này dựng một server WebSocket
> (Node.js + `ws`) tương đương về mặt chức năng (phòng chơi, đồng bộ real-time,
> xác thực nước đi phía server) để nhóm có ngay một bản chạy được. Nếu môn
> học bắt buộc dùng đúng `playfull.html`, chỉ cần thay phần kết nối/phòng
> trong `server/server.js` và `server/public/client.js` bằng API của thư
> viện đó — toàn bộ luật chơi (`shared/gameLogic.js`) và giao diện
> (`public/index.html`, `style.css`) có thể giữ nguyên.

## Deploy lên Vercel (phần tĩnh) + Render/Railway (server WebSocket)

### Vì sao phải tách 2 nơi?

Vercel chỉ host **file tĩnh** và **function ngắn hạn (serverless)**. Server trong
`server/server.js` là một process Node **chạy liên tục**, giữ trạng thái phòng
trong RAM (`Map`) và cần giữ kết nối WebSocket mở — những thứ serverless không
làm được. Vì vậy:

| Phần             | Nơi deploy                 | Nội dung                                                                                                |
| ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Web tĩnh         | **Vercel**                 | `/` (trang chủ), `/local/` (2 người cùng máy), `/multiplayer/` (UI multiplayer), `/shared/` (luật chơi) |
| Server WebSocket | **Render / Railway / VPS** | `server/server.js` — Express + `ws`, giữ phòng trong RAM                                                |

Client multiplayer biết địa chỉ server qua biến **`WS_URL`**, được nhúng vào
`runtime-config.js` **lúc build**. Nếu `WS_URL` trống, client tự dùng
same-origin (đúng cho lúc chạy local).

### Cấu trúc `dist/` mà Vercel phục vụ

`npm run build:static` gom các thư mục rời thành 1 cây tĩnh:

```
dist/
├── index.html            # trang chủ chọn chế độ chơi
├── local/                # từ local/
├── multiplayer/          # từ server/public/ (+ runtime-config.js sinh ra)
└── shared/gameLogic.js   # từ shared/
```

Cây này là bắt buộc vì có **2 kiểu đường dẫn import** khác nhau:
`local/game.js` dùng `../shared/gameLogic.js` (cần `local/` và `shared/` là anh em
ruột), còn `multiplayer/client.js` dùng `/shared/gameLogic.js` (cần `shared/` nằm
ngay gốc site).

### Bước 1 — Deploy server WebSocket (làm trước để có URL)

**Cách A: Render (đã có `render.yaml`)**

1. Render → **New** → **Blueprint** → chọn repo này.
2. Render tạo service `ottv2-ws-server`: build `npm install --prefix server`,
   start `node server/server.js`, health check `/`.
3. Deploy xong, copy URL dạng `https://ottv2-ws-server.onrender.com`.

**Cách B: Railway**

1. **New Project** → **Deploy from GitHub repo** → chọn repo.
2. Settings: Build Command `npm install --prefix server`,
   Start Command `node server/server.js`.
3. Railway tự cấp `PORT` (server đã đọc `process.env.PORT` sẵn).
4. Copy domain ở **Settings → Networking → Generate Domain**.

> Render gói free sẽ "ngủ" sau ~15 phút không dùng, nên lần kết nối đầu có thể
> chậm vài chục giây. `WS_URL` nhận cả `https://...` lẫn `wss://...`.

### Bước 2 — Deploy phần tĩnh lên Vercel

1. **Add New Project** → import repo này.
2. Framework Preset: **Other**. Không cần đổi build/output vì `vercel.json` đã
   khai báo `buildCommand: node scripts/build-static.mjs` và
   `outputDirectory: dist`.
3. **Settings → Environment Variables**, thêm cho cả **Production** và **Preview**:
    - Key: `WS_URL`
    - Value: URL server ở Bước 1, ví dụ `https://ottv2-ws-server.onrender.com`
4. **Deploy**. Vì `WS_URL` là biến **build-time**, mỗi lần đổi giá trị phải
   **Redeploy** (đừng bật "Use existing build cache") để `runtime-config.js`
   được sinh lại.
5. Mở thử:
    - `https://<domain>.vercel.app/local/` — 2 người cùng máy, không cần server.
    - `https://<domain>.vercel.app/multiplayer/?room=nhom5` — mở 2 tab / 2 máy
      cùng `?room=nhom5` để làm 2 đối thủ, người thứ 3 là khán giả.

> Nếu thanh trạng thái hiện "chưa cấu hình WS_URL", tức là biến `WS_URL` chưa
> được set (hoặc chưa redeploy) nên client đang thử kết nối same-origin.

### Kiểm tra trước khi push

```bash
npm test               # build tĩnh + kiểm tra đường dẫn import trong dist/
npm run preview        # mở http://localhost:5000 xem đúng thứ Vercel sẽ phục vụ
npm run check:dist     # chỉ chạy kiểm tra HTTP dist/ rồi thoát
npm run test:ws        # test end-to-end server WebSocket (tự spawn port riêng)
```

### Chạy local (không cần deploy)

```bash
# Bản 2 người cùng máy: mở local/index.html qua một static server bất kỳ
# Bản multiplayer: UI + server cùng origin, không cần WS_URL
npm run install:server
npm start              # http://localhost:8080/?room=nhom5
```

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
| --- | ------ | ---- | --------- |
| 1   |        |      |           |
| 2   |        |      |           |
| 3   |        |      |           |
| 4   |        |      |           |

_(Điền thông tin nhóm trước khi nộp bài.)_
