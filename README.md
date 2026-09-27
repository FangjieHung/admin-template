# PenghuRentalAdmin

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.6.

## Prerequisites

Angular CLI 22 requires **Node.js >= 22.22.3 or 24.x**. This project pins Node 24 via `.nvmrc`:

```bash
nvm use   # switches to Node 24 (from .nvmrc)
npm install
```

## 這是一個多 App 專案（Nx Monorepo）

`npm install` 只需在專案根目錄跑一次；`apps/` 底下有多個各自獨立的網站（各自的網址、各自的
畫面），開發時要看哪個就另外啟動哪個。目前有：

| App | 是誰在用 | 本機開發網址 | 啟動指令 |
|---|---|---|---|
| **admin** | 車行內部後台人員 | http://localhost:4200/ | `npx nx serve admin` |
| **booking** | 一般消費者訂車站 | http://localhost:4300/ | `npx nx serve booking --port 4300` |
| **affiliate** | 合作民宿代訂＋對帳站 | http://localhost:4400/ | `npx nx serve affiliate` |
| pos（尚未啟用） | — | — | — |

三個站是三個獨立的網站（各自的網域/port），**不是**同一個網站底下的三個分頁，所以要同時看
兩個以上，就要開兩個以上的終端機視窗，各自跑各自的 `nx serve`。詳細原因見「為什麼設計成
不同 App」一節。

### 同時跑起所有 app

開三個終端機分頁（tab），各自進到專案資料夾，各跑一行：

```bash
# 分頁 1
npx nx serve admin

# 分頁 2
npx nx serve booking --port 4300

# 分頁 3
npx nx serve affiliate
```

三個都起來後，瀏覽器分別開：
- 後台：http://localhost:4200/
- 訂車站：http://localhost:4300/
- 民宿代訂站：http://localhost:4400/p/seaview （`seaview` 是示範民宿的代碼，
  也可以到 http://localhost:4200/partners 頁面按「複製代訂連結」拿正確網址）

**注意**：`admin` 和 `booking` 沒有另外指定 port 時預設都是 4200，兩個一起開會互撞
（其中一個會啟動失敗或占用不到 port），所以 `booking` 一定要加 `--port 4300`。
`affiliate` 的 4400 已經寫在它自己的設定檔（`apps/affiliate/project.json`）裡，不用另外指定。

### 只想跑單一個 app

只看後台，跑 `npm start`（等同 `npx nx serve admin`）就好，不用管其他兩個。

### 為什麼設計成不同 App（不同 port / 未來不同網域）

三個站的使用者身分不同：admin 是車行員工用的內部後台、booking 是給一般消費者訂車、
affiliate 是給合作民宿免登入代訂＋對帳。分開部署符合這個業務上的分工，正式上線後預期
會是三個不同網域（例如 `admin.xxx.com` / `book.xxx.com` / `partner.xxx.com`），現在本機開發
用不同 port 只是本機的權宜作法。目前是純前端 demo（資料存在瀏覽器 localStorage），三個站
各自的資料**不會互通**——例如在 affiliate 站下的新單，不會即時出現在 admin 的退佣報表裡，
admin 看到的是內建的範例訂單；接上真正後端後才會即時互通。

想更了解系統架構（各 app 對應誰在用、`libs/` 共用了哪些元件、計費與退佣的業務邏輯公式），
看 [`docs/architecture/`](./docs/architecture/00-overview.md)。

### 開發階段的模擬功能（Development Mocks）

`admin` 的訂單工作區有幾項功能目前只是**前端模擬**，還沒有真正的後端能力：

- **證件 OCR**：`document-capture` 元件的辨識結果是假資料，不是真的呼叫 OCR 服務。
- **證件圖檔儲存**：圖檔暫存在目前瀏覽器的開發用 IndexedDB，不是私有 object storage；它不會
  跨裝置同步，也沒有後端存取權限控管。
- **還車提醒 Email**：前端只會把 24／2 小時前提醒標為「已排程」或「缺少 Email」，不會
  寄信，也不會宣稱已寄送。訂金／尾款收據、合約副本與取消／退款通知則尚未實作。
- **退款**：取消與客訴補償流程算出的退款金額只會寫進前端的付款分類帳，不會觸發任何金流
  出款動作。

這些都是刻意的 MVP 簡化，**不能被當成正式上線的行為**；串接真正的 OCR／檔案儲存／Email／
金流退款服務前，畫面上任何「成功」都只代表前端狀態機走完，不代表真的發生了。完整的後端
承接範圍、需要的 API 與資料模型，見
[`docs/plans/2026-09-18-rental-operations-backend-handoff.md`](./docs/plans/2026-09-18-rental-operations-backend-handoff.md)。

## Common commands

```bash
npm start        # 等同 npx nx serve admin，http://localhost:4200/
npm run build    # 建置 admin production 版本，輸出到 dist/
npm test         # 跑 admin 的單元測試（vitest）
npm run deploy   # 建置 admin 並發布到 GitHub Pages（gh-pages branch）
```

上面四個指令預設都只作用在 `admin`。要對其他 app 做一樣的事，把 app 名字換掉即可：

```bash
npx nx build affiliate   # 建置 affiliate
npx nx test booking      # 跑 booking 的測試
npx nx run-many -t test  # 一次跑全部 app 的測試
```

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

> 上面這段是舊版單一 app 專案留下的說明，等同 `npx nx serve admin`。多 app 開發請看
> 上方「這是一個多 App 專案」一節。

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Deploying to GitHub Pages

This app is hosted at https://fangjiehung.github.io/bbd-car-rental/. To deploy:

```bash
npm run deploy
```

This builds with the correct base href for the `/bbd-car-rental/` subpath and publishes
`dist/penghu-rental-admin/browser` to the `gh-pages` branch via `angular-cli-ghpages`.
Pages typically takes 1–2 minutes to update after the push completes.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

---

## 雙軸主題系統

本專案採用**質地（Paradigm）× 配色（Color-theme）**的兩軸主題架構。質地管造型（圓角、陰影、字體、背景紋理與元件密度），配色管顏色。一套配色可搭配不同質地；同一質地可套用不同配色。目前提供 Material、Linen、Grid、Soft UI、Clay、Editorial、Frosted、Aero 八種質地與 Verdant、Midnight、Sandstone、Azure、Cool Grey、Candy、Mist Ink、Glacier Blue 八套配色。相容白名單目前核准 47 組組合；設定頁只顯示目前質地可搭配的配色。Soft UI 以雙向陰影呈現浮雕，Clay 以四層陰影和環境光暈呈現立體軟陶，Editorial 以白色工作區、細邊線及炭黑重點呈現極簡風格，Frosted 則以霧面半透明面板、柔和邊緣光和上方環境光暈呈現金融儀表板風格，Aero 以雲霧環境光與高透亮邊玻璃呈現輕盈工作台風格；質地陰影會適應明暗配色。

可用的 token 與 `ui-` class 契約見 `libs/theme-pack/src/lib/styles/CONTRACT.md`。

### 樣式規則（開發者）

撰寫樣式時請遵守以下規則，確保主題系統運作正確：

1. **顏色、字體、圓角綁定 token**
   - 顏色一律綁 `--mat-sys-*`（由配色包提供）或 `--app-*` 擴充 token（如 `--app-positive-bg`、`--app-viz-1` 等）
   - 字體綁 `--font-zh`（中文）與 `--font-en`（英文），由質地包提供
   - 圓角綁 `--mat-sys-corner-*`，由質地包提供

2. **間距與尺寸**
   - 間距（padding、margin、gap）使用 Tailwind 工具類（`p-4`、`gap-3` 等）
   - 不引入間距 CSS 變數

3. **禁止寫死顏色**
   - 嚴禁出現十六進位色碼（`#xxx`、`#xxxxxx`）
   - 嚴禁使用底層色階變數（如舊專案的 `--sage-500`）
   - **唯一允許的例外**：`libs/theme-pack/src/lib/styles/color-themes/*/` 與各質地的 `_tokens.scss` 檔案

4. **元件 class 契約**
   - 元件一律用 `.ui-*` 開頭（如 `.ui-card`、`.ui-btn`、`.ui-chip`）
   - 狀態使用 `.is-*`（如 `.is-active`、`.is-disabled`）
   - 完整列表見 `libs/theme-pack/src/lib/styles/CONTRACT.md`

5. **狀態色彩**
   - 業務狀態（success、error、warning 等）對應的 tone 在 `libs/theme-pack/src/lib/theme/status-tone.ts` 定義
   - 在元件中使用 `StatusKey` 型別，不要自行編造狀態字串
   - 例：`status-chip` 元件輸入 `success` 會自動對應 `positive` tone，套用 `.ui-chip--positive` 樣式

6. **提交前驗證**
   ```bash
   npm run lint:theme   # 掃 src/app 與 src/styles，檢查色碼與底層變數
   ```
   - 命令必須 exit 0（全綠）才能提交或觸發 CI
   - 違規會列出檔案:行號

### 新增一套配色

若要新增配色（如夜間模式、企業色系等），請按以下步驟：

1. **複製基礎**
   ```bash
   cp -r libs/theme-pack/src/lib/styles/color-themes/verdant libs/theme-pack/src/lib/styles/color-themes/新配色名稱
   ```

2. **編輯色彩 token**
   - 開啟 `libs/theme-pack/src/lib/styles/color-themes/新配色名稱/_tokens.scss`
   - 修改 `:root[data-theme='新配色名稱']` 下的所有 token 值
   - 必須提供的 token：`--mat-sys-*`（Material Design 3 系統顏色）與 `--app-*`（應用擴充色）

3. **註冊到全域**
   - 編輯 `libs/theme-pack/src/lib/styles/color-themes/_registry.scss`
   - 新增一行：`@forward '新配色名稱/tokens';`

4. **新增到配色清單**
   - 編輯 `libs/theme-pack/src/lib/theme/theme.token.ts`
   - 在 `COLOR_THEMES` 陣列中新增：
     ```typescript
     { id: '新配色名稱', label: '顯示名稱' }
     ```

5. **驗證**
   ```bash
   npm run build
   npm run lint:theme
   ```

### 新增一個質地

若要新增造型質地（如玻璃態效果、新形主義等），請按以下步驟：

1. **複製基礎**
   ```bash
   cp -r libs/theme-pack/src/lib/styles/texture/material libs/theme-pack/src/lib/styles/texture/新質地名稱
   ```

2. **依契約重寫 recipe**
   - 參考 `libs/theme-pack/src/lib/styles/CONTRACT.md` 的 class 名單
   - 在 recipe 檔中重新設計樣式；可以依元件拆成 `buttons.scss`、`card.scss` 等，也可以合併在 `recipes.scss`
   - 可自由使用 CSS（包括 `backdrop-filter`、`inset` 陰影等），但顏色一定要綁 token
   - 新增或修改 `_tokens.scss` 裡的造型 token（圓角、陰影、字體等）

3. **註冊到全域**
   - 編輯 `libs/theme-pack/src/lib/styles/texture/_registry.scss`
   - 新增一行：`@forward '新質地名稱/tokens';`
   - 若新增了 recipe 檔，也在該檔頭部用 `@use` 引入

4. **新增到質地清單**
   - 編輯 `libs/theme-pack/src/lib/theme/theme.token.ts`
   - 在 `texture` 陣列中新增：
     ```typescript
     { id: '新質地名稱', label: '顯示名稱' }
     ```

5. **驗證**
   ```bash
   npm run build
   npm run lint:theme
   ```

### 鎖成單一主題（初始化步驟）

若專案要收斂為固定的主題組合（質地 + 配色），請按以下步驟：

1. **設定預設值**
   - 編輯 `libs/theme-pack/src/lib/theme/theme.token.ts`
   - 修改 `DEFAULT_PARADIGM` 和 `DEFAULT_THEME` 為要鎖定的值
   - 或在 `apps/admin/src/index.html` 的 `<html>` 標籤直接寫死屬性：
     ```html
     <html data-paradigm="material" data-theme="verdant">
     ```

2. **（可選）移除換膚器**
   - 若不需要 runtime 切換，可刪除 `libs/theme-pack/src/lib/theme-switcher/theme-switcher.component.ts` 及其引用
   - 編輯主應用模板，移除 theme-switcher 的宣告與使用

3. **（可選）清理未用資源**
   - 若只用一個質地，可刪除 `libs/theme-pack/src/lib/styles/texture/` 下的其他資料夾
   - 同時編輯 `libs/theme-pack/src/lib/styles/texture/_registry.scss`，移除對應的 `@forward` 行
   - 若只用一個配色，可刪除 `libs/theme-pack/src/lib/styles/color-themes/` 下的其他資料夾
   - 同時編輯 `libs/theme-pack/src/lib/styles/color-themes/_registry.scss`，移除對應的 `@forward` 行

4. **驗證**
   ```bash
   npm run build
   npm run lint:theme
   ```

Runtime 主題切換能力隨時可重新啟用，無需修改架構。

---

## 子專案如何套用 / 取消主題系統

本 repo 是多子專案 monorepo（`apps/` 下多個 app，`libs/` 共用）。每個 app 可自由決定要不要套用雙軸主題系統（`libs/theme-pack`）。

### 判斷準則
這個 app 的 UI 未來是否需要換膚 / 換質地？需要就套 theme-pack；純資訊型、不需要換膚的前台可以不套。

### 套用步驟
`apps/<app>/src/styles.scss` 一律引入 `component`（reset，質地/配色無關）＋質地軸，
再依需求二選一決定配色軸怎麼接：

**A. Runtime 可切換配色**（app 內要放主題切換器，如 admin）：
```scss
@use 'theme-pack/src/lib/styles/texture/registry' as *;
@use 'theme-pack/src/lib/styles/color-themes/registry' as *; // 全部配色都編進去，供切換
@use 'theme-pack/src/lib/styles/component';
```
`app.config.ts` 注入 `provideAppInitializer(() => inject(ThemeService).init())`，
模板放 `<app-theme-switcher />`（見 `apps/admin`）。

**B. Build-time 鎖死單一配色**（不放切換器，如 booking／affiliate）：
```scss
@use 'theme-pack/src/lib/styles/texture/registry' as *;
@use 'theme-pack/src/lib/styles/color-themes/verdant/tokens' as *; // 只編進去這一個配色
@use 'theme-pack/src/lib/styles/component';
```
不注入 `ThemeService`，改在 `index.html` 的 `<html>` 直接寫死
`data-paradigm="material" data-theme="verdant"`（值要跟上面選的配色一致，否則沒有對應的
CSS block 可套）。

其餘共同步驟：
1. 確認該 app 的 `project.json` build options 有 `"stylePreprocessorOptions": { "includePaths": ["libs"] }`。
2. 元件樣式遵守 `ui-*` / `is-*` class 契約（見 `libs/theme-pack/src/lib/styles/CONTRACT.md`）。

### 不套用（預設）
什麼都不用做。app 直接用 Angular Material 預設主題或自訂 CSS，不受 `ui-*` 契約約束。`pos` 目前即為此狀態。

### lint:theme 如何運作
`npm run lint:theme` 會自動掃 `libs/theme-pack/src` 與所有 `styles.scss` 含 `theme-pack` 的 app；沒套主題的 app 自動略過，不需維護任何清單。

## libs/assets 共用資源
- `libs/assets/image/`：logo、favicon 等品牌圖檔，各 app 的 build assets 引用此處。
- `libs/assets/style/tailwind-base.scss`：共用 Tailwind v4 `@theme`（間距、斷點基準），各 app `@use 'assets/style/tailwind-base';` 繼承。
- `libs/assets/style/scss/quill-content-style/_quill-content.scss`：Quill 編輯器內容排版，獨立於主題系統、樣式固定，需要顯示 Quill 內容的 app `@use` 即可。
