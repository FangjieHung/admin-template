import { Component, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  ImportResult,
  ImportSchema,
  ImportTarget,
  ImportWizardComponent,
  createLocalStorageMappingStore,
} from '@admin-template/ui';
import { IMPORT_WIZARD_LABEL_PROVIDERS } from '../../shared/ui/import-wizard-labels';
import { DEMO_CONTACTS } from '../../showcase/demo-data';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';
import { DEMO_SAMPLES, DemoSampleId, demoSample } from './demo-samples';

const ENTRY = detailOf('import-wizard');

/** 匯入的聯絡人（示範，只存在這一頁的記憶體裡）。 */
export interface ImportedContact {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  tag: string | null;
  birthday: string | null;
}

/** 示範的「伺服器」延遲：比對現有資料、每一批匯入。 */
const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

/** 匯入精靈展示頁（/components/import-wizard）。 */
@Component({
  selector: 'app-import-wizard-page',
  imports: [MatButtonModule, ImportWizardComponent, ShowcasePageComponent, DemoBlockComponent],
  providers: [...IMPORT_WIZARD_LABEL_PROVIDERS],
  templateUrl: './import-wizard-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './import-wizard-page.component.scss'],
})
export class ImportWizardPageComponent {
  protected readonly entry = ENTRY;
  protected readonly samples = DEMO_SAMPLES;
  private readonly wizard = viewChild(ImportWizardComponent);

  /** 匯入示範的延遲（測試改成 0）。 */
  delayMs = 350;

  protected readonly schema: ImportSchema = {
    key: 'email',
    fields: [
      { key: 'name', label: '姓名', required: true, type: 'text', synonyms: ['聯絡人', '名字', 'name'], example: '王小明' },
      {
        key: 'email',
        label: 'Email',
        required: true,
        type: 'email',
        synonyms: ['電子郵件', '信箱', 'e-mail', 'mail'],
        example: 'ming@example.com',
      },
      { key: 'phone', label: '電話', type: 'phone', synonyms: ['手機', '行動電話', 'mobile', 'tel'], example: '0912-345-678' },
      { key: 'company', label: '公司', type: 'text', synonyms: ['公司名稱', '單位', 'company'], example: '晨光設計' },
      {
        key: 'tag',
        label: '標籤',
        type: 'enum',
        synonyms: ['分類', '類別', 'tag'],
        options: [
          { value: 'vip', label: 'VIP', synonyms: ['貴賓'] },
          { value: 'customer', label: '客戶', synonyms: ['顧客'] },
          { value: 'supplier', label: '供應商', synonyms: ['廠商'] },
          { value: 'partner', label: '合作夥伴', synonyms: ['夥伴'] },
        ],
      },
      { key: 'birthday', label: '生日', type: 'date', synonyms: ['出生日期', 'birthday'], example: '1990-03-08' },
    ],
  };

  /** 聯絡人「資料庫」：以 Email 為 key。 */
  protected readonly contacts = signal<ReadonlyMap<string, ImportedContact>>(
    new Map(
      DEMO_CONTACTS.map((c) => [c.email, { name: c.name, email: c.email, phone: null, company: c.team, tag: null, birthday: null }]),
    ),
  );
  protected readonly lastResult = signal<ImportResult | null>(null);
  protected readonly finishedResult = signal<ImportResult | null>(null);
  protected readonly loadingSample = signal<DemoSampleId | null>(null);
  protected readonly mappingStore = createLocalStorageMappingStore('admin-template.import-wizard');

  protected readonly target: ImportTarget<ImportedContact> = {
    findExisting: async (keys, signal) => {
      await wait(this.delayMs, signal);
      const existing = this.contacts();
      return new Set(keys.filter((key) => existing.has(key.toLowerCase())));
    },
    importBatch: async (rows, { signal }) => {
      await wait(this.delayMs, signal);
      const next = new Map(this.contacts());
      let created = 0;
      let updated = 0;
      const failed: { row: number; message: string }[] = [];
      for (const record of rows) {
        const contact = record.value;
        if (contact.email.endsWith('@blocked.test')) {
          failed.push({ row: record.row, message: '這個網域不接受匯入（示範）' });
          continue;
        }
        if (record.action === 'update' && next.has(contact.email)) {
          next.set(contact.email, { ...next.get(contact.email)!, ...withoutEmpty(contact) });
          updated++;
        } else {
          // 「仍然新增」時示範資料以 Email 為 key，同一個 Email 會蓋過去；真正的後端會多一筆。
          next.set(contact.email, contact);
          created++;
        }
      }
      this.contacts.set(next);
      return { created, updated, skipped: 0, failed };
    },
  };

  protected async loadSample(id: DemoSampleId): Promise<void> {
    this.loadingSample.set(id);
    try {
      this.wizard()?.loadFile(await demoSample(id));
    } finally {
      this.loadingSample.set(null);
    }
  }

  /** 結果畫面按「完成」：真正的頁面會回到清單；這裡記下結果、回到第一步。 */
  protected onFinished(result: ImportResult): void {
    this.finishedResult.set(result);
    this.wizard()?.restart();
  }

  protected resultText(result: ImportResult | null): string {
    if (!result) return '（尚未匯入）';
    const head = result.canceled ? '已停止' : '完成';
    return `${head}：新增 ${result.created}、更新 ${result.updated}、略過 ${result.skipped}、失敗 ${result.failed.length}`;
  }

  protected readonly whenToUse = [
    '使用者手上已經有一份 Excel 或 CSV（從舊系統匯出、業務自己整理的名單），要一次建立很多筆資料。',
    '檔案的欄位名稱、格式不一定照規定：需要先對應欄位、看過錯誤再決定匯入哪些。',
    '同一份資料可能已經存在，需要選擇略過、更新或新增。',
  ];
  protected readonly avoid = [
    '一次只新增一兩筆：用表單（工單表單樣板）。',
    '資料量是數萬筆以上、或需要排程定期同步：交給後端的批次作業，畫面只顯示進度與結果。',
    '只是要讓使用者附上檔案（附件、照片）：用附件上傳。',
  ];

  protected readonly usage = `// 頁面的 providers：精靈的文字，以及它用到的步驟精靈、附件上傳、確認對話框的文字
providers: [
  { provide: IMPORT_WIZARD_LABELS, useValue: { stepUpload: '上傳檔案', …, table: ADMIN_DATA_TABLE_LABELS } },
  { provide: STEP_WIZARD_LABELS, useValue: … },
  { provide: FILE_UPLOAD_LABELS, useValue: … },
  { provide: CONFIRM_DIALOG_LABELS, useValue: { confirm: '確認', cancel: '取消' } },
]

// 要匯入的欄位：型別決定預設的檢查；synonyms 讓不同寫法的欄位名稱自動對應；key 用來判斷重複
readonly schema: ImportSchema = {
  key: 'email',
  fields: [
    { key: 'name', label: '姓名', required: true, type: 'text', synonyms: ['聯絡人'] },
    { key: 'email', label: 'Email', required: true, type: 'email', synonyms: ['電子郵件', 'e-mail'] },
    { key: 'tag', label: '標籤', type: 'enum', options: [{ value: 'vip', label: 'VIP', synonyms: ['貴賓'] }, …] },
    { key: 'birthday', label: '生日', type: 'date' },
  ],
};

// 匯入到哪裡：換成呼叫自己的 API
readonly target: ImportTarget<Contact> = {
  findExisting: (emails, signal) => this.api.existingEmails(emails, signal),     // 回傳已存在的 key
  importBatch: (rows, { signal }) => this.api.importContacts(rows, signal),      // 回傳 { created, updated, skipped, failed }
};

<lib-import-wizard
  [schema]="schema"
  [target]="target"
  [mappingStore]="mappingStore"
  mappingId="contacts"
  templateFileName="聯絡人匯入範本.csv"
  (finished)="backToList($event)"
/>`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-import-wizard 輸入',
      rows: [
        { name: '[schema]', type: 'ImportSchema', default: '必填', description: '要匯入的欄位（key、label、required、type、options、synonyms、example、validate、transform）與判斷重複的 key。' },
        { name: '[target]', type: 'ImportTarget<T>', default: '必填', description: 'findExisting(keys, signal)：回傳已存在的 key；importBatch(rows, { mode, signal })：分批匯入，回傳新增、更新、略過與失敗的列。' },
        { name: '[mappingStore]', type: 'ImportMappingStore | null', default: 'null', description: '記住欄位對應（createLocalStorageMappingStore() 存在瀏覽器）；給了才顯示「記住這次的對應」。' },
        { name: '[mappingId]', type: 'string', default: "'default'", description: '記住對應時的識別，每種匯入用不同的值。' },
        { name: '[maxRows]', type: 'number', default: '5000', description: '一個檔案最多幾列資料；超過時說明上限，請使用者分檔。' },
        { name: '[maxFileSize]', type: 'number', default: '10 MB', description: '檔案大小上限（bytes），0＝不限。' },
        { name: '[batchSize]', type: 'number', default: '50', description: '每批送幾筆給 importBatch（進度條依批次前進）。' },
        { name: '[templateFileName]／[reportFileName]', type: 'string', default: '畫面文字', description: '範本檔與錯誤報告的檔名。' },
        { name: '[showCancel]', type: 'boolean', default: 'false', description: '顯示步驟精靈的「取消」。' },
        { name: '[headingLevel]', type: 'number', default: '2', description: '步驟標題的 aria-level。' },
      ],
    },
    {
      title: 'lib-import-wizard 輸出與方法',
      rows: [
        { name: '(imported)', type: 'ImportResult', description: '匯入結束（含停止）：created、updated、skipped、failed、canceled。' },
        { name: '(finished)', type: 'ImportResult', description: '結果畫面按「完成」：通常回到清單並顯示提示訊息。' },
        { name: '(cancel)', type: 'void', description: '按「取消」（showCancel）。' },
        { name: 'loadFile(file)', type: 'method', description: '用程式選一個檔案（例如載入示範檔案），回到第一步。' },
        { name: 'restart()', type: 'method', description: '清空檔案與結果，回到第一步。' },
      ],
    },
    {
      title: '工具函式（可單獨使用）',
      rows: [
        { name: 'parseCsv(text, delimiter?)', type: 'string[][]', description: '解析 CSV：雙引號、跳脫引號、引號裡的換行、CRLF、BOM；不給分隔符號時自動判斷 , ; Tab。' },
        { name: 'decodeText(bytes)', type: "{ text, encoding }", description: 'UTF-8 解碼，出現亂碼時改用 Big5。' },
        { name: 'toCsv(rows, withBom?)', type: 'string', description: '寫出 CSV（預設加 BOM，Excel 才會正確顯示中文）。' },
        { name: 'autoMap(schema, headers, remembered?)', type: 'Record<string, number>', description: '依名稱與同義詞自動對應（不分大小寫、全形半形）。' },
        { name: 'buildTemplateCsv(schema)', type: 'string', description: '依 schema 產生範本檔內容。' },
      ],
    },
    {
      title: '注入',
      rows: [
        { name: 'IMPORT_WIZARD_LABELS', type: 'ImportWizardLabels', default: '必填', description: '精靈的畫面文字（含預覽表格的 DataTableLabels）；少一句會在建立元件時丟出錯誤，列出缺的名稱。' },
        { name: 'STEP_WIZARD_LABELS／FILE_UPLOAD_LABELS／CONFIRM_DIALOG_LABELS', type: '—', default: '必填', description: '精靈裡用到的步驟精靈、附件上傳（選檔）與確認對話框（停止匯入）的文字。' },
      ],
    },
  ];
}

/** 更新時空白的欄位不覆蓋原本的值。 */
function withoutEmpty(contact: ImportedContact): Partial<ImportedContact> {
  return Object.fromEntries(Object.entries(contact).filter(([, v]) => v !== null && v !== '')) as Partial<ImportedContact>;
}
