import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { formatLabel } from '../data-table/data-table-query';
import { ListViewController } from './list-view-controller';
import { SavedViewsLabels } from './saved-view.types';

type Mode = 'list' | 'saveAs' | 'rename' | 'remove';

let nextId = 0;

/**
 * 檢視切換器：預設檢視＋已儲存的檢視、「已修改」標示、儲存／另存新檢視／重新命名／刪除。
 * 狀態都在 ListViewController，這個元件只負責畫面。
 */
@Component({
  selector: 'lib-saved-views',
  imports: [OverlayModule, MatButtonModule],
  templateUrl: './saved-views.component.html',
  styleUrl: './saved-views.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavedViewsComponent {
  readonly controller = input.required<ListViewController>();
  readonly labels = input.required<SavedViewsLabels>();

  protected readonly uid = `lib-saved-views-${nextId++}`;
  protected readonly open = signal(false);
  protected readonly mode = signal<Mode>('list');
  protected readonly nameDraft = signal('');
  protected readonly nameError = signal<string | null>(null);

  private readonly injector = inject(Injector);
  private readonly trigger = viewChild('trigger', { read: ElementRef<HTMLButtonElement> });
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  ];

  protected readonly currentName = computed(
    () => this.controller().selectedView()?.name ?? this.labels().defaultView,
  );

  protected readonly triggerLabel = computed(() => formatLabel(this.labels().trigger, { name: this.currentName() }));

  protected readonly removeConfirmText = computed(() =>
    formatLabel(this.labels().removeConfirm, { name: this.currentName() }),
  );

  protected toggle(): void {
    if (this.open()) this.close();
    else {
      this.mode.set('list');
      this.open.set(true);
    }
  }

  protected close(returnFocus = true): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) this.trigger()?.nativeElement.focus();
  }

  protected onAttach(): void {
    this.focusFirst();
  }

  protected onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    // 在子畫面（另存、改名、刪除確認）按 Esc 先回清單，再按一次才關閉。
    if (this.mode() !== 'list') this.setMode('list');
    else this.close();
  }

  protected choose(id: string | null): void {
    this.controller().select(id);
    this.close();
  }

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    this.nameError.set(null);
    if (mode === 'saveAs') this.nameDraft.set('');
    if (mode === 'rename') this.nameDraft.set(this.controller().selectedView()?.name ?? '');
    this.focusFirst();
  }

  protected onNameInput(event: Event): void {
    this.nameDraft.set((event.target as HTMLInputElement).value);
    this.nameError.set(null);
  }

  protected async submitName(event: Event): Promise<void> {
    event.preventDefault();
    const name = this.nameDraft().trim();
    const ctrl = this.controller();
    const exceptId = this.mode() === 'rename' ? (ctrl.selectedId() ?? undefined) : undefined;
    if (!name) {
      this.nameError.set(this.labels().nameRequired);
      return;
    }
    if (ctrl.isNameTaken(name, exceptId)) {
      this.nameError.set(this.labels().nameTaken);
      return;
    }
    if (this.mode() === 'rename' && exceptId) await ctrl.rename(exceptId, name);
    else await ctrl.saveAs(name);
    this.close();
  }

  protected async saveCurrent(): Promise<void> {
    await this.controller().saveCurrent();
    this.close();
  }

  protected discard(): void {
    this.controller().discardChanges();
    this.close();
  }

  protected async confirmRemove(): Promise<void> {
    const id = this.controller().selectedId();
    if (id) await this.controller().remove(id);
    this.close();
  }

  private focusFirst(): void {
    afterNextRender(
      () => {
        const root = this.panel()?.nativeElement;
        const target =
          root?.querySelector<HTMLElement>('input') ??
          root?.querySelector<HTMLElement>('[aria-current="true"]') ??
          root?.querySelector<HTMLElement>('button');
        target?.focus();
      },
      { injector: this.injector },
    );
  }
}
