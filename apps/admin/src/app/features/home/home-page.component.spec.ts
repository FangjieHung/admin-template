import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { HomePageComponent } from './home-page.component';
import { PLANNED_ITEMS } from '../../showcase/showcase-catalog';

describe('HomePageComponent（首頁）', () => {
  let el: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: HomePageComponent }])] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', HomePageComponent);
    el = harness.routeNativeElement as HTMLElement;
    harness.detectChanges();
  });

  it('規劃中清單是空的時候，不顯示「規劃中」的數字與篩選鈕，並說明清單已完成', () => {
    expect(PLANNED_ITEMS.length).toBe(0);
    const captions = Array.from(el.querySelectorAll('.home__stats .ui-text-caption')).map((n) => n.textContent?.trim());
    expect(captions).toEqual(['已完成的元件與樣板頁']);
    expect(el.querySelector('.home__filter')).toBeNull();
    expect(el.querySelector('.home__note')?.textContent).toContain('清單上的項目都已完成');
  });
});
