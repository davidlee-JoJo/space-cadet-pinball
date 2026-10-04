# 太空彈珠台 SPACE CADET PINBALL

純 HTML5 Canvas + 原生 JavaScript 的復古太空風彈珠台，零相依、單頁面即可玩。

A retro space-themed pinball game built with pure HTML5 Canvas and vanilla JavaScript. No dependencies, no build step.

## 開始遊戲 / Play

直接用瀏覽器開啟 `index.html`，或：

```bash
python -m http.server 8000
# → http://localhost:8000
```

## 操作 / Controls

| 動作 | 按鍵 |
|---|---|
| 蓄力發射 / Launch | 按住 `Space` 放開（瞄準時） |
| 左擋板 / Left flipper | `Z` 或 `←` |
| 右擋板 / Right flipper | `/` 或 `→` |
| 雙擋板 / Both flippers | `Space`（遊戲中） |
| 觸控 / 滑鼠 | 瞄準時按住右側蓄力；遊戲中點左/右半邊打擋板 |

## 機制 / Mechanics

- 3 顆球，高分記錄存於 localStorage
- 3 個彈墊（bumpers）、6 個彈弓（slingshots）計分
- 240 Hz 固定步長物理：重力、空氣阻力、旋轉擋板面速度碰撞

## 檔案 / Files

- `index.html` — 頁面與 HUD
- `physics.js` — 物理引擎（球、牆段、擋板、彈墊）
- `game.js` — 遊戲流程、輸入、繪製
- `SPEC.md` — 設計規格
