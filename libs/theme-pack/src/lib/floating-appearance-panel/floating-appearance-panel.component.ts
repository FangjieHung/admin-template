import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { AppearancePanelService } from '../theme/appearance-panel.service';
import { ThemeService } from '../theme/theme.service';
import { texture } from '../theme/theme.token';

// ticket 03（外觀浮動面板）：開關在設定頁（AppearancePanelService.visible），開啟後這個元件
// 掛在 app shell 裡，每一頁角落都有一顆常駐按鈕。質地／配色的過濾邏輯全部重用 ThemeService，
// 這裡不重抄相容配色清單（ADR 0007）。
// 樣式只用語意 token（--mat-sys-*）與 .ui-card（見 CONTRACT.md），質地換了外觀跟著換，
// 不寫死任何色碼。
@Component({
  selector: 'lib-floating-appearance-panel',
  standalone: true,
  imports: [A11yModule],
  templateUrl: './floating-appearance-panel.component.html',
  styleUrl: './floating-appearance-panel.component.scss',
})
export class FloatingAppearancePanelComponent {
  protected readonly panel = inject(AppearancePanelService);
  protected readonly theme = inject(ThemeService);
  protected readonly texture = texture;
  // ADR 0007：配色列只顯示目前質地的相容配色，過濾邏輯在 ThemeService，這裡不重抄。
  protected readonly colorThemes = this.theme.compatibleThemes;

  protected open = false;

  @ViewChild('triggerBtn') private triggerBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('panelEl') private panelEl?: ElementRef<HTMLElement>;

  private readonly hostRef = inject(ElementRef<HTMLElement>);

  protected toggleOpen(): void {
    this.open = !this.open;
  }

  protected closeAndFocusTrigger(): void {
    this.open = false;
    this.triggerBtn?.nativeElement.focus();
  }

  protected onParadigm(id: string): void {
    this.theme.setParadigm(id);
  }

  protected onTheme(id: string): void {
    this.theme.setTheme(id);
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
    if (!this.open) {
      return;
    }
    if (!this.hostRef.nativeElement.contains(event.target as Node)) {
      this.open = false;
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
}
