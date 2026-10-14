import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { RICH_TEXT_LABELS, assertRichTextLabels, formatRichTextLabel } from './rich-text-labels';
import type { MentionSource } from './rich-text.types';
import { TEST_RICH_TEXT_LABELS, flush, installLayoutStubs, testMentionSource, editorOf } from './testing';

@Component({
  imports: [RichTextEditorComponent, ReactiveFormsModule],
  template: `
    <lib-rich-text-editor
      [formControl]="control"
      placeholder="寫點什麼"
      [readonly]="readonly()"
      [maxLength]="maxLength()"
      [mentionSource]="source()"
      (mentions)="mentions.push($event)"
      (submitShortcut)="submits = submits + 1"
    />
  `,
})
class HostComponent {
  readonly control = new FormControl('', { nonNullable: true });
  readonly readonly = signal(false);
  readonly maxLength = signal<number | null>(null);
  readonly source = signal<MentionSource | null>(null);
  readonly mentions: (readonly string[])[] = [];
  submits = 0;
}

let fixture: ComponentFixture<HostComponent>;
let host: HostComponent;

async function setup(configure?: (h: HostComponent) => void): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [{ provide: RICH_TEXT_LABELS, useValue: TEST_RICH_TEXT_LABELS }],
  });
  fixture = TestBed.createComponent(HostComponent);
  host = fixture.componentInstance;
  configure?.(host);
  fixture.detectChanges();
  await fixture.whenStable();
  const editor = fixture.debugElement.children[0].componentInstance as RichTextEditorComponent;
  await editor.whenReady();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

function editable(el: HTMLElement): HTMLElement {
  return el.querySelector('.ProseMirror') as HTMLElement;
}

function tool(el: HTMLElement, id: string): HTMLButtonElement {
  return el.querySelector(`[data-tool="${id}"]`) as HTMLButtonElement;
}

function key(target: HTMLElement, keyName: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true, ...init }));
}

async function settle(): Promise<void> {
  await flush();
  fixture.detectChanges();
  await fixture.whenStable();
}

beforeAll(() => installLayoutStubs());

afterEach(() => {
  fixture?.destroy();
  document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove());
});

describe('RichTextEditorComponent：ControlValueAccessor', () => {
  it('寫入：表單的值畫進編輯區', async () => {
    const el = await setup((h) => h.control.setValue('<p>你好<strong>世界</strong></p>'));
    expect(editable(el).innerHTML).toContain('<strong>世界</strong>');
    host.control.setValue('<p>換掉</p>');
    await settle();
    expect(editable(el).textContent).toBe('換掉');
    // writeValue 不會反過來觸發表單變更
    expect(host.control.dirty).toBe(false);
  });

  it('讀出：使用者編輯後表單拿到 HTML；清空時是空字串', async () => {
    const el = await setup();
    editorOf(el).commands.insertContent('<p>第一段</p>');
    await settle();
    expect(host.control.value).toBe('<p>第一段</p>');
    editorOf(el).commands.clearContent();
    await settle();
    expect(host.control.value).toBe('');
  });

  it('停用：編輯區不可編輯、工具列按鈕停用；啟用後恢復', async () => {
    const el = await setup();
    host.control.disable();
    await settle();
    expect(editable(el).getAttribute('contenteditable')).toBe('false');
    expect(editable(el).getAttribute('aria-disabled')).toBe('true');
    expect(tool(el, 'bold').disabled).toBe(true);
    host.control.enable();
    await settle();
    expect(editable(el).getAttribute('contenteditable')).toBe('true');
    expect(tool(el, 'bold').disabled).toBe(false);
  });

  it('唯讀：不顯示工具列、不可編輯', async () => {
    const el = await setup((h) => {
      h.readonly.set(true);
      h.control.setValue('<p>只能看</p>');
    });
    expect(el.querySelector('[role="toolbar"]')).toBeNull();
    expect(editable(el).getAttribute('contenteditable')).toBe('false');
    expect(editable(el).getAttribute('aria-readonly')).toBe('true');
  });

  it('編輯區有 role=textbox、aria-multiline、無障礙名稱與 aria-placeholder', async () => {
    const el = await setup();
    const dom = editable(el);
    expect(dom.getAttribute('role')).toBe('textbox');
    expect(dom.getAttribute('aria-multiline')).toBe('true');
    expect(dom.getAttribute('aria-label')).toBe('內容');
    expect(dom.getAttribute('aria-placeholder')).toBe('寫點什麼');
  });
});

describe('RichTextEditorComponent：工具列', () => {
  it('按鈕的 aria-pressed 跟著游標所在的格式；按下會切換格式', async () => {
    const el = await setup((h) => h.control.setValue('<p><strong>粗</strong>一般</p>'));
    const editor = editorOf(el);
    editor.commands.setTextSelection(2);
    await settle();
    expect(tool(el, 'bold').getAttribute('aria-pressed')).toBe('true');
    expect(tool(el, 'emphasis').getAttribute('aria-pressed')).toBe('false');
    editor.commands.setTextSelection(3);
    await settle();
    expect(tool(el, 'bold').getAttribute('aria-pressed')).toBe('false');

    editor.commands.setTextSelection({ from: 2, to: 4 });
    tool(el, 'emphasis').click();
    await settle();
    expect(host.control.value).toBe('<p><strong>粗</strong><em>一般</em></p>');
    expect(tool(el, 'emphasis').getAttribute('aria-pressed')).toBe('true');

    tool(el, 'bulletList').click();
    await settle();
    expect(host.control.value).toContain('<ul><li>');
    expect(tool(el, 'bulletList').getAttribute('aria-pressed')).toBe('true');

    editor.commands.selectAll();
    tool(el, 'clearFormat').click();
    await settle();
    expect(host.control.value).toBe('<p>粗一般</p>');
    expect(tool(el, 'clearFormat').hasAttribute('aria-pressed')).toBe(false);
  });

  it('提示顯示快捷鍵、aria-keyshortcuts；連結沒有快捷鍵', async () => {
    const el = await setup();
    expect(tool(el, 'bold').getAttribute('aria-keyshortcuts')).toMatch(/^(Meta|Control)\+B$/);
    expect(tool(el, 'link').hasAttribute('aria-keyshortcuts')).toBe(false);
  });

  it('工具列只有一個 Tab 停點，← → 移動焦點', async () => {
    const el = await setup();
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('.lib-rte__tool'));
    expect(buttons.filter((b) => b.tabIndex === 0)).toHaveLength(1);
    buttons[0].focus();
    key(buttons[0], 'ArrowRight');
    await settle();
    expect(document.activeElement).toBe(buttons[1]);
    key(buttons[1], 'End');
    await settle();
    expect(document.activeElement).toBe(buttons.at(-1));
  });
});

describe('RichTextEditorComponent：連結', () => {
  async function openLink(el: HTMLElement): Promise<HTMLInputElement> {
    tool(el, 'link').click();
    await settle();
    return document.querySelector('[data-link-input]') as HTMLInputElement;
  }

  function typeInto(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('只接受 http、https、mailto：javascript: 顯示錯誤、不套用', async () => {
    const el = await setup((h) => h.control.setValue('<p>說明文件</p>'));
    editorOf(el).commands.setTextSelection({ from: 1, to: 5 });
    const input = await openLink(el);
    typeInto(input, 'javascript:alert(1)');
    (document.querySelector('[data-link-apply]') as HTMLButtonElement).click();
    await settle();
    expect(document.querySelector('mat-error')?.textContent).toContain('只接受 http、https 或 mailto 連結');
    expect(host.control.value).toBe('<p>說明文件</p>');

    typeInto(input, 'https://example.com/docs');
    (document.querySelector('[data-link-apply]') as HTMLButtonElement).click();
    await settle();
    expect(host.control.value).toBe(
      '<p><a href="https://example.com/docs" rel="noopener noreferrer" target="_blank">說明文件</a></p>',
    );
    expect(document.querySelector('[data-link-input]')).toBeNull();
  });

  it('游標在連結上：標題是「編輯連結」，可以移除連結', async () => {
    const el = await setup((h) => h.control.setValue('<p><a href="https://example.com">官網</a></p>'));
    editorOf(el).commands.setTextSelection(2);
    await settle();
    expect(tool(el, 'link').getAttribute('aria-pressed')).toBe('true');
    const input = await openLink(el);
    expect(input.value).toBe('https://example.com/');
    expect(document.querySelector('.lib-rte-link__title')?.textContent).toContain('編輯連結');
    (document.querySelector('[data-link-remove]') as HTMLButtonElement).click();
    await settle();
    expect(host.control.value).toBe('<p>官網</p>');
  });

  it('貼上帶 javascript: 的連結只留文字', async () => {
    const el = await setup();
    editorOf(el).view.pasteHTML('<p><a href="javascript:alert(1)">按我</a></p>');
    await settle();
    expect(host.control.value).toBe('<p>按我</p>');
  });
});

describe('RichTextEditorComponent：@提及', () => {
  it('輸入 @ 打開清單（role=listbox），↑↓ 移動 aria-activedescendant，Enter 插入提及並送出 mentions', async () => {
    const { source, queries } = testMentionSource();
    const el = await setup((h) => h.source.set(source));
    const editor = editorOf(el);
    editor.view.focus();
    editor.commands.insertContent('請 @');
    await settle();
    expect(queries).toEqual(['']);
    const listbox = document.querySelector('[role="listbox"]') as HTMLElement;
    expect(listbox).not.toBeNull();
    expect(listbox.querySelectorAll('[role="option"]')).toHaveLength(3);
    const dom = editable(el);
    expect(dom.getAttribute('aria-expanded')).toBe('true');
    expect(dom.getAttribute('aria-controls')).toBe(listbox.id);
    expect(dom.getAttribute('aria-activedescendant')).toBe(`${listbox.id}-0`);

    key(dom, 'ArrowDown');
    await settle();
    expect(dom.getAttribute('aria-activedescendant')).toBe(`${listbox.id}-1`);
    expect(document.getElementById(`${listbox.id}-1`)?.getAttribute('aria-selected')).toBe('true');
    key(dom, 'ArrowUp');
    key(dom, 'ArrowUp');
    await settle();
    expect(dom.getAttribute('aria-activedescendant')).toBe(`${listbox.id}-2`);

    key(dom, 'ArrowDown');
    key(dom, 'ArrowDown');
    await settle();
    key(dom, 'Enter');
    await settle();
    expect(host.control.value).toBe(
      '<p>請 <span class="lib-rich-text-mention" data-type="mention" data-id="u2" data-label="王小明">@王小明</span> </p>',
    );
    expect(host.mentions.at(-1)).toEqual(['u2']);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(dom.getAttribute('aria-expanded')).toBe('false');
    expect(dom.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('查詢字縮小清單，Tab 也能確認；找不到時顯示「找不到」', async () => {
    const { source, queries } = testMentionSource();
    const el = await setup((h) => h.source.set(source));
    const editor = editorOf(el);
    editor.view.focus();
    editor.commands.insertContent('@an');
    await settle();
    expect(queries.at(-1)).toBe('an');
    expect(document.querySelector('[role="listbox"]')?.getAttribute('data-query')).toBe('an');
    expect(Array.from(document.querySelectorAll('[role="option"]')).map((o) => o.getAttribute('data-mention-id'))).toEqual(['u3']);
    key(editable(el), 'Tab');
    await settle();
    expect(host.control.value).toContain('data-id="u3"');

    editor.commands.insertContent('@zzz');
    await settle();
    expect(document.querySelector('.lib-rte-mention__status')?.textContent).toContain('找不到「zzz」');
  });

  it('Esc 關掉清單，同一個 @ 不再打開；Email 裡的 @ 不觸發', async () => {
    const { source, queries } = testMentionSource();
    const el = await setup((h) => h.source.set(source));
    const editor = editorOf(el);
    editor.view.focus();
    editor.commands.insertContent('@a');
    await settle();
    key(editable(el), 'Escape');
    await settle();
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    editor.commands.insertContent('m');
    await settle();
    expect(document.querySelector('[role="listbox"]')).toBeNull();

    const before = queries.length;
    editor.commands.insertContent(' help@example');
    await settle();
    expect(queries.length).toBe(before);
  });

  it('多人提及：mentions 依出現順序、不重複', async () => {
    const el = await setup((h) =>
      h.control.setValue(
        '<p><span data-type="mention" data-id="u2" data-label="王小明">@王小明</span> 和 <span data-type="mention" data-id="u1" data-label="Amy Lin">@Amy Lin</span></p>',
      ),
    );
    const editor = fixture.debugElement.children[0].componentInstance as RichTextEditorComponent;
    expect(editor.content().mentions).toEqual(['u2', 'u1']);
    editorOf(el).commands.insertContent(' <span data-type="mention" data-id="u2" data-label="王小明">@王小明</span>');
    await settle();
    expect(editor.content().mentions).toEqual(['u2', 'u1']);
  });

  it('中文輸入法組字中不搜尋；組字結束後依確定的字搜尋', async () => {
    const { source, queries } = testMentionSource();
    const el = await setup((h) => h.source.set(source));
    const editor = editorOf(el);
    editor.view.focus();
    editor.commands.insertContent('@');
    await settle();
    expect(queries).toEqual(['']);

    // 模擬組字：ProseMirror 的 view.composing 為 true 時讀進來的注音
    const input = (editor.view as unknown as { input: { composing: boolean } }).input;
    input.composing = true;
    editor.commands.insertContent('ㄨㄤˊ');
    await settle();
    expect(queries).toEqual(['']);

    // 選字：注音換成「王」，組字結束
    editor.commands.deleteRange({ from: editor.state.selection.from - 3, to: editor.state.selection.from });
    editor.commands.insertContent('王');
    input.composing = false;
    editable(el).dispatchEvent(new CompositionEvent('compositionend', { data: '王', bubbles: true }));
    await settle();
    await settle();
    expect(queries).toEqual(['', '王']);
    expect(Array.from(document.querySelectorAll('[role="option"]')).map((o) => o.textContent?.trim())).toEqual([
      expect.stringContaining('王小明'),
    ]);
  });
});

describe('RichTextEditorComponent：字數上限與貼上', () => {
  it('接近上限顯示「剩 N 字」，超過時是錯誤（aria-invalid、表單 maxlength）', async () => {
    const el = await setup((h) => h.maxLength.set(10));
    editorOf(el).commands.insertContent('一二三四五六七八');
    await settle();
    expect(el.querySelector('.lib-rte__counter')?.textContent?.trim()).toBe('剩 2 字');
    expect(host.control.valid).toBe(true);

    editorOf(el).commands.insertContent('九十十一十二');
    await settle();
    const counter = el.querySelector('.lib-rte__counter') as HTMLElement;
    expect(counter.textContent?.trim()).toBe('超過 4 字，請刪減');
    expect(counter.classList).toContain('is-error');
    expect(editable(el).getAttribute('aria-invalid')).toBe('true');
    expect(editable(el).getAttribute('aria-describedby')).toBe(counter.id);
    expect(host.control.errors).toEqual({ maxlength: { requiredLength: 10, actualLength: 14 } });
  });

  it('字數用純文字長度：段落之間不算、提及算「@名字」', async () => {
    const el = await setup((h) =>
      h.control.setValue('<p><strong>粗</strong>字</p><p><span data-type="mention" data-id="u2" data-label="王小明">@王小明</span></p>'),
    );
    const editor = fixture.debugElement.children[0].componentInstance as RichTextEditorComponent;
    expect(editor.content().length).toBe(6);
    expect(editor.content().text).toBe('粗字\n@王小明');
    void el;
  });

  it('貼上時只留支援的格式：字型、顏色、大小、圖片、標題樣式都拿掉', async () => {
    const el = await setup();
    editorOf(el).view.pasteHTML(
      '<h1 style="color:red">標題</h1><p class="MsoNormal" style="font-family:Comic Sans MS;color:crimson"><span style="font-size:24pt;background:yellow">彩色</span><font color="red">字</font><b>粗</b><img src="x.png"></p>',
    );
    await settle();
    expect(host.control.value).toBe('<p>標題</p><p>彩色字<strong>粗</strong></p>');
  });

  it('⌘↵／Ctrl+↵ 送出 submitShortcut', async () => {
    const el = await setup();
    editorOf(el).view.focus();
    key(editable(el), 'Enter', { ctrlKey: true });
    await settle();
    expect(host.submits).toBe(1);
  });
});

describe('RICH_TEXT_LABELS', () => {
  it('缺少文字時丟出明確錯誤；{name} 佔位被換掉', () => {
    expect(() => assertRichTextLabels(null)).toThrow(/RICH_TEXT_LABELS/);
    expect(() => assertRichTextLabels({ ...TEST_RICH_TEXT_LABELS, send: '' })).toThrow(/send/);
    expect(formatRichTextLabel('剩 {count} 字，{x}', { count: 3 })).toBe('剩 3 字，{x}');
  });
});
