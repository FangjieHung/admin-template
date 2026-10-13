import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ScrollShadowDirective } from './scroll-shadow.directive';

/** jsdom 沒有版面：scrollHeight／clientHeight 手動指定，ResizeObserver 換成可手動觸發的替身。 */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed = new Set<Element>();
  disconnected = false;
  constructor(private readonly cb: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.observed.clear();
    this.disconnected = true;
  }
  fire() {
    this.cb([], this as unknown as ResizeObserver);
  }
}

function setMetrics(el: HTMLElement, m: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => m.scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => m.clientHeight });
  // jsdom 會把 scrollTop 夾成 0（沒有版面），改成可寫的屬性。
  Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: m.scrollTop });
}

@Component({
  imports: [ScrollShadowDirective],
  template: `
    @if (show()) {
      <div class="host" libScrollShadow=".scroller">
        <div class="scroller">
          <div class="step">a</div>
          @if (extraStep()) {
            <div class="step extra">b</div>
          }
        </div>
      </div>
    }
  `,
})
class HostComponent {
  readonly show = signal(true);
  readonly extraStep = signal(false);
}

describe('ScrollShadowDirective', () => {
  let originalRO: typeof ResizeObserver | undefined;

  beforeEach(() => {
    originalRO = globalThis.ResizeObserver;
    FakeResizeObserver.instances = [];
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalRO as typeof ResizeObserver;
  });

  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const scroller = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.scroller')!;
    return { fixture, scroller, ro: FakeResizeObserver.instances[0] };
  }

  it('依捲動位置切換 has-more-above／has-more-below（頂／中／底），各留 1px 容差', async () => {
    const { scroller } = await setup();
    const scrollTo = (top: number) => {
      setMetrics(scroller, { scrollHeight: 911, clientHeight: 461, scrollTop: top });
      scroller.dispatchEvent(new Event('scroll'));
    };

    scrollTo(0);
    expect(scroller.classList.contains('has-more-above')).toBe(false);
    expect(scroller.classList.contains('has-more-below')).toBe(true);

    scrollTo(200);
    expect(scroller.classList.contains('has-more-above')).toBe(true);
    expect(scroller.classList.contains('has-more-below')).toBe(true);

    scrollTo(450); // 差 1px 到底：視為到底
    expect(scroller.classList.contains('has-more-above')).toBe(true);
    expect(scroller.classList.contains('has-more-below')).toBe(false);

    scrollTo(1); // 1px 以內視為在頂
    expect(scroller.classList.contains('has-more-above')).toBe(false);
  });

  it('內容沒有溢出時兩個 class 都沒有', async () => {
    const { scroller, ro } = await setup();
    setMetrics(scroller, { scrollHeight: 300, clientHeight: 461, scrollTop: 0 });
    ro.fire();
    expect(scroller.classList.contains('has-more-above')).toBe(false);
    expect(scroller.classList.contains('has-more-below')).toBe(false);
  });

  it('觀察容器與各步驟內容的尺寸；內容長高（例如切換步驟）時不用捲動也會更新', async () => {
    const { scroller, ro } = await setup();
    expect(ro.observed.has(scroller)).toBe(true);
    expect(ro.observed.has(scroller.querySelector('.step')!)).toBe(true);

    setMetrics(scroller, { scrollHeight: 300, clientHeight: 461, scrollTop: 0 });
    ro.fire();
    expect(scroller.classList.contains('has-more-below')).toBe(false);

    setMetrics(scroller, { scrollHeight: 911, clientHeight: 461, scrollTop: 0 });
    ro.fire();
    expect(scroller.classList.contains('has-more-below')).toBe(true);
  });

  it('新增的步驟內容節點也會被觀察', async () => {
    const { fixture, scroller, ro } = await setup();
    fixture.componentInstance.extraStep.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0)); // MutationObserver 回呼是 microtask
    expect(ro.observed.has(scroller.querySelector('.extra')!)).toBe(true);
  });

  it('銷毀時移除 scroll 監聽並停止所有觀察', async () => {
    const { fixture, scroller, ro } = await setup();
    const removeSpy = vi.spyOn(scroller, 'removeEventListener');

    fixture.componentInstance.show.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(ro.disconnected).toBe(true);
    expect(ro.observed.size).toBe(0);

    // 監聽已拿掉：再捲動不會改 class
    setMetrics(scroller, { scrollHeight: 911, clientHeight: 461, scrollTop: 200 });
    scroller.dispatchEvent(new Event('scroll'));
    expect(scroller.classList.contains('has-more-above')).toBe(false);
  });
});
