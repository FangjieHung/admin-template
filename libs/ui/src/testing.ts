/**
 * `@admin-template/ui/testing`：只給測試（spec）用的輔助函式。
 * 跟 `@admin-template/ui`（index.ts）分開，production 程式不會 import 到，不進任何 bundle。
 */
export * from './lib/data-table/data-table-testing';
