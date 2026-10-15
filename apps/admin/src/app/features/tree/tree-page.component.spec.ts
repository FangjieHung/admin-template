import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TreePageComponent } from './tree-page.component';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('TreePageComponent（樹狀選單與樹狀表展示頁）', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  const demo = (id: string) => el.querySelector<HTMLElement>(`[data-demo="${id}"]`)!;
  const labelOf = (li: Element) => el.querySelector(`#${li.getAttribute('aria-labelledby')}`)?.querySelector('.tree-node__name')?.textContent?.trim();
  const names = (scope: HTMLElement) => Array.from(scope.querySelectorAll('[role="treeitem"]')).map(labelOf);
  const item = (scope: HTMLElement, name: string) =>
    Array.from(scope.querySelectorAll<HTMLElement>('[role="treeitem"]')).find((li) => labelOf(li) === name)!;
  const settle = async (ms = 0) => {
    for (let i = 0; i < 3; i++) {
      harness.detectChanges();
      await sleep(ms);
    }
    harness.detectChanges();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: TreePageComponent }])] });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/components/tree', TreePageComponent);
    el = harness.routeNativeElement as HTMLElement;
    await settle();
  });

  it('組織架構：預設展開總公司與研發部，前端組是目前項目；點一個人，旁邊的詳情換成他', async () => {
    const org = demo('org');
    expect(names(org)).toEqual(['總公司', '研發部', '前端組', '後端組', '營運部', '財務部']);
    expect(item(org, '前端組').getAttribute('aria-selected')).toBe('true');
    const detail = () => org.querySelector('[data-demo-detail]')!.textContent!.replace(/\s+/g, ' ');
    expect(detail()).toContain('前端組');
    expect(detail()).toContain('總公司 / 研發部');
    expect(detail()).toContain('2 人');
    item(org, '前端組').querySelector<HTMLElement>('.tr-toggle')!.click();
    await settle();
    item(org, '張志明').querySelector<HTMLElement>('.tr-row')!.click();
    await settle();
    expect(item(org, '張志明').getAttribute('aria-selected')).toBe('true');
    expect(detail()).toContain('前端工程師');
    expect(detail()).toContain('2102');
    expect(detail()).toContain('總公司 / 研發部 / 前端組');
  });

  it('文件分類：預設勾兩個分類並列出；搜尋「採購」只留符合的分類與上層；搜尋框按 ↓ 進到樹裡', async () => {
    const cat = demo('category');
    const result = () => cat.querySelector('[data-demo-checked]')!.textContent!.replace(/\s+/g, ' ');
    expect(result()).toContain('已勾選 2 個分類，共 37 份文件');
    expect(item(cat, '財務').getAttribute('aria-checked')).toBe('mixed');
    // 勾「財務」：三個子分類全勾
    item(cat, '財務').querySelector<HTMLElement>('.tr-row')!.click();
    await settle();
    expect(item(cat, '財務').getAttribute('aria-checked')).toBe('true');
    expect(result()).toContain('已勾選 4 個分類，共 49 份文件');
    const search = cat.querySelector<HTMLInputElement>('[data-demo-search]')!;
    search.value = '採購';
    search.dispatchEvent(new Event('input'));
    await settle();
    expect(names(cat)).toEqual(['財務', '採購單據', '行政', '文具採購']);
    expect(item(cat, '採購單據').querySelector('mark')?.textContent).toBe('採購');
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    await settle();
    // 焦點在樹的鍵盤接收器上，aria-activedescendant 指向「財務」
    const sink = cat.querySelector<HTMLInputElement>('.tr-sink')!;
    expect(document.activeElement).toBe(sink);
    expect(sink.getAttribute('aria-activedescendant')).toBe(item(cat, '財務').id);
    search.value = '找不到的字';
    search.dispatchEvent(new Event('input'));
    await settle();
    expect(cat.querySelector('.tr-empty')?.textContent?.trim()).toBe('找不到符合「找不到的字」的項目');
    cat.querySelector<HTMLButtonElement>('[data-demo-action="clear"]')!.click();
    await settle();
    expect(result()).toContain('已勾選 0 個分類');
  });

  it('延遲載入：「設計稿」第一次失敗，按重試後載入成功；「會議紀錄」載入後變成沒有展開鈕', async () => {
    const lazy = demo('lazy');
    item(lazy, '設計稿').querySelector<HTMLElement>('.tr-toggle')!.click();
    await settle();
    expect(item(lazy, '設計稿').getAttribute('aria-busy')).toBe('true');
    await sleep(800);
    await settle();
    const error = item(lazy, '設計稿').querySelector('.tr-error');
    expect(error?.textContent).toContain('無法載入「設計稿」的內容');
    error!.querySelector<HTMLButtonElement>('.tr-retry')!.click();
    await sleep(800);
    await settle();
    expect(names(lazy)).toEqual(['專案文件', '設計稿', '首頁.fig', '圖示.fig', '會議紀錄', '使用說明.pdf', 'README.md']);
    item(lazy, '會議紀錄').querySelector<HTMLElement>('.tr-toggle')!.click();
    await sleep(800);
    await settle();
    expect(item(lazy, '會議紀錄').hasAttribute('aria-expanded')).toBe(false);
    expect(lazy.querySelector('.demo-list')!.textContent).toContain('「設計稿」載入失敗');
    // 重設：再展開一次「設計稿」又會失敗
    lazy.querySelector<HTMLButtonElement>('[data-demo-action="reset-lazy"]')!.click();
    await settle();
    expect(names(lazy)).toEqual(['專案文件', '設計稿', '會議紀錄', '使用說明.pdf', 'README.md']);
    item(lazy, '設計稿').querySelector<HTMLElement>('.tr-toggle')!.click();
    await sleep(800);
    await settle();
    expect(item(lazy, '設計稿').querySelector('.tr-error')).not.toBeNull();
  });

  it('組織架構：用注音打「財」跳到「財務部」', async () => {
    const org = demo('org');
    item(org, '總公司').focus();
    await settle();
    const sink = org.querySelector<HTMLInputElement>('.tr-sink')!;
    expect(document.activeElement).toBe(sink);
    sink.dispatchEvent(new CompositionEvent('compositionstart', { data: '', bubbles: true }));
    sink.value = 'ㄘㄞˊ';
    sink.dispatchEvent(new CompositionEvent('compositionend', { data: '財', bubbles: true }));
    await settle();
    expect(sink.getAttribute('aria-activedescendant')).toBe(item(org, '財務部').id);
  });

  it('大量延遲載入：全部展開顯示進度並可停止；伺服器端搜尋照路徑載入並展開；關掉時說明只搜尋已載入的項目', async () => {
    const drive = demo('drive');
    const status = () => drive.querySelector('[data-demo-status]')!.textContent!.replace(/\s+/g, ' ').trim();
    drive.querySelector<HTMLButtonElement>('[data-demo-action="expand-drive"]')!.click();
    await settle();
    expect(status()).toContain('正在載入');
    expect(drive.querySelector('[data-demo-action="stop-drive"]')).not.toBeNull();
    expect(item(drive, '業務部').getAttribute('aria-busy')).toBe('true');
    await sleep(450);
    await settle();
    drive.querySelector<HTMLButtonElement>('[data-demo-action="stop-drive"]')!.click();
    await settle();
    await sleep(450);
    await settle();
    expect(status()).toMatch(/已停止：載入了 \d+ 個資料夾/);
    expect(names(drive)).toContain('2025 年');
    drive.querySelector<HTMLButtonElement>('[data-demo-action="reset-drive"]')!.click();
    await settle();
    expect(names(drive)).toEqual(['業務部', '財務部', '研發部', '人資部']);
    // 伺服器端搜尋：「Q3 損益」在 財務部 / 2025 年 / 2025 Q3 底下，還沒載入
    const search = drive.querySelector<HTMLInputElement>('[data-demo-search]')!;
    search.value = '2025Q3 損益';
    search.dispatchEvent(new Event('input'));
    await settle();
    await sleep(250 + 450 + 3 * 450);
    await settle();
    expect(names(drive)).toEqual(['財務部', '2025 年', '2025 Q3', '2025Q3 損益報表.xlsx']);
    expect(item(drive, '2025 Q3').getAttribute('aria-expanded')).toBe('true');
    // 關掉伺服器端搜尋：只比對已載入的項目，結果下方說明
    drive.querySelector<HTMLInputElement>('[data-demo-server] input')!.click();
    search.value = '招募';
    search.dispatchEvent(new Event('input'));
    await settle();
    expect(drive.querySelector('.tr-empty')?.textContent).toContain('找不到符合「招募」的項目');
    expect(drive.querySelector('.tr-search-note')?.textContent).toContain('只搜尋已載入的項目');
  });

  it('樹狀表：預設展開第一個專案；全部展開／全部收合；進度欄用狀態標籤＋百分比', async () => {
    const plan = demo('plan');
    const rowNames = () => Array.from(plan.querySelectorAll('tr[data-tree-row] .tt-name')).map((n) => n.textContent?.trim());
    expect(plan.querySelector('table')!.getAttribute('role')).toBe('treegrid');
    expect(rowNames()).toEqual(['官網改版', '需求訪談', '視覺設計', '開發上線', '帳務系統整併', '服務台流程優化']);
    const first = plan.querySelector('tr[data-tree-row]')!;
    expect(first.querySelectorAll('td')[2].textContent?.replace(/\s+/g, '')).toBe('進行中55%');
    expect(first.querySelectorAll('td')[3].textContent?.trim()).toBe('2026/12/18');
    plan.querySelector<HTMLButtonElement>('[data-demo-action="expand-all"]')!.click();
    await settle();
    expect(rowNames().length).toBe(21);
    plan.querySelector<HTMLButtonElement>('[data-demo-action="collapse-all"]')!.click();
    await settle();
    expect(rowNames()).toEqual(['官網改版', '帳務系統整併', '服務台流程優化']);
  });
});
