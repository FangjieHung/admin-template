/**
 * 殼層（側欄、頁首、頁尾、App 根元件、app.config）用到的字串。
 * 從 zh-tw.ts 拆出來，讓 Initial bundle 不必帶著整本字典（以及字典引用的 @car-rental/domain 選項表）；
 * zh-tw.ts 的 ZH_TW 直接引用這裡的同一份物件，各頁面照舊用 ZH_TW.nav／ZH_TW.layout 等，文字只維護在這裡。
 */
export const ZH_TW_SHELL = {
  app: { title: '澎湖租車後台' },
  nav: {
    dashboard: '總覽',
    // 4.5：「商品管理」是電商用語，改叫它實際管的東西。
    productGroup: '車輛與配件',
    vehicles: '車輛清單',
    // 4.5：「訂單管理」改成側欄群組（訂單列表、會員）；新增訂單、訂單詳情、會員頁的麵包屑也用這個字。
    orders: '訂單管理',
    orderList: '訂單列表',
    members: '會員',
    maintenance: '保養管理',
    pricingGroup: '定價管理',
    pricing: '定價規則',
    pricingCalendar: '假日及旺季',
    addOns: '配件清單',
    coupons: '優惠券設定',
    partnerGroup: '合作通路',
    partners: '通路管理',
    commission: '退佣帳單',
  },
  // ZH_TW.common.storageReset 引用這一條（app.config 的本機資料重設提示）。
  storageReset: '本機資料格式異常，已重設為示範資料',
  layout: {
    subtitle: '管理中心',
    navAriaLabel: '主導覽',
    adminUser: '管理員',
    loggedIn: '已登入',
    copyright: '版權所有',
    // 2.1：頁首麵包屑／返回（各頁的標題文字仍各自放在對應頁面的 i18n 區塊）。
    breadcrumbAriaLabel: '麵包屑',
    back: '返回',
  },
  // 清單頁的頁首工具列（@car-rental/ui 的 lib-page-toolbar／lib-filter-select）：在 app.config 根層提供，
  // ZH_TW.common 的同名字串引用這裡。
  listToolbar: {
    search: '搜尋',
    collapseSearch: '收合搜尋',
    clearSearch: '清除搜尋',
    submitSearch: '搜尋',
    clearFilters: '清除篩選',
    all: '全部',
  },
} as const;
