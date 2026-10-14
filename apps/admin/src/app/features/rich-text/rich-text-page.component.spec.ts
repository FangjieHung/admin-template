import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { DOMParser as PmDOMParser } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { RichTextEditorComponent } from '@admin-template/ui';
import { RichTextPageComponent } from './rich-text-page.component';
import { DEMO_PEOPLE, demoComments } from './demo-rich-text-data';

/** 元件裡的 ProseMirror view（掛在編輯區外層 `.lib-rte__mount` 上）；用 transaction 模擬使用者輸入。 */
function pmView(host: HTMLElement): EditorView {
  return (host.querySelector('.lib-rte__mount') as HTMLElement & { libRichTextView: EditorView }).libRichTextView;
}
function typeHtml(host: HTMLElement, html: string, replaceAll = false): void {
  const view = pmView(host);
  const box = document.createElement('div');
  box.innerHTML = html;
  const parser = PmDOMParser.fromSchema(view.state.schema);
  const tr = replaceAll
    ? view.state.tr.replaceWith(0, view.state.doc.content.size, parser.parse(box).content)
    : view.state.tr.replaceSelection(parser.parseSlice(box));
  view.dispatch(tr);
}

/** jsdom 沒有版面：ProseMirror 算游標座標時要用的 API 補上空的版本。 */
function installLayoutStubs(): void {
  Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0);
  Range.prototype.getClientRects ??= () => Object.assign([] as DOMRect[], { item: () => null }) as unknown as DOMRectList;
  Element.prototype.scrollIntoView ??= () => undefined;
  document.elementFromPoint ??= () => null;
}

describe('RichTextPageComponent（富文字、留言與 @提及展示頁）', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  const demo = (id: string) => el.querySelector<HTMLElement>(`[data-demo="${id}"]`)!;
  const output = (id: string) => el.querySelector<HTMLElement>(`[data-output="${id}"]`)!;
  const settle = async (ms = 0) => {
    for (let i = 0; i < 3; i++) {
      harness.detectChanges();
      await new Promise((r) => setTimeout(r, ms));
    }
    harness.detectChanges();
  };
  const ready = async (host: HTMLElement) => {
    const debug = harness.fixture.debugElement.query((d) => d.nativeElement === host);
    await (debug.componentInstance as RichTextEditorComponent).whenReady();
    await settle();
  };

  beforeAll(() => installLayoutStubs());

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: RichTextPageComponent }])] });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/components/rich-text', RichTextPageComponent);
    el = harness.routeNativeElement as HTMLElement;
    await settle();
    await ready(demo('form'));
  });

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('四個示範：表單、字數上限、唯讀與停用、留言串', () => {
    expect(el.querySelectorAll('app-demo-block')).toHaveLength(4);
    expect(demo('form').querySelector('[role="toolbar"]')).not.toBeNull();
    expect(demo('readonly').querySelector('[role="toolbar"]')).toBeNull();
    expect(demo('disabled').querySelector<HTMLButtonElement>('[data-tool="bold"]')?.disabled).toBe(true);
    expect(DEMO_PEOPLE).toHaveLength(8);
    expect(DEMO_PEOPLE.filter((p) => !p.avatar)).toHaveLength(1);
  });

  it('表單：編輯後即時顯示 HTML 輸出、mentions 與 lib-rich-text-view', async () => {
    expect(output('mentions').textContent).toBe('[p-wu]');
    expect(output('view').querySelectorAll('ul li')).toHaveLength(2);
    typeHtml(demo('form'), '<p>請 <span data-type="mention" data-id="p-wang" data-label="王小明">@王小明</span> 確認</p>', true);
    await settle();
    expect(output('html').textContent).toContain('data-id="p-wang"');
    expect(output('mentions').textContent).toBe('[p-wang]');
    expect(output('mention-names').textContent).toContain('王小明');
    expect(output('view').querySelector('.lib-rich-text-mention')?.textContent).toBe('@王小明');
  });

  it('字數上限：一開始顯示「剩 5 字」，超過時表單變成 INVALID', async () => {
    await ready(demo('limit'));
    expect(demo('limit').querySelector('.lib-rte__counter')?.textContent?.trim()).toBe('剩 5 字');
    pmView(demo('limit')).dispatch(pmView(demo('limit')).state.tr.insertText('再多打十個字讓它超過上限'));
    await settle();
    expect(demo('limit').querySelector('.lib-rte__counter')?.textContent).toContain('超過');
    expect(output('limit-status').textContent).toContain('INVALID');
  });

  it('留言串：12 則先顯示最新 5 則；送出新留言後出現在最後', async () => {
    const thread = demo('thread');
    expect(demoComments(Date.now())).toHaveLength(12);
    expect(thread.querySelectorAll('.lc-item')).toHaveLength(5);
    expect(thread.querySelector('[data-comments-earlier]')?.textContent).toContain('顯示較早的 7 則');
    expect(thread.querySelectorAll('[data-comment-edited]')).toHaveLength(1);

    const composer = thread.querySelector('.lc-composer lib-rich-text-editor') as HTMLElement;
    await ready(composer);
    typeHtml(composer, '<p>新的留言</p>');
    await settle();
    (thread.querySelector('[data-comment-send]') as HTMLButtonElement).click();
    await settle(700);
    const last = Array.from(thread.querySelectorAll('.lc-item')).at(-1) as HTMLElement;
    expect(last.querySelector('.lc-bubble')?.textContent).toBe('新的留言');
    expect(last.querySelector('.lc-you')).not.toBeNull();
  });
});
