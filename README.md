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

**Ghép ngẫu nhiên:** chọn **2. Trực tuyến** để tự vào sảnh tìm đối thủ. Các người chơi đang chờ được xáo trộn bằng mã vé ngẫu nhiên, ghép từng cặp hai người và chuyển vào phòng riêng, tự phân đội Xanh/Cam. Người lẻ tiếp tục chờ. Có thể **Hủy tìm trận**, tìm lại hoặc chuyển về cùng máy. Người tạo phòng riêng không nằm trong hàng chờ.

**Mời bạn:** bấm **Tạo phòng riêng & mời bạn**, sao chép liên kết phòng và gửi bạn. Bạn cũng có thể nhập mã phòng riêng. Mỗi người chọn một đội; phòng đủ hai người vẫn cho khán giả xem. Hai máy phải dùng cùng hostname.

Trong trận chỉ đi được quân của mình khi đến lượt. Chơi lại cần cả hai người đồng ý. Bấm **Về sảnh · tìm đối thủ mới** để ghép ván khác. Tải lại cùng tab giữ ghế bằng sessionStorage. Rời ghế trước khi đóng tab; ghế trong trận chưa tự thu hồi khi đóng tab đột ngột.

Để chơi qua mạng LAN: mọi máy dùng cùng địa chỉ IP của máy chạy server (ví dụ http://192.168.1.10:3000), kể cả máy chủ. Các máy cần truy cập Internet để đồng bộ. Để chơi qua Internet, host năm file index.html, style.css, app.js, game.js, matchmaking.js trên hosting tĩnh HTTPS.

## Chơi từ hai nơi hoặc hai mạng khác nhau

Web cần được xuất bản trên HTTPS công khai. GitHub Pages có thể phục vụ trực tiếp mã nguồn này: trong repository, vào **Settings → Pages → Deploy from a branch**, chọn nhánh **codex/playhtml-ottv2**, thư mục **/(root)** và Save. Địa chỉ dự kiến là https://huykhanh1602.github.io/Group5-proj/ (chỉ hoạt động sau khi Pages triển khai thành công).

Hai người mở cùng địa chỉ công khai, chọn Trực tuyến để ghép ngẫu nhiên hoặc tạo phòng riêng và gửi link phòng. Dữ liệu đi qua server công cộng của playhtml, không qua máy chạy localhost; hai người không cần cùng Wi-Fi, không cần mở cổng router và không cần giữ máy chủ cá nhân bật. Cả hai cần Internet và truy cập được CDN unpkg cùng dịch vụ playhtml/PartyKit. Không gửi link localhost cho người ở xa.

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
- `matchmaking.js`: sảnh dùng `playhtml.createPageData` để lưu vé và kết quả ghép; `playhtml.presence` và heartbeat riêng cho từng vé theo dõi người đang chờ (hỗ trợ nhiều tab cùng trình duyệt). Mỗi vé chỉ chọn một đối thủ; chỉ xác nhận cặp khi cả hai vé chọn nhau. Kết quả ghép được lưu trước khi chuyển phòng. Người hủy hoặc mất heartbeat được loại khỏi hàng chờ; lời mời không khớp được thử lại sau 8 giây bằng vé mới. Sảnh là chung cho hostname, phòng game tách riêng.
- Ghép trận hiện chạy phía trình duyệt, dùng server đồng bộ công cộng của playhtml; không có server xác thực chống gian lận. Dữ liệu sảnh được lưu bền, chưa có tác vụ dọn lịch sử vé; bản demo cần bổ sung dọn dữ liệu và backend đáng tin cậy nếu vận hành quy mô lớn.
- `server.mjs`: server tĩnh, chỉ phục vụ năm file công khai.
- `npm test`: kiểm tra tám hướng, ma trận ăn quân, điều kiện thắng, lượt, tranh ghế, đồng bộ thứ tự và đồng thuận chơi lại.

Đã kiểm tra ghép ngẫu nhiên thực tế: hai cửa sổ tự vào cùng phòng, phân đội Xanh/Cam và đồng bộ nước đi. 13 bài kiểm tra tự động đều đạt.

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
