import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { StepWizardPageComponent } from './step-wizard-page.component';

const DRAFT_KEY = 'admin-template.step-wizard.project-draft';

describe('StepWizardPageComponent（步驟精靈展示頁）', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  const project = () => el.querySelector<HTMLElement>('[data-demo="project"]')!;
  const heading = (root: HTMLElement) => root.querySelector('.sw-panel__heading')?.textContent?.trim();
  const settle = async () => {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  };
  const type = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  async function open(url: string): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, StepWizardPageComponent);
    el = harness.routeNativeElement as HTMLElement;
    await settle();
  }

  beforeEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      // 測試環境沒有 sessionStorage 時略過
    }
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: StepWizardPageComponent }])] });
  });

  afterEach(() => {
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
  });

  it('有四個示範：線性、錯誤狀態、非線性直式、窄容器', async () => {
    await open('/components/step-wizard');
    expect(el.querySelectorAll('lib-step-wizard')).toHaveLength(4);
    expect(el.querySelector('[data-demo="vertical"] lib-step-wizard')?.classList).toContain('lib-step-wizard--vertical');
    expect(heading(project())).toBe('基本資料');
  });

  it('?step= 超過還沒填好的步驟時退回第一步；換步驟會寫回網址', async () => {
    await open('/components/step-wizard?step=3');
    expect(heading(project())).toBe('基本資料');
    type(project().querySelector<HTMLInputElement>('[formControlName="name"]')!, '官網改版');
    type(project().querySelector<HTMLInputElement>('[formControlName="code"]')!, 'WEB');
    await settle();
    project().querySelector<HTMLButtonElement>('.sw-actions__next')!.click();
    await settle();
    expect(heading(project())).toBe('成員');
    expect(TestBed.inject(Router).url).toContain('step=2');
    // 草稿存在 sessionStorage，重新整理後還在
    expect(JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}').basics?.name).toBe('官網改版');
  });

  it('有草稿時，重新整理（帶 ?step=3）會留在第三步', async () => {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        basics: { name: '官網改版', code: 'WEB', description: '' },
        members: { owner: null, notifyMembers: true },
        settings: { visibility: null, dueDate: '' },
      }),
    );
    await open('/components/step-wizard?step=3');
    expect(heading(project())).toBe('設定');
    expect(project().querySelector('.sw-step[data-state="done"]')).not.toBeNull();
  });

  it('錯誤示範：按下一步留在原地，摘要列出 Email 與電話', async () => {
    await open('/components/step-wizard');
    const demo = el.querySelector<HTMLElement>('[data-demo="error"]')!;
    demo.querySelector<HTMLButtonElement>('.sw-actions__next')!.click();
    await settle();
    expect(heading(demo)).toBe('聯絡資料');
    const summary = demo.querySelector('[data-error-summary]');
    expect(summary?.textContent).toContain('這一步有 2 個欄位需要修正');
    expect(Array.from(summary!.querySelectorAll('li')).map((li) => li.textContent?.trim())).toEqual(['Email', '電話']);
  });

  it('有填內容時按取消，先開確認對話框', async () => {
    await open('/components/step-wizard');
    type(project().querySelector<HTMLInputElement>('[formControlName="name"]')!, '官網改版');
    await settle();
    project().querySelector<HTMLButtonElement>('.sw-actions__cancel')!.click();
    await settle();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.textContent).toContain('放棄新增專案？');
  });

  it('走完全部步驟按「建立專案」：送出中，完成後顯示完成畫面', async () => {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        basics: { name: '官網改版', code: 'WEB', description: '' },
        members: { owner: null, notifyMembers: true },
        settings: { visibility: 'team', dueDate: '' },
      }),
    );
    await open('/components/step-wizard?step=4');
    expect(heading(project())).toBe('確認');
    expect(project().querySelector('lib-description-list')?.textContent).toContain('團隊內');
    const finish = project().querySelector<HTMLButtonElement>('.sw-actions__finish')!;
    expect(finish.textContent).toContain('建立專案');
    finish.click();
    harness.detectChanges();
    expect(finish.textContent).toContain('送出中…');
    await new Promise((resolve) => setTimeout(resolve, 1300));
    await settle();
    expect(project().querySelector('lib-empty-state')?.textContent).toContain('已建立專案「官網改版」');
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
