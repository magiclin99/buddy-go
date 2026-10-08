# buddy-go

住在 Claude Code 輸入框上方的吉祥物 buddy（Clawd）。平常來回走路，特定時機會播動畫。

```
 ▐▛███▛█
▝▜██████▀
 ▝▝   ▝▝
```

## 安裝

在 Claude Code 終端機的輸入框打：

```
/plugin install buddy-go --marketplace magiclin99/buddy-go
```

開發時直接從資料夾載入：

```bash
claude --plugin-dir /path/to/buddy-go
```

## 動畫

| 動畫 | 什麼時候播 | 祕技 |
|---|---|---|
| 走路 | 沒有其他動畫時 | — |
| your turn | AI 的回覆結尾在問你問題，或用提問工具問你時。buddy 原地消失、閃現在最左邊、揮手 | `buddy:your-turn` |
| PR 元氣彈 | 執行 `gh pr create` 時。buddy 舉手集氣，球長大後丟出去 | `buddy:send-pr` |

祕技直接打在輸入框（前面不加斜線），會被 mod 攔下、不會送給模型。

## 結構

```
hooks/
├── register.tsx        串接：計時、發布狀態、祕技、繪製
├── animations/         一個動畫一個檔案，加上登記表 index.ts
│   ├── walk.ts
│   ├── wait.ts
│   └── launch.ts
└── lib/
    ├── player.ts       播放器：現在播誰、誰在排隊、buddy 站在哪（純邏輯）
    ├── body.ts         buddy 的身體部件
    ├── render.tsx      把動畫輸出的資料轉成畫面元件
    └── frame.ts        共用型別
tests/
├── player.test.ts      播放器規則
├── animations.test.ts  每個動畫的畫格內容
└── walk.test.tsx       事件觸發到畫面的整合測試
```

### 新增一個動畫

1. 在 `hooks/animations/` 新增一個檔案，匯出一個 `Animation`（名稱、優先順序、格數、每格多久、`draw`），需要的話再匯出觸發函式和宣告祕技名稱。
2. 在 `hooks/animations/index.ts` 的 `ANIMATIONS` 加一行；有觸發函式的話在 `registerTriggers` 加一行。

`draw` 是純計算：輸入第幾格與 buddy 的位置，輸出要畫的字和顏色，不碰計時器也不碰引擎。

## 開發

```bash
claude plugin validate .
claude plugin test .
```
