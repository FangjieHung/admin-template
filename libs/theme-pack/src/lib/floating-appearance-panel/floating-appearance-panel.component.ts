import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { CdkDragEnd, CdkDragStart, DragDropModule } from '@angular/cdk/drag-drop';
import { AppearancePanelService } from '../theme/appearance-panel.service';
import { ThemeService } from '../theme/theme.service';
import { texture } from '../theme/theme.token';
import {
  Offset,
  POSITION_STORAGE_KEY,
  PanelAnchor,
  clampOffset,
  computePanelAnchor,
  defaultOffset,
  moveOffsetByKey,
  parseStoredOffset,
  serializeOffset,
} from './floating-appearance-panel.position';

// ticket 03（外觀浮動面板）：開關在設定頁（AppearancePanelService.visible），開啟後每一頁角落都有
// 一顆常駐按鈕，可拖曳停到不擋路的地方。
//
// 走查記錄（coordinator 要求，17 條路徑 × 1280／390 兩個寬度）：先試過把按鈕釘死在視窗四個角落
// 各一輪，全部撞到東西——桌機寬度下跟每個列表頁頁首的主要操作鈕（「新增」…）重疊、
// 手機寬度下跟搜尋圖示鈕、page-toolbar 的固定操作列、滿版頁鋪到視窗底都疊到過。
// 後來改成掛進頁首的 flex 排版（不疊，因為 flexbox 天生不重疊），但使用者看過後選了另一個方向：
// 維持真正的 position: fixed 浮動，改成「可拖曳」——把「這個角落安不安全」的判斷權交給使用者，
// 讓他自己拖到當下這頁不擋路的地方，而不是由這顆元件自己去猜。定位運算（拖曳位移量、
// 邊界夾回、鍵盤移動、面板開啟方向）都抽成不碰 DOM 的純函式，見同目錄的
// floating-appearance-panel.position.ts，方便直接單元測試。
//
// 這個 app 是 zoneless（package.json 沒有 zone.js），開關狀態、位移量、面板錨點都用 signal
// 存，不是一般欄位——一開始用一般欄位在 MutationObserver callback 裡指派新值，數字算對了，
// 畫面卻沒更新（zoneless 只認 signal／事件綁定觸發的變更偵測，不會理會 MutationObserver 這種
// 直接呼叫瀏覽器 API 產生的 callback），實測換頁到長表單頁時按鈕沒有如預期往上頂開才發現。
@Component({
  selector: 'lib-floating-appearance-panel',
  standalone: true,
  imports: [A11yModule, DragDropModule],
  templateUrl: './floating-appearance-panel.component.html',
  styleUrl: './floating-appearance-panel.component.scss',
})
export class FloatingAppearancePanelComponent implements OnInit, OnDestroy {
  protected readonly panel = inject(AppearancePanelService);
  protected readonly theme = inject(ThemeService);
  protected readonly texture = texture;
  // ADR 0007：配色列只顯示目前質地的相容配色，過濾邏輯在 ThemeService，這裡不重抄。
  protected readonly colorThemes = this.theme.compatibleThemes;

  protected readonly open = signal(false);
  // 按鈕相對於原生右下角位置（bottom/right: 16px）的位移量；同時餵給 CDK 的
  // cdkDragFreeDragPosition（語意完全一致：從原生位置再位移多少）與我們自己的鍵盤移動、
  // resize 夾回邏輯。
  protected readonly offset = signal<Offset>({ x: 0, y: 0 });
  // 面板開啟時的錨定位置（往上/下、左/右展開＋可用高度），開啟當下與 resize 時重算一次。
  protected readonly anchor = signal<PanelAnchor>({ maxHeight: 480 });

  // 使用者是否已經自己拖／按過鍵盤移動過：一旦是 true，就不再用「貼底 sticky 列」那套自動避讓，
  // 使用者自己選的位置只在 resize 時夾回視窗內，不會被自動搬走（除非按「重設位置」）。
  private hasCustomPosition = false;
  // 分辨「拖曳」跟「點擊」：cdkDragStarted 只有實際移動超過門檻才會觸發，click 在 mouseup 之後
  // 才發生，所以在這裡設一次性旗標，click handler 判斷完立刻歸零。
  private draggedThisGesture = false;
  private recomputeDefaultTimer?: ReturnType<typeof setTimeout>;
  private mutationObserver?: MutationObserver;

  @ViewChild('triggerBtn') private triggerBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('panelEl') private panelEl?: ElementRef<HTMLElement>;

  private readonly hostRef = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    this.loadPosition();
    // 貼底 sticky 列（page-toolbar 的 .toolbar-actions、長表單頁的貼底操作列）
    // 會隨路由出現/消失；這個元件是單一實例掛在殼層，不會隨路由重建，用 MutationObserver
    // 盯 document.body 的變動，換頁時（router-outlet 換內容）重算一次預設位置需不需要讓位。
    // 只有「使用者還沒自己拖過」時才自動調整，已經自訂過位置的話尊重使用者的選擇。
    this.mutationObserver = new MutationObserver(() => this.scheduleRecomputeDefault());
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.mutationObserver?.disconnect();
    clearTimeout(this.recomputeDefaultTimer);
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    if (this.hasCustomPosition) {
      const clamped = clampOffset(this.offset(), viewport);
      this.offset.set(clamped);
      this.persistPosition();
    } else {
      this.offset.set(defaultOffset(this.computeBottomClearance()));
    }
    if (this.open()) {
      this.computeAnchor();
    }
  }

  protected toggleOpen(): void {
    const next = !this.open();
    this.open.set(next);
    if (next) {
      this.computeAnchor();
      // ADR 0010／0013：面板一打開就在背景預先下載所有按需質地與按需配色，之後點選時多半不用等網路。
      this.theme.prefetchTextures();
      this.theme.prefetchColors();
    }
  }

  protected closeAndFocusTrigger(): void {
    this.open.set(false);
    this.triggerBtn?.nativeElement.focus();
  }

  protected onParadigm(id: string): void {
    // 按需質地載入完成才會真的切換（ADR 0010），失敗時 ThemeService 自己退回並提示，這裡不用等。
    void this.theme.setParadigm(id);
  }

  protected onTheme(id: string): void {
    // 按需配色載入完成才會真的切換（ADR 0013），失敗時 ThemeService 自己退回並提示，這裡不用等。
    void this.theme.setTheme(id);
  }

  protected onTriggerClick(): void {
    // 剛拖完放開滑鼠/手指也會補發一個 click；拖曳當下不是使用者「開面板」的意圖，吃掉這次點擊。
    if (this.draggedThisGesture) {
      this.draggedThisGesture = false;
      return;
    }
    this.toggleOpen();
  }

  protected onDragStarted(_event: CdkDragStart): void {
    this.draggedThisGesture = true;
  }

  protected onDragEnded(event: CdkDragEnd): void {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const raw = event.source.getFreeDragPosition();
    const clamped = clampOffset({ x: raw.x, y: raw.y }, viewport);
    this.hasCustomPosition = true;
    this.offset.set(clamped);
    if (clamped.x !== raw.x || clamped.y !== raw.y) {
      // 邊界元件理論上已經擋住了，這裡是保險：真的被拖出視窗外一點點時同步夾回去。
      event.source.setFreeDragPosition(clamped);
    }
    this.persistPosition();
  }

  // Alt+方向鍵／Shift+方向鍵移動 16px 一步（WCAG 2.5.7 的鍵盤替代方案），觸發按鈕本身要先聚焦。
  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (!event.altKey && !event.shiftKey) {
      return;
    }
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const moved = moveOffsetByKey(this.offset(), event.key, viewport);
    if (!moved) {
      return;
    }
    event.preventDefault();
    this.hasCustomPosition = true;
    this.offset.set(moved);
    this.persistPosition();
  }

  // 面板裡的「重設位置」：回到動態預設值（右下角，貼底 sticky 列存在時往上頂開），
  // 並清掉使用者存過的自訂位置。
  protected resetPosition(): void {
    this.hasCustomPosition = false;
    localStorage.removeItem(POSITION_STORAGE_KEY);
    this.offset.set(defaultOffset(this.computeBottomClearance()));
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        event.stopPropagation();
        this.closeAndFocusTrigger();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        this.moveFocus(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        this.moveFocus(-1);
        break;
    }
  }

  // 面板開啟時點外面（非觸發按鈕、非面板內）就關閉；不還原焦點——只有 Esc 需要把焦點還給按鈕。
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) {
      return;
    }
    if (!this.hostRef.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  private moveFocus(delta: number): void {
    const root = this.panelEl?.nativeElement;
    if (!root) {
      return;
    }
    const options = Array.from(root.querySelectorAll<HTMLButtonElement>('button.theme-pill'));
    if (options.length === 0) {
      return;
    }
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = (current + delta + options.length) % options.length;
    options[nextIndex]?.focus();
  }

  private loadPosition(): void {
    const stored = parseStoredOffset(localStorage.getItem(POSITION_STORAGE_KEY));
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    if (stored) {
      this.hasCustomPosition = true;
      this.offset.set(clampOffset(stored, viewport));
    } else {
      this.hasCustomPosition = false;
      this.offset.set(defaultOffset(this.computeBottomClearance()));
    }
  }

  private persistPosition(): void {
    localStorage.setItem(POSITION_STORAGE_KEY, serializeOffset(this.offset()));
  }

  private scheduleRecomputeDefault(): void {
    if (this.hasCustomPosition) {
      return;
    }
    clearTimeout(this.recomputeDefaultTimer);
    this.recomputeDefaultTimer = setTimeout(() => {
      this.offset.set(defaultOffset(this.computeBottomClearance()));
    }, 120);
  }

  /**
   * 貼底 sticky／fixed 列目前實際佔用的高度：page-toolbar 的 .toolbar-actions（行動版操作列）、
   * 長表單頁的貼底操作列。直接量 DOM（getBoundingClientRect + computed position），
   * 不寫死任何頁面專屬的數字或 class 判斷式以外的邏輯——哪一頁有這兩個 class、贴不贴底完全由
   * 當下渲染出來的樣式決定。
   */
  private computeBottomClearance(): number {
    const selectors = ['.toolbar-actions', '.order-create__footer'];
    let clearance = 0;
    for (const selector of selectors) {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) {
        continue;
      }
      const position = getComputedStyle(el).position;
      const pinnedToBottom = (position === 'fixed' || position === 'sticky') && rect.bottom >= window.innerHeight - 2;
      if (pinnedToBottom) {
        clearance = Math.max(clearance, rect.height + 8);
      }
    }
    return clearance;
  }

  private computeAnchor(): void {
    const btn = this.triggerBtn?.nativeElement;
    if (!btn) {
      return;
    }
    const rect = btn.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    this.anchor.set(
      computePanelAnchor({ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }, viewport),
    );
  }
}
