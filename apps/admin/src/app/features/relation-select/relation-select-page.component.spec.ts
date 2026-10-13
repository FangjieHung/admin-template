import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OverlayContainer } from '@angular/cdk/overlay';
import { RelationSelectPageComponent } from './relation-select-page.component';
import { makeDemoProjects, makeDemoUsers, nameInitials, withDemoLatency } from './relation-select-demo-data';
import { createArraySource } from '@admin-template/ui';

describe('關聯選擇欄位示範資料', () => {
  it('5,000 位使用者：固定種子每次一樣、id 與 email 不重複', () => {
    const a = makeDemoUsers();
    const b = makeDemoUsers();
    expect(a).toHaveLength(5000);
    expect(a).toEqual(b);
    expect(new Set(a.map((u) => u.id)).size).toBe(5000);
    expect(new Set(a.map((u) => u.email)).size).toBe(5000);
    expect(makeDemoProjects()).toHaveLength(60);
  });

  it('縮寫圓章：中文取名字、英文取字首', () => {
    expect(nameInitials('王小明')).toBe('小明');
    expect(nameInitials('Alice Wang')).toBe('AW');
    expect(nameInitials('Bob')).toBe('BO');
  });

  describe('withDemoLatency', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const base = createArraySource(makeDemoUsers(30), { idOf: (u) => u.id, textOf: (u) => u.name });

    it('延遲後回應；abort 時立刻丟 AbortError；模擬失敗時 reject', async () => {
      let fail = false;
      const source = withDemoLatency(base, { fail: () => fail, slow: () => false }, { search: 300, getById: 300 });
      const ok = source.search('', new AbortController().signal);
      await vi.advanceTimersByTimeAsync(300);
      expect((await ok).items.length).toBe(20);

      const abort = new AbortController();
      const cancelled = source.search('', abort.signal);
      abort.abort();
      await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });

      fail = true;
      const failed = source.search('', new AbortController().signal);
      const assertion = expect(failed).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(300);
      await assertion;
    });
  });
});

describe('RelationSelectPageComponent（關聯選擇欄位展示頁）', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => {
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
  });

  it('按「建立」：新增聯絡人、表單值換成新 id、顯示提示訊息', async () => {
    const fixture = TestBed.createComponent(RelationSelectPageComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as {
      onCreateContact(name: string): void;
      form: { controls: { contact: { value: string | null } } };
    };
    page.onCreateContact('新聯絡人');
    fixture.detectChanges();
    expect(page.form.controls.contact.value).toBe('c-new-1');
    await new Promise((r) => setTimeout(r, 300));
    fixture.detectChanges();
    expect(TestBed.inject(OverlayContainer).getContainerElement().textContent).toContain('已建立「新聯絡人」（示範）');
    expect((fixture.nativeElement as HTMLElement).querySelector('.result')?.textContent).toContain('c-new-1');
  });

  it('「必填」示範一進來就顯示錯誤；停用欄位的輸入框是 disabled', () => {
    const fixture = TestBed.createComponent(RelationSelectPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-demo="required"] mat-error')?.textContent).toContain('請選擇負責人');
    expect((el.querySelector('[data-demo="disabled"] input') as HTMLInputElement).disabled).toBe(true);
    expect((el.querySelector('[data-demo="readonly"] input') as HTMLInputElement).readOnly).toBe(true);
  });
});
