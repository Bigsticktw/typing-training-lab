# Deployment

目前的展示架構：

- Frontend：Vercel — <https://typing-solo-demo.vercel.app>
- Multiplayer server：Render — <https://typing-solo-demo-server.onrender.com>

## Vercel

專案根目錄使用下列設定：

```text
Framework preset: Vite
Install command: npm ci
Build command: npm run build
Output directory: dist
```

環境變數：

```env
VITE_WEBSOCKET_URL=https://typing-solo-demo-server.onrender.com
```

Repository 更名後，請在 Vercel 的 Git 設定確認連結顯示為
`Bigsticktw/typing-training-lab`。GitHub 通常會自動轉址，但部署平台仍應人工確認一次。

## Render

從 repository root 建立 Web Service：

```text
Build command: npm ci --prefix server && npm run build:server
Start command: npm --prefix server start
Health check path: /health
```

環境變數：

```env
NODE_ENV=production
ALLOWED_ORIGINS=https://typing-solo-demo.vercel.app
```

`PORT` 由 Render 注入，伺服器會自動讀取。

## 冷啟動

Render 免費服務閒置後可能休眠。第一次開啟多人模式時：

1. UI 會先顯示「連線中」。
2. 伺服器喚醒通常需要約 30–60 秒。
3. Socket.IO client 會自動重連，不需重新整理。

這是展示方案的運行限制。若需要穩定即時服務，應改用不休眠的 instance。

## 部署前檢查

```bash
npm ci
npm ci --prefix server
npm run check
npm audit --omit=dev
npm audit --prefix server --omit=dev
```

## 上線後 smoke test

1. 開啟 Vercel 首頁，確認訓練模式可開始。
2. 開啟 `/health`，確認回傳 `status: "ok"`。
3. 進入多人模式並等待狀態變成「已連線」。
4. 使用兩個瀏覽器視窗加入同一房間，確認所有玩家準備後才開始。
5. 確認錯誤按鍵只增加 errors，正確按鍵才增加 score/currentIndex。
