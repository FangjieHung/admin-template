import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { CommentThreadComponent } from './comment-thread.component';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { RICH_TEXT_LABELS } from './rich-text-labels';
import type { CommentDeleteEvent, CommentEditEvent, CommentItem, CommentSubmitEvent } from './rich-text.types';
import { TEST_RICH_TEXT_LABELS, flush, installLayoutStubs, testMentionSource, editorOf } from './testing';

const NOW = Date.now();
const MIN = 60_000;

function comment(i: number, authorId = `p${i % 3}`, extra: Partial<CommentItem> = {}): CommentItem {
  return {
    id: `c${i}`,
    author: { id: authorId, name: authorId === 'me' ? '林雅婷' : `同事${i % 3}` },
    html: `<p>第 ${i} 則</p>`,
    createdAt: NOW - (20 - i) * 10 * MIN,
    ...extra,
  };
}

/** 讓測試決定事件怎麼回應：resolve、reject，或不回應（等於馬上成功）。 */
interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: () => void;
}
function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: () => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = () => rej(new Error('失敗'));
  });
  return { promise, resolve, reject };
}

@Component({
  imports: [CommentThreadComponent],
  template: `
    <lib-comment-thread
      [comments]="comments()"
      currentUserId="me"
      [visibleCount]="5"
      [mentionSource]="source"
      (commentSubmit)="onSubmit($event)"
      (commentEdit)="onEdit($event)"
      (commentDelete)="onDelete($event)"
    />
  `,
})
class HostComponent {
  readonly comments = signal<readonly CommentItem[]>([]);
  readonly source = testMentionSource().source;
  submits: CommentSubmitEvent[] = [];
  edits: CommentEditEvent[] = [];
  deletes: CommentDeleteEvent[] = [];
  next: Deferred | null = null;

  onSubmit(event: CommentSubmitEvent): void {
    this.submits.push(event);
    if (this.next) event.respondWith(this.next.promise);
  }
  onEdit(event: CommentEditEvent): void {
    this.edits.push(event);
    if (this.next) event.respondWith(this.next.promise);
  }
  onDelete(event: CommentDeleteEvent): void {
    this.deletes.push(event);
    if (this.next) event.respondWith(this.next.promise);
  }
}

let fixture: ComponentFixture<HostComponent>;
let host: HostComponent;
let el: HTMLElement;

async function settle(): Promise<void> {
  await flush();
  fixture.detectChanges();
  await fixture.whenStable();
}

async function setup(comments: readonly CommentItem[]): Promise<void> {
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [{ provide: RICH_TEXT_LABELS, useValue: TEST_RICH_TEXT_LABELS }],
  });
  fixture = TestBed.createComponent(HostComponent);
  host = fixture.componentInstance;
  host.comments.set(comments);
  fixture.detectChanges();
  await fixture.whenStable();
  el = fixture.nativeElement as HTMLElement;
  await editorAt(composerHost()).whenReady();
  await settle();
}

function composerHost(): HTMLElement {
  return el.querySelector('.lc-composer lib-rich-text-editor') as HTMLElement;
}

function editorAt(node: HTMLElement): RichTextEditorComponent {
  const debug = fixture.debugElement.query((d) => d.nativeElement === node);
  return debug.componentInstance as RichTextEditorComponent;
}

function sendButton(): HTMLButtonElement {
  return el.querySelector('[data-comment-send]') as HTMLButtonElement;
}

function items(): string[] {
  return Array.from(el.querySelectorAll('.lc-item')).map((li) => li.getAttribute('data-comment-id') ?? '');
}

async function typeComposer(html: string): Promise<void> {
  editorOf(composerHost()).commands.insertContent(html);
  await settle();
}

beforeAll(() => installLayoutStubs());

afterEach(() => {
  TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
  fixture?.destroy();
});

describe('CommentThreadComponent', () => {
  it('沒有留言時顯示空狀態，下面仍有輸入框', async () => {
    await setup([]);
    expect(el.querySelector('lib-empty-state')?.textContent).toContain('還沒有留言');
    expect(el.querySelector('.lc-list')).toBeNull();
    expect(composerHost()).not.toBeNull();
    expect(sendButton().disabled).toBe(true);
  });

  it('依時間由舊到新；先顯示最新 5 則，「顯示較早的 7 則」展開全部並把焦點移到第一則', async () => {
    await setup(Array.from({ length: 12 }, (_, i) => comment(i + 1)));
    expect(items()).toEqual(['c8', 'c9', 'c10', 'c11', 'c12']);
    const earlier = el.querySelector('[data-comments-earlier]') as HTMLButtonElement;
    expect(earlier.textContent).toContain('顯示較早的 7 則');
    earlier.click();
    await settle();
    expect(items()).toHaveLength(12);
    expect(items()[0]).toBe('c1');
    expect(el.querySelector('[data-comments-earlier]')).toBeNull();
    expect(document.activeElement?.getAttribute('data-comment-id')).toBe('c1');
  });

  it('頭像（沒有圖片時是名字首字）、名字、相對時間（title 是完整時間）、已編輯標記；只有自己的留言有編輯、刪除', async () => {
    await setup([
      comment(1, 'p1'),
      comment(2, 'me', { editedAt: NOW - 5 * MIN, author: { id: 'me', name: '林雅婷', avatar: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' } }),
    ]);
    const [other, mine] = Array.from(el.querySelectorAll<HTMLElement>('.lc-item'));
    expect(other.querySelector('.lc-avatar')?.textContent?.trim()).toBe('同');
    expect(other.querySelector('.lc-name')?.textContent).toBe('同事1');
    const time = other.querySelector('time') as HTMLElement;
    expect(time.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(time.getAttribute('title')).toBeTruthy();
    expect(other.querySelector('[data-comment-action]')).toBeNull();
    expect(other.querySelector('[data-comment-edited]')).toBeNull();

    expect(mine.querySelector('.lc-avatar img')).not.toBeNull();
    expect(mine.querySelector('.lc-you')?.textContent).toBe('（你）');
    expect(mine.querySelector('[data-comment-edited]')?.getAttribute('title')).toMatch(/^編輯於 /);
    expect(mine.querySelectorAll('[data-comment-action]')).toHaveLength(2);
    expect(mine.querySelector('.lc-bubble')?.textContent).toBe('第 2 則');
  });

  it('送出：事件帶 HTML、純文字與 mentions；送出中停用輸入與按鈕；成功後清空', async () => {
    await setup([]);
    await typeComposer('<p>請 <span data-type="mention" data-id="u2" data-label="王小明">@王小明</span> 確認</p>');
    expect(sendButton().disabled).toBe(false);
    host.next = deferred();
    sendButton().click();
    await settle();
    expect(host.submits).toHaveLength(1);
    expect(host.submits[0].mentions).toEqual(['u2']);
    expect(host.submits[0].text).toBe('請 @王小明 確認');
    expect(host.submits[0].html).toContain('data-id="u2"');
    expect(sendButton().disabled).toBe(true);
    expect(sendButton().textContent).toContain('送出中…');
    expect(composerHost().querySelector('.ProseMirror')?.getAttribute('contenteditable')).toBe('false');

    host.next.resolve();
    await settle();
    await settle();
    expect(composerHost().querySelector('.ProseMirror')?.getAttribute('contenteditable')).toBe('true');
    expect(editorAt(composerHost()).content().html).toBe('');
    expect(sendButton().disabled).toBe(true);
  });

  it('送出失敗：保留內容、顯示錯誤，按重試再送一次', async () => {
    await setup([]);
    await typeComposer('<p>會失敗的留言</p>');
    host.next = deferred();
    sendButton().click();
    await settle();
    host.next.reject();
    await settle();
    await settle();
    expect(el.querySelector('[data-send-error]')?.textContent).toContain('送出失敗');
    expect(editorAt(composerHost()).content().text).toBe('會失敗的留言');

    host.next = deferred();
    (el.querySelector('[data-comment-retry]') as HTMLButtonElement).click();
    await settle();
    expect(host.submits).toHaveLength(2);
    expect(host.submits[1].html).toBe('<p>會失敗的留言</p>');
    host.next.resolve();
    await settle();
    await settle();
    expect(el.querySelector('[data-send-error]')).toBeNull();
    expect(editorAt(composerHost()).content().html).toBe('');
  });

  it('⌘↵／Ctrl+↵ 送出', async () => {
    await setup([]);
    await typeComposer('<p>快捷鍵</p>');
    const dom = composerHost().querySelector('.ProseMirror') as HTMLElement;
    editorOf(composerHost()).view.focus();
    dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    await settle();
    expect(host.submits.map((s) => s.text)).toEqual(['快捷鍵']);
  });

  it('編輯自己的留言：原地換成編輯器，儲存送出 commentEdit（含 mentions）；失敗時保留編輯、成功回到檢視', async () => {
    await setup([comment(1, 'me')]);
    (el.querySelector('[data-comment-action="edit"]') as HTMLButtonElement).click();
    await settle();
    const editorHost = el.querySelector('.lc-edit lib-rich-text-editor') as HTMLElement;
    await editorAt(editorHost).whenReady();
    await settle();
    expect(el.querySelector('.lc-bubble')).toBeNull();
    const editor = editorOf(editorHost);
    editor.commands.setContent('<p>改過 <span data-type="mention" data-id="u1" data-label="Amy Lin">@Amy Lin</span></p>');
    await settle();

    host.next = deferred();
    (el.querySelector('[data-edit-save]') as HTMLButtonElement).click();
    await settle();
    expect(host.edits).toHaveLength(1);
    expect(host.edits[0].id).toBe('c1');
    expect(host.edits[0].mentions).toEqual(['u1']);
    host.next.reject();
    await settle();
    await settle();
    expect(el.querySelector('.lc-edit .lc-error')?.textContent).toContain('儲存失敗');
    expect(el.querySelector('.lc-edit')).not.toBeNull();

    host.next = deferred();
    (el.querySelector('[data-edit-save]') as HTMLButtonElement).click();
    await settle();
    host.comments.set([{ ...comment(1, 'me'), html: host.edits[1].html, editedAt: Date.now() }]);
    host.next.resolve();
    await settle();
    await settle();
    expect(el.querySelector('.lc-edit')).toBeNull();
    expect(el.querySelector('.lc-bubble .lib-rich-text-mention')?.textContent).toBe('@Amy Lin');
    expect(el.querySelector('[data-comment-edited]')).not.toBeNull();
  });

  it('編輯中按取消或 Esc 回到檢視，不送出事件', async () => {
    await setup([comment(1, 'me')]);
    (el.querySelector('[data-comment-action="edit"]') as HTMLButtonElement).click();
    await settle();
    (el.querySelector('[data-edit-cancel]') as HTMLButtonElement).click();
    await settle();
    expect(el.querySelector('.lc-edit')).toBeNull();

    (el.querySelector('[data-comment-action="edit"]') as HTMLButtonElement).click();
    await settle();
    const editorHost = el.querySelector('.lc-edit lib-rich-text-editor') as HTMLElement;
    await editorAt(editorHost).whenReady();
    editorHost.querySelector('.ProseMirror')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await settle();
    expect(el.querySelector('.lc-edit')).toBeNull();
    expect(host.edits).toHaveLength(0);
  });

  it('刪除：先確認，確認後送出 commentDelete；取消就不送；失敗時顯示錯誤', async () => {
    await setup([comment(1, 'me')]);
    const deleteButton = () => el.querySelector('[data-comment-action="delete"]') as HTMLButtonElement;
    const dialogButton = (text: string) =>
      Array.from(document.querySelectorAll<HTMLButtonElement>('.cdk-overlay-container mat-dialog-container button'))
        .filter((b) => b.textContent?.trim() === text)
        .at(-1);

    deleteButton().click();
    await settle();
    expect(document.querySelector('.cdk-overlay-container')?.textContent).toContain('刪除留言？');
    dialogButton('取消')?.click();
    TestBed.tick();
    await flush(300);
    await settle();
    expect(host.deletes).toHaveLength(0);

    host.next = deferred();
    deleteButton().click();
    await settle();
    expect(dialogButton('刪除')).toBeTruthy();
    dialogButton('刪除')?.click();
    TestBed.tick();
    await flush(300);
    await settle();
    expect(host.deletes.map((d) => d.id)).toEqual(['c1']);
    expect(deleteButton().disabled).toBe(true);
    host.next.reject();
    await settle();
    await settle();
    expect(el.querySelector('.lc-item .lc-error')?.textContent).toContain('刪除失敗');
    expect(deleteButton().disabled).toBe(false);
  });
});
