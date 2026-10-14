import type { CommentItem, MentionCandidate } from '@admin-template/ui';
import { TICKET_ASSIGNEES } from './ticket-demo-data';

/**
 * 工單留言的示範資料：只有詳情樣板預設打開的 TK-2048 有留言（其他工單是空的，看得到空狀態）。
 * 時間以「現在」往回推。作者 u-admin 是示範身分「林雅婷」（libs/access 預設登入的使用者），所以那一則可以編輯、刪除。
 */

/** 可以 @提及的同事：工單的負責人名單（中文名字或組別都能找）。 */
export const TICKET_MENTION_PEOPLE: readonly MentionCandidate[] = TICKET_ASSIGNEES.map((p) => ({
  id: p.id,
  name: p.name,
  description: p.team,
}));

const MIN = 60_000;
const HOUR = 60 * MIN;

function mention(id: string): string {
  const name = TICKET_ASSIGNEES.find((p) => p.id === id)?.name ?? id;
  return `<span data-type="mention" data-id="${id}" data-label="${name}">@${name}</span>`;
}

export function makeTicketComments(now: number): Map<string, CommentItem[]> {
  return new Map([
    [
      'TK-2048',
      [
        {
          id: 'TK-2048-c1',
          author: { id: 'staff-03', name: '陳志明' },
          html: `<p>投影機電源燈有亮，但按電源鍵沒反應。${mention('staff-06')} 方便下午幫忙看訊號線嗎？</p>`,
          createdAt: now - 26 * HOUR,
        },
        {
          id: 'TK-2048-c2',
          author: { id: 'staff-06', name: '黃冠宇' },
          html: '<p>已確認：</p><ul><li>HDMI 線正常</li><li>換到另一台筆電也一樣</li></ul><p>應該是投影機本身，建議<strong>送修</strong>。</p>',
          createdAt: now - 22 * HOUR,
          editedAt: now - 21 * HOUR,
        },
        {
          id: 'TK-2048-c3',
          author: { id: 'u-admin', name: '林雅婷' },
          html: '<p>好，我來聯絡原廠，維修說明在 <a href="https://example.com/support">原廠維修頁</a>。</p>',
          createdAt: now - 3 * HOUR,
        },
      ],
    ],
  ]);
}
