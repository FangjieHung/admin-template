import { describe, it, expect, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MediaMatcher } from '@angular/cdk/layout';
import { FEEDBACK_STATE_LABELS, FeedbackStateLabels } from './feedback-state-labels';
import { SkeletonComponent } from './skeleton.component';
import { EmptyStateComponent } from './empty-state.component';
import { ErrorStateComponent } from './error-state.component';
import { AsyncStateComponent, AsyncStateEmptyDirective, AsyncStatus } from './async-state.component';

const LABELS: FeedbackStateLabels = {
  loading: '載入中',
  retry: '重試',
  showDetails: '顯示詳細資訊',
  hideDetails: '隱藏詳細資訊',
};

function mediaMatcher(reduced: boolean) {
  return {
    provide: MediaMatcher,
    useValue: { matchMedia: (q: string) => ({ matches: reduced && q.includes('reduce'), media: q }) },
  };
}

describe('SkeletonComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: FEEDBACK_STATE_LABELS, useValue: LABELS }, mediaMatcher(false)] });
  });

  it('外框 aria-busy，報讀器文字「載入中」，色塊全部 aria-hidden', () => {
    const f = TestBed.createComponent(SkeletonComponent);
    f.detectChanges();
    const host = f.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('.sk-sr-only')?.textContent).toBe('載入中');
    const blocks = host.querySelectorAll('.sk-block');
    expect(blocks.length).toBe(3);
    for (const b of Array.from(blocks)) {
      expect(b.closest('[aria-hidden="true"]')).toBeTruthy();
    }
  });

  it('label input 覆寫預設文字', () => {
    const f = TestBed.createComponent(SkeletonComponent);
    f.componentRef.setInput('label', '工單載入中');
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.sk-sr-only')?.textContent).toBe('工單載入中');
  });

  it('table：表頭＋n 列 × m 欄', () => {
    const f = TestBed.createComponent(SkeletonComponent);
    f.componentRef.setInput('variant', 'table');
    f.componentRef.setInput('count', 4);
    f.componentRef.setInput('columns', 3);
    f.detectChanges();
    const rows = (f.nativeElement as HTMLElement).querySelectorAll('.sk-table__row');
    expect(rows.length).toBe(5);
    expect(rows[1].querySelectorAll('.sk-block').length).toBe(3);
  });

  it('各形狀的預設數量：card 3、list 3、kpi 4', () => {
    for (const [variant, selector, n] of [
      ['card', '.sk-card', 3],
      ['list', '.sk-list__item', 3],
      ['kpi', '.sk-kpi', 4],
    ] as const) {
      const f = TestBed.createComponent(SkeletonComponent);
      f.componentRef.setInput('variant', variant);
      f.detectChanges();
      expect((f.nativeElement as HTMLElement).querySelectorAll(selector).length).toBe(n);
      expect((f.nativeElement as HTMLElement).dataset['variant']).toBe(variant);
    }
  });

  it('預設有閃光；animated=false 時加上靜止 class', () => {
    const f = TestBed.createComponent(SkeletonComponent);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).classList).not.toContain('lib-skeleton--static');
    f.componentRef.setInput('animated', false);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).classList).toContain('lib-skeleton--static');
  });

  it('沒有提供文字時丟出明確錯誤', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [mediaMatcher(false)] });
    const f = TestBed.createComponent(SkeletonComponent);
    expect(() => f.detectChanges()).toThrow(/FEEDBACK_STATE_LABELS/);
  });
});

describe('SkeletonComponent（減少動態）', () => {
  it('prefers-reduced-motion: reduce 時一律靜止', () => {
    TestBed.configureTestingModule({ providers: [{ provide: FEEDBACK_STATE_LABELS, useValue: LABELS }, mediaMatcher(true)] });
    const f = TestBed.createComponent(SkeletonComponent);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).classList).toContain('lib-skeleton--static');
  });
});

describe('EmptyStateComponent', () => {
  it('圖示、說明、補充文字與動作；no-data 是實心鈕、預設 inbox 圖示', () => {
    const f = TestBed.createComponent(EmptyStateComponent);
    f.componentRef.setInput('message', '還沒有工單');
    f.componentRef.setInput('detail', '建立第一張工單後會出現在這裡');
    f.componentRef.setInput('actionLabel', '新增工單');
    let clicked = 0;
    f.componentInstance.action.subscribe(() => clicked++);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.lib-feedback-panel__icon')?.textContent?.trim()).toBe('inbox');
    expect(el.querySelector('.lib-feedback-panel__icon')?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.ui-text-subtitle')?.textContent).toContain('還沒有工單');
    expect(el.querySelector('.ui-text-caption')?.textContent).toContain('建立第一張工單');
    const btn = el.querySelector('button') as HTMLButtonElement;
    expect(btn.textContent).toContain('新增工單');
    expect(btn.classList).toContain('mat-mdc-unelevated-button');
    btn.click();
    expect(clicked).toBe(1);
  });

  it('no-results：search_off 圖示、外框鈕；沒有 actionLabel 就沒有按鈕', () => {
    const f = TestBed.createComponent(EmptyStateComponent);
    f.componentRef.setInput('message', '沒有符合條件的工單');
    f.componentRef.setInput('kind', 'no-results');
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.dataset['kind']).toBe('no-results');
    expect(el.querySelector('.lib-feedback-panel__icon')?.textContent?.trim()).toBe('search_off');
    expect(el.querySelector('button')).toBeNull();
    f.componentRef.setInput('actionLabel', '清除篩選');
    f.detectChanges();
    expect(el.querySelector('button')?.classList).toContain('mat-mdc-outlined-button');
  });
});

describe('ErrorStateComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: FEEDBACK_STATE_LABELS, useValue: LABELS }] });
  });

  it('說明在 role="alert" 裡，重試鈕送出 retry', () => {
    const f = TestBed.createComponent(ErrorStateComponent);
    f.componentRef.setInput('message', '工單清單載入失敗');
    f.componentRef.setInput('hint', '請確認網路連線後再試一次');
    let retried = 0;
    f.componentInstance.retry.subscribe(() => retried++);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('工單清單載入失敗');
    expect(alert?.textContent).toContain('請確認網路連線');
    expect(alert?.querySelector('button')).toBeNull();
    const retry = el.querySelector('.lib-error-state__retry') as HTMLButtonElement;
    expect(retry.textContent?.trim()).toBe('重試');
    retry.click();
    expect(retried).toBe(1);
    // 沒有 detail 就沒有切換鈕。
    expect(el.querySelector('.lib-error-state__toggle')).toBeNull();
  });

  it('detail 可以展開／收合，aria-expanded 跟著變', () => {
    const f = TestBed.createComponent(ErrorStateComponent);
    f.componentRef.setInput('message', '儲存失敗');
    f.componentRef.setInput('detail', 'HTTP 503 · 請求編號 7F3A');
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const toggle = el.querySelector('.lib-error-state__toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent?.trim()).toBe('顯示詳細資訊');
    expect(el.querySelector('pre')).toBeNull();
    toggle.click();
    f.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent?.trim()).toBe('隱藏詳細資訊');
    const pre = el.querySelector('pre') as HTMLElement;
    expect(pre.textContent).toContain('請求編號 7F3A');
    expect(toggle.getAttribute('aria-controls')).toBe(pre.id);
  });

  it('retryable=false 不顯示重試；retryLabel 覆寫文字', () => {
    const f = TestBed.createComponent(ErrorStateComponent);
    f.componentRef.setInput('message', '沒有權限');
    f.componentRef.setInput('retryable', false);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.lib-error-state__retry')).toBeNull();
    f.componentRef.setInput('retryable', true);
    f.componentRef.setInput('retryLabel', '重新整理');
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.lib-error-state__retry')?.textContent?.trim()).toBe('重新整理');
  });
});

@Component({
  imports: [AsyncStateComponent],
  template: `
    <lib-async-state
      [status]="status()"
      skeleton="list"
      emptyMessage="還沒有聯絡人"
      emptyActionLabel="新增聯絡人"
      errorMessage="聯絡人載入失敗"
      (retry)="retries = retries + 1"
      (emptyAction)="creates = creates + 1"
    >
      <p class="content">三位聯絡人</p>
    </lib-async-state>
  `,
})
class AsyncHostComponent {
  readonly status = signal<AsyncStatus>('loading');
  retries = 0;
  creates = 0;
}

@Component({
  imports: [AsyncStateComponent, AsyncStateEmptyDirective],
  template: `
    <lib-async-state status="empty" emptyMessage="不會用到">
      <ng-template libAsyncEmpty><p class="custom-empty">自訂空狀態</p></ng-template>
    </lib-async-state>
  `,
})
class AsyncCustomHostComponent {}

describe('AsyncStateComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: FEEDBACK_STATE_LABELS, useValue: LABELS }, mediaMatcher(false)] });
  });

  it('依 status 切換骨架、空狀態、錯誤與內容', () => {
    const f = TestBed.createComponent(AsyncHostComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const host = el.querySelector('lib-async-state') as HTMLElement;
    const live = host.querySelector('.lib-async-state__live') as HTMLElement;

    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('lib-skeleton')?.getAttribute('data-variant')).toBe('list');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toBe('載入中');
    expect(el.querySelector('.content')).toBeNull();

    f.componentInstance.status.set('empty');
    f.detectChanges();
    expect(host.getAttribute('aria-busy')).toBeNull();
    expect(host.querySelector('lib-skeleton')).toBeNull();
    expect(host.querySelector('lib-empty-state')?.textContent).toContain('還沒有聯絡人');
    expect(live.textContent).toBe('還沒有聯絡人');
    (host.querySelector('lib-empty-state button') as HTMLButtonElement).click();
    expect(f.componentInstance.creates).toBe(1);

    f.componentInstance.status.set('error');
    f.detectChanges();
    expect(host.querySelector('lib-empty-state')).toBeNull();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('聯絡人載入失敗');
    expect(live.textContent).toBe('');
    (host.querySelector('.lib-error-state__retry') as HTMLButtonElement).click();
    expect(f.componentInstance.retries).toBe(1);

    f.componentInstance.status.set('ready');
    f.detectChanges();
    expect(host.querySelector('lib-error-state')).toBeNull();
    expect(el.querySelector('.content')?.textContent).toContain('三位聯絡人');
    expect(host.dataset['status']).toBe('ready');
  });

  it('ng-template libAsyncEmpty 取代預設空狀態', () => {
    const f = TestBed.createComponent(AsyncCustomHostComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.custom-empty')?.textContent).toBe('自訂空狀態');
    expect(el.querySelector('lib-empty-state')).toBeNull();
    expect(el.querySelector('.lib-async-state__live')?.textContent).toBe('');
  });
});
