# OTTv2 — Oẳn Tù Tì v2 (Cờ Búa–Bao–Kéo 9x9)

Code base cho 2 bài tập:

1. **`local/`** — Trang web cho 2 người chơi trên cùng 1 máy (hotseat), không cần server.
2. **`playhtml/`** — ✅ Bản chính thức của bài 2: dùng thư viện
   **[playhtml.fun](https://playhtml.fun)** để đồng bộ nhiều người chơi real-time.
   playhtml.fun tự lo phần "server" (qua dịch vụ PartyKit công khai của thư
   viện) nên nhóm **không cần tự host backend**.
3. **`server/`** — Bản thay thế: server tự viết bằng Node.js + WebSocket, dùng
   trong lúc nhóm chưa rõ yêu cầu dùng đúng thư viện nào. Giữ lại để tham
   khảo / làm phương án dự phòng nếu playhtml.fun bị chặn mạng hoặc môn học
   yêu cầu server tự host.

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
├── playhtml/               # Bài 2 (chính thức): multiplayer bằng playhtml.fun
│   ├── index.html
│   ├── style.css
│   └── app.js               # dùng playhtml.createPageData + playhtml.users
└── server/                 # Bài 2 (phương án dự phòng): server Node tự host
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

## Bài 2 (chính thức) — Chạy bản multiplayer bằng playhtml.fun

Không cần cài Node, không cần `npm install`, không cần tự chạy server — chỉ
cần một static file server đơn giản để mở đúng cách qua `http://` (ES module
không chạy được khi mở file trực tiếp bằng `file://`):

```bash
cd OTTv2            # đứng ở thư mục gốc (chứa local/, playhtml/, shared/...)
npx serve .
# in ra http://localhost:3000
```

Mở trình duyệt (2 máy/2 tab khác nhau, cùng 1 tên phòng):

```
http://localhost:3000/playhtml/?room=nhom5
http://localhost:3000/playhtml/?room=nhom5
```

- Người vào phòng đầu tiên tự động là **P1**, người thứ hai là **P2**, từ
  người thứ ba trở đi là **khán giả**.
- Toàn bộ trạng thái ván đấu (bàn cờ, lượt đi, ai đang thắng...) được lưu
  trong một **page-level data channel** của playhtml
  (`playhtml.createPageData(...)`) — playhtml tự đồng bộ real-time giữa mọi
  người đang mở cùng `?room=...` này, kể cả khi họ ở 2 máy khác nhau qua
  Internet thật (không chỉ localhost), vì dữ liệu được đồng bộ qua server
  của playhtml.fun chứ không qua máy bạn.
- `playhtml.users` dùng để biết ai đang có mặt trong phòng và tự dọn chỗ
  ngồi (P1/P2) khi một người rời đi.
- Luật chơi (di chuyển, ăn quân, thắng/thua) vẫn được kiểm tra bằng đúng
  `shared/gameLogic.js` — không viết lại luật riêng cho bản playhtml.

> ⚠️ Vì playhtml.fun đồng bộ real-time kiểu client tự ghi state (không có
> server riêng của nhóm đứng ra "trọng tài"), nếu 2 người bấm gần như cùng
> lúc có thể hiếm khi bị lệch 1 nhịp — đây là giới hạn cố hữu của mô hình
> playhtml (đổi lại là không cần tự host server). Bản `server/` bên dưới có
> server riêng "trọng tài" mọi nước đi nên không gặp vấn đề này, nếu môn
> học yêu cầu độ chặt chẽ cao hơn thì dùng bản đó.

## Bài 2 (phương án dự phòng) — Server Node.js tự host

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

> **Chế độ khuyến nghị: `/playhtml/` — không cần backend.**
> Vì bài 2 (chính thức) đồng bộ qua dịch vụ công cộng của playhtml.fun, phần
> `/playhtml/` **không cần `WS_URL` và không cần server riêng**. Chỉ khi muốn chạy
> `/multiplayer/` (server WebSocket tự host) mới cần Render/Railway như bên dưới.

### Ba chế độ sau khi deploy

| Đường dẫn       | Cần thêm gì                            |
| --------------- | -------------------------------------- |
| `/local/`       | Không. Hotseat 2 người cùng một máy.   |
| `/playhtml/`    | Không. Chỉ cần người chơi có Internet. |
| `/multiplayer/` | Cần `WS_URL` trỏ tới server WebSocket. |

### Vì sao `/multiplayer/` phải tách 2 nơi?

Vercel chỉ host **file tĩnh** và **function ngắn hạn (serverless)**. Server trong
`server/server.js` là một process Node **chạy liên tục**, giữ trạng thái phòng
trong RAM (`Map`) và cần giữ kết nối WebSocket mở — những thứ serverless không
làm được. Vì vậy:

| Phần             | Nơi deploy                 | Nội dung                                                                                              |
| ---------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Web tĩnh         | **Vercel**                 | `/` (trang chủ), `/local/`, `/playhtml/` (chính thức, không cần backend), `/multiplayer/`, `/shared/` |
| Server WebSocket | **Render / Railway / VPS** | `server/server.js` — Express + `ws`, giữ phòng trong RAM (chỉ cần cho `/multiplayer/`)                |

Client của `/multiplayer/` biết địa chỉ server qua biến **`WS_URL`**, được nhúng vào
`runtime-config.js` **lúc build**. Nếu `WS_URL` trống, client tự dùng same-origin
(đúng cho lúc chạy local). **`/playhtml/` không liên quan tới biến này.**

### Cấu trúc `dist/` mà Vercel phục vụ

`npm run build:static` gom các thư mục rời thành 1 cây tĩnh:

```
dist/
├── index.html            # trang chủ chọn chế độ chơi
├── local/                # từ local/
├── playhtml/             # từ playhtml/       (bài 2 chính thức, không cần backend)
├── multiplayer/          # từ server/public/  (+ runtime-config.js sinh ra)
└── shared/gameLogic.js   # từ shared/
```

Cây này là bắt buộc vì có **2 kiểu đường dẫn import** khác nhau:
`local/game.js` và `playhtml/app.js` đều dùng `../shared/gameLogic.js` (cần chúng là
anh em ruột với `shared/`), còn `multiplayer/client.js` dùng `/shared/gameLogic.js`
(cần `shared/` nằm ngay gốc site).

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
3. **(Tuỳ chọn — chỉ cần cho `/multiplayer/`)** **Settings → Environment Variables**,
   thêm cho cả **Production** và **Preview**:
    - Key: `WS_URL`
    - Value: URL server ở Bước 1, ví dụ `https://ottv2-ws-server.onrender.com`
      Nếu chỉ dùng `/local/` và `/playhtml/` thì **bỏ qua bước này** — không cần biến nào.
4. **Deploy**. Vì `WS_URL` là biến **build-time**, mỗi lần đổi giá trị phải
   **Redeploy** (đừng bật "Use existing build cache") để `runtime-config.js`
   được sinh lại.
5. Mở thử:
    - `https://<domain>.vercel.app/local/` — 2 người cùng máy, không cần server.
    - `https://<domain>.vercel.app/playhtml/?room=nhom5` — **chế độ chính thức**:
      mở 2 tab / 2 máy cùng `?room=nhom5` là 2 đối thủ, người thứ 3 là khán giả.
      Không cần cấu hình gì thêm.
    - `https://<domain>.vercel.app/multiplayer/?room=nhom5` — chỉ dùng khi đã set
      `WS_URL` và đã deploy server WebSocket.

> playhtml phân tách dữ liệu theo **hostname**, nên hai người chơi phải mở **đúng
> cùng một hostname**. Đừng để một người dùng link preview của Vercel còn người kia
> dùng domain production — họ sẽ vào hai phòng khác nhau dù mã phòng giống nhau.
> Nên thống nhất dùng domain production, hoặc gắn domain riêng rồi gửi đúng link đó.

> `/playhtml/` **không** đọc biến `WS_URL`. Nếu `/multiplayer/` hiện "chưa cấu hình
> WS_URL", tức là biến `WS_URL` chưa được set (hoặc chưa redeploy) nên client đang
> thử kết nối same-origin — điều này không ảnh hưởng gì tới `/playhtml/`.

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
