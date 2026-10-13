import type { ActivityEntry, ActivityKindMap } from '@admin-template/ui';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  Ticket,
  TicketCategory,
  TicketPerson,
  TicketStatus,
} from './ticket.model';

/**
 * 工單樣板的示範資料：120 張工單、負責人、申請人與每張工單的活動紀錄。固定種子，每次產生的內容都一樣
 * （截圖與測試可重現）；時間相對於傳入的「今天」計算，期限才會有過期、今天、未來。新專案接上後端後整個刪掉。
 */

export const TICKET_COUNT = 120;
/** 第一張工單的編號數字：TK-2001 … TK-2120。 */
const FIRST_NUMBER = 2001;

/** 活動紀錄的種類 → 圖示與色調（使用端提供，元件不認得任何業務種類）。 */
export const TICKET_ACTIVITY_KINDS: ActivityKindMap = {
  create: { icon: 'add_circle', tone: 'info' },
  status: { icon: 'sync_alt', tone: 'info' },
  assign: { icon: 'person_add', tone: 'neutral' },
  priority: { icon: 'flag', tone: 'warning' },
  comment: { icon: 'chat', tone: 'neutral' },
  edit: { icon: 'edit', tone: 'neutral' },
  resolve: { icon: 'check_circle', tone: 'success' },
  close: { icon: 'task_alt', tone: 'success' },
};

export const TICKET_ASSIGNEES: readonly TicketPerson[] = [
  { id: 'staff-01', name: '王宗翰', team: '資訊室' },
  { id: 'staff-02', name: '林雅婷', team: '資訊室' },
  { id: 'staff-03', name: '陳志明', team: '資訊室' },
  { id: 'staff-04', name: '張美玲', team: '總務組' },
  { id: 'staff-05', name: '李佩君', team: '總務組' },
  { id: 'staff-06', name: '黃冠宇', team: '資訊室' },
  { id: 'staff-07', name: '吳怡君', team: '人資組' },
  { id: 'staff-08', name: '劉俊傑', team: '資訊室' },
  { id: 'staff-09', name: '蔡淑芬', team: '總務組' },
  { id: 'staff-10', name: '楊建宏', team: '資訊室' },
  { id: 'staff-11', name: '許宜蓁', team: '人資組' },
  { id: 'staff-12', name: '鄭承翰', team: '資訊室' },
];

const REQUESTER_SURNAMES = ['周', '謝', '郭', '洪', '曾', '邱', '廖', '賴', '徐', '蘇'];
const REQUESTER_GIVEN = ['詩涵', '柏翰', '欣怡', '思妤', '品睿', '婉婷', '文傑', '佳穎'];
const REQUESTER_TEAMS = ['業務部', '行銷部', '財務部', '客服部', '研發部', '法務室'];

const SUBJECTS: Readonly<Record<TicketCategory, readonly string[]>> = {
  hardware: ['印表機無法連線', '螢幕閃爍', '筆電電池無法充電', '會議室投影機沒有畫面', '鍵盤按鍵失靈'],
  software: ['報表匯出失敗', '文書軟體授權到期', '更新後無法開啟', '瀏覽器擴充功能被封鎖', '行事曆同步延遲'],
  account: ['新進人員開通帳號', '密碼重設', '共用資料夾權限申請', '離職人員帳號停用', '群組信箱新增成員'],
  network: ['無線網路訊號不穩', 'VPN 無法連線', '會議室網路斷線', '訪客網路申請', '網路磁碟機很慢'],
  other: ['辦公桌搬遷', '門禁卡補發', '教育訓練教室預借', '設備借用', '分機號碼調整'],
};

const DESCRIPTIONS = [
  '從今天早上開始發生，重新開機後仍然一樣。',
  '同一層樓有好幾位同事反映相同的問題。',
  '需要在本週五前完成，下週一有新進同仁報到。',
  '已經試過重新安裝，錯誤訊息相同，附上截圖。',
  '偶爾才發生，大約每小時一次，持續幾分鐘。',
];

const COMMENTS = [
  '已到現場確認，問題可以重現。',
  '已聯絡廠商，等待回覆。',
  '暫時改用備用設備，明天再觀察一次。',
  '請申請人確認目前是否恢復正常。',
];

/** 固定種子的亂數（mulberry32）：同一個種子每次產生一樣的序列。 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 'YYYY-MM-DD'（本地時間）。 */
export function toDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function makeTicketRequesters(): TicketPerson[] {
  const people: TicketPerson[] = [];
  let n = 1;
  for (const surname of REQUESTER_SURNAMES) {
    for (const given of REQUESTER_GIVEN.slice(0, 4)) {
      people.push({
        id: `req-${String(n).padStart(3, '0')}`,
        name: `${surname}${given}`,
        team: REQUESTER_TEAMS[n % REQUESTER_TEAMS.length],
      });
      n += 1;
    }
  }
  return people;
}

export interface TicketDemoData {
  tickets: Ticket[];
  activity: Map<string, ActivityEntry[]>;
  requesters: TicketPerson[];
}

const HOUR = 3_600_000;

const SPAN_DAYS = 90;
/** 某次系統異常當天的爆量：[距今天數, 當天工單數]。 */
const SPIKES: readonly (readonly [number, number])[] = [
  [11, 7],
  [47, 6],
];

/**
 * 120 張工單各自的建立日（距今天數，由遠到近）：平日量是週末的 4 倍；每週有 ±30% 的起伏、整體緩慢上升；
 * 另外有兩天因系統異常爆量。用獨立的亂數，不影響工單其他欄位的序列。
 */
function createdDayOffsets(now: Date): number[] {
  const rand = seeded(31337);
  const weekFactor = Array.from({ length: Math.ceil(SPAN_DAYS / 7) + 1 }, () => 0.7 + rand() * 0.6);
  const weights = Array.from({ length: SPAN_DAYS }, (_, d) => {
    const weekday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d).getDay();
    const rhythm = weekday === 0 || weekday === 6 ? 0.25 : 1;
    return rhythm * weekFactor[Math.floor(d / 7)] * (0.75 + 0.5 * (1 - d / (SPAN_DAYS - 1)));
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const counts = new Array<number>(SPAN_DAYS).fill(0);
  let rest = TICKET_COUNT;
  for (const [d, n] of SPIKES) {
    counts[d] += n;
    rest -= n;
  }
  for (let k = 0; k < rest; k++) {
    let r = rand() * total;
    let d = 0;
    while (d < SPAN_DAYS - 1 && r >= weights[d]) r -= weights[d++];
    counts[d] += 1;
  }
  const offsets: number[] = [];
  for (let d = SPAN_DAYS - 1; d >= 0; d--) for (let k = 0; k < counts[d]; k++) offsets.push(d);
  return offsets;
}

/** 產生示範資料：建立時間與期限以 `today` 的日期起算；活動紀錄不會晚於 `today` 這個時間點。 */
export function makeTicketDemoData(today = new Date()): TicketDemoData {
  const rand = seeded(20261014);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const requesters = makeTicketRequesters();
  const statusWeights: readonly TicketStatus[] = [
    'open', 'open', 'open', 'in-progress', 'in-progress', 'in-progress', 'waiting', 'waiting', 'resolved', 'resolved', 'closed',
  ];
  const tickets: Ticket[] = [];
  const activity = new Map<string, ActivityEntry[]>();
  const dayOffsets = createdDayOffsets(today);
  let sameDayIndex = 0;

  for (let i = 0; i < TICKET_COUNT; i++) {
    const id = `TK-${FIRST_NUMBER + i}`;
    const category = pick(TICKET_CATEGORIES);
    const status = pick(statusWeights);
    const priority = pick(TICKET_PRIORITIES);
    const assignee = status === 'open' && rand() < 0.5 ? null : pick(TICKET_ASSIGNEES);
    const requester = pick(requesters);
    // 越後面的編號越新：建立日來自 createdDayOffsets（平日多週末少、有起伏、偶爾爆量）；同一天的依序往後排，時間不倒退。
    const dayOffset = dayOffsets[i];
    const sameDay = i > 0 && dayOffsets[i - 1] === dayOffset ? sameDayIndex + 1 : 0;
    sameDayIndex = sameDay;
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset).getTime();
    const created = day + Math.floor(9 + rand() * 9) * HOUR + sameDay * 7 * 60_000;
    const hasDue = rand() < 0.85;
    const due = hasDue ? toDateString(new Date(base + (Math.floor(rand() * 30) - 8) * 24 * HOUR)) : null;
    const ticket: Ticket = {
      id,
      title: pick(SUBJECTS[category]),
      status,
      priority,
      category,
      assigneeId: assignee?.id ?? null,
      requesterId: requester.id,
      createdAt: new Date(created).toISOString(),
      dueDate: due,
      description: pick(DESCRIPTIONS),
      attachmentCount: Math.floor(rand() * 4),
    };
    tickets.push(ticket);
    activity.set(id, makeActivity(ticket, requester, assignee ?? null, created, today.getTime(), rand, seeded(7000 + i * 31)));
  }
  // 新到舊：清單預設最新的在最上面。
  tickets.reverse();
  return { tickets, activity, requesters };
}

/** 一張工單的歷史（新到舊）：建立 → 指派 → 狀態變更 → 留言。 */
function makeActivity(
  ticket: Ticket,
  requester: TicketPerson,
  assignee: TicketPerson | null,
  created: number,
  now: number,
  rand: () => number,
  gapRand: () => number,
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  let at = created;
  let seq = 0;
  const push = (entry: Omit<ActivityEntry, 'id' | 'at'>) => {
    rand(); // 保留原本每筆消耗一次亂數，工單其他欄位的序列才不會變。
    if (seq > 0) {
      // 一般往來隔幾小時；結案的處理時間有長有短（約 6 小時到 7 天，偏短的居多）。
      const finishing = entry.kind === 'resolve' || entry.kind === 'close';
      const g = gapRand();
      at += (finishing ? 6 + g * g * 170 : 1 + g * 20) * HOUR;
    }
    entries.push({ ...entry, id: `${ticket.id}-a${++seq}`, at: new Date(at).toISOString() });
  };
  push({ actor: { name: requester.name }, kind: 'create', summary: `${requester.name} 建立了工單` });
  if (assignee) {
    push({
      actor: null,
      kind: 'assign',
      summary: `系統把工單指派給 ${assignee.name}`,
      changes: [{ field: '負責人', from: null, to: assignee.name }],
    });
  }
  const path: TicketStatus[] = ['open', 'in-progress', 'waiting', 'resolved', 'closed'];
  const target = path.indexOf(ticket.status);
  for (let s = 1; s <= target; s++) {
    const who = assignee?.name ?? '系統';
    const from = TICKET_STATUS_LABELS[path[s - 1]];
    const to = TICKET_STATUS_LABELS[path[s]];
    if (path[s] === 'waiting' && rand() < 0.7) {
      push({ actor: assignee ? { name: assignee.name } : null, kind: 'comment', summary: `${who} 留言`, body: COMMENTS[Math.floor(rand() * COMMENTS.length)] });
    }
    push({
      actor: assignee ? { name: assignee.name } : null,
      kind: path[s] === 'resolved' ? 'resolve' : path[s] === 'closed' ? 'close' : 'status',
      summary: `${who} 把狀態從「${from}」改成「${to}」`,
      changes: [{ field: '狀態', from, to }],
    });
  }
  if (ticket.priority === 'urgent' && rand() < 0.6) {
    push({
      actor: { name: requester.name },
      kind: 'priority',
      summary: `${requester.name} 把優先順序改成「${TICKET_PRIORITY_LABELS.urgent}」`,
      changes: [{ field: '優先順序', from: TICKET_PRIORITY_LABELS.high, to: TICKET_PRIORITY_LABELS.urgent }],
    });
  }
  // 已完成／已關閉的工單，結案一定發生在過去：最後一筆晚於「現在」時，把整串活動等比壓進 [建立, 現在]。
  const lastAt = new Date(entries[entries.length - 1].at).getTime();
  if ((ticket.status === 'resolved' || ticket.status === 'closed') && lastAt > now && now > created) {
    const ratio = (now - created) / (lastAt - created);
    for (const e of entries) e.at = new Date(created + (new Date(e.at).getTime() - created) * ratio).toISOString();
  }
  // 活動不會發生在未來：超過「現在」的就不放。
  return entries.filter((e) => new Date(e.at).getTime() <= now).reverse();
}
