import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SkeletonComponent, ToastService } from '@admin-template/ui';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  NotificationChannelId,
  NotificationEventId,
  NotificationMatrix,
} from '../data/account-settings.model';
import { AccountSettingsRepository } from '../data/account-settings.repository';

/**
 * 通知（即時儲存）：一張「事件 × 管道」的勾選表，改了就存並提示「已更新」；失敗時把勾選還原並提示錯誤。
 * 「全部暫停」開啟時其他項目停用（個別設定保留）。沒有「儲存」按鈕，也不需要未存提醒。
 */
@Component({
  selector: 'app-notifications-section',
  imports: [MatSlideToggleModule, SkeletonComponent],
  templateUrl: './notifications-section.component.html',
  styleUrls: ['./settings-section.scss', './notifications-section.component.scss'],
})
export class NotificationsSectionComponent {
  private readonly repo = inject(AccountSettingsRepository);
  private readonly toast = inject(ToastService);
  /** 示範：網址帶 ?demo=fail 時，所有即時儲存都失敗。 */
  private readonly simulateError = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((q) => q.get('demo') === 'fail')),
    { initialValue: false },
  );

  protected readonly events = NOTIFICATION_EVENTS;
  protected readonly channels = NOTIFICATION_CHANNELS;

  protected readonly loading = signal(true);
  protected readonly paused = signal(false);
  protected readonly matrix = signal<NotificationMatrix | null>(null);
  /** 正在儲存的項目（`<事件>.<管道>` 或 `paused`）：儲存中先停用，避免連點。 */
  protected readonly pending = signal<ReadonlySet<string>>(new Set());

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const settings = await this.repo.notifications();
    this.paused.set(settings.paused);
    this.matrix.set(settings.matrix);
    this.loading.set(false);
  }

  protected isPending(key: string): boolean {
    return this.pending().has(key);
  }

  protected async toggle(event: NotificationEventId, channel: NotificationChannelId, change: Event): Promise<void> {
    const input = change.target as HTMLInputElement;
    const enabled = input.checked;
    const key = `${event}.${channel}`;
    const name = `「${this.eventLabel(event)}」的${this.channelLabel(channel)}通知`;
    // 先更新畫面（樂觀更新），失敗再改回來：勾選框的 [checked] 綁定跟著 signal 走，還原時才會真的取消勾選。
    this.setCell(event, channel, enabled);
    this.setPending(key, true);
    try {
      await this.repo.setNotification(event, channel, enabled, { simulateError: this.simulateError() });
      this.toast.success(`已更新：${name}${enabled ? '開啟' : '關閉'}`);
    } catch {
      this.setCell(event, channel, !enabled);
      this.toast.error(`無法更新${name}，已還原。請再試一次。`);
    } finally {
      this.setPending(key, false);
    }
  }

  protected async setPaused(change: MatSlideToggleChange): Promise<void> {
    const paused = change.checked;
    this.paused.set(paused);
    this.setPending('paused', true);
    try {
      await this.repo.setNotificationsPaused(paused, { simulateError: this.simulateError() });
      this.toast.success(paused ? '已更新：所有通知已暫停' : '已更新：通知已恢復');
    } catch {
      // 開關的 [checked] 綁定跟著 signal 走（上面已先改成新值），改回來開關就會跟著還原。
      this.paused.set(!paused);
      this.toast.error('無法更新「全部暫停」，已還原。請再試一次。');
    } finally {
      this.setPending('paused', false);
    }
  }

  private setCell(event: NotificationEventId, channel: NotificationChannelId, enabled: boolean): void {
    this.matrix.update((m) => (m ? { ...m, [event]: { ...m[event], [channel]: enabled } } : m));
  }

  private setPending(key: string, on: boolean): void {
    this.pending.update((set) => {
      const next = new Set(set);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  private eventLabel(id: NotificationEventId): string {
    return this.events.find((e) => e.id === id)?.label ?? id;
  }

  private channelLabel(id: NotificationChannelId): string {
    return this.channels.find((c) => c.id === id)?.label ?? id;
  }
}
