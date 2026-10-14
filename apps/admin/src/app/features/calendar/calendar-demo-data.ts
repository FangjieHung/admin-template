import type { CalendarCategory, CalendarEvent, CalendarResource } from '@admin-template/ui';

/**
 * 日曆展示頁的中性示範資料：以「今天」所在的那一週為基準產生（每次都一樣，截圖與測試可重現）。
 * 新專案刪掉展示頁時一起刪。
 */

export const DEMO_CALENDAR_CATEGORIES: readonly CalendarCategory[] = [
  { id: 'meeting', label: '會議', color: 1 },
  { id: 'client', label: '客戶', color: 2 },
  { id: 'training', label: '教育訓練', color: 3 },
  { id: 'leave', label: '請假', color: 4 },
  { id: 'ops', label: '系統維護', color: 5 },
];

function monday(today: Date): Date {
  const back = (today.getDay() + 6) % 7;
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
}

/** 這週第 `day` 天（0＝星期一）的 h:m。 */
function at(base: Date, day: number, h = 0, m = 0): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + day, h, m);
}

/** 月／週／日／議程示範：團隊週會、客戶簡報、教育訓練、請假、系統維護，前後各三週。 */
export function makeDemoCalendarEvents(today = new Date()): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let w = -3; w <= 3; w++) {
    const base = at(monday(today), w * 7);
    const tag = `w${w + 3}`;
    events.push(
      { id: `${tag}-weekly`, title: '團隊週會', start: at(base, 0, 10), end: at(base, 0, 11), category: 'meeting', status: '已確認' },
      { id: `${tag}-brief`, title: '客戶簡報', start: at(base, 2, 14), end: at(base, 2, 15, 30), category: 'client' },
      { id: `${tag}-train`, title: '教育訓練', start: at(base, 3, 9, 30), end: at(base, 3, 12), category: 'training' },
      { id: `${tag}-onboard`, title: '新人說明會', start: at(base, 3, 10), end: at(base, 3, 11), category: 'meeting' },
      { id: `${tag}-review`, title: '專案檢討', start: at(base, 3, 10, 30), end: at(base, 3, 11, 30), category: 'meeting', status: '暫定' },
      { id: `${tag}-ops`, title: '系統維護', start: at(base, 5, 22), end: at(base, 6, 2), category: 'ops' },
    );
  }
  const base = monday(today);
  events.push(
    // 星期二塞滿：月檢視出現「+N 筆」。
    { id: 'tue-1on1', title: '一對一面談', start: at(base, 1, 9), end: at(base, 1, 9, 30), category: 'meeting' },
    { id: 'tue-budget', title: '預算審查', start: at(base, 1, 10), end: at(base, 1, 11, 30), category: 'meeting' },
    { id: 'tue-vendor', title: '供應商來電', start: at(base, 1, 13), end: at(base, 1, 13, 30), category: 'client' },
    { id: 'tue-standup', title: '專案站立會議', start: at(base, 1, 15), end: at(base, 1, 15, 15), category: 'meeting' },
    { id: 'tue-book', title: '讀書會', start: at(base, 1, 17), end: at(base, 1, 18), category: 'training' },
    { id: 'fri-leave', title: '請假（林雅婷）', start: at(base, 4), end: at(base, 5), allDay: true, category: 'leave' },
    { id: 'next-leave', title: '特休（王宗翰）', start: at(base, 8), end: at(base, 11), allDay: true, category: 'leave' },
    { id: 'next-visit', title: '客戶拜訪', start: at(base, 9, 13, 30), end: at(base, 9, 16), category: 'client' },
  );
  return events;
}

export const DEMO_ROOMS: readonly CalendarResource[] = [
  { id: 'room-a', title: '會議室 A', subtitle: '12 人', group: '三樓' },
  { id: 'room-b', title: '會議室 B', subtitle: '6 人', group: '三樓' },
  { id: 'room-c', title: '會議室 C', subtitle: '20 人', group: '三樓' },
  { id: 'room-video', title: '視訊室', subtitle: '8 人', group: '五樓' },
  { id: 'room-class', title: '訓練教室', subtitle: '30 人', group: '五樓' },
];

/** 會議室預約（資源排程）：今天與這一週，會議室 B 有一組時間重疊（衝突）。 */
export function makeDemoRoomBookings(today = new Date()): CalendarEvent[] {
  const base = monday(today);
  const day = (today.getDay() + 6) % 7;
  const b = (id: string, title: string, room: string, d: number, h: number, m: number, h2: number, m2: number, category: string): CalendarEvent => ({
    id,
    title,
    resourceId: room,
    category,
    start: at(base, d, h, m),
    end: at(base, d, h2, m2),
  });
  return [
    b('bk-weekly', '團隊週會', 'room-a', day, 10, 0, 11, 0, 'meeting'),
    b('bk-brief', '客戶簡報', 'room-a', day, 14, 0, 15, 30, 'client'),
    b('bk-interview', '面試', 'room-b', day, 9, 30, 10, 30, 'meeting'),
    b('bk-sync', '跨部門同步', 'room-b', day, 10, 0, 11, 0, 'meeting'),
    b('bk-vendor', '供應商簡報', 'room-c', day, 13, 0, 14, 30, 'client'),
    b('bk-video', '視訊：分公司週報', 'room-video', day, 11, 0, 12, 0, 'meeting'),
    b('bk-train', '新人教育訓練', 'room-class', day, 9, 0, 12, 0, 'training'),
    b('bk-train2', '資安課程', 'room-class', day, 13, 30, 16, 0, 'training'),
    b('bk-next', '專案啟動會', 'room-c', (day + 1) % 7, 15, 0, 16, 30, 'meeting'),
    b('bk-ops', '設備保養', 'room-video', (day + 2) % 7, 8, 0, 10, 0, 'ops'),
  ];
}

/** 儲存失敗示範：星期五下午的維護時段鎖定，活動移進去會失敗。 */
export function makeLockedWeek(today = new Date()): CalendarEvent[] {
  const base = monday(today);
  return [
    { id: 'lk-weekly', title: '團隊週會', start: at(base, 0, 10), end: at(base, 0, 11), category: 'meeting' },
    { id: 'lk-brief', title: '客戶簡報', start: at(base, 2, 14), end: at(base, 2, 15), category: 'client' },
    { id: 'lk-train', title: '教育訓練', start: at(base, 3, 9), end: at(base, 3, 11), category: 'training' },
    {
      id: 'lk-lock',
      title: '系統維護（鎖定）',
      start: at(base, 4, 13),
      end: at(base, 4, 17),
      category: 'ops',
      editable: false,
      status: '鎖定',
    },
  ];
}
