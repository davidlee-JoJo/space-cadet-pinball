# 專案：太空彈珠台（Windows Space Cadet Pinball 風格網頁遊戲）

## 硬性規定
- 產出單一檔案 `index.html`（內嵌全部 CSS/JS，無外部資源、無 CDN）
- Canvas 2D。邏輯尺寸 **480×800**（直向），CSS 等比縮放置中於視窗（letterbox 黑邊），支援 devicePixelRatio
- 手機優先：`<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`、`touch-action:none`、禁止雙擊縮放與捲動

## 桌面幾何（座標 480×800）
- 外框：左牆 x=20、右牆 x=460、頂部大圓弧（用線段近似 240,20 半徑 220 的上半圓弧）
- **發射道**：右側垂直通道 x∈[400,460]，內牆 x=400 從 y=140 到底 y=760；頂部開口 y=140 讓球飛出
- **單向閘門**：線段 (400,140)-(460,140)，僅擋「從主區飛進發射道」方向的球（從發射道往上通過後不再回擋）
- **Flippers**：pivot 左 (155,715)、右 (325,715)，長 85，寬 12
  - 左：靜止角 -30°（向下）、按住 +28°；右鏡像；角速度約 20 rad/s
- **Drain**：兩 flipper 之間底部開口（寬約 110px），球掉出 → 失球
- **Bumpers**（圓形 r=26）：(150,300)、(330,300)、(240,180)
- **Slingshots**：三角形，斜邊面向 drain，位於 (95,600)-(155,660) 與 (385,600)-(325,660) 附近
- 底部外牆由 flipper pivot 外側往兩側斜上連到左右牆（避免死角）

## 物理
- 固定子步 dt=1/240s（累加器，每幀上限 8 子步）
- 球 r=9，重力 1800 px/s²，每子步阻尼 ×0.999
- 圓 vs 線段碰撞：restitution 0.5、切向摩擦 ×0.98
- Bumper 被擊中：沿法線以 350 px/s 彈出、+100 分、發光 0.2 秒
- Slingshot 斜邊被擊中：沿法線踢 320 px/s、+10 分
- Flipper 碰撞需把「flipper 表面速度」（角速度×半徑向量）加進球速度
- 球速上限 1400 px/s；子步夠小避免穿透牆壁

## 操作
- 鍵盤：`Z`/`←` 左 flipper；`/`/`→` 右 flipper；`空白鍵` 按住蓄力、放開發射
- 觸控：**遊玩時** 左半螢幕＝左 flipper、右半螢幕＝右 flipper（多點觸控支援兩指同時）
- 觸控**蓄力發射**：球在發射道時（state=aiming），按住右側 25% 螢幕（x>360 邏輯座標）即蓄力（1.2 秒充滿），放開發射；蓄力時顯示 meter
- 發射初速：-(900 + 900×charge)

## 流程與 HUD
- States：`title`（標題＋點擊開始）→ `aiming`（球在發射道）→ `playing` → `gameover`
- 3 顆球；失球後自動進入 aiming
- 頂部 HUD：SCORE / BALL n/3 / HIGH（localStorage `pinball_high`）
- Game over：顯示本局分數＋最高分＋「重新開始」按鈕

## 視覺
- 深藍紫太空風：星空點背景、霓虹紫藍邊框、bumper 青色光環（擊中更亮）、flipper 亮白、球金屬漸層
- 標題「太空彈珠台」（副標 SPACE CADET PINBALL），系統字體即可

## 自我驗收
- 開啟無 JS 錯誤；發射能把球送入主區；flipper 能把落球打回上方；bumper 加分；失球流程正確；手機直向可玩
