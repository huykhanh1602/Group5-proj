# playhtml.fun — Oẳn tù tì v2 (Nhóm 5)

Website bài tập OTTv2 bằng HTML/CSS/JavaScript, có hai người chơi cùng máy và nhiều phòng trực tuyến qua thư viện [playhtml](https://playhtml.fun/docs/). Mỗi phòng có hai ghế chơi và cho phép khán giả.

## Chạy

Cài Node.js 20 trở lên, mở terminal tại thư mục dự án:

```sh
npm start
```

Mở http://localhost:3000. Không cần npm install. Cùng máy hoạt động không cần dịch vụ đồng bộ; chế độ trực tuyến tải playhtml 2.14.1 từ unpkg và dùng server PartyKit công cộng mặc định của playhtml. Font Google có font hệ thống dự phòng.

## Hai chế độ chơi

### 1. Hai người cùng một máy

Chọn **1. Cùng một máy**. Người chơi 1 cầm Xanh, người chơi 2 cầm Cam; luân phiên dùng chung chuột hoặc bàn phím. Không cần Internet hoặc mã phòng. Ván cùng máy được giữ trong phiên trang khi chuyển qua lại hai chế độ.

### 2. Chơi trực tuyến

1. Chọn **2. Trực tuyến**, nhập tên, tạo phòng hoặc nhập cùng một mã phòng.
2. Gửi liên kết phòng cho người thứ hai. Hai trình duyệt phải truy cập cùng hostname vì playhtml phân tách dữ liệu theo hostname.
3. Mỗi người nhập tên và chọn một đội trên thiết bị của mình. Chỉ đi được quân của mình khi đến lượt; bàn cờ khóa khi chưa đủ hai người. Người tiếp theo có thể xem trận đấu.
4. Chọn quân rồi chọn ô được đánh dấu. Bấm Chơi lại ở cả hai máy để khởi động ván mới.
5. Bấm Rời ghế trước khi rời trận. Chuyển sang chế độ cùng máy cũng nhường ghế trực tuyến khi đang kết nối. Tải lại cùng tab giữ ghế bằng sessionStorage. Nếu người chơi đóng tab mà chưa nhường ghế, tạo phòng mới; chưa có cơ chế tự thu hồi ghế.

Để chơi qua mạng LAN: mọi máy dùng cùng địa chỉ IP của máy chạy server (ví dụ http://192.168.1.10:3000), kể cả máy chủ. Các máy cần truy cập Internet để đồng bộ. Để chơi qua Internet, host bốn file index.html, style.css, app.js, game.js trên hosting tĩnh HTTPS.

## Luật theo yêu cầu đã làm rõ

- Bàn 9×9, mọi quân đi đúng một ô trong tám hướng.
- Đấm ăn Kéo, Kéo ăn Bao, Bao ăn Đấm. Quân cùng loại không ăn nhau, chặn nhau.
- Xanh bảo vệ a1, Cam bảo vệ i9. Đưa bất kỳ quân nào vào ô bảo vệ đối phương sẽ thắng; vào ô của mình không thắng. Nếu ô đích có quân, nước đi vẫn phải hợp lệ theo luật ăn quân.
- Ăn hết một loại quân đối phương cũng là điều kiện thắng.

## Quy ước bổ sung (đề chưa chỉ rõ)

- Mỗi đội có 3 Đấm, 3 Kéo và 3 Bao (tổng 9 quân). Xanh đi trước.
- Cam: Đấm–Kéo–Bao lặp lại ở a8–i8. Xanh: Bao–Kéo–Đấm lặp lại ở a2–i2.
- Không nhảy quân, không đi vào đồng đội hoặc quân khắc chế.
- Nếu hết nước đi, hai bên có thể đồng ý chơi lại; đề không quy định xử thua/hòa.

## Kiến trúc và kiểm tra

- `game.js`: luật thuần, kiểm tra nước đi và phát lại nhật ký thao tác.
- `app.js`: giao diện, phòng, ghế và dữ liệu dùng chung bằng `playhtml.createPageData`.
- Các thao tác mang ID riêng, đồng hồ logic, số ván và số nước đi. Phát lại theo thứ tự xác định để phân xử tranh ghế và loại bỏ nước đi cũ khi thao tác đồng thời. Lưu thao tác vào các khóa riêng giúp tránh ghi đè toàn bộ bàn cờ.
- Server công cộng đồng bộ dữ liệu; kiểm tra luật ở client. Phù hợp bài tập/demo, chưa có xác thực hay server chống gian lận. Không lưu thông tin nhạy cảm trong phòng.
- `server.mjs`: server tĩnh, chỉ phục vụ bốn file công khai.
- `npm test`: kiểm tra tám hướng, ma trận ăn quân, điều kiện thắng, lượt, tranh ghế, đồng bộ thứ tự và đồng thuận chơi lại.

Đã kiểm tra trên hai cửa sổ trình duyệt: chọn hai đội, đồng bộ nước đi Xanh và Cam, yêu cầu/đồng ý chơi lại, cả hai trở về 0 nước, rời ghế. Các bài kiểm tra tự động bao gồm cả chiếm ô bảo vệ bằng cả ba loại quân, không thắng ở ô nhà và kiểm tra ăn quân tại ô bảo vệ.

Kiểm thử bổ sung khi triển khai: mở trình duyệt thứ ba để xem, thử phòng khác, tải lại và kiểm tra trên các máy qua Internet.

## Nộp Git

Repository đã cấu hình: https://github.com/huykhanh1602/Group5-proj

```sh
git add index.html style.css app.js game.js game.test.js server.mjs package.json README.md
git commit -m "Build OTTv2 with playhtml multiplayer"
git push origin HEAD
```

Tên hiển thị dự án là **playhtml.fun** theo yêu cầu. Địa chỉ playhtml.fun hiện là website của thư viện; mã nguồn này không đăng ký hay sở hữu tên miền đó. Đưa mã lên Git không đồng nghĩa với triển khai website hoặc gửi bài cho giáo viên.
