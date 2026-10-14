import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ImportWizardLabels, formatImportLabel } from './import-wizard-labels';
import { ImportPlan } from './import-rows';
import { ImportResult } from './import-wizard.types';

/**
 * 匯入精靈的最後一步（內部元件，不從 index.ts 匯出）：匯入前的摘要、匯入中的進度與「停止匯入」、結束後的結果。
 */
@Component({
  selector: 'lib-import-run',
  imports: [MatButtonModule, MatProgressBarModule],
  templateUrl: './import-run.component.html',
  styleUrl: './import-run.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportRunComponent {
  readonly labels = input.required<ImportWizardLabels>();
  readonly phase = input.required<'idle' | 'running' | 'done'>();
  readonly plan = input.required<ImportPlan<unknown>>();
  readonly progress = input.required<{ done: number; total: number }>();
  readonly result = input<ImportResult | null>(null);
  /** 錯誤報告裡有幾列（0 時不顯示下載鈕）。 */
  readonly reportCount = input(0);

  readonly stop = output<void>();
  readonly downloadReport = output<void>();
  readonly done = output<void>();
  readonly again = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly announcement = signal('');

  protected readonly summary = computed(() => {
    const plan = this.plan();
    return formatImportLabel(this.labels().importSummary, {
      create: plan.create,
      update: plan.update,
      skip: plan.invalid.length + plan.duplicates.length,
    });
  });

  protected readonly percent = computed(() => {
    const { done, total } = this.progress();
    return total ? Math.round((done / total) * 100) : 0;
  });

  protected readonly progressText = computed(() => formatImportLabel(this.labels().progressText, this.progress()));

  protected readonly stats = computed(() => {
    const result = this.result();
    const labels = this.labels();
    if (!result) return [];
    return [
      { key: 'created', label: labels.resultCreated, value: result.created },
      { key: 'updated', label: labels.resultUpdated, value: result.updated },
      { key: 'skipped', label: labels.resultSkipped, value: result.skipped },
      { key: 'failed', label: labels.resultFailed, value: result.failed.length },
    ];
  });

  constructor() {
    // 結束時念出結果，焦點移到結果標題（底部按鈕已經收起來了）。
    effect(() => {
      const result = this.result();
      if (!result || this.phase() !== 'done') return;
      const labels = this.labels();
      const text = formatImportLabel(labels.announceResult, {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed.length,
      });
      this.announcement.set(result.canceled ? `${labels.resultCanceledTitle}。${text}` : text);
      afterNextRender(
        { write: () => this.host.nativeElement.querySelector<HTMLElement>('[data-result-title]')?.focus() },
        { injector: this.injector },
      );
    });
  }

  protected failedText(row: number, message: string): string {
    return formatImportLabel(this.labels().failedRow, { row, message });
  }

  protected canceledText(result: ImportResult): string {
    return formatImportLabel(this.labels().canceledNote, { count: result.created + result.updated });
  }
}
