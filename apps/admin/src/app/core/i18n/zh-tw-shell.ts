/**
 * 殼層（側欄、頁首、頁尾、App 根元件）用到的字串。
 * 從 zh-tw.ts 拆出來，讓 Initial bundle 不必帶著整本字典；zh-tw.ts 的 ZH_TW 直接引用這裡的同一份物件。
 */
export const ZH_TW_SHELL = {
  app: { title: 'Admin Template' },
  nav: {
    home: '首頁',
    materialOverview: 'Material 元件總覽',
    templates: '頁面樣板',
    planned: '規劃中',
  },
  layout: {
    subtitle: '元件範本',
    navAriaLabel: '主導覽',
    adminUser: '示範使用者',
    loggedIn: '已登入',
    settings: '設定',
    logout: '登出',
    copyright: '版權所有',
    breadcrumbAriaLabel: '麵包屑',
    back: '返回',
  },
} as const;
