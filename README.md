[AI小幫手整合操作流程.md](https://github.com/user-attachments/files/29157185/AI.md)
# 🤖 AI 小幫手整合操作流程

> 給開發人員的逐步操作說明，預估時間：10 分鐘

---

## 準備工作：複製檔案

把以下 3 個檔案複製到目標網站的資料夾：

```
ai-widget.css   ← AI 小幫手的樣式
ai-widget.js    ← AI 小幫手的邏輯
admin.html      ← 管理員後台
```

建議放在與目標網站的 HTML 同一層目錄。

---

## Step 1 — 在 `<head>` 加入 CSS

打開目標網站的 HTML，找到 `</head>` 結束標籤，在它**正上方**加入一行：

```html
<link rel="stylesheet" href="ai-widget.css">
</head>
```

---

## Step 2 — 在導覽列加入按鈕

在目標網站的導覽列 HTML，找到最後一個導覽項目後面，加入按鈕：

```html
<!-- 加在導覽列最後一個項目的後面 -->
<button id="aiNavBtn" class="ai-nav-btn">🤖 工藝詢問AI小幫手</button>
```

> ⚠️ `id="aiNavBtn"` 不能改，程式靠這個 ID 運作。  
> 按鈕的外觀會繼承目標網站的樣式，可以再加 class 調整。

---

## Step 3 — 在 `</body>` 前貼入 Modal HTML 與 Script

找到目標網站 HTML 的 `</body>` 結束標籤，在它**正上方**貼入以下整段：

```html
<!-- ████ AI 小幫手：Bot 選擇 Modal ████ -->
<div class="ai-overlay" id="botSelectOverlay">
  <div class="bot-select-panel">
    <div class="bot-select-hd">
      <h3>🤖 請選擇詢問機器人</h3>
      <button class="modal-close" id="botSelectClose">✕</button>
    </div>
    <div id="botGrid" class="bot-grid"></div>
  </div>
</div>

<!-- ████ AI 小幫手：對話視窗 ████ -->
<div class="chat-modal" id="chatModal">
  <div class="chat-hd">
    <span class="chat-hd-icon" id="chatBotIcon">🤖</span>
    <span class="chat-hd-name" id="chatBotName">AI 小幫手</span>
    <button class="chat-close" id="chatClose">✕</button>
  </div>
  <div class="chat-messages" id="chatMessages"></div>
  <div class="chat-img-preview" id="chatImgPreview" style="display:none;">
    <img id="chatImgThumb" src="" alt="預覽">
    <button class="chat-img-remove" id="chatImgRemove">✕</button>
  </div>
  <div class="chat-footer">
    <button class="chat-upload-btn" id="chatUploadBtn" title="上傳圖片">📎</button>
    <input type="file" id="chatFileInput" accept="image/*" style="display:none;">
    <textarea class="chat-input" id="chatInput" placeholder="輸入您的問題..." rows="1"></textarea>
    <button class="chat-send-btn" id="chatSendBtn">&#10148;</button>
  </div>
</div>

<!-- ████ AI 小幫手：Script ████ -->
<script src="ai-widget.js"></script>

</body>
```

---

## Step 4 — 驗收

用瀏覽器打開目標網站，確認以下項目：

- [ ] 導覽列出現「🤖 工藝詢問AI小幫手」按鈕
- [ ] 點擊按鈕 → 出現機器人選擇視窗（顯示 4 個預設卡片）
- [ ] 選擇任一機器人 → 右下角出現對話視窗
- [ ] 輸入訊息送出 → 出現「尚未設定 API」提示（正常，還沒填 API Key）
- [ ] 按 F12 → Console 沒有紅色錯誤

---

## Step 5 — 管理員設定 API（讓機器人真正能回答）

1. 用瀏覽器直接開啟 `admin.html`
2. 輸入密碼 `ntcri2025` 登入（**請盡快修改密碼**）
3. 點「✏️ 編輯」任一機器人
4. 填入 API 網址、Token、Request 模板、Response 欄位路徑
5. 按「測試連線」確認 AI 有正常回應
6. 儲存後，回目標網站再試一次對話

### Gemini 快速設定範例

| 欄位 | 填入值 |
|------|--------|
| API 網址 | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=你的KEY` |
| API Token | （不填） |
| Request 模板 | `{"contents":[{"parts":[{"text":"{{message}}"}]}]}` |
| Response 欄位路徑 | `candidates.0.content.parts.0.text` |

---

## Step 6 — （可選）設定 Google Sheets 收集回饋

若要集中收集所有使用者的 👍/👎 回饋：

1. 前往 [script.google.com](https://script.google.com) → 新增專案
2. 複製 `admin.html` 裡「展開 Google Apps Script 程式碼」的內容，貼入編輯器
3. 點「部署」→「新增部署」→ 類型選「網頁應用程式」
4. 執行身分：**我**；存取權限：**所有人** → 部署 → 複製網址
5. 開啟 `admin.html` → 「資料儲存設定」→ 貼入網址 → 儲存

設定完成後，使用者按 👍/👎 資料會自動寫入 Google 試算表，管理員可在 admin.html 查看與匯出。

---

## 常見問題

**按鈕點了沒反應**  
→ 打開 F12 Console 看錯誤訊息。最常見原因：`ai-widget.js` 路徑寫錯，或 Step 3 的 HTML 沒有完整貼入。

**AI 回應出現錯誤**  
→ 先在 `admin.html` 用「測試連線」確認 API 可以通。若是 CORS 錯誤，代表 AI 服務不允許瀏覽器直接呼叫。

**樣式跑版**  
→ 目標網站的 CSS 可能覆蓋了 Widget 樣式。確認目標網站沒有對 `*` 或 `div` 設定影響 `position:fixed` 的屬性。

**admin.html 設定後前台沒更新**  
→ `admin.html` 與目標網站須在**同一個瀏覽器、同一個網域**下開啟，localStorage 才能共用。
