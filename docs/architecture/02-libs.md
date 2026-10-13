# libs/ 共用了什麼

三個 app（admin/booking/affiliate）不是各自獨立寫一份邏輯，而是共用 `libs/` 底下的幾個庫。
改 `libs/` 的東西會同時影響所有引用它的 app，這是這份文件存在的原因——先搞清楚
「這段邏輯是誰的」，再決定要改哪裡。

## libs/domain — 全系統共用的資料模型與純函式

別名 `@car-rental/domain`（見根目錄 `tsconfig.base.json` 的 `paths`）。這是**沒有 UI**、
不依賴任何特定 app 的一層，三個 app 都直接 import 它。

### Model（`libs/domain/src/lib/models/`）

| Model | 檔案 | 說明 |
|---|---|---|
| `Vehicle` | `vehicle.ts` | 車輛；`category` 是 `car\|scooter\|ev`，`status` 是狀態機（見下）、`branchId` 存所在據點 id |
| `Member` | `member.ts` | 承租人基本資料；`kind` 分本國人／外國旅客／持居留證者。刻意不存證件圖檔或驗證狀態，那是 `IdentityDocument`/`DriverCredential` 的責任（可跨訂單重用，經 `memberId` 反參照） |
| `RentalOrder` | `rental-order.ts` | 訂單；`status` 是狀態機、`pickupBranchId`/`returnBranchId` 存據點 id、`sourcePartnerId` 標記來源民宿（模組二新增） |
| `RentalBranch` / `BranchType` | `branch.ts` | 具體據點（機場櫃檯、馬公中正門市…），車輛所在據點、取車據點、還車據點共用同一份清單；`BranchType` 只是分類，不能當地址 |
| `PricingPlan` / `SeasonCalendar` | `pricing-plan.ts` | 定價方案（依車型、依日型費率、天數累折級距）與假日/旺季日曆 |
| `AddOn` | `add-on.ts` | 配件（單價 + 計價單位 `per_rental`/`per_day`） |
| `Coupon` | `coupon.ts` | 優惠券（`percent`/`amount`，可限車型/最少天數/有效期） |
| `InsurancePlan` | `insurance-plan.ts` | 保險方案（每日起價、保障項目），計入 `PriceBreakdown.insuranceSubtotal` |
| `PriceBreakdown` | `price-breakdown.ts` | `calculatePrice()` 的輸出，見 `03-pricing-and-commission.md` |
| `PaymentRecord` | `payment-record.ts` | 付款分類帳的單筆紀錄（`purpose: deposit\|balance\|adjustment`、`status` 有 `pending\|confirmed\|failed\|voided`）；訂單目前已付多少一律靠掃這本帳算，不看 `OrderStatus` |
| `ContractVersion` | `contract-version.ts` | 某一時點訂單條款的不可變快照（承租人、車輛、租期、費用皆存文字快照，不怕後續資料異動回頭改到舊合約） |
| `HandoverRecord` | `handover-record.ts` | 取車或還車的完整紀錄：時間、里程、能源讀數、照片、證件核對、雙方簽署確認 |
| `CancellationCase` | `cancellation-case.ts` | 取消案件：責任歸屬（顧客／不可抗力／業者過失／業者故意）、退費試算、最終了結方式 |
| `IdentityDocument` / `DriverCredential` | `identity-document.ts` | 身分證明文件與駕駛資格，存於會員層可跨訂單重用；`DriverCredential` 含外國旅客的駕照互惠資格查核狀態 |
| `CustomerCreditLedgerEntry` | `customer-credit.ts` | 會員購物金帳本，append-only，餘額由所有 entry 加總推導 |
| `OperatorRecoveryCase` | `operator-recovery-case.ts` | 業者責任救單案件：同級調車／免費升等／同業轉單三種補救方案依序嘗試的紀錄 |
| `AuditEntry` | `audit-entry.ts` | 操作稽核紀錄：誰、何時、對哪個實體做了什麼 |
| `ReminderStatus` | `reminder-status.ts` | 還車提醒（前 24 小時／前 2 小時）的排程狀態，實際寄送邏輯在後端 |
| `PrepTask` | `prep-task.ts` | 整備待辦（後台流程審查 4.3，CONTEXT.md「整備」）；`vehicleId`＋觸發的 `bookingId`、`returnedAt`／`returnLocation`、`completedAt?`／`completedBy?`、`supersededBy?`（還沒整備就被同一台車下一次還車取代時指向新那筆——只是一般 model，不是狀態機） |
| `Partner` | `partner.ts` | 合作民宿（模組二新增）；`discountPercent` 協議折扣、`commission` 退佣規則 |
| `CommissionRule` | `commission.ts` | 退佣規則（模組二新增）；`type: 'percent'\|'per_vehicle_day'` |
| `MonthlyPayout` | `monthly-payout.ts` | 月結撥款記錄（模組二新增）；`partnerId + month + status` |
| `SelectOption<T>` | `select-option.ts` | 下拉選單共用的「值＋預設繁中標籤」形狀。各業務列舉的選項常數（`*_OPTIONS`，如 `VEHICLE_CATEGORY_OPTIONS`、`ORDER_STATUS_OPTIONS`、`PAYMENT_METHOD_OPTIONS`）與型別放在同一檔；admin 以 `optionLabelMap()` 取回 `ZH_TW`，官網依 value 翻譯。**新增列舉標籤請加在這裡，不要在 app 或元件裡另長一份** |

以上列的是目前規模較大的 model；完整、隨時最新的清單以 `libs/domain/src/index.ts` 的實際匯出
內容為準，改動前務必核對。表中偏後段那批（`PaymentRecord` 到 `ReminderStatus`）主要支援 admin
訂單詳情頁的收款／合約／交車／取消／稽核等分頁（見 `01-apps.md`「訂單頁面化」）。

**車輛狀態機**（`VehicleStatus`）：`available` → `rented` → `available`；隨時可轉 `maintenance`。
**訂單狀態機**（`OrderStatus`）：只有 `reserved`／`in_progress`／`completed`／`cancelled`
四個值，只描述車輛交接進度，**不代表付款是否完成**——付款狀態改由 `PaymentRecord` 分類帳獨立
追蹤（見上表）。只有 `reserved`/`in_progress` 會佔用車輛時段，定義在 `OCCUPYING_ORDER_STATUSES`／`isOccupyingStatus()`（`enums.ts`），可用性、衝突檢查與調度月曆都用它。
舊資料裡的 `pending_payment`/`confirmed` 是已淘汰的 legacy 值，讀取時由
`normalize-rental-order.ts` 統一遷移為 `reserved`，不會出現在應用程式邏輯裡；完整設計脈絡見
`04-booking-flow.md`。

`MaintenanceRecord`（保養紀錄）**不在這裡**，只有 admin 內部需要，定義在
`apps/admin/src/app/core/models/index.ts`。

### Repository 介面與 in-browser 實作（`libs/domain/src/lib/repositories/`）

```ts
export interface Repository<T extends { id: string }> {
  getAll(): T[];
  getById(id: string): T | undefined;
  create(item: T): T;
  update(id: string, patch: Partial<T>): T;
  remove(id: string): void;
  replaceAll(items: T[]): void;
}
```

`LocalStorageRepository<T>` 是目前唯一的實作：資料序列化進 `localStorage`，
key 統一 `cr.` 前綴（如 `cr.vehicles`、`cr.partners`）。**這是換真後端時唯一要換的地方**——
架構鐵律：元件只經 Store，Store 只依賴這個 `Repository<T>` 介面，不直接碰
`localStorage`；換成打 API 的 `HttpRepository` 實作，Store 跟元件都不用改。

每個 Repository 各自對應一個 `InjectionToken`（`tokens.ts`），app 在 `app.config.ts` 裡
`useFactory` 決定要注入哪個實作 + 哪個 seed 函式（`seed-data.ts`）。

### 純函式（沒有 Angular 依賴，可獨立單元測試）

| 函式 | 檔案 | 用途 |
|---|---|---|
| `calculatePrice()` | `pricing/calculate-price.ts` | 定價引擎，見 `03-pricing-and-commission.md` |
| `isCouponValid()` | `pricing/calculate-price.ts` | 優惠券是否可用（日期/最少天數/車型） |
| `classifyDay()` | `pricing/date-classify.ts` | 某天是 `weekday`/`weekend`/`holiday`/`peak` |
| `calculateCommission()` | `commission/calculate-commission.ts` | 退佣計算，見 `03-pricing-and-commission.md` |
| `rentalDaysOf()` | `commission/rental-days.ts` | 租期天數（優先用報價明細的晚數，缺報價才 fallback 算時間差），admin 與 affiliate 對帳共用 |
| `vehicleAvailability()` / `vehicleUnavailableReasons()` | `availability/vehicle-availability.ts` | 一整段租期內、一批車各自能不能租的**單一規則來源**（2026-09-23：保養中或與既有 `reserved`/`in_progress` 訂單時段重疊就不能租，可排除指定訂單 id；不能租時附原因，重疊訂單依取車時間排序）。月曆的「可用 N」、建單第 1 步與總覽「可用」分頁共用的可租清單（`available-vehicle-list`）都呼叫這裡，不各自再算一次 |
| `isVehicleAvailable()` | `availability/is-vehicle-available.ts` | 單一車輛、單一時段是否可租；內部委派給 `vehicleUnavailableReasons()`，語意與上面那組保證一致。**目前只有 `libs/booking-flow`（官網／代訂站的選車清單）呼叫它**，admin 改呼叫上面那組可以一次問一批車、還能附不能租的原因 |
| `rangesOverlap()` | `availability/ranges-overlap.ts` | 兩個時間區間是否重疊（前單 end === 後單 start 視為不重疊，可無縫接續） |
| `needsDispatch()` | `models/branch.ts` | 取車據點與車輛所在據點是否不同（任一邊未知時保守回傳 false） |
| `evaluateContractChange()` | `contracts/contract-versioning.ts` | 比對合約快照前後版本，判斷是否構成重大異動（須產生新版本、使已簽署版本失效） |
| `contractSigningState()` | `contracts/contract-signing-state.ts` | 一筆訂單的合約簽署狀態：`none`/`unsigned`/`signed`/`needs_resign` |
| `evaluatePickupReadiness()` | `handover/evaluate-pickup-readiness.ts` | 取車前檢查（訂金門檻、合約簽署、證件、互惠資格、車輛狀態），分類一般人員不得放行的阻擋原因。可選傳入 `previousRental: { scheduledReturnAt }`（同一台車另一筆 `in_progress` 訂單）時，「前一位客人尚未還車」永遠排最前面並附逾時時長，取代掉原本排最後、看不出逾時多久的通用「車輛目前在租」阻擋（2026-09-23，後台流程審查批次 1／3 acceptance） |
| `calculateReturnCharges()` | `handover/calculate-return-charges.ts` | 還車逾時費與能源補繳費試算，可由主管手動調整金額 |
| `quoteCancellation()` | `cancellation/quote-cancellation.ts` | 依責任歸屬（顧客／不可抗力／業者過失／業者故意）試算取消退費 |
| `calculatePaymentSummary()` | `payments/calculate-payment-summary.ts` | 掃過付款分類帳＋退款＋加收，算出應收總額、已付淨額、餘額與付款狀態 |
| `formatTwd()` | `formatting/format-currency.ts` | 金額格式化：「NT$10,545」，負數用正確的負號（U+2212）而非連字號「−NT$700」，非有限值（`NaN`/`Infinity`）顯示「—」。放在 `libs/domain`（而非 admin 本地）是為了讓官網日後也能重用；目前 admin 用 `TwdPipe` 包一層在模板用。**注意日期格式化函式（`fmtDate`/`fmtDateTime`/`fmtIsoDate`）沒有跟著放這裡**，仍是 admin 本地的 `apps/admin/src/app/core/date-utils.ts`，只有金額格式化這一項共用 |
| `prepQueue()` | `prep/prep-queue.ts` | 待整備清單排序：只列未結案（`!completedAt && !supersededBy`）的 `PrepTask`，依該車「下一次取車」（`reserved` 訂單中取車時間最早的一筆，刻意不排除已過取車時間的）由近到遠排，沒有下一筆的排最後，相同時先還車的排前面 |

## libs/ui — 無業務邏輯的通用 UI 元件

別名 `@car-rental/ui`（見根目錄 `tsconfig.base.json` 的 `paths`）。跟 `libs/domain` 一樣**沒有業務邏輯**，差別是這裡裝的是 UI 元件而不是 model／純函式；元件 selector 一律 `lib-` 前綴（lint 規則）。跟 `libs/contract-signing` 一樣**不內建任何使用者看得到的文字**——需要顯示文字的元件靠 injection token 讓消費端注入，忘記提供會直接壞掉（fail loudly）而不是靜默顯示錯的語言。目前三個 app 都可能用到，實際上 `booking`／`affiliate` 透過 `libs/booking-flow` 間接引用，`admin` 直接引用。

```
libs/ui/src/lib/
  data-table/                    # lib-data-table：表格（見 DataTable 共用元件，10 張表格統一）
  dual-month-range-picker/       # lib-dual-month-range-picker（2026-09-23 從 booking-flow 搬來）
  responsive-panel/              # 響應式面板容器
```

- **`lib-data-table`**：全站表格共用元件，完整清單／欄位設定見各消費端。2026-09-23 批次修了一個鍵盤操作的 bug：`rowClickable` 模式下，列內按鈕（狀態 chip、操作圖示、勾選框）按 Enter／Space 原本會被事件冒泡到列本身，同時觸發「打開整列」與該按鈕自己的 `preventDefault()`，導致列內按鈕的鍵盤操作實際上永遠打不到；現在只有 keydown 的 `event.target` 就是列本身（不是冒泡上來的）才當作列點擊（`data-table.component.ts` 的 `onRowKeydown()`，用 `event.target !== event.currentTarget` 判斷）。這連帶修好了訂單列表、車輛列表兩處。
- **`lib-dual-month-range-picker`**：雙月日期區間選擇器。原本是 `libs/booking-flow` 內的 `app-dual-month-range-picker`，中文文字寫死在模板裡；2026-09-23 批次搬進這裡改名 `lib-dual-month-range-picker`，改由 `DUAL_MONTH_RANGE_PICKER_LABELS` 這個 injection token（無預設值）注入欄位標籤、預留字、月份換頁的 aria label、月份標題。官網／代訂站經 `libs/booking-flow` 的 `date-step` 帶入 `BOOKING_FLOW_LABELS.dateRangePicker`；admin 建單第 1 步（`order-rental-section`）直接注入自己的文字，行為與畫面跟搬移前一致。同批次也補上鍵盤操作：欄位聚焦時按 Enter／Space／Alt+↓ 開啟面板，開啟時焦點移進當月的某一格、方向鍵可直接操作，Escape 關閉面板並把焦點還給欄位；滑鼠操作不受影響。
- **`responsive-panel`**：既有的響應式面板容器，總覽的行事曆／時間軸共用的右側面板（3.2–3.5）也是用它。

## libs/booking-flow — 共用的預約流程

別名 `@car-rental/booking-flow`。這是**booking 和 affiliate 共用同一套 UI**的地方——
兩個 app 的「預約流程」長得一模一樣，只是套用的情境不同。流程本身是四個獨立路由頁
（搜尋 → 下單 → 付款 → 完成），不是單一元件裡的精靈步驟；完整設計決策見
[`04-booking-flow.md`](./04-booking-flow.md)，這裡只列這個 lib 裝了什麼、誰在用。

```
libs/booking-flow/src/lib/
  pages/               # 五個路由頁：search / plan / order / payment / done
  components/          # 頁面用的展示元件：order-summary-card、search-criteria-bar
  steps/               # 被頁面組合的展示元件（date-step、vehicle-step、addon-step、
                        # coupon-step、confirm-step），以及 done（完成頁，實際是路由頁）
  i18n/                 # 官網多語系（BookingFlowI18n、三語字典、語言切換器）
  booking-context.ts    # BOOKING_CONTEXT：夥伴身分與導頁前綴
  quote.service.ts      # QuoteService：報價計算
  catalog.store.ts      # CatalogStore：資料存取與訂單寫入
  date-range.ts         # DateRange 型別
```

**夥伴身分靠 `BOOKING_CONTEXT` injection token 注入**，不是 input：

```ts
interface BookingContext {
  partner: Signal<Partner | null>;   // 消費者情境恆為 null
  basePath: Signal<string[]>;        // ['/'] 或 ['/p', slug]
}
```

booking app 不提供，吃 root 預設值（consumer）；affiliate 的 `PartnerShellComponent`
在元件層 `providers` 提供夥伴版本，讓子路由的四個頁面都能讀到 `Partner` 與正確的導頁前綴。

**`QuoteService` 與 `CatalogStore` 分工**：`QuoteService`（`quote.service.ts`）是唯一算價
入口，搜尋頁與下單頁都靠它試算，內部包一層 `CatalogStore.price()`；`CatalogStore`
（`catalog.store.ts`）負責資料存取與寫入，職責：
- `price()` — 包一層呼叫 `calculatePrice()`（domain 純函式）
- `validateCoupon()` — 查優惠券是否存在、是否符合條件
- `submitBooking()` — 檢查車輛可租用（`isVehicleAvailable()`）→ 算價 → 建 `Member` →
  寫入 `status: 'reserved'` 的訂單
- `markBookingPaid()` — 付款成功後呼叫，**不改動** `booking.status`（履約狀態本來就不代表
  付款進度），只在付款分類帳（`PAYMENT_REPO`）追加一筆 `purpose: 'balance'`、
  `status: 'confirmed'` 的付款紀錄；冪等性靠查有無該訂單的 confirmed balance 紀錄判斷，
  完整脈絡見 `04-booking-flow.md`

`admin` 也直接引用這個 lib 的 `DateStepComponent`、`VehicleStepComponent`、`DateRange`
（分別用在 dashboard 與選車 dialog），所以改這三者的 input/output 會同時影響 admin。

`plan-page.component.ts`（選保險方案）掛在 `vehicle/:vehicleId/plan`，是 search 與 order
之間的一步；它在 2026-09-18 到 09-23 之間曾被暫時從路由拿掉，期間官網的保費一律算成 0。

## libs/contract-signing — 合約檢視與簽署（admin 使用，設計上供官網共用）

別名 `@car-rental/contract-signing`。從 admin 的建單／訂單詳情流程抽出來的「看合約條文＋簽
名」共用元件庫，只依賴 `@car-rental/domain` 與 Angular／Material，**不依賴任何 apps/\* 的
程式碼**，因此官網日後要接上時可以直接引用（目前尚未接，見 `04-booking-flow.md`「已知缺
口」）。只負責顯示合約與擷取簽名，不呼叫任何合約 store——拿到簽名資產紀錄後完成簽署是呼叫端
的職責。

| 匯出 | 用途 |
|---|---|
| `ContractSigningDialogComponent` / `openContractSigningDialog()` | 簽署用 dialog：合約條文（可捲動）→ 簽名板 → 取消／確認簽署，寬螢幕大尺寸、手機全螢幕 |
| `ContractDocumentComponent` | 純展示一份 `ContractSnapshot` |
| `SignaturePadComponent` | 手寫（canvas）／打字簽名，存檔後只 emit 不透明的資產紀錄 |

admin 的建單第四步（`/orders/new` 的「合約」步驟）與訂單詳情的合約分頁共用同一個
簽署 dialog。完整匯出清單與消費端需提供的 token 見 `libs/contract-signing/README.md`。

## libs/order-form — 建單積木層（admin 使用，設計上供官網共用）

別名 `@car-rental/order-form`。依 ADR 0001，官網與櫃檯**不共用外層流程**（admin 是 stepper 單頁、官網是可分享的
網址頁），只共用這一層積木：

| 匯出 | 用途 |
|---|---|
| `createOrderForm()`、`orderFormInitialFromOrder()` 等 | 型別化 FormGroup 定義、初始值、欄位連動 |
| `createOrderFormDerived()`、`orderFormProblems()`、`orderIncompleteItems()` | 報價、衝突、訂金上限等衍生狀態；送出前檢查與待補項目 |
| `buildContractSnapshot()`、`sameContractTerms()` | 由表單組合約快照、比對條款（先簽後建） |
| `lib-order-rental-section` 等五個區塊元件 | 租期與車輛、承租人、費用、款項、合約 |
| `ORDER_FORM_DATA`、`ORDER_SUBMIT_GATEWAY`、`ORDER_FORM_LABELS` | 使用端必須提供的參考資料、送出實作、文案與日期格式 |

這個 lib **不帶任何文案**：admin 以 `ZH_TW` 的對應分組提供 `ORDER_FORM_LABELS`
（`apps/admin/src/app/features/orders/data/provide-admin-order-form.ts`），官網日後接上時由它自己的字典提供。
只依賴 `domain`、`contract-signing` 與 Angular／Material，不依賴任何 apps/\* 的程式碼。

## libs/theme-pack — 雙軸主題系統（Admin 開放切換）

別名 `@car-rental/theme-pack`。質地（Paradigm，管造型：圓角/陰影/字體）×
配色（Color-theme，管顏色）兩軸可自由組合，目前提供 Material/Linen/Grid/Soft UI/Clay/Editorial/Frosted/Aero 質地與
Verdant/Midnight/Sandstone/Azure/Cool Grey/Candy/Mist Ink/Glacier Blue 配色。Admin 常駐 Material 質地與全部配色，其餘質地切換時才下載各自的 `texture-<id>.css`（ADR 0010），並提供設定頁切換；
booking 與 affiliate 雖引用 theme-pack 的樣式，但各自只編入一套固定配色，沒有開放執行期換膚。

詳細設計、樣式規則（禁止寫死顏色、`.ui-*` class 契約等）、新增配色/質地的步驟，
完整寫在根目錄 `README.md`「雙軸主題系統」一節，class 契約完整列表見
`libs/theme-pack/src/lib/styles/CONTRACT.md`，這裡不重複。
