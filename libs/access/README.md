# access

通用的權限層：權限 = 功能 × 動作（檢視、建立、編輯、刪除、核准）、預設角色＋自訂角色、一位使用者多個角色（權限取聯集）。
不含任何業務規則；功能清單、預設角色與使用者由 app 宣告（`provideAccess(config)`）。

**純前端只能隱藏畫面，不是安全防護；接後端時伺服器必須再檢查一次。**

- `@admin-template/access`：模型、`AccessService`、`accessGuard`／`accessMatchGuard`、`*libCan`、`[libDisabledUnless]`、`filterByAccess`、`unsavedChangesGuard`、`AccessRepository`（預設存在瀏覽器）。
- `@admin-template/access/permission-matrix`：權限矩陣編輯器、`RoleDraft`（編輯中的角色與未儲存變更）。
- `@admin-template/access/identity-switcher`：示範用的「切換身分」小工具。

不依賴 `libs/ui`；`libs/ui` 也不依賴這裡。用法見根目錄 `README.md`「權限」與展示 app 的「權限控制」頁。

`npx nx test access`、`npx nx lint access`。
