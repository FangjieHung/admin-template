import { baseKeymap, lift, toggleMark, wrapIn } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { inputRules, undoInputRule, wrappingInputRule } from 'prosemirror-inputrules';
import type { InputRule } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import { DOMParser as PmDOMParser, DOMSerializer, Schema } from 'prosemirror-model';
import type { Mark, MarkType, Node as PmNode, NodeType } from 'prosemirror-model';
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import { liftTarget } from 'prosemirror-transform';
import { EditorState, Plugin, Selection, TextSelection } from 'prosemirror-state';
import type { Command, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import type { CreateRichTextEngine, MentionTrigger, RichTextEngine, RichTextEngineCallbacks, RichTextToolbarState } from './rich-text-engine.types';
import { RICH_TEXT_MENTION_CLASS, safeLinkHref } from './rich-text-html';
import type { RichTextCommand, RichTextContent } from './rich-text.types';

/**
 * 編輯器引擎：直接用 ProseMirror（Tiptap 底下的同一套引擎，MIT）。lib-rich-text-editor 第一次建立時才 `import()`
 * 這個檔案，所以 ProseMirror 在獨立的 lazy chunk 裡。
 *
 * 為什麼不用 Tiptap：只裝需要的擴充，Tiptap（core 加上段落、粗斜體、清單、引用、換行、復原、placeholder）
 * 打包後 gzip 約 100 kB，其中 Tiptap core 自己就約 25 kB；直接用 ProseMirror 約 70 kB。中文輸入法組字、游標與
 * 貼上的處理都在 ProseMirror（prosemirror-view）裡，兩者相同；這裡只多寫了 schema、指令與鍵盤對照。
 *
 * - schema 就是 `rich-text-html.ts` 的白名單：段落、粗體、斜體、項目／編號清單、引用、換行、連結（http、https、mailto）、
 *   提及。貼上時不在 schema 裡的東西（字型、顏色、大小、圖片、標題樣式）一律丟掉，只留文字。
 * - 提及：外掛在組字中（view.composing）完全不動作，組字結束之後才依確定的字通知元件；清單由元件自己畫（CDK overlay）。
 */

/** `@` 前面可以是開頭或「不是英數字」的字（中文、空白、標點都可以），避免 Email 的 `a@b` 被當成提及。 */
const MENTION_PATTERN = /(^|[^A-Za-z0-9_.+-])@([^\s@￼]{0,32})$/u;
const LEAF = '￼';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block', parseDOM: [{ tag: 'p' }], toDOM: () => ['p', 0] },
    blockquote: {
      content: 'block+',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'blockquote' }],
      toDOM: () => ['blockquote', 0],
    },
    bullet_list: { content: 'list_item+', group: 'block', parseDOM: [{ tag: 'ul' }], toDOM: () => ['ul', 0] },
    ordered_list: { content: 'list_item+', group: 'block', parseDOM: [{ tag: 'ol' }], toDOM: () => ['ol', 0] },
    list_item: { content: 'paragraph block*', defining: true, parseDOM: [{ tag: 'li' }], toDOM: () => ['li', 0] },
    text: { group: 'inline' },
    hard_break: { inline: true, group: 'inline', selectable: false, parseDOM: [{ tag: 'br' }], toDOM: () => ['br'] },
    mention: {
      inline: true,
      group: 'inline',
      atom: true,
      selectable: false,
      attrs: { id: {}, label: {} },
      parseDOM: [
        {
          tag: 'span[data-type="mention"]',
          getAttrs: (dom: HTMLElement) => {
            const id = dom.getAttribute('data-id');
            const label = (dom.getAttribute('data-label') ?? dom.textContent ?? '').replace(/^@/, '').trim();
            return id && label ? { id, label } : false;
          },
        },
      ],
      toDOM: (node) => [
        'span',
        { class: RICH_TEXT_MENTION_CLASS, 'data-type': 'mention', 'data-id': node.attrs['id'], 'data-label': node.attrs['label'] },
        `@${node.attrs['label']}`,
      ],
      leafText: (node) => `@${node.attrs['label']}`,
    },
  },
  marks: {
    link: {
      attrs: { href: {} },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          // 協定不在白名單（javascript:、data:…）的連結只留文字。
          getAttrs: (dom: HTMLElement) => {
            const href = safeLinkHref(dom.getAttribute('href'));
            return href ? { href } : false;
          },
        },
      ],
      toDOM: (mark) => ['a', { href: mark.attrs['href'], rel: 'noopener noreferrer', target: '_blank' }, 0],
    },
    strong: {
      parseDOM: [
        { tag: 'strong' },
        // Google 文件把整段包在 <b style="font-weight:normal"> 裡，那不是粗體。
        { tag: 'b', getAttrs: (dom: HTMLElement) => dom.style.fontWeight !== 'normal' && null },
        { style: 'font-weight=400', clearMark: (m) => m.type.name === 'strong' },
        { style: 'font-weight', getAttrs: (value: string) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null },
      ],
      toDOM: () => ['strong', 0],
    },
    em: {
      parseDOM: [
        { tag: 'em' },
        { tag: 'i' },
        // 斜體的 style（italic／oblique）；不寫出整個字，Tailwind 會把它當成 utility 編進主樣式。
        { style: 'font-style', getAttrs: (value: string) => /^(it|ob)/.test(value) && null },
        { style: 'font-style=normal', clearMark: (m) => m.type.name === 'em' },
      ],
      toDOM: () => ['em', 0],
    },
  },
});

const N = schema.nodes;
const M = schema.marks;
const parser = PmDOMParser.fromSchema(schema);
const serializer = DOMSerializer.fromSchema(schema);

function parseDoc(html: string): PmNode {
  const box = document.createElement('div');
  box.innerHTML = html || '';
  return parser.parse(box);
}

function serialize(doc: PmNode): string {
  const box = document.createElement('div');
  box.appendChild(serializer.serializeFragment(doc.content));
  return box.innerHTML;
}

function isEmptyDoc(doc: PmNode): boolean {
  const first = doc.firstChild;
  return doc.childCount === 1 && !!first && first.type === N['paragraph'] && first.content.size === 0;
}

function contentOf(doc: PmNode): RichTextContent {
  const mentions: string[] = [];
  doc.descendants((node) => {
    if (node.type === N['mention']) {
      const id = node.attrs['id'] as string;
      if (!mentions.includes(id)) mentions.push(id);
    }
  });
  if (isEmptyDoc(doc)) return { html: '', text: '', mentions, length: 0 };
  const mentionText = (node: PmNode) => (node.type === N['mention'] ? `@${node.attrs['label']}` : '');
  const leaf = (node: PmNode) => (node.type === N['hard_break'] ? '\n' : mentionText(node));
  return {
    html: serialize(doc),
    text: doc.textBetween(0, doc.content.size, '\n', leaf),
    mentions,
    length: Array.from(doc.textBetween(0, doc.content.size, '', mentionText)).length,
  };
}

// ---- 狀態查詢 ----

function markActive(state: EditorState, type: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;
  if (empty) return !!type.isInSet(state.storedMarks ?? $from.marks());
  return state.doc.rangeHasMark(from, to, type);
}

/** 游標所在的最近一層某種節點（清單、引用）。 */
function ancestor(state: EditorState, types: readonly NodeType[]): { node: PmNode; depth: number } | null {
  const $from = state.selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (types.includes(node.type)) return { node, depth: d };
  }
  return null;
}

function toolbarOf(state: EditorState): RichTextToolbarState {
  const list = ancestor(state, [N['bullet_list'], N['ordered_list']]);
  return {
    bold: markActive(state, M['strong']),
    emphasis: markActive(state, M['em']),
    bulletList: list?.node.type === N['bullet_list'],
    orderedList: list?.node.type === N['ordered_list'],
    blockquote: !!ancestor(state, [N['blockquote']]),
    link: markActive(state, M['link']),
  };
}

/** 游標所在（沒有選取範圍時）的連結整段範圍；游標在連結的頭尾也算。 */
function linkRange(state: EditorState): { from: number; to: number; mark: Mark } | null {
  const $pos = state.selection.$from;
  const spans: { from: number; to: number; mark: Mark | undefined }[] = [];
  $pos.parent.forEach((child, offset) => spans.push({ from: offset, to: offset + child.nodeSize, mark: M['link'].isInSet(child.marks) ?? undefined }));
  const at = $pos.parentOffset;
  let i = spans.findIndex((s) => s.mark && s.from < at && at < s.to);
  if (i < 0) i = spans.findIndex((s) => s.mark && (s.from === at || s.to === at));
  if (i < 0) return null;
  const mark = spans[i].mark as Mark;
  let a = i;
  let b = i;
  while (a > 0 && spans[a - 1].mark?.eq(mark)) a--;
  while (b < spans.length - 1 && spans[b + 1].mark?.eq(mark)) b++;
  const base = $pos.start();
  return { from: base + spans[a].from, to: base + spans[b].to, mark };
}

// ---- 指令 ----

/** 切換清單：同一種 → 取消；另一種 → 換種類；不在清單裡 → 包成清單。 */
function toggleList(type: NodeType): Command {
  return (state, dispatch) => {
    const list = ancestor(state, [N['bullet_list'], N['ordered_list']]);
    if (list?.node.type === type) return liftListItem(N['list_item'])(state, dispatch);
    if (list) {
      if (dispatch) dispatch(state.tr.setNodeMarkup(state.selection.$from.before(list.depth), type));
      return true;
    }
    return wrapInList(type)(state, dispatch);
  };
}

const toggleBlockquote: Command = (state, dispatch) =>
  ancestor(state, [N['blockquote']]) ? lift(state, dispatch) : wrapIn(N['blockquote'])(state, dispatch);

const insertHardBreak: Command = (state, dispatch) => {
  if (dispatch) dispatch(state.tr.replaceSelectionWith(N['hard_break'].create()).scrollIntoView());
  return true;
};

/** 清除格式：拿掉選取範圍的所有樣式，範圍內的段落從清單、引用裡提出來（變回一般段落）。 */
function clearFormat(view: EditorView): void {
  const { state } = view;
  const { from, to } = state.selection;
  const tr = state.tr.removeMark(from, to).setStoredMarks([]);
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    const $start = tr.doc.resolve(tr.mapping.map(pos));
    const $end = tr.doc.resolve(tr.mapping.map(pos + node.nodeSize));
    const range = $start.blockRange($end);
    const target = range ? liftTarget(range) : null;
    if (range && target !== null) tr.lift(range, target);
    return false;
  });
  view.dispatch(tr);
}

// ---- 外掛 ----

function placeholderPlugin(text: () => string): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const first = state.doc.firstChild;
        const label = text();
        if (!label || !first || !isEmptyDoc(state.doc)) return null;
        return DecorationSet.create(state.doc, [Decoration.node(0, first.nodeSize, { class: 'is-editor-empty', 'data-placeholder': label })]);
      },
    },
  });
}

interface MentionHolder {
  /** 使用者按 Esc 關掉的那個 `@` 的位置：同一個 `@` 不再打開，直到打了新的 `@`。 */
  dismissedAt: number | null;
  /** 目前回報給元件的提及（null：清單關著）。 */
  active: MentionTrigger | null;
}

/** 游標前面的 `@查詢字`（只看目前這一段、游標前面的文字；沒有選取範圍時才算）。 */
function findMention(state: EditorState): { from: number; to: number; query: string } | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const $from = selection.$from;
  if (!$from.parent.isTextblock) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, LEAF);
  const match = MENTION_PATTERN.exec(before);
  if (!match) return null;
  const query = match[2];
  const to = $from.pos;
  return { from: to - query.length - 1, to, query };
}

function mentionPlugin(callbacks: RichTextEngineCallbacks, holder: MentionHolder): Plugin {
  const close = () => {
    if (!holder.active) return;
    holder.active = null;
    callbacks.onMention(null);
  };
  const report = (view: EditorView) => {
    // 組字中（注音、倉頡還沒選字）完全不動作：查詢字還不是使用者要的字，搜尋與清單都等組字結束。
    if (view.composing) return;
    const found = view.hasFocus() || holder.active ? findMention(view.state) : null;
    if (!found) {
      holder.dismissedAt = null;
      return close();
    }
    if (holder.dismissedAt === found.from) return close();
    const active = holder.active;
    if (active && active.from === found.from && active.query === found.query) return;
    let rect = { left: 0, top: 0, bottom: 0 };
    try {
      const c = view.coordsAtPos(found.from);
      rect = { left: c.left, top: c.top, bottom: c.bottom };
    } catch {
      const r = view.dom.getBoundingClientRect();
      rect = { left: r.left, top: r.top, bottom: r.bottom };
    }
    holder.active = { ...found, rect };
    callbacks.onMention(holder.active);
  };

  return new Plugin({
    view(view) {
      // 組字結束：ProseMirror 會在下一個 microtask 讀回確定的字，之後再檢查一次（保險；update 通常已經處理）。
      const onCompositionEnd = () => setTimeout(() => report(view));
      const onBlur = () => setTimeout(() => !view.hasFocus() && close());
      view.dom.addEventListener('compositionend', onCompositionEnd);
      view.dom.addEventListener('blur', onBlur);
      return {
        update: (v) => report(v),
        destroy: () => {
          view.dom.removeEventListener('compositionend', onCompositionEnd);
          view.dom.removeEventListener('blur', onBlur);
        },
      };
    },
    props: {
      handleKeyDown(view, event) {
        if (!holder.active || view.composing || event.isComposing || event.keyCode === 229) return false;
        if (!['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(event.key)) return false;
        if (event.metaKey || event.ctrlKey || event.altKey) return false;
        return callbacks.onMentionKey(event);
      },
    },
  });
}

/** 行首輸入「- 」「1. 」「> 」變成清單或引用。 */
function markdownRules(): Plugin {
  const rules: InputRule[] = [
    wrappingInputRule(/^\s*([-+*])\s$/, N['bullet_list']),
    wrappingInputRule(/^(\d+)\.\s$/, N['ordered_list']),
    wrappingInputRule(/^\s*>\s$/, N['blockquote']),
  ];
  return inputRules({ rules });
}

// ---- 引擎 ----

export const createRichTextEngine: CreateRichTextEngine = (options) => {
  const { callbacks } = options;
  let placeholder = options.placeholder;
  let editable = options.editable;
  const holder: MentionHolder = { dismissedAt: null, active: null };

  const run = (command: RichTextCommand) => {
    if (!editable) return;
    const { state, dispatch } = view;
    switch (command) {
      case 'bold':
        toggleMark(M['strong'])(state, dispatch);
        break;
      case 'emphasis':
        toggleMark(M['em'])(state, dispatch);
        break;
      case 'bulletList':
        toggleList(N['bullet_list'])(state, dispatch);
        break;
      case 'orderedList':
        toggleList(N['ordered_list'])(state, dispatch);
        break;
      case 'blockquote':
        toggleBlockquote(state, dispatch);
        break;
      case 'clearFormat':
        clearFormat(view);
        break;
    }
    view.focus();
  };

  const plugins = [
    mentionPlugin(callbacks, holder),
    markdownRules(),
    keymap({
      'Mod-z': undo,
      'Shift-Mod-z': redo,
      'Mod-y': redo,
      'Mod-b': toggleMark(M['strong']),
      'Mod-i': toggleMark(M['em']),
      'Shift-Mod-8': toggleList(N['bullet_list']),
      'Shift-Mod-7': toggleList(N['ordered_list']),
      'Shift-Mod-b': toggleBlockquote,
      'Mod-\\': () => {
        clearFormat(view);
        return true;
      },
      'Mod-Enter': () => callbacks.onSubmitShortcut(),
      'Shift-Enter': insertHardBreak,
      Enter: splitListItem(N['list_item']),
      // 清單裡 Tab／Shift+Tab 縮排；不在清單裡就不處理，焦點照常離開編輯區。
      Tab: sinkListItem(N['list_item']),
      'Shift-Tab': liftListItem(N['list_item']),
      Backspace: undoInputRule,
    }),
    keymap(baseKeymap),
    history(),
    placeholderPlugin(() => placeholder),
  ];

  const stateFor = (html: string) => EditorState.create({ doc: parseDoc(html), plugins });

  const view: EditorView = new EditorView(
    { mount: options.element },
    {
      state: stateFor(options.content),
      editable: () => editable,
      attributes: options.attributes,
      dispatchTransaction(tr: Transaction) {
        const next = view.state.apply(tr);
        view.updateState(next);
        if (tr.docChanged) callbacks.onChange(contentOf(next.doc));
        callbacks.onToolbar(toolbarOf(next));
      },
      handleDOMEvents: {
        focus: () => {
          callbacks.onFocus(true);
          return false;
        },
        blur: () => {
          callbacks.onFocus(false);
          return false;
        },
      },
    },
  );

  // 給測試與除錯用：從畫面上的編輯器找到 view（testing.ts 的 viewOf）。
  Object.defineProperty(options.element, 'libRichTextView', { value: view, configurable: true });

  const engine: RichTextEngine = {
    view,
    setContent(html) {
      holder.dismissedAt = null;
      view.updateState(stateFor(html));
      callbacks.onToolbar(toolbarOf(view.state));
    },
    setEditable(next) {
      if (next === editable) return;
      editable = next;
      view.setProps({ editable: () => editable });
    },
    setPlaceholder(text) {
      if (text === placeholder) return;
      placeholder = text;
      view.dispatch(view.state.tr.setMeta('addToHistory', false));
    },
    setAttributes(attributes) {
      const dom = view.dom;
      for (const [name, value] of Object.entries(attributes)) {
        if (value === null) dom.removeAttribute(name);
        else if (dom.getAttribute(name) !== value) dom.setAttribute(name, value);
      }
    },
    run,
    currentLink() {
      const range = linkRange(view.state);
      if (range) return range.mark.attrs['href'] as string;
      const { from, to } = view.state.selection;
      let href: string | null = null;
      view.state.doc.nodesBetween(from, to, (node) => {
        const mark = M['link'].isInSet(node.marks);
        if (mark && !href) href = mark.attrs['href'] as string;
      });
      return href;
    },
    applyLink(href) {
      const safe = safeLinkHref(href);
      if (!safe || !editable) return;
      const { state } = view;
      const mark = M['link'].create({ href: safe });
      const range = state.selection.empty ? linkRange(state) : null;
      const tr = state.tr;
      if (range) {
        tr.removeMark(range.from, range.to, M['link']).addMark(range.from, range.to, mark);
      } else if (state.selection.empty) {
        const text = safe.startsWith('mailto:') ? decodeURIComponent(safe.slice('mailto:'.length)) : safe;
        const at = state.selection.from;
        tr.insert(at, schema.text(text, [mark]));
        tr.setSelection(TextSelection.create(tr.doc, at + text.length));
      } else {
        const { from, to } = state.selection;
        tr.removeMark(from, to, M['link']).addMark(from, to, mark);
      }
      view.dispatch(tr.scrollIntoView());
      view.focus();
    },
    removeLink() {
      const { state } = view;
      const range = state.selection.empty ? linkRange(state) : { from: state.selection.from, to: state.selection.to };
      if (range) view.dispatch(state.tr.removeMark(range.from, range.to, M['link']));
      view.focus();
    },
    insertMention(trigger, id, label) {
      holder.dismissedAt = null;
      const tr = view.state.tr.replaceWith(trigger.from, trigger.to, [N['mention'].create({ id, label }), schema.text(' ')]);
      tr.setSelection(Selection.near(tr.doc.resolve(trigger.from + 2)));
      view.dispatch(tr.scrollIntoView());
      view.focus();
    },
    dismissMention() {
      holder.dismissedAt = findMention(view.state)?.from ?? null;
      holder.active = null;
      callbacks.onMention(null);
    },
    focus() {
      view.focus();
    },
    content() {
      return contentOf(view.state.doc);
    },
    destroy() {
      view.destroy();
    },
  };
  return engine;
};
