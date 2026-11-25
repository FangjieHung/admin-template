import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { DomPortal } from '@angular/cdk/portal';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

export type ResponsivePanelNarrowLayout = 'sheet' | 'fullscreen';

/** 面板改成浮層的斷點（lib-split-panel 用同一個值決定兩欄版面何時收掉）。 */
export const RESPONSIVE_PANEL_NARROW_QUERY = '(max-width: 1280px)';
const NARROW_QUERY = RESPONSIVE_PANEL_NARROW_QUERY;
const FOCUSABLE_SELECTOR =
  'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

@Component({
  selector: 'lib-responsive-panel',
  templateUrl: './responsive-panel.component.html',
  styleUrl: './responsive-panel.component.scss',
})
export class ResponsivePanelComponent {
  readonly open = input(false);
  readonly heading = input('');
  readonly closeLabel = input.required<string>();
  readonly showCloseButton = input(true);
  readonly showHeaderDivider = input(true);
  /**
   * 窄螢幕的樣子：`sheet` 從底部升起、最高 70vh（預設）；`fullscreen` 蓋滿整個畫面、從右側滑入
   * （面板裡是整份編輯表單時用，例如 lib-split-panel）。
   */
  readonly narrowLayout = input<ResponsivePanelNarrowLayout>('sheet');
  readonly closed = output<void>();

  private static nextId = 0;
  protected readonly headingId = `responsive-panel-heading-${ResponsivePanelComponent.nextId++}`;

  private readonly breakpointObserver = inject(BreakpointObserver);
  protected readonly isNarrow = toSignal(
    this.breakpointObserver.observe([NARROW_QUERY]).pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  private readonly overlay = inject(Overlay);
  private readonly wrapperRef = viewChild<ElementRef<HTMLElement>>('panelWrapper');
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');

  // Drives the template's @if instead of open() directly. Kept as a separate signal so the
  // "closing" effect below can synchronously detach the overlay portal (restoring the DOM node
  // to its inline position) *before* setting this false — if the template read open() directly,
  // Angular would tear down the @if view as part of the same change-detection pass that updates
  // the `open` input, which runs *before* our effect() gets a chance to run (effects flush after
  // template updates), orphaning the portaled node inside the CDK overlay instead of removing it.
  protected readonly renderContent = signal(false);

  private lastFocused: HTMLElement | null = null;
  /** 打開了、還沒處理焦點（等面板畫出來）。 */
  private pendingFocus = false;
  private overlayRef: OverlayRef | null = null;
  private domPortal: DomPortal | null = null;
  private portaledWrapper: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.renderContent.set(true);
      } else {
        this.detachOverlay();
        this.renderContent.set(false);
      }
    });

    // Narrow-mode content is relocated into a CDK Overlay (appended to document.body) instead of
    // staying inline, so the fixed backdrop/sheet can't be trapped inside an ancestor's stacking
    // context (e.g. Angular Material's .mat-drawer-content, which sets its own z-index and would
    // otherwise cap us below the app's mobile sidenav no matter how high our own z-index is).
    // DomPortal *moves* the already-rendered wrapper node rather than recreating it, so an
    // isNarrow() flip mid-open never disturbs focus or destroys projected content. This only
    // needs to react while the wrapper already exists — the effect above owns teardown.
    effect(() => {
      const wrapper = this.wrapperRef();
      if (!wrapper) return;
      if (this.isNarrow()) {
        this.attachOverlay(wrapper);
      } else {
        this.detachOverlay();
      }
    });

    // 焦點：只在「使用者打開」時把焦點移進面板。判斷方式是打開那一刻焦點停在頁面上的某個元素（點的那一列、
    // 按的按鈕；觸發元素要能取得焦點）——關閉後焦點還給它。頁面一載入就是開著的（例如網址帶著要編輯的 id），
    // 焦點還在 body 上：寬螢幕不搶焦點（不會出現焦點框）；窄螢幕是對話框，焦點放在面板本身（不畫焦點框），
    // Tab 從面板內開始。只看 open() 的轉換，不看 isNarrow，所以開著時縮放視窗不會重搶或歸還焦點。
    effect(() => {
      const open = this.open();
      untracked(() => {
        if (open) {
          const active = document.activeElement;
          this.lastFocused = active instanceof HTMLElement && active !== document.body ? active : null;
          this.pendingFocus = true;
        } else {
          this.pendingFocus = false;
          const target = this.lastFocused;
          this.lastFocused = null;
          if (target?.isConnected) target.focus();
        }
      });
    });

    // 面板畫出來之後才移焦點（每次打開都重建面板，panelRef 會換一個）。
    effect(() => {
      const panel = this.panelRef()?.nativeElement;
      if (!panel || !this.pendingFocus) return;
      this.pendingFocus = false;
      untracked(() => {
        if (panel.contains(document.activeElement)) return;
        if (this.lastFocused) this.focusableElements()[0]?.focus();
        else if (this.isNarrow()) panel.focus({ preventScroll: true });
      });
    });

    // Scroll lock (always reflects current open && isNarrow state)
    effect(() => {
      document.body.style.overflow = this.open() && this.isNarrow() ? 'hidden' : '';
    });

    inject(DestroyRef).onDestroy(() => {
      this.detachOverlay();
      // 使用端用 @if 直接拿掉開著的面板（日曆頁、排程頁的作法）：open 沒有變回 false，上面的歸還不會發生。
      // 等 DOM 拿掉之後，焦點若掉回 body（原本在面板裡），還給打開面板的元素。
      const target = this.lastFocused;
      if (!target) return;
      queueMicrotask(() => {
        const active = document.activeElement;
        if (target.isConnected && (!active || active === document.body)) target.focus();
      });
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.closed.emit();
  }

  protected onTrapKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.isNarrow()) return;
    const focusables = this.focusableElements();
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private attachOverlay(wrapper: ElementRef<HTMLElement>): void {
    if (this.overlayRef) return;
    const active = document.activeElement as HTMLElement | null;
    const hadFocus = !!active && wrapper.nativeElement.contains(active);
    this.overlayRef = this.overlay.create({ positionStrategy: this.overlay.position().global() });
    this.domPortal = new DomPortal(wrapper);
    this.portaledWrapper = wrapper.nativeElement;
    this.overlayRef.attach(this.domPortal);
    // jsdom (unlike real browsers) blurs an element when it's reparented via appendChild, even
    // within the same document — restore focus explicitly so the move itself is never observable.
    if (hadFocus) active?.focus();
  }

  private detachOverlay(): void {
    if (!this.domPortal) return;
    const active = document.activeElement as HTMLElement | null;
    const hadFocus = !!active && !!this.portaledWrapper?.contains(active);
    if (this.domPortal.isAttached) {
      this.domPortal.detach();
    }
    this.domPortal = null;
    this.portaledWrapper = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
    if (hadFocus) active?.focus();
  }

  private focusableElements(): HTMLElement[] {
    const root = this.panelRef()?.nativeElement ?? this.wrapperRef()?.nativeElement ?? null;
    return root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : [];
  }
}
