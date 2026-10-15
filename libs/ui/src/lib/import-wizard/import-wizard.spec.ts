import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { decodeText, parseCsv, sniffDelimiter, toCsv } from './import-csv';
import { autoMap, headersOf, missingRequired, normalizeHeader, sampleValues } from './import-mapping';
import {
  ImportValidationMessages,
  buildErrorReport,
  buildRows,
  buildTemplateCsv,
  editCell,
  markDuplicates,
  parseDate,
  planImport,
  runImport,
  validateRow,
} from './import-rows';
import { readImportFile } from './import-read';
import { IMPORT_WIZARD_LABELS, ImportWizardLabels, assertImportWizardLabels } from './import-wizard-labels';
import { ImportWizardComponent } from './import-wizard.component';
import { ImportRecord, ImportResult, ImportSchema, ImportTarget } from './import-wizard.types';
import { STEP_WIZARD_LABELS, StepWizardLabels } from '../step-wizard/step-wizard-labels';
import { FILE_UPLOAD_LABELS, FileUploadLabels } from '../file-upload/file-upload-labels';
import { CONFIRM_DIALOG_LABELS } from '../confirm-dialog/confirm-dialog.component';
import { DataTableLabels } from '../data-table/data-table.types';

const MESSAGES: ImportValidationMessages = {
  required: '必填',
  number: '請填數字',
  date: '日期格式不正確',
  email: 'Email 格式不正確',
  phone: '電話格式不正確',
  option: '請填 {options} 其中之一',
};

const SCHEMA: ImportSchema = {
  key: 'email',
  fields: [
    { key: 'name', label: '姓名', required: true, type: 'text', synonyms: ['name', '聯絡人'], example: '王小明' },
    { key: 'email', label: 'Email', required: true, type: 'email', synonyms: ['電子郵件', 'e-mail', 'mail'], example: 'ming@example.com' },
    { key: 'phone', label: '電話', type: 'phone', synonyms: ['手機', 'mobile'] },
    { key: 'company', label: '公司', type: 'text' },
    {
      key: 'tag',
      label: '標籤',
      type: 'enum',
      options: [
        { value: 'vip', label: 'VIP', synonyms: ['貴賓'] },
        { value: 'customer', label: '客戶' },
      ],
    },
    { key: 'birthday', label: '生日', type: 'date' },
    { key: 'age', label: '年資', type: 'number' },
  ],
};

describe('import-csv（CSV 解析）', () => {
  it('處理雙引號、跳脫引號、引號裡的換行與 CRLF', () => {
    const text = '名稱,說明\r\n"王,小明","他說""你好"""\r\n"兩行\r\n內容",結尾\r\n';
    expect(parseCsv(text)).toEqual([
      ['名稱', '說明'],
      ['王,小明', '他說"你好"'],
      ['兩行\r\n內容', '結尾'],
    ]);
  });

  it('去掉開頭的 BOM、略過空白列、最後一列沒有換行也讀得到', () => {
    expect(parseCsv('\uFEFFa,b\n\n1,2\n , \n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('自動判斷分號與 Tab 分隔（引號裡的逗號不算）', () => {
    expect(sniffDelimiter('姓名;電話;備註\n王小明;0912;"a,b,c"\n')).toBe(';');
    expect(parseCsv('姓名;電話\n王小明;0912')).toEqual([['姓名', '電話'], ['王小明', '0912']]);
    expect(sniffDelimiter('姓名\t電話\n王小明\t0912')).toBe('\t');
    expect(parseCsv('姓名\t電話\n"王, 小明"\t0912')).toEqual([['姓名', '電話'], ['王, 小明', '0912']]);
    expect(sniffDelimiter('只有一欄\n第二列')).toBe(',');
  });

  it('UTF-8 解不開時改用 Big5（台灣 Excel 存的 CSV）', () => {
    const big5 = new Uint8Array([
      169, 109, 166, 87, 44, 185, 113, 184, 220, 13, 10, 164, 253, 164, 112, 169, 250, 44, 48, 57, 49, 50, 45, 51, 52, 53,
      45, 54, 55, 56, 13, 10,
    ]);
    const decoded = decodeText(big5);
    expect(decoded.encoding).toBe('big5');
    expect(parseCsv(decoded.text)).toEqual([['姓名', '電話'], ['王小明', '0912-345-678']]);
    const utf8 = decodeText(new TextEncoder().encode('\uFEFF姓名,電話'));
    expect(utf8).toEqual({ text: '姓名,電話', encoding: 'utf-8' });
  });

  it('toCsv：需要時加引號，預設加 BOM、CRLF 換行', () => {
    expect(toCsv([['a', 'b,c'], ['他說"好"', '兩\n行']])).toBe('\uFEFFa,"b,c"\r\n"他說""好""","兩\n行"\r\n');
    expect(toCsv([['x']], false)).toBe('x\r\n');
  });

  it('readImportFile：TSV 依副檔名用 Tab，CSV 回報編碼', async () => {
    const tsv = await readImportFile(new File(['姓名\t電話\n王小明\t0912'], 'a.tsv'));
    expect(tsv.sheets[0].rows).toEqual([['姓名', '電話'], ['王小明', '0912']]);
    expect(tsv.encoding).toBe('utf-8');
  });
});

describe('import-mapping（欄位對應）', () => {
  it('依名稱與同義詞自動對應，不分大小寫、空白、全形半形與必填的 *', () => {
    expect(normalizeHeader(' Ｅ－ｍａｉｌ＊ ')).toBe('email');
    const headers = ['聯絡人', 'Ｅ－ｍａｉｌ', ' 手 機 ', '備註', '生日*'];
    expect(autoMap(SCHEMA, headers)).toEqual({ name: 0, email: 1, phone: 2, birthday: 4 });
  });

  it('label 比同義詞優先，一個檔案欄位只對應一次；記住的對應最優先', () => {
    const headers = ['name', '姓名', 'mail'];
    expect(autoMap(SCHEMA, headers)).toEqual({ name: 1, email: 2 });
    expect(autoMap(SCHEMA, headers, { name: 'name' })).toEqual({ name: 0, email: 2 });
  });

  it('必填欄位沒有對應時列出來', () => {
    expect(missingRequired(SCHEMA, { name: 0, email: null }).map((f) => f.key)).toEqual(['email']);
    expect(missingRequired(SCHEMA, { name: 0, email: 3 })).toEqual([]);
  });

  it('範例值取前三個不重複、非空白的值；沒有標題列時用「第 N 欄」', () => {
    expect(sampleValues([['a'], [''], ['a'], ['b'], ['c'], ['d']], 0)).toEqual(['a', 'b', 'c']);
    expect(headersOf([['x', ''], ['1', '2', '3']], true, (n) => `第 ${n} 欄`)).toEqual(['x', '第 2 欄', '第 3 欄']);
    expect(headersOf([['x', 'y']], false, (n) => `C${n}`)).toEqual(['C1', 'C2']);
  });
});

describe('import-rows（驗證、重複、匯入）', () => {
  const raw = (values: Record<string, string>) => validateRow(SCHEMA, values, MESSAGES);

  it('依型別檢查與轉換：必填、Email、電話、選項（含同義詞與全形）、日期、數字', () => {
    const ok = raw({
      name: '王小明',
      email: ' Ming@Example.COM ',
      phone: '0912-345-678',
      tag: '貴賓',
      birthday: '1990/3/8',
      age: '1,200',
    });
    expect(ok.errors).toEqual({});
    expect(ok.value).toEqual({
      name: '王小明',
      email: 'ming@example.com',
      phone: '0912-345-678',
      tag: 'vip',
      birthday: '1990-03-08',
      age: 1200,
    });
    expect(raw({ email: 'ｍｉｎｇ＠ｅｘａｍｐｌｅ．ｃｏｍ', tag: 'ＶＩＰ' }).value).toMatchObject({ email: 'ming@example.com', tag: 'vip' });

    const bad = raw({ name: '', email: 'ming@', phone: '12', tag: '同事', birthday: '2026/2/30', age: '三' });
    expect(bad.errors).toEqual({
      name: '必填',
      email: 'Email 格式不正確',
      phone: '電話格式不正確',
      tag: '請填 VIP、客戶 其中之一',
      birthday: '日期格式不正確',
      age: '請填數字',
    });
  });

  it('日期接受 - / . 與「年月日」，不是真的日期回 null', () => {
    expect(parseDate('2026-3-8')).toBe('2026-03-08');
    expect(parseDate('2024年2月29日')).toBe('2024-02-29');
    expect(parseDate('２０２６．１２．０１')).toBe('2026-12-01');
    expect(parseDate('2025/2/29')).toBeNull();
    expect(parseDate('3/8/2026')).toBeNull();
  });

  it('transform 丟出錯誤時訊息寫在那一格；validate 收到轉換後的值', () => {
    const schema: ImportSchema = {
      fields: [
        {
          key: 'owner',
          label: '負責人',
          type: 'text',
          transform: (v) => {
            if (v !== '王宗翰') throw new Error('找不到這位負責人');
            return 'staff-01';
          },
        },
        { key: 'qty', label: '數量', type: 'number', validate: (v) => ((v as number) > 0 ? null : '要大於 0') },
      ],
    };
    expect(validateRow(schema, { owner: '王宗翰', qty: '0' }, MESSAGES)).toEqual({
      value: { owner: 'staff-01', qty: 0 },
      errors: { qty: '要大於 0' },
    });
    expect(validateRow(schema, { owner: '路人' }, MESSAGES).errors).toEqual({ owner: '找不到這位負責人' });
  });

  it('直接修改一格會重新驗證那一列', () => {
    const [row] = buildRows(SCHEMA, { name: 0, email: 1 }, [['王小明', 'ming@']], 2, MESSAGES);
    expect(row.errors).toEqual({ email: 'Email 格式不正確' });
    const fixed = editCell(SCHEMA, row, 'email', ' ming@example.com ', MESSAGES);
    expect(fixed.errors).toEqual({});
    expect(fixed.raw['email']).toBe('ming@example.com');
    expect(fixed.row).toBe(2);
  });

  it('重複：檔案內（後出現的）與現有資料，不分大小寫；有錯的列不算', () => {
    const rows = buildRows(
      SCHEMA,
      { name: 0, email: 1 },
      [
        ['A', 'a@x.com'],
        ['B', 'b@x.com'],
        ['A2', 'A@X.com'],
        ['C', 'bad@'],
        ['D', 'old@x.com'],
      ],
      2,
      MESSAGES,
    );
    const marked = markDuplicates(SCHEMA, rows, new Set(['OLD@x.com']));
    expect(marked.map((r) => r.duplicate)).toEqual([null, null, { kind: 'file', firstRow: 2 }, null, { kind: 'existing' }]);
  });

  it('匯入計畫：略過／更新現有／仍然新增', () => {
    const rows = markDuplicates(
      SCHEMA,
      buildRows(SCHEMA, { name: 0, email: 1 }, [['A', 'a@x.com'], ['B', 'old@x.com'], ['C', 'a@x.com'], ['', 'z@x.com']], 2, MESSAGES),
      new Set(['old@x.com']),
    );
    const skip = planImport(rows, 'skip');
    expect(skip.records.map((r) => [r.row, r.action])).toEqual([[2, 'create']]);
    expect(skip.duplicates.map((r) => r.row)).toEqual([3, 4]);
    expect(skip.invalid.map((r) => r.row)).toEqual([5]);
    const update = planImport(rows, 'update');
    expect(update.records.map((r) => [r.row, r.action])).toEqual([[2, 'create'], [3, 'update'], [4, 'update']]);
    expect([update.create, update.update]).toEqual([1, 2]);
    expect(planImport(rows, 'create').records.map((r) => r.action)).toEqual(['create', 'create', 'create']);
  });

  it('分批匯入：回報進度；停止後不再送下一批，沒送的算略過', async () => {
    const records: ImportRecord[] = Array.from({ length: 7 }, (_, i) => ({ row: i + 2, value: { i }, action: 'create' }));
    const controller = new AbortController();
    const batches: number[][] = [];
    const target: ImportTarget = {
      importBatch: async (rows) => {
        batches.push(rows.map((r) => r.row));
        if (batches.length === 2) controller.abort();
        return { created: rows.length - 1, updated: 0, skipped: 0, failed: [{ row: rows[0].row, message: '伺服器拒絕' }] };
      },
    };
    const progress: string[] = [];
    const result = await runImport(target, records, {
      mode: 'skip',
      batchSize: 3,
      signal: controller.signal,
      batchFailedMessage: '這批失敗',
      onProgress: (done, total) => progress.push(`${done}/${total}`),
    });
    expect(batches).toEqual([[2, 3, 4], [5, 6, 7]]);
    expect(progress).toEqual(['0/7', '3/7', '6/7']);
    expect(result).toMatchObject({ created: 4, updated: 0, skipped: 1, canceled: true, notSent: [8] });
    expect(result.failed).toEqual([{ row: 2, message: '伺服器拒絕' }, { row: 5, message: '伺服器拒絕' }]);
  });

  it('一整批丟出錯誤時，那一批每一列都算失敗', async () => {
    const records: ImportRecord[] = [{ row: 2, value: {}, action: 'create' }, { row: 3, value: {}, action: 'update' }];
    const result = await runImport({ importBatch: () => Promise.reject(new Error('500')) }, records, {
      mode: 'update',
      batchSize: 10,
      signal: new AbortController().signal,
      batchFailedMessage: '這批失敗',
      onProgress: () => undefined,
    });
    expect(result.failed).toEqual([{ row: 2, message: '這批失敗' }, { row: 3, message: '這批失敗' }]);
    expect(result.canceled).toBe(false);
  });

  it('錯誤報告：列號、各欄位原始文字、原因，依列號排序，含 BOM', () => {
    const rows = buildRows(SCHEMA, { name: 0, email: 1 }, [['A', 'a@'], ['B, Inc', 'b@x.com']], 2, MESSAGES);
    const csv = buildErrorReport(
      SCHEMA,
      [{ row: 3, reason: '伺服器拒絕' }, { row: 2, reason: 'Email：Email 格式不正確' }],
      new Map(rows.map((r) => [r.row, r])),
      { row: '列號', reason: '原因' },
    );
    expect(csv).toBe(
      '\uFEFF列號,姓名,Email,電話,公司,標籤,生日,年資,原因\r\n' +
        '2,A,a@,,,,,,Email：Email 格式不正確\r\n' +
        '3,"B, Inc",b@x.com,,,,,,伺服器拒絕\r\n',
    );
  });

  it('範本檔：標題列（必填加 *）＋一列範例（選項欄位沒給範例時用第一個選項），含 BOM', () => {
    expect(buildTemplateCsv(SCHEMA)).toBe('\uFEFF姓名*,Email*,電話,公司,標籤,生日,年資\r\n王小明,ming@example.com,,,VIP,,\r\n');
  });
});

// ---- 元件 ----

const STEP_LABELS: StepWizardLabels = {
  previous: '上一步',
  next: '下一步',
  finish: '完成',
  submitting: '送出中…',
  cancel: '取消',
  optional: '選填',
  stepList: '步驟',
  compactStatus: '步驟 {current}／{total} · {label}',
  stepListToggle: '所有步驟',
  stepListError: '其他步驟需要修正',
  announce: '步驟 {current}，共 {total} 步：{label}',
  stateDone: '已完成',
  stateError: '有錯誤',
  stateLocked: '尚未開放',
  stateUpcoming: '未完成',
  errorSummary: '這一步有 {count} 個欄位需要修正',
  stepInvalid: '這一步還有內容需要修正',
};

const UPLOAD_LABELS = new Proxy({} as FileUploadLabels, { get: (_t, key) => String(key) });

const TABLE_LABELS: DataTableLabels = {
  exportExcel: '匯出',
  selectAll: '全選',
  deselectAll: '取消全選',
  selectRow: '選取',
  batchDelete: '刪除',
  selectedCount: '已選 {count}',
  exportSelected: '匯出選取',
  expandRow: '展開',
  collapseRow: '收合',
  exportFailedText: '匯出失敗',
  paging: {
    nav: '分頁',
    pageSizeLabel: '每頁筆數',
    pageSizeOption: '每頁 {size} 筆',
    range: '第 {from}–{to} 筆，共 {total} 筆',
    pageOf: '第 {page} / {pages} 頁',
    firstPage: '第一頁',
    prevPage: '上一頁',
    nextPage: '下一頁',
    lastPage: '最後一頁',
    loadMore: '載入更多',
    shownOf: '已顯示 {shown} / {total} 筆',
  },
};

/** 每一句都填上 key 本身（測試只看結構與行為）。 */
function makeLabels(): ImportWizardLabels {
  const labels = {} as Record<string, unknown>;
  const keys = [
    'stepUpload', 'stepMapping', 'stepPreview', 'stepImport', 'uploadDescription', 'mappingDescription',
    'previewDescription', 'importDescription', 'fileLabel', 'fileHint', 'fileRequired', 'downloadTemplate',
    'templateHint', 'templateFileName', 'readFailed', 'emptyFile', 'sheet', 'hasHeader', 'encodingBig5',
    'mappingField', 'mappingSource', 'mappingSamples', 'notImported', 'requiredMark', 'mappingRequired',
    'unusedColumns', 'unusedNone', 'rememberMapping', 'noSamples', 'onlyProblems', 'nextProblem', 'rowNumber',
    'rowStatus', 'statusReady', 'statusProblem', 'statusDuplicateExisting', 'emptyCell', 'duplicateSkip',
    'duplicateUpdate', 'duplicateCreate', 'checkingExisting', 'existingFailed', 'noProblems', 'nothingToImport',
    'progressLabel', 'stop', 'stopTitle', 'stopMessage', 'stopConfirm', 'resultTitle', 'resultCanceledTitle',
    'resultCreated', 'resultUpdated', 'resultSkipped', 'resultFailed', 'failedRows', 'downloadReport', 'reportHint',
    'reportFileName', 'reportRow', 'reportReason', 'reasonNotSent', 'batchFailed', 'done', 'importAnother',
    'errorRequired', 'errorNumber', 'errorDate', 'errorEmail', 'errorPhone',
  ];
  for (const key of keys) labels[key] = key;
  return {
    ...(labels as unknown as ImportWizardLabels),
    tooManyRows: '超過 {max} 列（{count}）',
    fileSummary: '{rows} 列 · {columns} 欄',
    columnName: '第 {n} 欄',
    autoMapped: '自動對應 {count}／{total}',
    countReady: '可匯入 {count}',
    countProblem: '有問題 {count}',
    countDuplicate: '重複 {count}',
    skipInvalid: '略過有問題的列（{count}）',
    blockedByProblems: '還有 {count} 列有問題',
    statusDuplicateFile: '與第 {row} 列重複',
    editCell: '第 {row} 列 {field}：{value}',
    editInput: '修改第 {row} 列的{field}',
    cellFixed: '第 {row} 列的{field}已修正',
    cellStillInvalid: '{field}：{message}',
    duplicatesTitle: '{count} 列重複（{field}）',
    importSummary: '新增 {create}、更新 {update}、略過 {skip}',
    start: '開始匯入 {count} 筆',
    progressText: '{done}／{total}',
    canceledNote: '已保留 {count} 筆',
    failedRow: '第 {row} 列：{message}',
    reasonDuplicateFile: '與第 {row} 列重複',
    reasonDuplicateExisting: '已有相同的{field}',
    announceResult: '新增 {created}、更新 {updated}、略過 {skipped}、失敗 {failed}',
    errorOption: '請填 {options} 其中之一',
    editsDiscarded: '對應已變更，{count} 筆修改不再適用',
    table: TABLE_LABELS,
  };
}

describe('assertImportWizardLabels', () => {
  it('沒提供或少了句子時丟出明確的錯誤', () => {
    expect(() => assertImportWizardLabels(null)).toThrow(/IMPORT_WIZARD_LABELS/);
    const labels = makeLabels();
    expect(assertImportWizardLabels(labels)).toBe(labels);
    const { stop: _stop, ...missing } = labels;
    expect(() => assertImportWizardLabels(missing)).toThrow(/「stop」/);
    expect(() => assertImportWizardLabels({ ...labels, table: { ...TABLE_LABELS, paging: undefined } })).toThrow(/「table」/);
  });
});

@Component({
  imports: [ImportWizardComponent],
  template: `<lib-import-wizard
    [schema]="schema"
    [target]="target"
    [batchSize]="2"
    [showCancel]="true"
    (imported)="imported.set($event)"
    (finished)="finished.set($event)"
    (cancel)="cancelled = cancelled + 1"
  />`,
})
class HostComponent {
  readonly wizard = viewChild.required(ImportWizardComponent);
  schema = SCHEMA;
  calls: ImportRecord[][] = [];
  existingKeys: string[] = [];
  target: ImportTarget = {
    findExisting: async (keys) => new Set(keys.filter((k) => this.existingKeys.includes(k))),
    importBatch: async (rows) => {
      this.calls.push([...rows]);
      return {
        created: rows.filter((r) => r.action === 'create').length,
        updated: rows.filter((r) => r.action === 'update').length,
        skipped: 0,
        failed: [],
      };
    },
  };
  readonly imported = signal<ImportResult | null>(null);
  readonly finished = signal<ImportResult | null>(null);
  cancelled = 0;
}

describe('ImportWizardComponent（匯入精靈）', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: IMPORT_WIZARD_LABELS, useValue: makeLabels() },
        { provide: STEP_WIZARD_LABELS, useValue: STEP_LABELS },
        { provide: FILE_UPLOAD_LABELS, useValue: UPLOAD_LABELS },
        { provide: CONFIRM_DIALOG_LABELS, useValue: { confirm: '確認', cancel: '取消' } },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
    vi.useRealTimers();
  });

  it('沒有提供 IMPORT_WIZARD_LABELS 時建立元件就丟出錯誤', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: STEP_WIZARD_LABELS, useValue: STEP_LABELS },
        { provide: FILE_UPLOAD_LABELS, useValue: UPLOAD_LABELS },
      ],
    });
    expect(() => TestBed.createComponent(HostComponent)).toThrow(/IMPORT_WIZARD_LABELS/);
  });

  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    const el = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      // 讀檔（Blob.arrayBuffer／FileReader）是真的非同步：多等幾輪。
      for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
      await fixture.whenStable();
      fixture.detectChanges();
    };
    await settle();
    const load = async (text: string, name = 'contacts.csv') => {
      fixture.componentInstance.wizard().loadFile(new File([text], name, { type: 'text/csv' }));
      await settle();
    };
    const heading = () => el.querySelector('.sw-panel__heading')?.textContent?.trim();
    const click = async (selector: string) => {
      el.querySelector<HTMLElement>(selector)!.click();
      await settle();
    };
    return { fixture, el, settle, load, heading, click };
  }

  it('必填欄位沒有對應時不能往下，錯誤摘要列出欄位；選了之後可以前進', async () => {
    const { el, load, heading, click, settle } = await setup();
    await load('聯絡人,電話,備註\n王小明,0912-345-678,老客戶\n');
    expect(el.textContent).toContain('1 列 · 3 欄');
    await click('.sw-actions__next');
    expect(heading()).toBe('stepMapping');
    expect(el.querySelector<HTMLSelectElement>('[data-mapping="name"] select')!.selectedIndex).toBe(1);
    expect(el.querySelector<HTMLSelectElement>('[data-mapping="email"] select')!.selectedIndex).toBe(0);
    expect(el.querySelector('.iwm-unused')?.textContent).toContain('備註');

    await click('.sw-actions__next');
    expect(heading()).toBe('stepMapping');
    expect(el.querySelector('lib-step-wizard-summary')?.textContent).toContain('Email');

    const select = el.querySelector<HTMLSelectElement>('[data-mapping="email"] select')!;
    select.selectedIndex = 3; // 備註
    select.dispatchEvent(new Event('change'));
    await settle();
    await click('.sw-actions__next');
    expect(heading()).toBe('stepPreview');
  });

  it('預覽：標出錯誤、直接修改一格後重新驗證；有問題時要勾略過才能前進；重複可選擇處理方式並匯入', async () => {
    const { fixture, el, load, heading, click, settle } = await setup();
    fixture.componentInstance.existingKeys = ['old@x.com'];
    await load(
      '姓名,Email,標籤\n王小明,ming@x.com,VIP\n陳大同,datong@,客戶\n林美惠,old@x.com,客戶\n張家豪,ming@x.com,貴賓\n',
    );
    await click('.sw-actions__next');
    await click('.sw-actions__next');
    expect(heading()).toBe('stepPreview');
    expect(el.textContent).toContain('可匯入 3');
    expect(el.textContent).toContain('有問題 1');
    expect(el.textContent).toContain('重複 2');

    const invalid = el.querySelectorAll<HTMLButtonElement>('.iwp-cell.is-invalid');
    expect(invalid).toHaveLength(1);
    expect(invalid[0].textContent).toContain('errorEmail');
    expect(invalid[0].getAttribute('data-cell')).toBe('1:email');

    // 有問題、沒勾略過：擋下
    await click('.sw-actions__next');
    expect(heading()).toBe('stepPreview');
    expect(el.querySelector('lib-step-wizard-summary')?.textContent).toContain('還有 1 列有問題');

    // 「下一個問題」把焦點移到有錯的格子
    await click('[data-action="next-problem"]');
    expect(document.activeElement?.getAttribute('data-cell')).toBe('1:email');

    // 點一下改值，Enter 確定
    await click('[data-cell="1:email"]');
    const input = el.querySelector<HTMLInputElement>('[data-editor]')!;
    expect(document.activeElement).toBe(input);
    input.value = 'datong@x.com';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();
    expect(el.querySelectorAll('.iwp-cell.is-invalid')).toHaveLength(0);
    expect(el.textContent).toContain('有問題 0');
    expect(document.activeElement?.getAttribute('data-cell')).toBe('1:email');

    // 重複選「更新現有」
    const update = el.querySelector<HTMLInputElement>('[data-section="duplicates"] input[value="update"]')!;
    update.checked = true;
    update.dispatchEvent(new Event('change'));
    await settle();
    await click('.sw-actions__next');
    expect(heading()).toBe('stepImport');
    expect(el.querySelector('[data-run="summary"]')?.textContent).toContain('新增 2、更新 2、略過 0');
    expect(el.querySelector('.sw-actions__finish')?.textContent).toContain('開始匯入 4 筆');

    await click('.sw-actions__finish');
    await settle();
    const calls = fixture.componentInstance.calls;
    expect(calls.map((batch) => batch.map((r) => [r.row, r.action]))).toEqual([
      [[2, 'create'], [3, 'create']],
      [[4, 'update'], [5, 'update']],
    ]);
    expect(fixture.componentInstance.imported()).toEqual({ created: 2, updated: 2, skipped: 0, failed: [], canceled: false });
    expect(el.querySelector('.sw-actions')).toBeNull();
    expect(el.querySelector('[data-stat="created"]')?.textContent).toContain('2');

    await click('[data-action="done"]');
    expect(fixture.componentInstance.finished()?.created).toBe(2);

    await click('[data-action="again"]');
    expect(heading()).toBe('stepUpload');
    expect(el.querySelector('.sw-actions__next')).not.toBeNull();
  });

  it('勾選「略過有問題的列」後可以匯入，有問題與重複的列算略過', async () => {
    const { fixture, el, load, click, settle } = await setup();
    await load('姓名,Email\n王小明,ming@x.com\n,bad\n林美惠,ming@x.com\n');
    await click('.sw-actions__next');
    await click('.sw-actions__next');
    const skip = el.querySelector<HTMLInputElement>('[data-field="skipInvalid"] input')!;
    skip.click();
    await settle();
    await click('.sw-actions__next');
    expect(el.querySelector('[data-run="summary"]')?.textContent).toContain('新增 1、更新 0、略過 2');
    await click('.sw-actions__finish');
    await settle();
    expect(fixture.componentInstance.imported()).toMatchObject({ created: 1, skipped: 2 });
    expect(el.querySelector('[data-action="report"]')).not.toBeNull();
  });
  /** 在預覽裡改一格：點格子、輸入、Enter。 */
  async function editCellText(t: Awaited<ReturnType<typeof setup>>, cell: string, text: string) {
    await t.click(`[data-cell="${cell}"]`);
    const input = t.el.querySelector<HTMLInputElement>('[data-editor]')!;
    input.value = text;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await t.settle();
  }

  async function mapTo(t: Awaited<ReturnType<typeof setup>>, field: string, option: number) {
    const select = t.el.querySelector<HTMLSelectElement>(`[data-mapping="${field}"] select`)!;
    select.selectedIndex = option;
    select.dispatchEvent(new Event('change'));
    await t.settle();
  }

  it('換欄位對應後回到預覽：仍對應同一欄的修改保留，對應換掉的欄位上的修改不再適用，上方說明筆數', async () => {
    const t = await setup();
    const { el, load, heading, click } = t;
    await load('姓名,Email,電話,備註\n王小明,ming@x.com,0912-345-678,老客戶\n陳大同,datong@,0922-000-111,新客戶\n');
    await click('.sw-actions__next');
    await click('.sw-actions__next');
    expect(heading()).toBe('stepPreview');
    expect(el.querySelector('[data-note="edits-discarded"]')).toBeNull();

    await editCellText(t, '1:email', 'datong@x.com');
    await editCellText(t, '0:phone', '0933-111-222');
    await editCellText(t, '1:phone', '0944-222-333');
    expect(el.querySelectorAll('.iwp-cell.is-invalid')).toHaveLength(0);

    // 回到欄位對應，把「電話」換成「備註」那一欄
    await click('.sw-actions__previous');
    expect(heading()).toBe('stepMapping');
    await mapTo(t, 'phone', 4);
    await click('.sw-actions__next');
    expect(heading()).toBe('stepPreview');
    // Email 的對應沒變：修改留著；電話的兩筆修改不再適用，顯示檔案「備註」欄的原值
    expect(el.querySelector('[data-cell="1:email"]')?.textContent).toContain('datong@x.com');
    expect(el.querySelector('[data-cell="1:email"]')?.classList.contains('is-invalid')).toBe(false);
    expect(el.querySelector('[data-cell="0:phone"]')?.textContent).toContain('老客戶');
    expect(el.querySelector('[data-cell="1:phone"]')?.textContent).toContain('新客戶');
    expect(el.querySelector('[data-note="edits-discarded"]')?.textContent).toContain('對應已變更，2 筆修改不再適用');

    // 再回去只多對應一個沒改過的欄位（公司 → 電話欄）：沒有修改失效，說明消失，Email 的修改仍在
    await click('.sw-actions__previous');
    await mapTo(t, 'company', 3);
    await click('.sw-actions__next');
    expect(el.querySelector('[data-note="edits-discarded"]')).toBeNull();
    expect(el.querySelector('[data-cell="1:email"]')?.textContent).toContain('datong@x.com');
    expect(el.querySelector('[data-cell="0:company"]')?.textContent).toContain('0912-345-678');

    // 換檔案：修改全部清掉，不顯示說明（是另一份資料）
    await load('姓名,Email\n王小明,ming@x.com\n陳大同,datong@\n');
    await click('.sw-actions__next');
    await click('.sw-actions__next');
    expect(el.querySelector('[data-cell="1:email"]')?.classList.contains('is-invalid')).toBe(true);
    expect(el.querySelector('[data-note="edits-discarded"]')).toBeNull();
  });

  it('hasUnsavedWork()：選了檔案到匯入完成前是 true（重新整理時請瀏覽器確認）；完成、取消、重來之後是 false', async () => {
    const t = await setup();
    const { fixture, load, click } = t;
    const wizard = fixture.componentInstance.wizard();
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(wizard.hasUnsavedWork()).toBe(false);
    expect(unload()).toBe(false);

    await load('姓名,Email\n王小明,ming@x.com\n陳大同,datong@\n');
    expect(wizard.hasUnsavedWork()).toBe(true);
    expect(unload()).toBe(true);

    // 按「取消」：使用者已經決定放棄
    await click('.sw-actions__cancel');
    expect(fixture.componentInstance.cancelled).toBe(1);
    expect(wizard.hasUnsavedWork()).toBe(false);
    expect(unload()).toBe(false);

    // 之後再改資料又會提醒
    await click('.sw-actions__next');
    await click('.sw-actions__next');
    await editCellText(t, '1:email', 'datong@x.com');
    expect(wizard.hasUnsavedWork()).toBe(true);

    await click('.sw-actions__next');
    await click('.sw-actions__finish');
    await t.settle();
    expect(fixture.componentInstance.imported()?.created).toBe(2);
    expect(wizard.hasUnsavedWork()).toBe(false);
    expect(unload()).toBe(false);

    // 再匯入一個檔案：回到第一步，還沒選檔
    await click('[data-action="again"]');
    expect(wizard.hasUnsavedWork()).toBe(false);
    await load('姓名,Email\n王小明,ming@x.com\n');
    expect(wizard.hasUnsavedWork()).toBe(true);
    wizard.restart();
    await t.settle();
    expect(wizard.hasUnsavedWork()).toBe(false);
  });

  it('匯入完成後，前面的步驟鎖住：按鈕停用、維持「完成」外觀，點了不會回去', async () => {
    const { el, load, heading, click, settle } = await setup();
    await load('姓名,Email\n王小明,ming@x.com\n');
    await click('.sw-actions__next');
    await click('.sw-actions__next');
    await click('.sw-actions__next');
    const buttons = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.sw-step__button'));
    // 匯入前：走過的步驟可以點回去
    expect(buttons().slice(0, 3).map((b) => b.disabled)).toEqual([false, false, false]);

    await click('.sw-actions__finish');
    await settle();
    expect(el.querySelector('[data-stat="created"]')).not.toBeNull();
    const steps = Array.from(el.querySelectorAll<HTMLElement>('.sw-step'));
    expect(steps.map((s) => s.dataset['state'])).toEqual(['done', 'done', 'done', 'current']);
    expect(steps.map((s) => s.classList.contains('is-frozen'))).toEqual([true, true, true, false]);
    expect(buttons().map((b) => b.disabled)).toEqual([true, true, true, false]);

    buttons()[1].click();
    await settle();
    expect(heading()).toBe('stepImport');
    expect(el.querySelector('[data-action="again"]')).not.toBeNull();

    // 「再匯入一個檔案」之後回到第一步，鎖住解除
    await click('[data-action="again"]');
    expect(heading()).toBe('stepUpload');
    expect(el.querySelectorAll('.sw-step.is-frozen')).toHaveLength(0);
  });
});
