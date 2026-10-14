import { DestroyRef, EnvironmentInjector } from '@angular/core';
import { OverlayRef, createBlockScrollStrategy, createGlobalPositionStrategy, createOverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { EventType, Router } from '@angular/router';
import { CommandPaletteDialogComponent } from './command-palette-dialog.component';

interface PaletteHost {
  overlayRef: OverlayRef;
  /** 打開前的焦點（頁首的搜尋鈕、展示頁的按鈕…），關閉時還給它。 */
  returnTo: HTMLElement | null;
}

let current: PaletteHost | null = null;

/** 全域指令面板開著沒有。 */
export function isCommandPaletteOpen(): boolean {
  return !!current?.overlayRef.hasAttached();
}

/**
 * 打開、關上或切換頁首的全域指令面板（⌘K／Ctrl+K、`/`、頁首的搜尋鈕）。頁首第一次呼叫時才動態載入這個檔案，
 * 對話框、lib-command-palette 與三組結果來源（app-command-providers.ts）都在同一個 lazy chunk。
 *
 * 對話框掛在 CDK overlay（Initial bundle 裡側欄已經用到同一份程式碼）：桌機水平置中、離頂端 12vh（畫面上三分之一），
 * 600px 以下滿版（command-palette-dialog.component.ts）；有遮罩、背景不能捲動、Tab 留在搜尋框。
 * 點遮罩、Esc（查詢空白時）、執行了項目、換頁都會關閉，焦點回到打開前的位置。
 */
export function toggleCommandPalette(injector: EnvironmentInjector, open = !isCommandPaletteOpen()): void {
  current ??= createHost(injector);
  if (open) openPalette(current, injector);
  else closePalette(current);
}

function openPalette(host: PaletteHost, injector: EnvironmentInjector): void {
  if (host.overlayRef.hasAttached()) return;
  host.returnTo = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
  const ref = host.overlayRef.attach(new ComponentPortal(CommandPaletteDialogComponent, null, injector));
  ref.instance.ran.subscribe(() => closePalette(host));
  ref.instance.closed.subscribe(() => closePalette(host));
}

function closePalette(host: PaletteHost): void {
  if (!host.overlayRef.hasAttached()) return;
  host.overlayRef.detach();
  const target = host.returnTo?.isConnected ? host.returnTo : document.querySelector<HTMLElement>('.topbar-search');
  host.returnTo = null;
  target?.focus();
}

function createHost(injector: EnvironmentInjector): PaletteHost {
  const overlayRef = createOverlayRef(injector, {
    positionStrategy: createGlobalPositionStrategy(injector).centerHorizontally().top('12vh'),
    scrollStrategy: createBlockScrollStrategy(injector),
    hasBackdrop: true,
    backdropClass: 'cdk-overlay-dark-backdrop',
    panelClass: 'app-cmdk-pane',
  });
  const host: PaletteHost = { overlayRef, returnTo: null };

  overlayRef.backdropClick().subscribe(() => closePalette(host));
  // 搜尋框自己處理 Esc（先清空查詢、再回上一層）；焦點不在搜尋框時（例如點了清單的空白處）由這裡關閉。
  overlayRef.keydownEvents().subscribe((event) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      closePalette(host);
    }
  });
  const nav = injector.get(Router).events.subscribe((event) => {
    if (event.type === EventType.NavigationStart && overlayRef.hasAttached()) closePalette(host);
  });

  injector.get(DestroyRef).onDestroy(() => {
    nav.unsubscribe();
    overlayRef.dispose();
    if (current === host) current = null;
  });
  return host;
}
