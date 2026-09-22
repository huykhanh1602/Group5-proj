/**
 * Runtime config cho client multiplayer.
 * ---------------------------------------------------------------
 * File này được load dạng <script> thường (không phải module) TRƯỚC
 * client.js, để client biết phải kết nối WebSocket tới đâu.
 *
 * - Chạy local / chạy trên chính server này: để wsUrl = '' -> client
 *   tự dùng same-origin (ws://localhost:8080).
 * - Deploy tách rời (UI trên Vercel + server trên Render/Railway):
 *   `npm run build:static` sẽ GHI ĐÈ file này trong dist/multiplayer/
 *   bằng giá trị của biến môi trường WS_URL lúc build.
 *
 * ĐỔI Ở ĐÂY CHỈ ẢNH HƯỞNG BẢN LOCAL. Bản deploy do script build sinh ra.
 */
window.__OTT_CONFIG__ = Object.assign({ wsUrl: "" }, window.__OTT_CONFIG__ || {});
