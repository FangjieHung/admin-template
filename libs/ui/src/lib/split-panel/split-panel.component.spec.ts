import { afterEach, describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { SplitPanelComponent } from './split-panel.component';

@Component({
  imports: [SplitPanelComponent],
  template: `
    <lib-split-panel [open]="open()" [heading]="heading()" closeLabel="關閉面板" (closed)="onClosed()">
      <button type="button" class="list-row" (click)="open.set(true)">第一列</button>
      <div splitPanelContent>
        <input class="panel-field" aria-label="名稱" />
      </div>
    </lib-split-panel>
  `,
})
class HostComponent {
  readonly open = signal(false);
  readonly heading = signal('編輯聯絡人');
  closedCount = 0;
  onClosed(): void {
    this.closedCount++;
    this.open.set(false);
  }
}

function provideBreakpoint(matches: boolean) {
  return { provide: BreakpointObserver, useValue: { observe: () => of({ matches, breakpoints: {} }) } };
}

describe('SplitPanelComponent', () => {
  let fixture: ComponentFixture<HostComponent> | undefined;

  function create(narrow = false, open = false): ComponentFixture<HostComponent> {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideBreakpoint(narrow)] });
    const fx = TestBed.createComponent(HostComponent);
    fx.componentInstance.open.set(open);
    fx.detectChanges();
    fixture = fx;
    return fx;
  }

  afterEach(() => {
    // 窄螢幕時面板被移到 body 下的 CDK 浮層：銷毀 fixture 才會收掉，不影響下一個測試的 document 查詢。
    fixture?.destroy();
    fixture = undefined;
  });

  it('關著：清單照常顯示，面板內容不渲染、側欄不畫卡片', () => {
    const fx = create();
    const el = fx.nativeElement as HTMLElement;
    expect(el.querySelector('.sp-main .list-row')).not.toBeNull();
    expect(el.querySelector('.panel-field')).toBeNull();
    const side = el.querySelector('.sp-side')!;
    expect(side.classList.contains('sp-side--open')).toBe(false);
    expect(side.classList.contains('ui-card')).toBe(false);
    expect(el.querySelector('lib-split-panel')!.classList.contains('lib-split-panel--open')).toBe(false);
  });

  it('寬螢幕開著：面板在清單右邊的 .ui-card 裡，有標題與投影的內容，兩欄版面', () => {
    const fx = create(false, true);
    const el = fx.nativeElement as HTMLElement;
    const side = el.querySelector('.sp-side')!;
    expect(side.classList.contains('ui-card')).toBe(true);
    expect(side.querySelector('.responsive-panel__heading')?.textContent).toContain('編輯聯絡人');
    expect(side.querySelector('.panel-field')).not.toBeNull();
    expect(el.querySelector('lib-split-panel')!.classList.contains('lib-split-panel--open')).toBe(true);
    // 寬螢幕不是對話框：清單仍可操作。
    expect(side.querySelector('.responsive-panel')!.hasAttribute('role')).toBe(false);
  });

  it('關閉鈕的無障礙名稱來自 closeLabel，按下發出 closed', () => {
    const fx = create(false, true);
    const close = (fx.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.responsive-panel__close')!;
    expect(close.getAttribute('aria-label')).toBe('關閉面板');
    close.click();
    fx.detectChanges();
    expect(fx.componentInstance.closedCount).toBe(1);
    expect((fx.nativeElement as HTMLElement).querySelector('.panel-field')).toBeNull();
  });

  it('開著時按 Esc 發出 closed；關著時不動作', () => {
    const fx = create(false, false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fx.detectChanges();
    expect(fx.componentInstance.closedCount).toBe(0);

    fx.componentInstance.open.set(true);
    fx.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fx.detectChanges();
    expect(fx.componentInstance.closedCount).toBe(1);
  });

  it('窄螢幕開著：面板移到浮層、蓋滿整個畫面（role=dialog），原位不畫卡片也不分兩欄', () => {
    const fx = create(true, true);
    const el = fx.nativeElement as HTMLElement;
    const panel = document.body.querySelector<HTMLElement>('.cdk-overlay-container .responsive-panel')!;
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('responsive-panel--fullscreen')).toBe(true);
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.querySelector('.panel-field')).not.toBeNull();
    const side = el.querySelector('.sp-side')!;
    expect(side.classList.contains('ui-card')).toBe(false);
    expect(side.classList.contains('sp-side--narrow')).toBe(true);
    expect(el.querySelector('lib-split-panel')!.classList.contains('lib-split-panel--open')).toBe(false);
  });

  it('關閉後焦點回到點開面板的元素（面板一直留在 DOM，沒有被拆掉）', () => {
    const fx = create();
    const el = fx.nativeElement as HTMLElement;
    const row = el.querySelector<HTMLButtonElement>('.list-row')!;
    row.focus();
    row.click();
    fx.detectChanges();
    expect(el.querySelector('.panel-field')).not.toBeNull();

    fx.componentInstance.open.set(false);
    fx.detectChanges();
    expect(document.activeElement).toBe(row);
  });
});
