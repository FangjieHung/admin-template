import { DOMParser as PmDOMParser } from 'prosemirror-model';
import { AllSelection, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { MentionCandidate } from './rich-text.types';
import type { RichTextLabels } from './rich-text-labels';

/**
 * 富文字元件測試共用的替身（只給 spec 用，不從 index.ts 匯出）。
 * jsdom 沒有版面：ProseMirror 捲動到游標、算游標座標時會呼叫 Range 的 getClientRects，這裡補上回傳空矩形的版本。
 */
export const TEST_RICH_TEXT_LABELS: RichTextLabels = {
  editor: '內容',
  loading: '編輯器載入中',
  toolbar: '文字格式',
  bold: '粗體',
  emphasis: '斜體',
  bulletList: '項目清單',
  orderedList: '編號清單',
  blockquote: '引用',
  link: '連結',
  clearFormat: '清除格式',
  toolTip: '{label}（{keys}）',
  linkInsertTitle: '插入連結',
  linkEditTitle: '編輯連結',
  linkUrl: '網址',
  linkHint: 'http://、https:// 或 mailto: 開頭',
  linkInvalid: '只接受 http、https 或 mailto 連結',
  linkApply: '套用',
  linkRemove: '移除連結',
  cancel: '取消',
  mentionList: '提及成員',
  mentionLoading: '搜尋中…',
  mentionEmpty: '找不到「{query}」',
  mentionError: '搜尋失敗',
  remaining: '剩 {count} 字',
  overLimit: '超過 {count} 字，請刪減',
  thread: '留言',
  composer: '新增留言',
  composerPlaceholder: '寫下留言，輸入 @ 提及同事',
  send: '送出',
  sending: '送出中…',
  sendHint: '{keys} 送出',
  sendFailed: '送出失敗，內容還在，可以再試一次',
  retry: '重試',
  edit: '編輯',
  save: '儲存',
  delete: '刪除',
  actions: '{name} 的留言動作',
  editFailed: '儲存失敗，請再試一次',
  deleteFailed: '刪除失敗，請再試一次',
  deleteTitle: '刪除留言？',
  deleteMessage: '刪除後無法復原。',
  edited: '已編輯',
  editedAt: '編輯於 {time}',
  you: '（你）',
  showEarlier: '顯示較早的 {count} 則',
  empty: '還沒有留言',
  emptyDetail: '輸入 @ 可以提及同事',
};

export const TEST_PEOPLE: readonly MentionCandidate[] = [
  { id: 'u1', name: 'Amy Lin', description: '資訊室' },
  { id: 'u2', name: '王小明', description: '總務組' },
  { id: 'u3', name: 'Andy Chen' },
];

/** 依名字（不分大小寫）篩選的假來源，記下每次查詢的字。 */
export function testMentionSource(people: readonly MentionCandidate[] = TEST_PEOPLE) {
  const queries: string[] = [];
  const source = async (query: string) => {
    queries.push(query);
    const q = query.toLowerCase();
    return people.filter((p) => p.name.toLowerCase().includes(q));
  };
  return { source, queries };
}

/** 補上 jsdom 沒有的版面 API（重複呼叫無害）。 */
export function installLayoutStubs(): void {
  const empty = () => new DOMRect(0, 0, 0, 0);
  const rects = () => Object.assign([] as DOMRect[], { item: () => null }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect ??= empty;
  Range.prototype.getClientRects ??= rects;
  Element.prototype.scrollIntoView ??= () => undefined;
  document.elementFromPoint ??= () => null;
  const g = globalThis as { ClipboardEvent?: unknown };
  g.ClipboardEvent ??= class extends Event {
    readonly clipboardData = null;
  };
}

/** 元件裡的 ProseMirror view（引擎掛在編輯區外層 `.lib-rte__mount` 上，給測試與除錯用）。 */
export function viewOf(host: HTMLElement): EditorView {
  const mount = host.querySelector('.lib-rte__mount') as (HTMLElement & { libRichTextView?: EditorView }) | null;
  if (!mount?.libRichTextView) throw new Error('找不到編輯器（引擎還沒載入？）');
  return mount.libRichTextView;
}

/** 模擬使用者編輯（每一步都是一個會觸發 onChange 的 transaction）。 */
export function editorOf(host: HTMLElement) {
  const view = viewOf(host);
  const slice = (html: string) => {
    const box = document.createElement('div');
    box.innerHTML = html;
    return PmDOMParser.fromSchema(view.state.schema).parseSlice(box);
  };
  return {
    view,
    get state() {
      return view.state;
    },
    commands: {
      /** HTML（有 `<`）以貼上的方式插入；否則當成打字。 */
      insertContent(content: string) {
        const tr = /</.test(content) ? view.state.tr.replaceSelection(slice(content)) : view.state.tr.insertText(content);
        view.dispatch(tr);
      },
      setTextSelection(at: number | { from: number; to: number }) {
        const { from, to } = typeof at === 'number' ? { from: at, to: at } : at;
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
      },
      selectAll() {
        view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
      },
      deleteRange(range: { from: number; to: number }) {
        view.dispatch(view.state.tr.delete(range.from, range.to));
      },
      /** 整份換掉（算使用者編輯，會送出 onChange）。 */
      setContent(html: string) {
        const box = document.createElement('div');
        box.innerHTML = html;
        const doc = PmDOMParser.fromSchema(view.state.schema).parse(box);
        view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content));
      },
      clearContent() {
        const empty = view.state.schema.nodes['paragraph'].create();
        view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, empty));
      },
    },
  };
}

/** 等 Promise 與計時器都跑完一輪。 */
export function flush(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
