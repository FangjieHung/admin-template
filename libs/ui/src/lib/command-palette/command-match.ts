/**
 * 指令面板的比對與排序：不分大小寫，依「整段相同 > 開頭 > 字首 > 包含 > 依序出現」給分，
 * 標題比說明（subtitle）重要，說明又比關鍵字（keywords）重要。中文不轉拼音，直接比對子字串（「工單」找得到「新增工單」）。
 * 查詢有空白時拆成幾個詞，每個詞都要對到（任何一個欄位）才算符合。
 */

/** `[開始, 結束)` 的字元位置。 */
export type CommandMatchRange = readonly [number, number];

export interface CommandMatchResult {
  /** 越大越前面；0 以下不會出現。 */
  score: number;
  /** 標題裡要加 `<mark>` 的範圍。 */
  title: readonly CommandMatchRange[];
  /** 說明裡要加 `<mark>` 的範圍。 */
  subtitle: readonly CommandMatchRange[];
}

/** 給比對用的欄位（`CommandItem` 的子集合）。 */
export interface CommandMatchable {
  title: string;
  subtitle?: string;
  keywords?: readonly string[];
}

export interface CommandMatchSegment {
  text: string;
  match: boolean;
}

const TIER = { exact: 100, prefix: 80, wordStart: 60, contains: 40, sequence: 12 } as const;
const FIELD_WEIGHT = { title: 1, subtitle: 0.5, keyword: 0.6 } as const;

// 字首：前一個字是空白或標點、從非英數換成英數、從英數換成中文、駝峰的大寫。
const SEPARATOR = /[\s\-_/.,:;|·•、，。：；（）()「」『』[\]【】]/;
const ALNUM = /[a-z0-9]/i;

function isWordStart(text: string, at: number): boolean {
  if (at === 0) return true;
  const prev = text[at - 1];
  const cur = text[at];
  if (SEPARATOR.test(prev)) return true;
  if (ALNUM.test(cur) !== ALNUM.test(prev)) return true;
  return /[a-z]/.test(prev) && /[A-Z]/.test(cur);
}

interface TokenMatch {
  score: number;
  ranges: CommandMatchRange[];
}

/** 一個詞對一段文字的最佳比對；對不到回 null。 */
export function matchCommandToken(text: string, token: string): TokenMatch | null {
  if (!text || !token) return null;
  const lower = text.toLocaleLowerCase();
  if (lower === token) return { score: TIER.exact, ranges: [[0, text.length]] };
  if (lower.startsWith(token)) return { score: TIER.prefix, ranges: [[0, token.length]] };
  let first = -1;
  for (let at = lower.indexOf(token); at !== -1; at = lower.indexOf(token, at + 1)) {
    if (first === -1) first = at;
    if (isWordStart(text, at)) return { score: TIER.wordStart, ranges: [[at, at + token.length]] };
  }
  if (first !== -1) return { score: TIER.contains, ranges: [[first, first + token.length]] };
  // 依序出現（例：「tkl」對到「Ticket List」）：只給兩個字以上的詞，分數最低，跳越多扣越多。
  if (token.length < 2) return null;
  const ranges: [number, number][] = [];
  let from = 0;
  let gaps = 0;
  for (const ch of token) {
    const at = lower.indexOf(ch, from);
    if (at === -1) return null;
    if (ranges.length && ranges[ranges.length - 1][1] === at) ranges[ranges.length - 1][1] = at + 1;
    else {
      if (ranges.length) gaps++;
      ranges.push([at, at + 1]);
    }
    from = at + 1;
  }
  return { score: Math.max(1, TIER.sequence - gaps * 2), ranges };
}

function tokensOf(query: string): string[] {
  return query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
}

/** 整個查詢對一個項目的分數與標記範圍；有任何一個詞對不到就回 null。空查詢回分數 0、沒有標記。 */
export function matchCommand(query: string, item: CommandMatchable): CommandMatchResult | null {
  const tokens = tokensOf(query);
  if (tokens.length === 0) return { score: 0, title: [], subtitle: [] };
  let score = 0;
  const title: CommandMatchRange[] = [];
  const subtitle: CommandMatchRange[] = [];
  for (const token of tokens) {
    const t = matchCommandToken(item.title, token);
    const s = item.subtitle ? matchCommandToken(item.subtitle, token) : null;
    let k = 0;
    for (const keyword of item.keywords ?? []) k = Math.max(k, matchCommandToken(keyword, token)?.score ?? 0);
    const best = Math.max((t?.score ?? 0) * FIELD_WEIGHT.title, (s?.score ?? 0) * FIELD_WEIGHT.subtitle, k * FIELD_WEIGHT.keyword);
    if (best <= 0) return null;
    score += best;
    // 標記：對到哪裡就標哪裡（標題與說明都對到時兩邊都標），只對到關鍵字時不標。
    if (t) title.push(...t.ranges);
    if (s) subtitle.push(...s.ranges);
  }
  return { score, title: mergeRanges(title), subtitle: mergeRanges(subtitle) };
}

/**
 * 篩選並排序：分數高的在前，同分時標題短的在前，再同分維持原本的順序。空查詢原樣回傳（最多 `limit` 筆）。
 * 同步的資料來源（頁面、動作）直接用它；非同步的來源（伺服器搜尋）通常自己排序。
 */
export function filterCommands<T extends CommandMatchable>(query: string, items: readonly T[], limit = Infinity): T[] {
  if (tokensOf(query).length === 0) return items.slice(0, limit);
  return items
    .map((item, index) => ({ item, index, match: matchCommand(query, item) }))
    .filter((entry): entry is { item: T; index: number; match: CommandMatchResult } => entry.match !== null)
    .sort((a, b) => b.match.score - a.match.score || a.item.title.length - b.item.title.length || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}

function mergeRanges(ranges: CommandMatchRange[]): CommandMatchRange[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [start, end] of sorted) {
    const last = out[out.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }
  return out;
}

/** 依標記範圍把文字切成一段一段（`match: true` 的那段放進 `<mark>`）。 */
export function commandMatchSegments(text: string, ranges: readonly CommandMatchRange[]): CommandMatchSegment[] {
  if (!text) return [];
  const segments: CommandMatchSegment[] = [];
  let from = 0;
  for (const [start, end] of ranges) {
    if (start > from) segments.push({ text: text.slice(from, start), match: false });
    segments.push({ text: text.slice(start, end), match: true });
    from = end;
  }
  if (from < text.length) segments.push({ text: text.slice(from), match: false });
  return segments;
}
