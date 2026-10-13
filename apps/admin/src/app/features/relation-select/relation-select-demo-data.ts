// 關聯選擇欄位展示頁的示範資料：5,000 位使用者、60 個專案。固定種子，每次產生的資料都一樣（截圖與測試可重現）。
// 只有這一頁用；新專案刪掉展示頁時一起刪。
import { RelationPage, RelationSource } from '@admin-template/ui';
import { DEMO_OWNERS } from '../../showcase/demo-data';

export interface DemoUser {
  id: string;
  name: string;
  email: string;
}

export interface DemoRelationProject {
  id: string;
  code: string;
  name: string;
  owner: string;
}

// [中文, 拼音]：姓名與 email 帳號用同一組，看起來像同一個人。
const SURNAMES: readonly (readonly [string, string])[] = [
  ['王', 'wang'], ['陳', 'chen'], ['林', 'lin'], ['黃', 'huang'], ['張', 'chang'],
  ['李', 'li'], ['吳', 'wu'], ['劉', 'liu'], ['蔡', 'tsai'], ['楊', 'yang'],
  ['許', 'hsu'], ['鄭', 'cheng'], ['謝', 'hsieh'], ['郭', 'kuo'], ['洪', 'hung'],
  ['曾', 'tseng'], ['邱', 'chiu'], ['廖', 'liao'], ['賴', 'lai'], ['周', 'chou'],
];

const GIVEN_NAMES: readonly (readonly [string, string])[] = [
  ['小明', 'hsiaoming'], ['大同', 'tatung'], ['美惠', 'meihui'], ['家豪', 'chiahao'], ['佩君', 'peichun'],
  ['志偉', 'chihwei'], ['雅婷', 'yating'], ['冠宇', 'kuanyu'], ['怡君', 'yichun'], ['俊傑', 'chunchieh'],
  ['淑芬', 'shufen'], ['建宏', 'chienhung'], ['宜蓁', 'yichen'], ['承翰', 'chenghan'], ['詩涵', 'shihhan'],
  ['柏翰', 'pohan'], ['欣怡', 'hsinyi'], ['宗翰', 'tsunghan'], ['思妤', 'szuyu'], ['品睿', 'pinjui'],
  ['婉婷', 'wanting'], ['文傑', 'wenchieh'], ['佳穎', 'chiaying'], ['子軒', 'tzuhsuan'],
];

const PROJECT_TOPICS = [
  '官網改版', '客服系統導入', '年度教育訓練', '資料中心搬遷', '會員制度調整', '報表自動化',
  '內部入口網站', '供應商評鑑', '行動版 App', '資安稽核', '知識庫整理', '流程電子化',
];
const PROJECT_PHASES = ['第一期', '第二期', '試行', '擴大導入', '維護'];

/** 固定種子的亂數（同 showcase/demo-data.ts）。 */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function makeDemoUsers(count = 5000): DemoUser[] {
  const rand = seeded(20261013);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  return Array.from({ length: count }, (_, i) => {
    const [surname, surnameEn] = pick(SURNAMES);
    const [given, givenEn] = pick(GIVEN_NAMES);
    return {
      id: `u${String(i + 1).padStart(4, '0')}`,
      name: `${surname}${given}`,
      email: `${givenEn}.${surnameEn}${i + 1}@example.com`,
    };
  });
}

export function makeDemoProjects(): DemoRelationProject[] {
  return PROJECT_TOPICS.flatMap((topic, t) =>
    PROJECT_PHASES.map((phase, p) => {
      const n = t * PROJECT_PHASES.length + p + 1;
      return {
        id: `prj-${String(n).padStart(3, '0')}`,
        code: `PJ-${String(n).padStart(3, '0')}`,
        name: `${topic} ${phase}`,
        owner: DEMO_OWNERS[n % DEMO_OWNERS.length],
      };
    }),
  );
}

/** 姓名縮寫圓章：中文姓名取名字（後兩個字），英文取前兩個字首。 */
export function nameInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  return /^[\x20-\x7e]+$/.test(name) ? name.slice(0, 2).toUpperCase() : name.slice(-2);
}

/** 展示頁的「模擬網路狀況」：搜尋失敗、慢速。每次呼叫時讀目前的設定。 */
export interface DemoNetwork {
  fail(): boolean;
  slow(): boolean;
}

/** 慢速時一律 2 秒。 */
export const DEMO_SLOW_MS = 2000;

/**
 * 把前端陣列來源包成「像伺服器」的來源：加上延遲、可模擬搜尋失敗，abort 時立刻丟 AbortError（像 fetch 一樣）。
 * 真的接 API 時不需要這層，直接在 search 裡呼叫 fetch(url, { signal })。
 */
export function withDemoLatency<T>(
  source: RelationSource<T>,
  network: DemoNetwork,
  delays: { search: number; getById: number },
): RelationSource<T> {
  const later = <R>(ms: number, signal: AbortSignal | undefined, run: () => Promise<R>): Promise<R> =>
    new Promise<R>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        run().then(resolve, reject);
      }, network.slow() ? DEMO_SLOW_MS : ms);
      signal?.addEventListener('abort', abort, { once: true });
    });
  return {
    idOf: source.idOf,
    search: (query, signal): Promise<RelationPage<T>> =>
      later(delays.search, signal, () =>
        network.fail() ? Promise.reject(new Error('示範：搜尋失敗')) : source.search(query, signal),
      ),
    getById: (id, signal) => later(delays.getById, signal, () => source.getById(id, signal)),
  };
}
