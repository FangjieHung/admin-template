import type { ChartSeries, DonutSlice } from '@admin-template/ui';

/**
 * 圖表展示頁的示範資料（中性：工單的來源、優先順序、處理單位、主題）。固定種子，每次一樣；
 * 日期相對於傳入的「今天」。新專案刪掉展示頁時一起刪。
 */

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

export interface ChartsDemoData {
  /** 最近 30 天（含今天）。 */
  days: Date[];
  /** 每天依來源的新工單（5 個系列：第 4、5 條是虛線與點線）。 */
  sources: ChartSeries[];
  /** 最近 14 天每天結束時處理中的工單數（面積）。 */
  backlogDays: Date[];
  backlog: ChartSeries[];
  /** 最近 8 週（每週一）× 優先順序（堆疊）。 */
  weeks: Date[];
  priorities: ChartSeries[];
  /** 處理單位（橫式；最後一個名稱特別長）。 */
  teams: string[];
  teamLoad: ChartSeries[];
  /** 工單主題 8 類（圓環會把最小的 3 類併成「其他」）。 */
  topics: DonutSlice[];
  /** 數字小卡：今天往回 7 天的每日新增。 */
  weekly: number[];
}

const SOURCES = [
  { id: 'mail', label: '客服信箱', base: 9 },
  { id: 'webform', label: '線上表單', base: 7 },
  { id: 'phone', label: '電話', base: 5 },
  { id: 'walkin', label: '現場', base: 3 },
  { id: 'im', label: '即時通訊', base: 4 },
];

const PRIORITIES = [
  { id: 'low', label: '低' },
  { id: 'medium', label: '中' },
  { id: 'high', label: '高' },
  { id: 'urgent', label: '緊急' },
];

const TEAMS = ['資訊室', '總務組', '人資組', '財務部', '研發部', '法務室與稽核小組（含外部顧問）'];

const TOPICS = [
  ['printer', '印表機與事務機', 38],
  ['account', '帳號與密碼', 31],
  ['network', '網路連線', 24],
  ['software', '軟體安裝與授權', 17],
  ['meeting', '會議室設備', 12],
  ['access-card', '門禁卡', 6],
  ['furniture', '辦公桌椅', 4],
  ['phone-ext', '分機', 3],
] as const;

export function makeChartsDemoData(today = new Date()): ChartsDemoData {
  const rand = seeded(20261014);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = (offset: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  const days = Array.from({ length: 30 }, (_, i) => day(i - 29));
  // 週末量少一點，看起來像真的上班日。
  const weekday = (d: Date) => (d.getDay() === 0 || d.getDay() === 6 ? 0.35 : 1);
  const sources = SOURCES.map((s) => ({
    id: s.id,
    label: s.label,
    values: days.map((d, i) => Math.round((s.base + Math.sin(i / 4 + s.base) * 2 + rand() * 3) * weekday(d))),
  }));
  const backlogDays = days.slice(-14);
  let open = 42;
  const backlog = [
    {
      id: 'backlog',
      label: '處理中',
      values: backlogDays.map(() => {
        open = Math.max(18, open + Math.round(rand() * 9 - 4.5));
        return open;
      }),
    },
  ];
  const monday = day(-((base.getDay() + 6) % 7));
  const weeks = Array.from({ length: 8 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - (7 - i) * 7));
  const priorities = PRIORITIES.map((p, k) => ({
    id: p.id,
    label: p.label,
    values: weeks.map(() => Math.round([14, 22, 9, 3][k] + rand() * [6, 8, 6, 3][k])),
  }));
  const teamLoad = [{ id: 'month', label: '本月工單', values: [64, 37, 22, 18, 29, 9] }];
  const topics = TOPICS.map(([id, label, value]) => ({ id, label, value }));
  const weekly = days.slice(-7).map((_, i) => sources.reduce((sum, s) => sum + (s.values[23 + i] ?? 0), 0));
  return { days, sources, backlogDays, backlog, weeks, priorities, teams: TEAMS, teamLoad, topics, weekly };
}
