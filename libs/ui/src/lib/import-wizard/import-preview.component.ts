import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DataTableComponent } from '../data-table/data-table.component';
import { DataTableCellDirective } from '../data-table/data-table-cell.directive';
import { DataTableColumn } from '../data-table/data-table.types';
import { StatusChipComponent } from '../status-chip/status-chip.component';
import { ImportWizardLabels, formatImportLabel } from './import-wizard-labels';
import { ImportDuplicateMode, ImportField, ImportRow, ImportSchema } from './import-wizard.types';

/** 預覽裡改了一格。 */
export interface ImportCellEdit {
  index: number;
  key: string;
  text: string;
}

let nextId = 0;

/** 欄位 key 在資料表裡的欄位識別（避免跟列號、狀態欄撞名）。 */
const COL = (key: string) => `f:${key}`;

/**
 * 匯入精靈的「預覽與檢查」（內部元件，不從 index.ts 匯出）：資料表列出每一列，有錯的格子標出圖示與訊息，
 * 點一下直接修改（Enter 確定、Esc 取消）；「下一個問題」把焦點移到下一個有錯的格子（會自動換頁）。
 */
@Component({
  selector: 'lib-import-preview',
  imports: [ReactiveFormsModule, MatButtonModule, DataTableComponent, DataTableCellDirective, StatusChipComponent],
  templateUrl: './import-preview.component.html',
  styleUrl: './import-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportPreviewComponent {
  readonly schema = input.required<ImportSchema>();
  readonly rows = input.required<readonly ImportRow[]>();
  readonly form = input.required<FormGroup>();
  readonly labels = input.required<ImportWizardLabels>();
  /** 正在用 `findExisting` 比對現有資料。 */
  readonly checking = input(false);
  /** `findExisting` 失敗。 */
  readonly existingFailed = input(false);

  readonly edit = output<ImportCellEdit>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly onlyProblems = signal(false);
  protected readonly page = signal(0);
  protected readonly pageSize = signal(25);
  protected readonly editing = signal<{ index: number; key: string } | null>(null);
  protected readonly announcement = signal('');

  protected readonly uid = `lib-import-preview-${nextId++}`;
  /** 重複的處理方式（表單的 mode；radio 自己接，才能用不重複的 name）。 */
  protected readonly mode = signal<ImportDuplicateMode>('skip');
  protected readonly modes = computed(() => {
    const labels = this.labels();
    return [
      { value: 'skip' as const, label: labels.duplicateSkip },
      { value: 'update' as const, label: labels.duplicateUpdate },
      { value: 'create' as const, label: labels.duplicateCreate },
    ];
  });

  protected readonly rowId = (row: ImportRow) => row.index;
  protected readonly colOf = COL;

  protected readonly problemCount = computed(() => this.rows().filter(hasErrors).length);
  protected readonly readyCount = computed(() => this.rows().length - this.problemCount());
  protected readonly duplicateCount = computed(() => this.rows().filter((r) => r.duplicate).length);
  protected readonly displayRows = computed(() =>
    this.onlyProblems() ? this.rows().filter(hasErrors) : this.rows(),
  );
  protected readonly keyLabel = computed(() => this.schema().fields.find((f) => f.key === this.schema().key)?.label ?? '');

  protected readonly columns = computed<DataTableColumn<ImportRow>[]>(() => {
    const labels = this.labels();
    return [
      { key: 'row', virtual: true, label: labels.rowNumber, value: (r) => r.row, primary: true, frozen: true, align: 'end' },
      // 狀態放在列號後面：欄位多、表格要橫向捲動時，也一眼看得到哪幾列有問題。
      { key: 'status', virtual: true, label: labels.rowStatus, value: (r) => this.statusText(r), primary: true },
      ...this.schema().fields.map<DataTableColumn<ImportRow>>((field) => ({
        key: COL(field.key),
        virtual: true,
        label: field.required ? `${field.label} *` : field.label,
        value: (r) => r.raw[field.key] ?? '',
        primary: true,
      })),
    ];
  });

  /** 依畫面順序列出所有有錯的格子。 */
  private readonly problems = computed(() => {
    const fields = this.schema().fields;
    const list: { position: number; index: number; key: string }[] = [];
    this.displayRows().forEach((row, position) => {
      for (const field of fields) if (field.key in row.errors) list.push({ position, index: row.index, key: field.key });
    });
    return list;
  });

  constructor() {
    effect((onCleanup) => {
      const control = this.form().controls['mode'];
      if (!control) return;
      this.mode.set(control.value);
      const sub = control.valueChanges.subscribe((value: ImportDuplicateMode) => this.mode.set(value));
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected setMode(mode: ImportDuplicateMode): void {
    this.form().controls['mode']?.setValue(mode);
  }

  protected asRow(row: unknown): ImportRow {
    return row as ImportRow;
  }

  protected count(template: string, count: number): string {
    return formatImportLabel(template, { count });
  }

  protected duplicatesTitle(): string {
    return formatImportLabel(this.labels().duplicatesTitle, { count: this.duplicateCount(), field: this.keyLabel() });
  }

  protected statusText(row: ImportRow): string {
    const labels = this.labels();
    if (hasErrors(row)) return labels.statusProblem;
    if (row.duplicate?.kind === 'file') return formatImportLabel(labels.statusDuplicateFile, { row: row.duplicate.firstRow });
    if (row.duplicate?.kind === 'existing') return labels.statusDuplicateExisting;
    return labels.statusReady;
  }

  protected statusKey(row: ImportRow): 'error' | 'warning' | 'success' {
    if (hasErrors(row)) return 'error';
    return row.duplicate ? 'warning' : 'success';
  }

  protected cellId(row: ImportRow, key: string): string {
    return `${row.index}:${key}`;
  }

  protected cellLabel(row: ImportRow, field: ImportField): string {
    const labels = this.labels();
    const base = formatImportLabel(labels.editCell, {
      row: row.row,
      field: field.label,
      value: row.raw[field.key] || labels.emptyCell,
    });
    const error = row.errors[field.key];
    return error ? `${base}，${error}` : base;
  }

  protected editLabel(row: ImportRow, field: ImportField): string {
    return formatImportLabel(this.labels().editInput, { row: row.row, field: field.label });
  }

  protected isEditing(row: ImportRow, key: string): boolean {
    const editing = this.editing();
    return !!editing && editing.index === row.index && editing.key === key;
  }

  protected toggleProblems(event: Event): void {
    this.onlyProblems.set((event.target as HTMLInputElement).checked);
    this.page.set(0);
  }

  protected startEdit(row: ImportRow, key: string): void {
    this.editing.set({ index: row.index, key });
    afterNextRender(
      {
        write: () => {
          const input = this.host.nativeElement.querySelector<HTMLInputElement>('[data-editor]');
          input?.focus();
          input?.select();
        },
      },
      { injector: this.injector },
    );
  }

  protected onEditorKeydown(event: KeyboardEvent, row: ImportRow, key: string): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commit(row, key, (event.target as HTMLInputElement).value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.editing.set(null);
      this.focusCell(row.index, key);
    }
  }

  protected onEditorBlur(event: FocusEvent, row: ImportRow, key: string): void {
    if (!this.isEditing(row, key)) return;
    this.commit(row, key, (event.target as HTMLInputElement).value, false);
  }

  /** 下一個有錯的格子（從目前聚焦的格子往後找，到底了從頭開始）。 */
  protected nextProblem(): void {
    const problems = this.problems();
    if (!problems.length) return;
    const fields = this.schema().fields.map((f) => f.key);
    const order = (p: { position: number; key: string }) => p.position * fields.length + fields.indexOf(p.key);
    const active = (document.activeElement as HTMLElement | null)?.getAttribute('data-cell');
    let current = -1;
    if (active) {
      const [index, key] = splitCellId(active);
      const position = this.displayRows().findIndex((r) => r.index === index);
      if (position >= 0) current = order({ position, key });
    }
    const next = problems.find((p) => order(p) > current) ?? problems[0];
    this.page.set(Math.floor(next.position / this.pageSize()));
    this.focusCell(next.index, next.key);
  }

  private commit(row: ImportRow, key: string, text: string, refocus = true): void {
    this.editing.set(null);
    const field = this.schema().fields.find((f) => f.key === key);
    if (text.trim() !== (row.raw[key] ?? '')) this.edit.emit({ index: row.index, key, text });
    afterNextRender(
      {
        write: () => {
          const updated = this.rows()[row.index];
          if (field && updated) {
            const error = updated.errors[key];
            this.announcement.set(
              error
                ? formatImportLabel(this.labels().cellStillInvalid, { field: field.label, message: error })
                : formatImportLabel(this.labels().cellFixed, { field: field.label, row: updated.row }),
            );
          }
          if (refocus) this.focusCellNow(row.index, key);
        },
      },
      { injector: this.injector },
    );
  }

  private focusCell(index: number, key: string): void {
    afterNextRender({ write: () => this.focusCellNow(index, key) }, { injector: this.injector });
  }

  /** 修好後那一列可能因為「只看有問題」而消失：找不到格子時改聚焦「下一個問題」。 */
  private focusCellNow(index: number, key: string): void {
    const root = this.host.nativeElement;
    const cell = root.querySelector<HTMLElement>(`[data-cell="${index}:${key.replace(/["\\]/g, '\\$&')}"]`);
    const target = cell ?? root.querySelector<HTMLElement>('[data-action="next-problem"]');
    target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    target?.focus({ preventScroll: true });
  }
}

function hasErrors(row: ImportRow): boolean {
  return Object.keys(row.errors).length > 0;
}

function splitCellId(id: string): [number, string] {
  const at = id.indexOf(':');
  return [Number(id.slice(0, at)), id.slice(at + 1)];
}
