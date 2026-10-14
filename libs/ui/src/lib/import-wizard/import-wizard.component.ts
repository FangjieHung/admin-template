import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  numberAttribute,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { StepperSelectionEvent } from '@angular/cdk/stepper';
import { StepWizardComponent } from '../step-wizard/step-wizard.component';
import { WizardStepComponent } from '../step-wizard/wizard-step.component';
import { FileUploadComponent } from '../file-upload/file-upload.component';
import { UploadAdapter, UploadedFile, uploadError } from '../file-upload/upload-adapter';
import { openConfirmDialog } from '../confirm-dialog/confirm-dialog.component';
import { IMPORT_WIZARD_LABELS, assertImportWizardLabels, formatImportLabel } from './import-wizard-labels';
import { IMPORT_ACCEPT, readImportFile } from './import-read';
import { autoMap, headersOf, mappingToHeaders } from './import-mapping';
import {
  ImportPlan,
  ImportReportEntry,
  ImportValidationMessages,
  buildErrorReport,
  buildRows,
  buildTemplateCsv,
  describeErrors,
  editCell,
  markDuplicates,
  planImport,
  runImport,
} from './import-rows';
import {
  ImportDuplicateMode,
  ImportMappingStore,
  ImportResult,
  ImportRow,
  ImportSchema,
  ImportTarget,
  ImportWorkbook,
} from './import-wizard.types';
import { ImportMappingComponent } from './import-mapping.component';
import { ImportCellEdit, ImportPreviewComponent } from './import-preview.component';
import { ImportRunComponent } from './import-run.component';

export type ImportPhase = 'idle' | 'running' | 'done';

/** 精靈內部用的資料來源：目前的工作表、標題與資料列。 */
interface UploadValue {
  file: readonly UploadedFile[];
  sheet: number;
  hasHeader: boolean;
}

interface ImportSource {
  key: string;
  headers: string[];
  data: readonly (readonly string[])[];
  firstRow: number;
}

let nextId = 0;

/**
 * 匯入精靈：上傳 → 欄位對應 → 預覽與檢查 → 匯入。用 schema 描述要匯入的欄位，用 `ImportTarget` 接上真正的存檔，
 * 元件本身不認得任何業務資料。建立在 lib-step-wizard（步驟）、lib-file-upload（選檔）、lib-data-table（預覽）上。
 *
 * - 上傳：CSV／TSV 自己解析（引號、引號裡的換行、BOM、`,`／`;`／Tab 自動判斷；UTF-8 讀出亂碼時改用 Big5），
 *   Excel 用 SheetJS（第一次選 Excel 檔時才下載）。可以下載依 schema 產生的範本檔。超過 `maxRows` 時說明上限。
 * - 欄位對應：依欄位名稱與同義詞自動對應（不分大小寫、全形半形）；必填欄位沒對應時不能往下；可以記住這次的對應。
 * - 預覽：每一格依型別檢查，錯誤寫在格子裡（圖示＋文字），點一下就能直接修改；「下一個問題」把焦點移到下一個有錯的格子。
 *   依 `schema.key` 找出重複（檔案內與 `findExisting`），選擇略過、更新或仍然新增。
 * - 匯入：分批呼叫 `importBatch`，顯示進度、可以停止（已匯入的保留）；結束後列出新增、更新、略過、失敗，可以下載錯誤報告。
 */
@Component({
  selector: 'lib-import-wizard',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    StepWizardComponent,
    WizardStepComponent,
    FileUploadComponent,
    ImportMappingComponent,
    ImportPreviewComponent,
    ImportRunComponent,
  ],
  templateUrl: './import-wizard.component.html',
  styleUrl: './import-wizard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-import-wizard' },
})
export class ImportWizardComponent<T = Record<string, unknown>> {
  /** 要匯入的欄位與判斷重複的 key。 */
  readonly schema = input.required<ImportSchema>();
  /** 匯入到哪裡。 */
  readonly target = input.required<ImportTarget<T>>();
  /** 選填：記住欄位對應（`createLocalStorageMappingStore()` 或自己的實作）。給了才顯示「記住這次的對應」。 */
  readonly mappingStore = input<ImportMappingStore | null>(null);
  /** 記住對應時用的識別，例：`contacts`。 */
  readonly mappingId = input('default');
  /** 一個檔案最多幾列資料。 */
  readonly maxRows = input(5000, { transform: numberAttribute });
  /** 檔案大小上限（bytes），0＝不限。 */
  readonly maxFileSize = input(10 * 1024 * 1024, { transform: numberAttribute });
  /** 每批送幾筆給 `importBatch`。 */
  readonly batchSize = input(50, { transform: numberAttribute });
  /** 範本檔的檔名；不給時用畫面文字的 templateFileName。 */
  readonly templateFileName = input('');
  /** 錯誤報告的檔名；不給時用畫面文字的 reportFileName。 */
  readonly reportFileName = input('');
  /** 顯示步驟精靈的「取消」（按下送出 `cancel`）。 */
  readonly showCancel = input(false);
  /** 步驟標題的層級（`aria-level`）。 */
  readonly headingLevel = input(2, { transform: numberAttribute });

  /** 匯入結束（含停止）。 */
  readonly imported = output<ImportResult>();
  /** 結果畫面按「完成」。 */
  readonly finished = output<ImportResult>();
  /** 按「取消」。 */
  readonly cancel = output<void>();

  protected readonly labels = assertImportWizardLabels(inject(IMPORT_WIZARD_LABELS, { optional: true }));
  protected readonly accept = IMPORT_ACCEPT;
  protected readonly uid = `lib-import-wizard-${nextId++}`;
  private readonly injector = inject(Injector);
  private readonly wizard = viewChild(StepWizardComponent);
  private readonly uploader = viewChild(FileUploadComponent);

  protected readonly messages: ImportValidationMessages = {
    required: this.labels.errorRequired,
    number: this.labels.errorNumber,
    date: this.labels.errorDate,
    email: this.labels.errorEmail,
    phone: this.labels.errorPhone,
    option: this.labels.errorOption,
  };

  // ---- 1. 上傳 ----
  /** 讀進來的檔案（只留最近一個）：file-upload 的值只存參照，內容放這裡。 */
  private readonly workbooks = new Map<string, ImportWorkbook>();
  private fileSeq = 0;

  protected readonly uploadForm = new FormGroup(
    {
      file: new FormControl<readonly UploadedFile[]>([], { nonNullable: true, validators: Validators.required }),
      sheet: new FormControl(0, { nonNullable: true }),
      hasHeader: new FormControl(true, { nonNullable: true }),
    },
    { validators: (group) => this.validateSource(group) },
  );
  private readonly uploadValue = toSignal(this.uploadForm.valueChanges, { initialValue: this.uploadForm.getRawValue() });

  /** file-upload 的上傳介面：其實是在瀏覽器裡讀檔解析，不送到任何地方。 */
  protected readonly reader: UploadAdapter = {
    upload: async (file, { signal, onProgress }) => {
      onProgress(0.3);
      let workbook: ImportWorkbook;
      try {
        workbook = await readImportFile(file);
      } catch {
        throw uploadError(this.labels.readFailed);
      }
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const sheets = workbook.sheets.filter((sheet) => sheet.rows.length > 0);
      if (!sheets.length) throw uploadError(this.labels.emptyFile);
      const count = sheets[0].rows.length - 1;
      if (count > this.maxRows()) {
        throw uploadError(formatImportLabel(this.labels.tooManyRows, { max: this.maxRows(), count }));
      }
      onProgress(1);
      const id = `${this.uid}-file-${++this.fileSeq}`;
      this.workbooks.clear();
      this.workbooks.set(id, { ...workbook, sheets });
      return { id, name: file.name, size: file.size, type: file.type };
    },
  };

  protected readonly workbook = computed(() => this.workbookOf(this.uploadValue()));
  protected readonly source = computed<ImportSource | null>(() => this.sourceOf(this.uploadValue()));

  protected readonly sourceSummary = computed(() => {
    const source = this.source();
    if (!source) return '';
    return formatImportLabel(this.labels.fileSummary, { rows: source.data.length, columns: source.headers.length });
  });
  protected readonly sourceError = computed(() => this.sourceErrorOf(this.source()));

  // ---- 2. 欄位對應 ----
  protected readonly mappingForm = computed(
    () =>
      new FormGroup(
        Object.fromEntries(
          this.schema().fields.map((field) => [
            field.key,
            new FormControl<number | null>(null, field.required ? Validators.required : []),
          ]),
        ) as Record<string, FormControl<number | null>>,
      ),
  );
  protected readonly mappingLabels = computed(() =>
    Object.fromEntries(this.schema().fields.filter((f) => f.required).map((f) => [f.key, f.label])),
  );
  protected readonly remember = new FormControl(true, { nonNullable: true });
  protected readonly autoMappedText = signal('');
  private mappedSourceKey: string | null = null;

  // ---- 3. 預覽 ----
  protected readonly rows = signal<readonly ImportRow[]>([]);
  private builtKey: string | null = null;
  private readonly existing = signal<ReadonlySet<string>>(new Set());
  protected readonly checking = signal(false);
  protected readonly existingFailed = signal(false);
  private existingAbort: AbortController | null = null;

  protected readonly previewForm = new FormGroup(
    {
      skipInvalid: new FormControl(false, { nonNullable: true }),
      mode: new FormControl<ImportDuplicateMode>('skip', { nonNullable: true }),
    },
    { validators: (group) => this.validatePreview(group) },
  );
  private readonly previewValue = toSignal(this.previewForm.valueChanges, { initialValue: this.previewForm.getRawValue() });
  protected readonly problemCount = computed(() => this.rows().filter((r) => Object.keys(r.errors).length).length);
  protected readonly blockedText = computed(() =>
    formatImportLabel(this.labels.blockedByProblems, { count: this.problemCount() }),
  );

  // ---- 4. 匯入 ----
  protected readonly plan = computed<ImportPlan<T>>(() => planImport<T>(this.rows(), this.previewValue().mode ?? 'skip'));
  protected readonly importForm = new FormGroup({}, { validators: () => (this.plan().records.length ? null : { empty: true }) });
  protected readonly finishLabel = computed(() => formatImportLabel(this.labels.start, { count: this.plan().records.length }));
  protected readonly phase = signal<ImportPhase>('idle');
  protected readonly progress = signal({ done: 0, total: 0 });
  protected readonly result = signal<ImportResult | null>(null);
  private report: ImportReportEntry[] = [];
  private runAbort: AbortController | null = null;

  constructor() {
    // 換檔案、工作表或標題列設定時，重新自動對應。
    effect(() => {
      const source = this.source();
      const form = this.mappingForm();
      untracked(() => this.applyAutoMap(source, form));
    });
    // 列或略過設定變了：重新驗證預覽與匯入兩步（步驟精靈靠表單狀態判斷能不能往下）。
    effect(() => {
      this.rows();
      this.checking();
      untracked(() => {
        this.previewForm.updateValueAndValidity({ emitEvent: true });
        this.importForm.updateValueAndValidity();
      });
    });
    effect(() => {
      this.plan();
      untracked(() => this.importForm.updateValueAndValidity());
    });
    inject(DestroyRef).onDestroy(() => {
      this.existingAbort?.abort();
      this.runAbort?.abort();
    });
  }

  // ---- 公開方法 ----

  /** 用程式選一個檔案（例如「載入示範檔案」）：回到第一步，等同使用者選了這個檔案。 */
  loadFile(file: File): void {
    if (this.phase() === 'running') return;
    if (this.phase() === 'done') this.restart();
    const wizard = this.wizard();
    if (wizard && wizard.selectedIndex !== 0) wizard.selectedIndex = 0;
    afterNextRender({ write: () => this.uploader()?.addFiles([file]) }, { injector: this.injector });
  }

  /** 回到第一步、清空檔案與結果（「再匯入一個檔案」）。 */
  restart(): void {
    this.runAbort?.abort();
    this.existingAbort?.abort();
    this.phase.set('idle');
    this.result.set(null);
    this.rows.set([]);
    this.builtKey = null;
    this.mappedSourceKey = null;
    this.existing.set(new Set());
    this.workbooks.clear();
    this.report = [];
    this.wizard()?.reset();
    this.uploadForm.reset();
    this.previewForm.reset();
  }

  // ---- 範本事件 ----

  protected downloadTemplate(): void {
    downloadText(buildTemplateCsv(this.schema()), this.templateFileName() || this.labels.templateFileName);
  }

  protected onStep(event: StepperSelectionEvent): void {
    if (event.selectedIndex >= 2) this.buildPreview();
  }

  protected onEdit(edit: ImportCellEdit): void {
    const schema = this.schema();
    this.rows.update((rows) => {
      const next = rows.slice();
      next[edit.index] = editCell(schema, rows[edit.index], edit.key, edit.text, this.messages);
      return markDuplicates(schema, next, this.existing());
    });
  }

  protected readonly startImport = async (): Promise<void> => {
    const plan = this.plan();
    const controller = new AbortController();
    this.runAbort = controller;
    this.saveMapping();
    this.phase.set('running');
    this.progress.set({ done: 0, total: plan.records.length });
    const run = await runImport(this.target(), plan.records, {
      mode: this.previewValue().mode ?? 'skip',
      batchSize: this.batchSize(),
      signal: controller.signal,
      batchFailedMessage: this.labels.batchFailed,
      onProgress: (done, total) => this.progress.set({ done, total }),
    });
    if (this.runAbort !== controller) return;
    this.runAbort = null;
    const result: ImportResult = {
      created: run.created,
      updated: run.updated,
      skipped: run.skipped + plan.invalid.length + plan.duplicates.length,
      failed: run.failed,
      canceled: run.canceled,
    };
    this.report = [
      ...run.failed.map((f) => ({ row: f.row, reason: f.message })),
      ...plan.invalid.map((row) => ({ row: row.row, reason: describeErrors(this.schema(), row) })),
      ...plan.duplicates.map((row) => ({ row: row.row, reason: this.duplicateReason(row) })),
      ...run.notSent.map((row) => ({ row, reason: this.labels.reasonNotSent })),
    ];
    this.result.set(result);
    this.phase.set('done');
    this.imported.emit(result);
  };

  protected async stop(): Promise<void> {
    if (this.phase() !== 'running') return;
    const ok = await openConfirmDialog(this.injector, {
      title: this.labels.stopTitle,
      message: this.labels.stopMessage,
      confirmLabel: this.labels.stopConfirm,
      tone: 'danger',
    });
    if (ok && this.phase() === 'running') this.runAbort?.abort();
  }

  protected downloadReport(): void {
    const byNumber = new Map(this.rows().map((row) => [row.row, row]));
    const csv = buildErrorReport(this.schema(), this.report, byNumber, {
      row: this.labels.reportRow,
      reason: this.labels.reportReason,
    });
    downloadText(csv, this.reportFileName() || this.labels.reportFileName);
  }

  protected finish(): void {
    const result = this.result();
    if (result) this.finished.emit(result);
  }

  /** 錯誤報告裡有幾列（結果畫面決定要不要顯示下載鈕）。 */
  protected reportCount(): number {
    return this.report.length;
  }

  // ---- 內部 ----

  private applyAutoMap(source: ImportSource | null, form: FormGroup<Record<string, FormControl<number | null>>>): void {
    if (!source) {
      this.mappedSourceKey = null;
      return;
    }
    if (source.key === this.mappedSourceKey) return;
    this.mappedSourceKey = source.key;
    const remembered = this.mappingStore()?.load(this.mappingId()) ?? null;
    const mapped = autoMap(this.schema(), source.headers, remembered);
    form.reset(Object.fromEntries(this.schema().fields.map((f) => [f.key, mapped[f.key] ?? null])));
    this.autoMappedText.set(
      formatImportLabel(this.labels.autoMapped, {
        count: Object.keys(mapped).length,
        total: this.schema().fields.length,
      }),
    );
  }

  /** 進入預覽：對應或來源變了才重建（回到預覽時保留已修改的內容）。 */
  private buildPreview(): void {
    const source = this.source();
    if (!source) return;
    const mapping = this.mappingForm().getRawValue();
    const key = `${source.key}|${JSON.stringify(mapping)}`;
    if (key === this.builtKey) return;
    this.builtKey = key;
    const schema = this.schema();
    const rows = buildRows(schema, mapping, source.data, source.firstRow, this.messages);
    this.existing.set(new Set());
    this.existingFailed.set(false);
    this.rows.set(markDuplicates(schema, rows, new Set()));
    void this.checkExisting(rows);
  }

  private async checkExisting(rows: readonly ImportRow[]): Promise<void> {
    this.existingAbort?.abort();
    const find = this.target().findExisting;
    const schema = this.schema();
    if (!find || !schema.key) return;
    const keys = [...new Set(rows.map((row) => (Object.keys(row.errors).length ? null : row.value[schema.key!])).filter(isKey).map(String))];
    if (!keys.length) return;
    const controller = new AbortController();
    this.existingAbort = controller;
    this.checking.set(true);
    try {
      const existing = await find.call(this.target(), keys, controller.signal);
      if (controller.signal.aborted) return;
      this.existing.set(existing);
      this.rows.update((current) => markDuplicates(schema, current, existing));
    } catch {
      if (!controller.signal.aborted) this.existingFailed.set(true);
    } finally {
      if (this.existingAbort === controller) {
        this.existingAbort = null;
        this.checking.set(false);
      }
    }
  }

  private saveMapping(): void {
    const store = this.mappingStore();
    const source = this.source();
    if (!store || !source || !this.remember.value) return;
    store.save(this.mappingId(), mappingToHeaders(this.mappingForm().getRawValue(), source.headers));
  }

  private duplicateReason(row: ImportRow): string {
    if (row.duplicate?.kind === 'file') {
      return formatImportLabel(this.labels.reasonDuplicateFile, { row: row.duplicate.firstRow });
    }
    const keyField = this.schema().fields.find((f) => f.key === this.schema().key);
    return formatImportLabel(this.labels.reasonDuplicateExisting, { field: keyField?.label ?? '' });
  }

  private workbookOf(value: Partial<UploadValue>): ImportWorkbook | null {
    const ref = value.file?.[0];
    return ref ? (this.workbooks.get(ref.id) ?? null) : null;
  }

  private sourceOf(value: Partial<UploadValue>): ImportSource | null {
    const workbook = this.workbookOf(value);
    if (!workbook) return null;
    const sheetIndex = Math.max(0, Math.min(Number(value.sheet ?? 0), workbook.sheets.length - 1));
    const sheet = workbook.sheets[sheetIndex];
    const hasHeader = value.hasHeader ?? true;
    const headers = headersOf(sheet.rows, hasHeader, (n) => formatImportLabel(this.labels.columnName, { n }));
    return {
      key: `${value.file?.[0]?.id}:${sheetIndex}:${hasHeader}`,
      headers,
      data: hasHeader ? sheet.rows.slice(1) : sheet.rows,
      firstRow: hasHeader ? 2 : 1,
    };
  }

  private sourceErrorOf(source: ImportSource | null): string {
    if (!source) return '';
    if (source.data.length === 0) return this.labels.emptyFile;
    if (source.data.length > this.maxRows()) {
      return formatImportLabel(this.labels.tooManyRows, { max: this.maxRows(), count: source.data.length });
    }
    return '';
  }

  /** 驗證器在 valueChanges 之前執行，所以直接從表單的值算，不讀 signal。 */
  private validateSource(group: AbstractControl): ValidationErrors | null {
    if (!this.workbooks) return null;
    return this.sourceErrorOf(this.sourceOf((group as FormGroup).getRawValue())) ? { source: true } : null;
  }

  private validatePreview(group: AbstractControl): ValidationErrors | null {
    if (this.checking?.()) return { checking: true };
    const skip = (group as FormGroup).controls['skipInvalid']?.value;
    return this.problemCount?.() && !skip ? { problems: true } : null;
  }
}

function isKey(value: unknown): value is string {
  return value !== null && value !== undefined && String(value) !== '';
}

/** 把文字存成檔案下載（CSV 用 UTF-8；內容已含 BOM）。 */
function downloadText(text: string, fileName: string): void {
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
