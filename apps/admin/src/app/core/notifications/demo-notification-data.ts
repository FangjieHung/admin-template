import type { NewNotification, NotificationItem } from '@admin-template/ui';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * 示範通知（中性資料：工單指派、@提及、專案狀態變更、系統維護公告）。內容固定；時間以「現在」往回推，
 * 所以每次打開都有今天、昨天、更早三組。連結指向範本裡存在的頁面（工單詳情、設定頁）。
 */
export function demoNotifications(now: number): NotificationItem[] {
  return [
    {
      id: 'n-01',
      title: '林雅婷把 TK-2048 指派給你',
      body: '會議室投影機無法開機：已確認電源正常，請協助檢查訊號線與投影機設定。',
      createdAt: now - 6 * MIN,
      read: false,
      category: 'assigned',
      avatar: '林',
      link: '/templates/tickets/TK-2048',
    },
    {
      id: 'n-02',
      title: '王小明在 TK-2119 提到你',
      body: '@你 這張工單的報價單已經上傳，麻煩確認金額後再回覆客戶。',
      createdAt: now - 38 * MIN,
      read: false,
      category: 'mention',
      avatar: '王',
      link: '/templates/tickets/TK-2119',
      action: { id: 'view', label: '查看留言' },
    },
    {
      id: 'n-03',
      title: '專案「官網改版」狀態變更為「進行中」',
      body: '陳怡君更新了專案狀態，預計完成日為下個月 15 日。',
      createdAt: now - 3 * HOUR,
      read: false,
      category: 'status',
      icon: 'sync_alt',
      tone: 'info',
    },
    {
      id: 'n-04',
      title: 'TK-2118 已結案',
      body: '張志豪結案了這張工單：已更換門禁讀卡機並完成測試。',
      createdAt: now - 5 * HOUR,
      read: true,
      category: 'status',
      icon: 'task_alt',
      tone: 'positive',
      link: '/templates/tickets/TK-2118',
    },
    {
      id: 'n-05',
      title: '系統維護公告：週六 22:00–24:00',
      body: '維護期間無法登入與送出表單，請提前儲存正在編輯的資料。',
      createdAt: now - 1 * DAY - 2 * HOUR,
      read: false,
      category: 'system',
      icon: 'build',
      tone: 'warning',
    },
    {
      id: 'n-06',
      title: '李佩珊把 TK-2120 指派給你',
      body: '新進同仁的筆電需要安裝常用軟體與設定網路印表機。',
      createdAt: now - 1 * DAY - 6 * HOUR,
      read: true,
      category: 'assigned',
      avatar: '李',
      link: '/templates/tickets/TK-2120',
    },
    {
      id: 'n-07',
      title: '黃俊傑在專案「內部系統整合」提到你',
      body: '@你 下週的進度會議改到週三下午，請更新你負責的項目。',
      createdAt: now - 3 * DAY,
      read: true,
      category: 'mention',
      avatar: '黃',
    },
    {
      id: 'n-08',
      title: '你的密碼將在 7 天後到期',
      body: '請到設定頁的「安全性」更新密碼。',
      createdAt: now - 4 * DAY,
      read: false,
      category: 'system',
      icon: 'lock_clock',
      tone: 'danger',
      link: '/templates/settings/security',
      action: { id: 'change-password', label: '更新密碼' },
    },
    {
      id: 'n-09',
      title: '專案「年度盤點」狀態變更為「已暫停」',
      body: '吳淑芬暫停了專案：等待倉庫排程確認。',
      createdAt: now - 6 * DAY,
      read: true,
      category: 'status',
      icon: 'pause_circle',
      tone: 'neutral',
    },
    {
      id: 'n-10',
      title: '週報已產生',
      body: '上週共新增 18 張工單、結案 21 張。',
      createdAt: now - 8 * DAY,
      read: true,
      category: 'system',
      icon: 'summarize',
      tone: 'neutral',
    },
    {
      id: 'n-11',
      title: '劉建宏把 TK-2001 指派給你',
      body: '辦公室無線網路在下午時段斷線，請協助檢查基地台。',
      createdAt: now - 12 * DAY,
      read: true,
      category: 'assigned',
      avatar: '劉',
      link: '/templates/tickets/TK-2001',
    },
    {
      id: 'n-12',
      title: '系統已更新到新版本',
      body: '這次更新改善了清單頁的載入速度，並修正匯出 Excel 的日期格式。',
      createdAt: now - 15 * DAY,
      read: true,
      category: 'system',
      icon: 'new_releases',
      tone: 'info',
    },
  ];
}

const INCOMING: readonly NewNotification[] = [
  {
    title: '陳怡君在 TK-2048 提到你',
    body: '@你 投影機的訊號線已經換新，可以再測一次嗎？',
    category: 'mention',
    avatar: '陳',
    link: '/templates/tickets/TK-2048',
  },
  {
    title: '吳淑芬把 TK-2117 指派給你',
    body: '三樓茶水間的飲水機漏水，請安排維修。',
    category: 'assigned',
    avatar: '吳',
    link: '/templates/tickets/TK-2117',
  },
  {
    title: '專案「客服流程調整」狀態變更為「待審核」',
    body: '黃俊傑送出了審核，請在本週內完成。',
    category: 'status',
    icon: 'rule',
    tone: 'warning',
  },
  {
    title: '系統備份已完成',
    body: '今天凌晨的資料備份已完成，共 2.4 GB。',
    category: 'system',
    icon: 'cloud_done',
    tone: 'positive',
  },
];

/** 第 n 則推播進來的示範通知（輪流使用固定的四則）。 */
export function incomingNotification(n: number): NewNotification {
  return INCOMING[(n - 1) % INCOMING.length];
}
