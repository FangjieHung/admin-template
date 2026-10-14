import type { CommentItem, MentionCandidate } from '@admin-template/ui';

/**
 * 富文字展示頁的示範資料（中性內容：工單、同事）。頭像是 libs/assets/image/demo-avatars 的示範圖（代表使用者上傳的照片），
 * 其中一位沒有頭像（畫名字首字）。
 */
export const DEMO_PEOPLE: readonly MentionCandidate[] = [
  { id: 'p-wang', name: '王小明', description: 'Ming Wang・資訊室', avatar: 'demo-avatars/a1.svg' },
  { id: 'p-lin', name: '林雅婷', description: 'Tina Lin・資訊室', avatar: 'demo-avatars/a2.svg' },
  { id: 'p-chen', name: '陳志明', description: 'Jimmy Chen・總務組', avatar: 'demo-avatars/a3.svg' },
  { id: 'p-chang', name: '張美玲', description: 'Meiling Chang・總務組', avatar: 'demo-avatars/a4.svg' },
  { id: 'p-li', name: '李佩君', description: 'Peggy Li・人資組', avatar: 'demo-avatars/a5.svg' },
  { id: 'p-huang', name: '黃冠宇', description: 'Kevin Huang・資訊室' },
  { id: 'p-wu', name: '吳怡君', description: 'Yvonne Wu・客服部', avatar: 'demo-avatars/a6.svg' },
  { id: 'p-liu', name: '劉俊傑', description: 'Jay Liu・資訊室', avatar: 'demo-avatars/a7.svg' },
];

/** 展示頁的「目前使用者」：留言串裡這個人的留言可以編輯、刪除。 */
export const DEMO_ME = DEMO_PEOPLE[1];

const person = (id: string) => DEMO_PEOPLE.find((p) => p.id === id) ?? DEMO_PEOPLE[0];
const author = (id: string) => {
  const p = person(id);
  return { id: p.id, name: p.name, avatar: p.avatar };
};
const mention = (id: string) => `<span data-type="mention" data-id="${id}" data-label="${person(id).name}">@${person(id).name}</span>`;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** 12 則示範留言（舊到新）：一則已編輯、兩則是「我」的，時間從三天前到幾分鐘前。 */
export function demoComments(now: number): CommentItem[] {
  const rows: [string, number, string, number?][] = [
    ['p-wu', 3 * DAY + 2 * HOUR, '<p>客戶回報會議室投影機無法開機，已經建立工單 TK-2048。</p>'],
    ['p-chen', 3 * DAY + HOUR, `<p>${mention('p-huang')} 麻煩下午先去現場看一下，鑰匙在總務組。</p>`],
    ['p-huang', 3 * DAY, '<p>收到，14:00 過去。</p>'],
    [
      'p-huang',
      2 * DAY + 5 * HOUR,
      '<p>現場確認：</p><ul><li>電源燈有亮</li><li>按電源鍵沒反應</li><li>遙控器換電池也一樣</li></ul>',
    ],
    ['p-lin', 2 * DAY + 4 * HOUR, `<p>可能是主機板，先查保固。${mention('p-chang')} 採購單號還在嗎？</p>`],
    ['p-chang', 2 * DAY + 2 * HOUR, '<p>採購單是 <strong>PO-2024-118</strong>，保固到明年三月。</p>'],
    [
      'p-wang',
      DAY + 6 * HOUR,
      '<blockquote>保固到明年三月</blockquote><p>那就直接送修，原廠說明在 <a href="https://example.com/support">維修說明頁</a>。</p>',
    ],
    ['p-lin', DAY + 3 * HOUR, '<p>已經聯絡原廠，<em>週四</em>會派人來取件。</p>', DAY + 2 * HOUR],
    ['p-li', DAY, `<p>週四下午會議室有面試，${mention('p-lin')} 取件時間可以改上午嗎？</p>`],
    ['p-lin', 20 * HOUR, '<p>可以，我請原廠改成上午 10 點。</p>'],
    ['p-wu', 3 * HOUR, '<p>客戶問借用的備用投影機可以用到什麼時候？</p>'],
    ['p-liu', 12 * MIN, `<p>${mention('p-wu')} 備用機可以借到送修回來為止，歸還時請一併帶回 HDMI 線。</p>`],
  ];
  return rows.map(([who, ago, html, editedAgo], i) => ({
    id: `cm-${String(i + 1).padStart(2, '0')}`,
    author: author(who),
    html,
    createdAt: now - ago,
    editedAt: editedAgo === undefined ? null : now - editedAgo,
  }));
}

/** 假的提及搜尋：依中文名字、英文名字或部門比對（不分大小寫），模擬 250ms 的網路延遲。 */
export function searchDemoPeople(query: string, people: readonly MentionCandidate[] = DEMO_PEOPLE): Promise<MentionCandidate[]> {
  const q = query.trim().toLowerCase();
  const matched = people.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q));
  return new Promise((resolve) => setTimeout(() => resolve(matched.slice(0, 8)), 250));
}
