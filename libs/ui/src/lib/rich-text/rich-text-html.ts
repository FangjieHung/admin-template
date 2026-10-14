/**
 * 富文字 HTML 的白名單（編輯器的 schema 與 lib-rich-text-view 共用同一份規則）。
 *
 * 只留下：`p`、`br`、`strong`（`b` 轉成 `strong`）、`em`（`i` 轉成 `em`）、`ul`、`ol`、`li`、`blockquote`、
 * `a`（href 只接受 http、https、mailto，一律加 `rel="noopener noreferrer"`、`target="_blank"`）、
 * 提及標記 `span[data-type="mention"]`（只留 `data-id`、`data-label`，文字重畫成「@名字」）。
 * 其他標籤：會執行程式或載入外部資源的（script、style、iframe、object、svg、img、form…）連內容整個丟掉；
 * 其餘（div、span、font、h1…）拆掉標籤、保留文字。所有屬性（style、class、on*、id…）一律不留。
 */

/** 連結接受的協定。 */
export const RICH_TEXT_LINK_PROTOCOLS: readonly string[] = ['http:', 'https:', 'mailto:'];

/** 提及標記的 class（編輯器與顯示元件相同，質地的 recipe 用它）。 */
export const RICH_TEXT_MENTION_CLASS = 'lib-rich-text-mention';

/** href 是不是白名單內的協定（http、https 要有主機；mailto 要有收件人）。 */
export function isAllowedLinkHref(href: string | null | undefined): boolean {
  return safeLinkHref(href) !== null;
}

/**
 * 使用者在連結小視窗輸入的字 → 可以用的 href；不接受時回傳 null。
 * 沒寫協定時：像 Email 的補 `mailto:`、像網域的（`www.example.com/a`）補 `https://`。
 */
export function normalizeLinkHref(input: string): string | null {
  const value = input.trim();
  if (!value || /\s/.test(value)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return safeLinkHref(value);
  if (/^[^@/?#:]+@[^@/?#:]+\.[^@/?#:]+$/.test(value)) return safeLinkHref(`mailto:${value}`);
  if (/^[^@/?#:]+\.[a-z]{2,}([/?#:].*)?$/i.test(value)) return safeLinkHref(`https://${value}`);
  return null;
}

/** 解析後符合白名單就回傳正規化的網址（URL 解析會去掉 tab、換行這類用來混淆協定的字元）。 */
export function safeLinkHref(href: string | null | undefined): string | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href.trim());
  } catch {
    return null;
  }
  if (!RICH_TEXT_LINK_PROTOCOLS.includes(url.protocol)) return null;
  if (url.protocol === 'mailto:') return url.pathname.length > 0 ? url.href : null;
  return url.hostname ? url.href : null;
}

/** 連內容整個丟掉的標籤。 */
const DROP = new Set([
  'script', 'style', 'template', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'noscript', 'noembed',
  'noframes', 'svg', 'math', 'link', 'meta', 'base', 'title', 'head', 'form', 'input', 'button', 'select', 'option',
  'textarea', 'img', 'picture', 'video', 'audio', 'source', 'track', 'canvas', 'map', 'area', 'xmp', 'plaintext', 'dialog',
]);

/** 保留的標籤（左邊是原始標籤，右邊是輸出的標籤）。 */
const KEEP: Readonly<Record<string, string>> = {
  p: 'p',
  br: 'br',
  strong: 'strong',
  b: 'strong',
  em: 'em',
  i: 'em',
  ul: 'ul',
  ol: 'ol',
  li: 'li',
  blockquote: 'blockquote',
};

/**
 * 依白名單把 HTML 重建成新的節點（不搬原本的節點，屬性一個都不會帶過來）。
 * 解析用 DOMParser：產生的文件沒有瀏覽環境，`<img onerror>`、`<script>` 在解析時都不會執行。
 */
export function renderRichText(html: string | null | undefined, doc: Document = document): DocumentFragment {
  const out = doc.createDocumentFragment();
  if (!html) return out;
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  copyChildren(parsed.body, out, doc);
  return out;
}

/** 清理後的 HTML 字串。 */
export function sanitizeRichTextHtml(html: string | null | undefined, doc: Document = document): string {
  const box = doc.createElement('div');
  box.append(renderRichText(html, doc));
  return box.innerHTML;
}

/** 依出現順序列出提及的 id（不重複）。 */
export function mentionIdsOf(html: string | null | undefined, doc: Document = document): string[] {
  const ids: string[] = [];
  renderRichText(html, doc)
    .querySelectorAll('span[data-type="mention"]')
    .forEach((el) => {
      const id = el.getAttribute('data-id');
      if (id && !ids.includes(id)) ids.push(id);
    });
  return ids;
}

function copyChildren(from: Node, to: Node, doc: Document): void {
  from.childNodes.forEach((child) => copyNode(child, to, doc));
}

function copyNode(node: Node, to: Node, doc: Document): void {
  if (node.nodeType === Node.TEXT_NODE) {
    to.appendChild(doc.createTextNode(node.textContent ?? ''));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return; // 註解、處理指令
  const el = node as Element;
  const tag = el.localName.toLowerCase();
  if (DROP.has(tag)) return;

  if (tag === 'a') {
    const href = safeLinkHref(el.getAttribute('href'));
    if (!href) return copyChildren(el, to, doc);
    const a = doc.createElement('a');
    a.setAttribute('href', href);
    a.setAttribute('rel', 'noopener noreferrer');
    a.setAttribute('target', '_blank');
    copyChildren(el, a, doc);
    to.appendChild(a);
    return;
  }

  if (tag === 'span' && el.getAttribute('data-type') === 'mention') {
    const id = el.getAttribute('data-id');
    const label = (el.getAttribute('data-label') ?? el.textContent ?? '').replace(/^@/, '').trim();
    if (!id || !label) return copyChildren(el, to, doc);
    to.appendChild(createMention(doc, id, label));
    return;
  }

  const keep = KEEP[tag];
  if (!keep) return copyChildren(el, to, doc);
  const copy = doc.createElement(keep);
  if (keep !== 'br') copyChildren(el, copy, doc);
  to.appendChild(copy);
}

/** 提及標記：`<span class="lib-rich-text-mention" data-type="mention" data-id data-label>@名字</span>`。 */
export function createMention(doc: Document, id: string, label: string): HTMLElement {
  const span = doc.createElement('span');
  span.className = RICH_TEXT_MENTION_CLASS;
  span.setAttribute('data-type', 'mention');
  span.setAttribute('data-id', id);
  span.setAttribute('data-label', label);
  span.textContent = `@${label}`;
  return span;
}
