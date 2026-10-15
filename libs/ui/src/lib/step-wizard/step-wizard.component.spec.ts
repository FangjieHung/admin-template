import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { StepWizardComponent } from './step-wizard.component';
import { WizardStepComponent } from './wizard-step.component';
import { STEP_WIZARD_LABELS, StepWizardLabels, formatStepWizardLabel } from './step-wizard-labels';
import { collectFieldErrors, invalidControlPaths } from './step-wizard-fields';

const LABELS: StepWizardLabels = {
  previous: '上一步',
  next: '下一步',
  finish: '完成',
  submitting: '送出中…',
  cancel: '取消',
  optional: '選填',
  stepList: '步驟',
  compactStatus: '步驟 {current}／{total} · {label}',
  stepListToggle: '所有步驟',
  stepListError: '其他步驟需要修正',
  announce: '步驟 {current}，共 {total} 步：{label}',
  stateDone: '已完成',
  stateError: '有錯誤',
  stateLocked: '尚未開放',
  stateUpcoming: '未完成',
  errorSummary: '這一步有 {count} 個欄位需要修正',
  stepInvalid: '這一步還有內容需要修正',
};

@Component({
  imports: [StepWizardComponent, WizardStepComponent, ReactiveFormsModule],
  template: `
    <lib-step-wizard
      [linear]="linear()"
      [submitAction]="action()"
      [submitting]="submitting()"
      [showCancel]="true"
      finishLabel="建立專案"
      [(selectedIndex)]="index"
      (finish)="finished = finished + 1"
      (cancel)="cancelled = cancelled + 1"
    >
      <lib-wizard-step
        label="基本資料"
        description="專案的名稱與代碼"
        [stepControl]="basics"
        [fieldLabels]="{ name: '專案名稱', code: '專案代碼' }"
        [editable]="basicsEditable()"
      >
        <div [formGroup]="basics">
          <label>專案名稱 <input class="f-name" formControlName="name" /></label>
          <label>專案代碼 <input class="f-code" formControlName="code" /></label>
        </div>
      </lib-wizard-step>
      <lib-wizard-step label="成員" optional [stepControl]="members">
        <div [formGroup]="members"><input class="f-owner" formControlName="owner" /></div>
      </lib-wizard-step>
      <lib-wizard-step label="確認">
        <p class="confirm">確認內容</p>
      </lib-wizard-step>
    </lib-step-wizard>
  `,
})
class HostComponent {
  readonly linear = signal(true);
  readonly basicsEditable = signal(true);
  readonly index = signal(0);
  readonly submitting = signal(false);
  readonly action = signal<(() => unknown) | null>(null);
  finished = 0;
  cancelled = 0;
  readonly basics = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    code: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[A-Z]{2,5}$/)] }),
  });
  readonly members = new FormGroup({ owner: new FormControl('', { nonNullable: true }) });
}

/** 由測試決定元件的寬度（ResizeObserver 的 callback）。 */
let resize: ((entries: { contentRect: { width: number } }[]) => void) | null = null;
class FakeResizeObserver {
  constructor(cb: (entries: { contentRect: { width: number } }[]) => void) {
    resize = cb;
  }
  observe(): void {
    // 測試直接呼叫 callback。
  }
  disconnect(): void {
    // 同上。
  }
}

describe('StepWizardComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;
  const original = globalThis.ResizeObserver;

  const steps = () => Array.from(el.querySelectorAll<HTMLLIElement>('.sw-step'));
  const stateOf = (i: number) => steps()[i].dataset['state'];
  const headerButton = (i: number) => steps()[i].querySelector<HTMLButtonElement>('button')!;
  const heading = () => el.querySelector<HTMLElement>('.sw-panel__heading')!;
  const button = (cls: string) => el.querySelector<HTMLButtonElement>(`.sw-actions__${cls}`);
  const click = async (target: HTMLElement | null) => {
    target!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const fillBasics = () => host.basics.setValue({ name: '官網改版', code: 'WEB' });

  beforeEach(async () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
    resize = null;
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: STEP_WIZARD_LABELS, useValue: LABELS }],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = original;
  });

  it('editable=false 的步驟走過之後：按鈕停用、維持「完成」外觀，點了也不會回去', async () => {
    fillBasics();
    await click(button('next'));
    expect(headerButton(0).disabled).toBe(false);
    host.basicsEditable.set(false);
    fixture.detectChanges();
    expect(stateOf(0)).toBe('done');
    expect(steps()[0].classList.contains('is-frozen')).toBe(true);
    expect(headerButton(0).disabled).toBe(true);
    await click(headerButton(0));
    expect(heading().textContent?.trim()).toBe('成員');
    // 還沒走到的步驟、目前這一步不受影響
    expect(headerButton(1).disabled).toBe(false);
    expect(steps()[1].classList.contains('is-frozen')).toBe(false);
  });

  it('列出每一步：第一步是目前步驟（aria-current），選填步驟有「選填」，後面的步驟鎖住', () => {
    expect(steps().map((s) => s.querySelector('.sw-step__label')?.textContent?.trim())).toEqual(['基本資料', '成員', '確認']);
    expect(headerButton(0).getAttribute('aria-current')).toBe('step');
    expect(headerButton(1).hasAttribute('aria-current')).toBe(false);
    expect(steps()[1].querySelector('.sw-step__hint')?.textContent).toContain('選填');
    expect(stateOf(0)).toBe('current');
    expect(stateOf(1)).toBe('locked');
    expect(headerButton(1).disabled).toBe(true);
    // 狀態不只靠顏色：報讀器文字
    expect(steps()[1].querySelector('.sw-sr-only')?.textContent).toContain('尚未開放');
    expect(heading().textContent).toContain('基本資料');
    expect(heading().getAttribute('role')).toBe('heading');
    expect(el.querySelector('.sw-panel__description')?.textContent).toContain('專案的名稱與代碼');
    // 第一步沒有「上一步」，最後一步才有「完成」
    expect(button('previous')).toBeNull();
    expect(button('next')?.textContent).toContain('下一步');
    expect(button('finish')).toBeNull();
  });

  it('線性：無效時按下一步留在原地、標成錯誤、出現錯誤摘要，焦點移到第一個無效欄位', async () => {
    await click(button('next'));
    expect(host.index()).toBe(0);
    expect(stateOf(0)).toBe('error');
    expect(headerButton(0).getAttribute('aria-current')).toBe('step');
    const summary = el.querySelector('[data-error-summary]');
    expect(summary?.getAttribute('role')).toBe('alert');
    expect(summary?.textContent).toContain('這一步有 2 個欄位需要修正');
    expect(Array.from(summary!.querySelectorAll('li')).map((li) => li.textContent?.trim())).toEqual(['專案名稱', '專案代碼']);
    expect(document.activeElement).toBe(el.querySelector('.f-name'));
    expect(host.basics.controls.name.touched).toBe(true);

    // 摘要裡點欄位名稱 → 聚焦那個欄位
    await click(summary!.querySelector<HTMLButtonElement>('[data-summary-field="code"]'));
    expect(document.activeElement).toBe(el.querySelector('.f-code'));

    // 修正一部分：摘要的數字跟著變，還有錯就仍然擋下
    host.basics.controls.name.setValue('官網改版');
    fixture.detectChanges();
    expect(el.querySelector('[data-error-summary]')?.textContent).toContain('這一步有 1 個欄位需要修正');
    host.basics.controls.code.setValue('web');
    await click(button('next'));
    expect(host.index()).toBe(0);
    expect(document.activeElement).toBe(el.querySelector('.f-code'));
  });

  it('修正後按下一步前進：前一步變成完成，焦點移到新步驟的標題並念出「步驟 2，共 3 步：成員」', async () => {
    await click(button('next'));
    fillBasics();
    await click(button('next'));
    expect(host.index()).toBe(1);
    expect(stateOf(0)).toBe('done');
    expect(stateOf(1)).toBe('current');
    expect(el.querySelector('[data-error-summary]')).toBeNull();
    expect(heading().textContent).toContain('成員');
    expect(document.activeElement).toBe(heading());
    expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain('步驟 2，共 3 步：成員');
    expect(headerButton(1).getAttribute('aria-current')).toBe('step');
    expect(steps()[0].querySelector('.sw-sr-only')?.textContent).toContain('已完成');
  });

  it('可以點回已完成的步驟，也可以按上一步', async () => {
    fillBasics();
    await click(button('next'));
    await click(button('next'));
    expect(host.index()).toBe(2);
    expect(button('finish')?.textContent).toContain('建立專案');
    await click(headerButton(0));
    expect(host.index()).toBe(0);
    expect(stateOf(2)).not.toBe('locked');
    await click(headerButton(2));
    expect(host.index()).toBe(2);
    await click(button('previous'));
    expect(host.index()).toBe(1);
  });

  it('選填步驟留白也能前進；選填步驟後面的步驟在前一步完成後就開放', async () => {
    fillBasics();
    fixture.detectChanges();
    // 目前這一步有效：選填的第 2 步與它後面的第 3 步都可以直接點
    expect(stateOf(1)).toBe('upcoming');
    expect(stateOf(2)).toBe('upcoming');
    await click(headerButton(2));
    expect(host.index()).toBe(2);
    expect(el.querySelector('.confirm')).not.toBeNull();
  });

  it('非線性：每一步都能直接點；帶著錯誤離開的步驟標成錯誤；方向鍵在步驟清單裡移動焦點', async () => {
    host.linear.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(headerButton(2).disabled).toBe(false);
    await click(headerButton(2));
    expect(host.index()).toBe(2);
    expect(stateOf(0)).toBe('error');
    expect(document.activeElement).toBe(heading());

    // 方向鍵（FocusKeyManager）：從目前的按鈕往左移
    headerButton(2).focus();
    headerButton(2).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', keyCode: 37, bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(headerButton(1));
  });

  it('完成：先檢查所有步驟，有錯就打開那一步；全部通過才送出 finish', async () => {
    host.linear.set(false);
    fixture.detectChanges();
    await click(headerButton(2));
    await click(button('finish'));
    expect(host.finished).toBe(0);
    expect(host.index()).toBe(0);
    expect(el.querySelector('[data-error-summary]')).not.toBeNull();
    fillBasics();
    await click(headerButton(2));
    await click(button('finish'));
    expect(host.finished).toBe(1);
  });

  it('submitAction 回傳 Promise 時是忙碌狀態：顯示送出中、其他按鈕停用，結束後恢復', async () => {
    let resolve!: () => void;
    host.action.set(() => new Promise<void>((r) => (resolve = r)));
    fillBasics();
    await click(button('next'));
    await click(button('next'));
    button('finish')!.click();
    fixture.detectChanges();
    expect(button('finish')?.textContent).toContain('送出中…');
    expect(button('finish')?.getAttribute('aria-disabled')).toBe('true');
    expect(button('previous')?.disabled).toBe(true);
    expect(button('cancel')?.disabled).toBe(true);
    expect(el.querySelector('lib-step-wizard')?.getAttribute('aria-busy')).toBe('true');
    expect(host.finished).toBe(1);
    // 忙碌中再按一次不會重複送出
    button('finish')!.click();
    expect(host.finished).toBe(1);
    resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(button('finish')?.textContent).toContain('建立專案');
    expect(el.querySelector('lib-step-wizard')?.hasAttribute('aria-busy')).toBe(false);
  });

  it('[submitting] 由頁面控制忙碌狀態；取消只送出 cancel', async () => {
    host.submitting.set(true);
    fixture.detectChanges();
    expect(button('next')?.disabled).toBe(true);
    host.submitting.set(false);
    fixture.detectChanges();
    await click(button('cancel'));
    expect(host.cancelled).toBe(1);
  });

  it('窄版：寬度小於 600px 收成「步驟 1／3 · 基本資料」＋進度條，按鈕展開完整清單', async () => {
    expect(el.querySelector('lib-step-wizard-compact')).toBeNull();
    resize?.([{ contentRect: { width: 420 } }]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('lib-step-wizard')?.classList).toContain('lib-step-wizard--compact');
    expect(el.querySelector('.swc-text')?.textContent).toContain('步驟 1／3 · 基本資料');
    expect(el.querySelector('.sw-nav')).toBeNull();
    const fill = el.querySelector<HTMLElement>('.swc-progress span');
    expect(fill?.style.inlineSize).toMatch(/^33\.3/);
    const toggle = el.querySelector<HTMLButtonElement>('lib-step-wizard-compact button')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('.sw-nav')?.id).toBe(toggle.getAttribute('aria-controls'));
    // 從展開的清單換步驟後收起
    fillBasics();
    fixture.detectChanges();
    await click(headerButton(1));
    expect(host.index()).toBe(1);
    expect(el.querySelector('.sw-nav')).toBeNull();
    expect(el.querySelector('.swc-text')?.textContent).toContain('步驟 2／3 · 成員');
  });

  it('窄版：目前這一步有錯時精簡列顯示「有錯誤」；別的步驟有錯時展開按鈕帶錯誤圖示與報讀文字', async () => {
    resize?.([{ contentRect: { width: 420 } }]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('[data-compact-error]')).toBeNull();
    expect(el.querySelector('[data-compact-list-error]')).toBeNull();

    await click(button('next'));
    expect(host.index()).toBe(0);
    const badge = el.querySelector('.swc-text [data-compact-error]');
    expect(badge?.textContent?.trim()).toBe('有錯誤');
    expect(badge?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.swc-text')?.textContent).toContain('步驟 1／3 · 基本資料');

    // 非線性：帶著錯誤離開第 1 步 → 目前這一步沒錯，改在展開按鈕上標示
    host.linear.set(false);
    fixture.detectChanges();
    host.index.set(2);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('[data-compact-error]')).toBeNull();
    const toggle = el.querySelector<HTMLButtonElement>('lib-step-wizard-compact button')!;
    expect(toggle.querySelector('[data-compact-list-error]')).not.toBeNull();
    expect(toggle.querySelector('.swc-sr-only')?.textContent?.trim()).toBe('其他步驟需要修正');
    expect(toggle.textContent).toContain('所有步驟');
  });

  it('頁面改 selectedIndex（例如網址的 ?step=）會換到那一步', async () => {
    fillBasics();
    host.index.set(1);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(heading().textContent).toContain('成員');
  });
});

describe('StepWizard 畫面文字', () => {
  it('沒有提供 STEP_WIZARD_LABELS、或少了某一句，建立元件時就丟出明確的錯誤', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/STEP_WIZARD_LABELS/);
  });

  it('少了某一句時列出缺的名稱', () => {
    const partial: Partial<StepWizardLabels> = { ...LABELS };
    delete partial.announce;
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [{ provide: STEP_WIZARD_LABELS, useValue: partial }] });
    expect(() => TestBed.createComponent(HostComponent).detectChanges()).toThrow(/「announce」/);
  });

  it('formatStepWizardLabel 換掉 {name}，沒給的保留原樣', () => {
    expect(formatStepWizardLabel('步驟 {current}／{total}', { current: 2, total: 4 })).toBe('步驟 2／4');
    expect(formatStepWizardLabel('{x}', {})).toBe('{x}');
  });
});

describe('step-wizard-fields', () => {
  it('依表單順序列出無效的最底層欄位（含巢狀），有標籤的依 fieldLabels 的順序排前面', () => {
    const form = new FormGroup({
      a: new FormControl('', Validators.required),
      group: new FormGroup({ b: new FormControl('', Validators.required), c: new FormControl('ok') }),
      d: new FormControl({ value: '', disabled: true }, Validators.required),
    });
    expect(invalidControlPaths(form)).toEqual(['a', 'group.b']);
    expect(collectFieldErrors(form, { 'group.b': '負責人' })).toEqual([
      { path: 'group.b', label: '負責人' },
      { path: 'a', label: null },
    ]);
    expect(invalidControlPaths(new FormGroup({ a: new FormControl('x') }))).toEqual([]);
  });
});
