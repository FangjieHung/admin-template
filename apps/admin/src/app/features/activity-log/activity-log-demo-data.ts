// 活動紀錄展示頁（與詳情頁版型展示頁）的示範資料：一張工單的活動。固定種子，內容每次都一樣；
// 時間相對於傳入的「現在」計算，保證一定有「今天」「昨天」兩組。新專案刪掉展示頁時一起刪。
import type { ActivityEntry, ActivityFilter, ActivityKindMap } from '@admin-template/ui';

/** 種類 → 圖示與色調（使用端提供，元件不認得任何業務種類）。 */
export const DEMO_ACTIVITY_KINDS: ActivityKindMap = {
  create: { icon: 'add_circle', tone: 'info' },
  status: { icon: 'sync_alt', tone: 'info' },
  assign: { icon: 'person_add', tone: 'neutral' },
  priority: { icon: 'flag', tone: 'warning' },
  comment: { icon: 'chat', tone: 'neutral' },
  attachment: { icon: 'attach_file', tone: 'neutral' },
  edit: { icon: 'edit', tone: 'neutral' },
  escalate: { icon: 'priority_high', tone: 'danger' },
  resolve: { icon: 'check_circle', tone: 'success' },
  sla: { icon: 'timer', tone: 'warning' },
};

export const DEMO_ACTIVITY_FILTERS: ActivityFilter[] = [
  { id: 'all', label: '全部' },
  { id: 'changes', label: '變更' },
  { id: 'comments', label: '留言' },
  { id: 'system', label: '系統' },
];

/** 依篩選 id 篩資料（使用端的責任；元件只送出 filterChange）。 */
export function filterDemoActivity(entries: readonly ActivityEntry[], filter: string | null): ActivityEntry[] {
  switch (filter) {
    case 'changes':
      return entries.filter((e) => (e.changes?.length ?? 0) > 0);
    case 'comments':
      return entries.filter((e) => e.kind === 'comment');
    case 'system':
      return entries.filter((e) => e.actor === null);
    default:
      return [...entries];
  }
}

const PEOPLE = ['王宗翰', '林雅婷', '陳志明', '張美玲', '李佩君'];
const STATUSES = ['待處理', '處理中', '等待回覆', '已完成'];
const PRIORITIES = ['低', '中', '高', '緊急'];
const COMMENTS = [
  '已到現場確認，印表機可以列印測試頁，但從電腦送出的工作都卡在佇列。',
  '重新安裝驅動程式後仍無法連線，懷疑是網路設定。',
  '請 IT 協助確認這台印表機的固定 IP 是否被其他設備占用。',
  '已更換網路線，暫時恢復，明天再觀察一次。',
  '使用者回報下午又斷線一次。\n時間約 14:20，持續 5 分鐘。',
  '廠商回覆：韌體版本過舊，建議更新。',
];
const ATTACHMENTS = ['錯誤畫面.png', '網路設定.pdf', '韌體更新說明.pdf', '佇列截圖.png'];

/** 固定種子的亂數（mulberry32）：同一個種子每次產生一樣的序列。 */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR = 3_600_000;

/** 每一筆的發生時間（新到舊）：前 3 筆在今天、接著 4 筆在昨天，其餘每隔 3–20 小時往前。 */
function demoTimes(now: Date, count: number, random: () => number): Date[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const elapsed = now.getTime() - startOfToday;
  const times: number[] = [now.getTime() - 3 * 60_000 > startOfToday ? now.getTime() - 3 * 60_000 : now.getTime()];
  times.push(now.getTime() - elapsed * 0.35, now.getTime() - elapsed * 0.7);
  for (const h of [2, 5, 9, 15]) times.push(startOfToday - h * HOUR);
  let t = startOfToday - 30 * HOUR;
  while (times.length < count) {
    times.push(t);
    t -= (3 + Math.floor(random() * 18)) * HOUR + Math.floor(random() * 60) * 60_000;
  }
  return times.slice(0, count).map((ms) => new Date(ms));
}

/**
 * 一張工單（TK-2048 印表機無法連線）的活動紀錄，新到舊。`count` 預設 40。
 * 涵蓋：系統紀錄、留言（含換行）、多欄位變更（超過 3 筆會收合）、附件、狀態與指派。
 */
export function makeDemoActivity(now: Date, count = 40): ActivityEntry[] {
  const random = seeded(2048);
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  const times = demoTimes(now, count, random);
  const entries: ActivityEntry[] = [];
  // 固定的前幾筆，讓今天、昨天的分組一定看得到各種樣子。
  const scripted: Omit<ActivityEntry, 'id' | 'at'>[] = [
    { actor: { name: '王宗翰' }, kind: 'status', summary: '王宗翰 把狀態從「處理中」改成「等待回覆」', changes: [{ field: '狀態', from: '處理中', to: '等待回覆' }] },
    { actor: { name: '林雅婷' }, kind: 'comment', summary: '林雅婷 留言', body: COMMENTS[4] },
    { actor: null, kind: 'sla', summary: '系統提醒：距離回應期限剩 2 小時' },
    {
      actor: { name: '陳志明' },
      kind: 'edit',
      summary: '陳志明 修改了 5 個欄位',
      changes: [
        { field: '優先順序', from: '中', to: '高' },
        { field: '分類', from: '一般', to: '硬體' },
        { field: '地點', from: null, to: '3 樓影印區' },
        { field: '影響人數', from: '1', to: '12' },
        { field: '期限', from: '10/16', to: '10/15' },
      ],
    },
    { actor: { name: '張美玲' }, kind: 'attachment', summary: '張美玲 上傳附件「錯誤畫面.png」' },
    { actor: null, kind: 'assign', summary: '系統依分類自動指派給 王宗翰', changes: [{ field: '負責人', from: null, to: '王宗翰' }] },
    { actor: { name: '李佩君' }, kind: 'comment', summary: '李佩君 留言', body: COMMENTS[0] },
  ];
  for (let i = 0; i < count; i++) {
    const id = `act-${String(count - i).padStart(3, '0')}`;
    const at = times[i];
    if (i < scripted.length) {
      entries.push({ id, at, ...scripted[i] });
      continue;
    }
    if (i === count - 1) {
      entries.push({ id, at, actor: { name: '李佩君' }, kind: 'create', summary: '李佩君 建立工單「印表機無法連線」' });
      continue;
    }
    const who = pick(PEOPLE);
    const roll = random();
    if (roll < 0.25) {
      const from = pick(STATUSES);
      const to = pick(STATUSES.filter((s) => s !== from));
      entries.push({ id, at, actor: { name: who }, kind: 'status', summary: `${who} 把狀態從「${from}」改成「${to}」`, changes: [{ field: '狀態', from, to }] });
    } else if (roll < 0.45) {
      entries.push({ id, at, actor: { name: who }, kind: 'comment', summary: `${who} 留言`, body: pick(COMMENTS) });
    } else if (roll < 0.58) {
      const to = pick(PEOPLE);
      entries.push({ id, at, actor: { name: who }, kind: 'assign', summary: `${who} 把負責人改成 ${to}`, changes: [{ field: '負責人', from: pick(PEOPLE), to }] });
    } else if (roll < 0.68) {
      const from = pick(PRIORITIES);
      const to = pick(PRIORITIES.filter((p) => p !== from));
      entries.push({ id, at, actor: { name: who }, kind: 'priority', summary: `${who} 把優先順序改成「${to}」`, changes: [{ field: '優先順序', from, to }] });
    } else if (roll < 0.78) {
      entries.push({ id, at, actor: { name: who }, kind: 'attachment', summary: `${who} 上傳附件「${pick(ATTACHMENTS)}」` });
    } else if (roll < 0.88) {
      entries.push({ id, at, actor: null, kind: 'sla', summary: '系統提醒：工單超過 24 小時沒有更新' });
    } else if (roll < 0.94) {
      entries.push({ id, at, actor: null, kind: 'escalate', summary: '系統把工單升級給主管', changes: [{ field: '升級', from: null, to: '陳志明' }] });
    } else {
      entries.push({
        id,
        at,
        actor: { name: who },
        kind: 'edit',
        summary: `${who} 修改了 4 個欄位`,
        changes: [
          { field: '型號', from: 'LaserJet 400', to: 'LaserJet M404' },
          { field: '資產編號', from: null, to: 'AS-1187' },
          { field: '地點', from: '2 樓', to: '3 樓影印區' },
          { field: '備註', from: '無', to: null },
        ],
      });
    }
  }
  return entries;
}
