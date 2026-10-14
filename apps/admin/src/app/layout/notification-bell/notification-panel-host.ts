import { DestroyRef, EnvironmentInjector } from '@angular/core';
import {
  ConnectedPosition,
  OverlayRef,
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
  createRepositionScrollStrategy,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { EventType, Router } from '@angular/router';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';
import { NotificationPanelComponent } from './notification-panel.component';

const POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
];

interface PanelHost {
  bell: HTMLElement;
  overlayRef: OverlayRef;
  open(): void;
  close(focusBell: boolean): void;
}

let current: PanelHost | null = null;

/**
 * 打開或關上頁首的通知面板。NotificationCenterService.toggle() 第一次被呼叫時才動態載入這個檔案，
 * 面板與 lib-notification-list 跟著進同一個 lazy chunk（Initial bundle 只有鈴鐺按鈕與徽章）。
 *
 * 面板掛在 CDK overlay（Initial bundle 裡側欄已經用到同一份程式碼）：錨在鈴鐺下方、靠右對齊，放不下時翻到上方；
 * 600px 以下的滿版樣式在 notification-panel.component.scss。Esc 與點面板外面會關閉並讓焦點回到鈴鐺（點到別的
 * 可聚焦元素時讓它保有焦點），換頁時關閉。開關的結果寫回 `NotificationCenterService.panelOpen`（鈴鐺的 aria-expanded）。
 */
export function setNotificationPanel(open: boolean, injector: EnvironmentInjector): void {
  const bell = document.querySelector<HTMLElement>('.topbar-bell');
  if (!bell) return;
  if (current && current.bell !== bell) {
    current.overlayRef.dispose();
    current = null;
  }
  current ??= createPanelHost(bell, injector);
  if (open) current.open();
  else current.close(false);
}

function createPanelHost(bell: HTMLElement, injector: EnvironmentInjector): PanelHost {
  const center = injector.get(NotificationCenterService);
  const overlayRef = createOverlayRef(injector, {
    positionStrategy: createFlexibleConnectedPositionStrategy(injector, bell)
      .withPositions(POSITIONS)
      .withPush(true)
      .withViewportMargin(8),
    scrollStrategy: createRepositionScrollStrategy(injector),
    panelClass: 'app-notification-pane',
  });

  const host: PanelHost = {
    bell,
    overlayRef,
    open() {
      if (!overlayRef.hasAttached()) {
        const ref = overlayRef.attach(new ComponentPortal(NotificationPanelComponent, null, injector));
        ref.instance.closed.subscribe((focusBell) => host.close(focusBell));
      }
      center.panelOpen.set(true);
    },
    close(focusBell) {
      overlayRef.detach();
      center.panelOpen.set(false);
      if (focusBell) bell.focus();
    },
  };

  overlayRef.keydownEvents().subscribe((event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      host.close(true);
    }
  });
  overlayRef.outsidePointerEvents().subscribe((event) => {
    if (bell.contains(event.target as Node)) return; // 鈴鐺自己的點擊交給鈴鐺切換
    host.close(overlayRef.overlayElement.contains(document.activeElement));
  });
  const nav = injector.get(Router).events.subscribe((event) => {
    if (event.type === EventType.NavigationStart && center.panelOpen()) host.close(false);
  });

  injector.get(DestroyRef).onDestroy(() => {
    nav.unsubscribe();
    overlayRef.dispose();
    if (current === host) current = null;
  });
  return host;
}
