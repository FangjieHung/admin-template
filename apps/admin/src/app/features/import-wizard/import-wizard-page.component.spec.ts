import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ImportWizardPageComponent } from './import-wizard-page.component';
import { demoSample } from './demo-samples';

describe('ImportWizardPageComponent（匯入精靈展示頁）', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // 測試環境沒有 localStorage 時略過
    }
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => {
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
  });

  async function setup() {
    const fixture = TestBed.createComponent(ImportWizardPageComponent);
    fixture.componentInstance.delayMs = 0;
    const el = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      for (let i = 0; i < 8; i++) {
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise((r) => setTimeout(r, 0));
      }
      fixture.detectChanges();
    };
    const click = async (selector: string) => {
      const target = el.querySelector<HTMLElement>(selector);
      expect(target, selector).not.toBeNull();
      target!.click();
      await settle();
    };
    await settle();
    return { fixture, el, settle, click };
  }

  it('有問題的示範檔：自動對應全形欄位名稱，預覽列出問題與重複，略過後匯入，一筆被拒絕', async () => {
    const { el, click } = await setup();
    await click('[data-sample="messy"]');
    expect(el.querySelector('.iw-upload__summary')?.textContent).toContain('10 列資料 · 7 個欄位');

    await click('.sw-actions__next');
    expect(el.textContent).toContain('已自動對應 6／6 個欄位');
    expect(el.querySelector('.iwm-unused')?.textContent).toContain('備註');

    await click('.sw-actions__next');
    expect(el.textContent).toContain('可匯入 6 列');
    expect(el.textContent).toContain('有問題 4 列');
    expect(el.textContent).toContain('重複 2 列');

    await click('[data-field="skipInvalid"] input');
    await click('.sw-actions__next');
    expect(el.querySelector('[data-run="summary"]')?.textContent).toContain('將新增 4 筆、更新 0 筆，略過 6 筆');

    await click('.sw-actions__finish');
    expect(el.querySelector('[data-stat="created"] dd')?.textContent?.trim()).toBe('3');
    expect(el.querySelector('[data-stat="failed"] dd')?.textContent?.trim()).toBe('1');
    expect(el.querySelector('.iwr-failed')?.textContent).toContain('第 9 列：這個網域不接受匯入（示範）');
    expect(el.querySelector('[data-contact-count]')?.textContent).toContain('9 位');

    await click('[data-action="done"]');
    expect(el.querySelector('.sw-panel__heading')?.textContent?.trim()).toBe('上傳檔案');
    expect(el.textContent).toContain('已按「完成」');
  });

  it('Big5 的示範檔用 Big5 讀出中文', async () => {
    const { el, click } = await setup();
    await click('[data-sample="big5"]');
    expect(el.querySelector('.iw-upload__summary')?.textContent).toContain('以 Big5 編碼讀取');
    expect(el.querySelector('.iw-upload__summary')?.textContent).toContain('3 列資料 · 6 個欄位');
  });

  it('示範的 Excel 有兩個工作表，可以讀回文字與日期', async () => {
    const file = await demoSample('xlsx');
    const { readImportFile } = await import('@admin-template/ui');
    const book = await readImportFile(file);
    expect(book.sheets.map((s) => s.name)).toEqual(['聯絡人', '說明']);
    expect(book.sheets[0].rows[0]).toEqual(['姓名', 'Email', '電話', '公司', '標籤', '生日']);
    expect(book.sheets[0].rows[1]).toEqual(['周詩涵', 'shihan.zhou@example.com', '0912-100-201', '晨光設計', '客戶', '1991-04-12']);
  });
});
