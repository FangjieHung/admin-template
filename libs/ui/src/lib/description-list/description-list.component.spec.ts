import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Clipboard } from '@angular/cdk/clipboard';
import {
  DESCRIPTION_COPIED_DURATION,
  DescriptionCopiedEvent,
  DescriptionItem,
  DescriptionListComponent,
  DescriptionValueDirective,
} from './description-list.component';
import { DESCRIPTION_LIST_LABELS, DescriptionListLabels } from './description-list-labels';

const LABELS: DescriptionListLabels = { empty: '未填', copy: '複製{label}', copied: '已複製' };

@Component({
  imports: [DescriptionListComponent, DescriptionValueDirective],
  template: `
    <lib-description-list [items]="items()" [columns]="columns()" (copied)="copied.push($event)" (copyFailed)="failed.push($event)">
      <ng-template libDescriptionValue="status" let-item>
        <span class="custom-status">狀態：{{ item.value }}</span>
      </ng-template>
    </lib-description-list>
  `,
})
class HostComponent {
  readonly items = signal<DescriptionItem[]>([
    { label: '編號', value: 'TK-2048', copyable: true },
    { label: '負責人', value: null },
    { label: '備註', value: '' },
    { label: '數量', value: 3, hint: '含備品' },
    { label: '狀態', value: '處理中', key: 'status' },
  ]);
  readonly columns = signal<1 | 2>(1);
  readonly copied: DescriptionCopiedEvent[] = [];
  readonly failed: DescriptionItem[] = [];
}

describe('DescriptionListComponent', () => {
  let copyResult = true;
  const copy = vi.fn((text: string) => text.length >= 0 && copyResult);

  beforeEach(() => {
    copyResult = true;
    copy.mockClear();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: DESCRIPTION_LIST_LABELS, useValue: LABELS },
        { provide: Clipboard, useValue: { copy } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  function render() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('用 <dl><dt><dd> 呈現標籤與值，hint 在值下方', () => {
    const { el } = render();
    const rows = el.querySelectorAll('dl > div');
    expect(rows).toHaveLength(5);
    expect(rows[0].querySelector('dt')?.textContent?.trim()).toBe('編號');
    expect(rows[0].querySelector('dd')?.textContent).toContain('TK-2048');
    expect(rows[3].querySelector('dd .dsl-hint')?.textContent?.trim()).toBe('含備品');
  });

  it('null 與空字串顯示 labels 的 empty；數字 0 不算空值', () => {
    const { fixture, el } = render();
    const empties = Array.from(el.querySelectorAll('.dsl-empty')).map((n) => n.textContent?.trim());
    expect(empties).toEqual(['未填', '未填']);
    fixture.componentInstance.items.set([{ label: '數量', value: 0 }]);
    fixture.detectChanges();
    expect(el.querySelector('.dsl-empty')).toBeNull();
    expect(el.querySelector('dd')?.textContent?.trim()).toBe('0');
  });

  it('自訂 template 依 key 對應，拿到整筆 item', () => {
    const { el } = render();
    const custom = el.querySelectorAll('.custom-status');
    expect(custom).toHaveLength(1);
    expect(custom[0].textContent).toBe('狀態：處理中');
    expect(custom[0].closest('.dsl-row')?.querySelector('dt')?.textContent?.trim()).toBe('狀態');
  });

  it('columns 寫在 host 的 data-columns（樣式依此排 1 或 2 欄）', () => {
    const { fixture, el } = render();
    const host = el.querySelector('lib-description-list') as HTMLElement;
    expect(host.dataset['columns']).toBe('1');
    fixture.componentInstance.columns.set(2);
    fixture.detectChanges();
    expect(host.dataset['columns']).toBe('2');
  });

  it('複製：寫入剪貼簿、送出 copied、按鈕換成勾號並念出「已複製」，2 秒後恢復', () => {
    vi.useFakeTimers();
    const { fixture, el } = render();
    const buttons = el.querySelectorAll<HTMLButtonElement>('.dsl-copy');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('aria-label')).toBe('複製編號');

    buttons[0].click();
    fixture.detectChanges();
    expect(copy).toHaveBeenCalledWith('TK-2048');
    expect(fixture.componentInstance.copied).toEqual([{ item: fixture.componentInstance.items()[0], text: 'TK-2048' }]);
    expect(buttons[0].classList).toContain('is-copied');
    expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe('已複製');

    vi.advanceTimersByTime(DESCRIPTION_COPIED_DURATION);
    fixture.detectChanges();
    expect(buttons[0].classList).not.toContain('is-copied');
    expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe('');
  });

  it('複製失敗時送出 copyFailed，不顯示已複製', () => {
    copyResult = false;
    const { fixture, el } = render();
    el.querySelector<HTMLButtonElement>('.dsl-copy')?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.copied).toHaveLength(0);
    expect(fixture.componentInstance.failed).toHaveLength(1);
    expect(el.querySelector('.dsl-copy.is-copied')).toBeNull();
  });

  it('空值不顯示複製鈕', () => {
    const { fixture, el } = render();
    fixture.componentInstance.items.set([{ label: '編號', value: null, copyable: true }]);
    fixture.detectChanges();
    expect(el.querySelector('.dsl-copy')).toBeNull();
  });

  it('沒有提供文字、或少了某一句時，建立元件就丟錯並列出缺的名稱', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [{ provide: Clipboard, useValue: { copy } }] });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/DESCRIPTION_LIST_LABELS/);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: DESCRIPTION_LIST_LABELS, useValue: { empty: '—' } },
        { provide: Clipboard, useValue: { copy } },
      ],
    });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/「copy」「copied」/);
  });
});
