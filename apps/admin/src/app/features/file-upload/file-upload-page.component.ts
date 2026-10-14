import { Component, DestroyRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FileUploadComponent, UploadedFile, createDemoUploadAdapter, formatFileSize } from '@admin-template/ui';
import { FILE_UPLOAD_LABEL_PROVIDERS } from '../../shared/ui/file-upload-labels';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';
import { demoDocument, demoPhoto } from './demo-files';

const ENTRY = detailOf('file-upload');
const MB = 1024 * 1024;

/** 附件上傳展示頁（/components/file-upload）。 */
@Component({
  selector: 'app-file-upload-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FileUploadComponent,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  providers: [...FILE_UPLOAD_LABEL_PROVIDERS],
  templateUrl: './file-upload-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './file-upload-page.component.scss'],
})
export class FileUploadPageComponent {
  protected readonly entry = ENTRY;
  protected readonly formatSize = formatFileSize;

  // ---- 示範 1：工單附件（清單、名稱含「網路設定」的檔案第一次會失敗） ----
  protected readonly ticketAdapter = createDemoUploadAdapter({
    delayMs: 2400,
    failNames: ['網路設定'],
    failMessage: '連線逾時，請重試（示範）',
  });
  protected readonly ticketFiles = signal<readonly UploadedFile[]>([]);
  protected readonly ticketBusy = signal(false);
  private readonly ticketUploader = viewChild<FileUploadComponent>('ticketUploader');

  protected addTicketSamples(): void {
    this.ticketUploader()?.addFiles([
      demoDocument('TK-2048-設備維修報價單-第三季-最終確認版.pdf', 'application/pdf', 248 * 1024),
      demoDocument('網路設定截圖說明.pdf', 'application/pdf', 96 * 1024),
      demoDocument('客戶簽收單.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 41 * 1024),
      demoDocument('耗材清單.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 18 * 1024),
    ]);
  }

  // ---- 示範 2：現場照片（縮圖方塊、拍照、上傳前縮小到 1600px） ----
  protected readonly photoAdapter = createDemoUploadAdapter({ delayMs: 1600 });
  protected readonly photoLog = signal<readonly string[]>([]);
  private readonly originalSizes = new Map<string, number>();
  private readonly photoUploader = viewChild<FileUploadComponent>('photoUploader');
  private photoSeq = 0;

  protected async addPhotoSamples(): Promise<void> {
    const files = await Promise.all(
      [0, 1, 2].map((i) => demoPhoto(`現場照片-${String(++this.photoSeq).padStart(2, '0')}.jpg`, this.photoSeq + i)),
    );
    for (const file of files) this.originalSizes.set(file.name, file.size);
    this.photoUploader()?.addFiles(files);
  }

  protected onPhotoUploaded(file: UploadedFile): void {
    const original = this.originalSizes.get(file.name);
    const note = original && original > file.size ? `（原檔 ${formatFileSize(original)}，縮小到長邊 1600px）` : '';
    this.photoLog.update((log) => [`${file.name}：上傳 ${formatFileSize(file.size)}${note}`, ...log].slice(0, 4));
  }

  // ---- 示範 3：表單（必填、上傳中停用送出） ----
  protected readonly formAdapter = createDemoUploadAdapter({ delayMs: 3000 });
  protected readonly ticketForm = new FormGroup({
    subject: new FormControl('', { nonNullable: true, validators: Validators.required }),
    attachments: new FormControl<UploadedFile[]>([], { nonNullable: true, validators: Validators.required }),
  });
  protected readonly formBusy = signal(false);
  protected readonly formResult = signal('（尚未送出）');

  protected submitTicket(): void {
    if (this.formBusy()) return;
    if (this.ticketForm.invalid) {
      this.ticketForm.markAllAsTouched();
      this.formResult.set('還有欄位需要填寫');
      return;
    }
    const { subject, attachments } = this.ticketForm.getRawValue();
    this.formResult.set(`已送出「${subject}」，附件 ${attachments.length} 個：${attachments.map((f) => f.name).join('、')}（示範）`);
  }

  // ---- 示範 4：唯讀（詳情頁） ----
  protected readonly readonlyDocs = signal<readonly UploadedFile[]>([]);
  protected readonly readonlyPhotos = signal<readonly UploadedFile[]>([]);

  // ---- 示範 5：限制（只收 PDF 與圖片、5 MB、最多 3 個） ----
  protected readonly limitAdapter = createDemoUploadAdapter({ delayMs: 1200 });
  protected readonly limitLog = signal('（尚未加入）');
  private readonly limitUploader = viewChild<FileUploadComponent>('limitUploader');

  protected async addLimitSamples(): Promise<void> {
    const photo = await demoPhoto('會議白板.jpg', 2, 1200, 900).catch(() => null);
    this.limitUploader()?.addFiles([
      demoDocument('合約草稿.pdf', 'application/pdf', 320 * 1024),
      demoDocument('掃描檔-高解析.pdf', 'application/pdf', 7.4 * MB),
      demoDocument('預算試算.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 22 * 1024),
      ...(photo ? [photo] : []),
      demoDocument('會議記錄.pdf', 'application/pdf', 88 * 1024),
      demoDocument('補充說明.pdf', 'application/pdf', 54 * 1024),
      demoDocument('附錄-名詞解釋.pdf', 'application/pdf', 31 * 1024),
    ]);
  }

  protected onLimitRejected(count: number): void {
    this.limitLog.set(`這次有 ${count} 個檔案無法加入（原因寫在各列）`);
  }

  private readonly urls: string[] = [];

  constructor() {
    // 唯讀示範的附件：頁面打開時產生一次（object URL，離開頁面時釋放）。
    afterNextRender(async () => {
      const docs = [
        demoDocument('維修完工報告.pdf', 'application/pdf', 186 * 1024),
        demoDocument('驗收紀錄表.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 24 * 1024),
        demoDocument('備品更換清單-設備編號-A12-2026年10月.pdf', 'application/pdf', 52 * 1024),
      ];
      try {
        this.readonlyDocs.set(docs.map((file, i) => this.reference(file, `doc-${i}`)));
        const photos = await Promise.all([0, 1, 2, 3].map((i) => demoPhoto(`完工照片-${i + 1}.jpg`, i + 5, 1200, 900)));
        this.readonlyPhotos.set(photos.map((file, i) => this.reference(file, `photo-${i}`)));
      } catch {
        // 不支援 canvas／object URL 的環境（單元測試）就不放示範附件。
      }
    });
    inject(DestroyRef).onDestroy(() => this.urls.forEach((url) => URL.revokeObjectURL(url)));
  }

  private reference(file: File, id: string): UploadedFile {
    const url = URL.createObjectURL(file);
    this.urls.push(url);
    return { id, name: file.name, size: file.size, type: file.type, url };
  }

  protected readonly whenToUse = [
    '表單要附上檔案：工單附件、合約掃描檔、報價單。',
    '現場拍照存證：維修前後、驗收、盤點（手機直接開相機，桌機用網路攝影機）。',
    '詳情頁列出已上傳的附件與下載連結（readonly）。',
  ];
  protected readonly avoid = [
    '匯入整份資料（CSV、Excel 轉成多筆資料）：用匯入精靈，它要做欄位對應與驗證。',
    '只要一張頭像或 Logo 且需要裁切：另做裁切元件，上傳只負責檔案本身。',
    '檔案很大（影片、數百 MB）：需要分段續傳，adapter 要換成支援 multipart 的實作。',
  ];

  protected readonly usage = `// 頁面的 providers：畫面文字（{name}、{size}、{max}、{percent}、{reason} 會被換掉）
providers: [{ provide: FILE_UPLOAD_LABELS, useValue: ZH_TW_FILE_UPLOAD }]

// 上傳交給 adapter：把 signal 傳給 fetch／XHR，取消時就會中斷；onProgress(0..1) 可有可無
readonly adapter: UploadAdapter = {
  upload: (file, { signal, onProgress }) =>
    this.api.upload(file, { signal, onProgress }).then((res) => ({
      id: res.id, name: file.name, size: file.size, type: file.type, url: res.url,
    })),
};

<lib-file-upload
  formControlName="attachments"
  label="附件"
  hint="PDF 或圖片"
  errorMessage="請至少上傳一個附件"
  accept="application/pdf,image/*"
  [maxSize]="5 * 1024 * 1024"
  [maxFiles]="3"
  camera="auto"
  [maxImageDimension]="1600"
  [adapter]="adapter"
  (busyChange)="uploading.set($event)"
/>
<button matButton="filled" [disabled]="uploading()">送出</button>

// 詳情頁：只列出附件與下載連結
<lib-file-upload readonly [value]="ticket.attachments" />`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-file-upload 輸入',
      rows: [
        { name: '[adapter]', type: 'UploadAdapter', default: '必填（readonly 除外）', description: 'upload(file, { signal, onProgress }) 回傳 Promise<UploadedFile>；reject uploadError(原因) 時原因顯示在那一列。選填的 release(file) 在元件不再顯示該檔案時呼叫（釋放 object URL 之類的本機資源）。' },
        { name: 'formControlName／[(value)]', type: 'UploadedFile[]', default: '[]', description: '只有已上傳完成的檔案（id、名稱、大小、類型、網址），不含檔案內容。Validators.required 在沒有任何完成的檔案時無效。' },
        { name: 'label／hint／errorMessage', type: 'string', default: "''", description: '欄位標籤（必填時加 *）、拖放區下方說明接受的類型（大小與個數上限會自動接在後面）、驗證錯誤時的文字。' },
        { name: 'accept', type: 'string', default: "''", description: '同 <input accept>：MIME、萬用 MIME、副檔名，逗號分隔；不符的檔案顯示「不支援這種檔案類型」。' },
        { name: '[maxSize]', type: 'number（bytes）', default: '0（不限）', description: '單一檔案的大小上限。' },
        { name: '[maxFiles]', type: 'number', default: '0（不限）', description: '檔案個數上限（含上傳中與失敗的），超過的顯示原因。' },
        { name: '[multiple]', type: 'boolean', default: 'true', description: 'false：一次一個檔案，新選的取代原本的。' },
        { name: 'camera', type: "'off' | 'auto' | 'only'", default: "'off'", description: 'auto：允許圖片且裝置有相機時顯示「拍照」（手機開系統相機；桌機開拍照對話框，可切換前後鏡頭）；only：只有拍照鈕。沒有權限或相機時說明原因並改為選擇檔案。' },
        { name: '[maxImageDimension]', type: 'number（px）', default: '0（不縮）', description: '圖片長邊超過時先縮小再上傳（依 EXIF 轉正，JPEG／PNG／WebP 保留格式）。' },
        { name: '[concurrency]', type: 'number', default: '3', description: '同時上傳幾個，其餘顯示「等待上傳」。' },
        { name: 'layout', type: "'list' | 'grid'", default: "'list'", description: 'list：一列一個檔案；grid：縮圖方塊，適合照片。點圖片縮圖打開預覽（上一張／下一張、方向鍵）。' },
        { name: 'readonly', type: 'boolean', default: 'false', description: '只列出附件，檔名是下載連結；沒有拖放區與動作。' },
        { name: 'required／disabled', type: 'boolean', default: 'false', description: '沒接表單時自己標示必填與停用；接表單時跟著 Validators.required 與 control.disable()。' },
      ],
    },
    {
      title: 'lib-file-upload 輸出與方法',
      rows: [
        { name: '(busyChange)', type: 'boolean', description: '有檔案在等待或上傳中；頁面據此停用送出鈕。也可以讀 busy()（signal）。' },
        { name: '(uploaded)', type: 'UploadedFile', description: '一個檔案上傳完成。' },
        { name: '(removed)', type: 'UploadedFile', description: '使用者移除了已上傳的檔案；要不要刪伺服器上的檔案由頁面決定。' },
        { name: '(rejected)', type: 'FileRejection[]', description: '這次加入的檔案中無法加入的（reason：type／size／count）。' },
        { name: 'addFiles(files)／openFilePicker()', type: 'method', description: '用程式加入檔案；在自己的按鈕點擊裡打開檔案選擇器。' },
      ],
    },
    {
      title: '其他匯出',
      rows: [
        { name: 'createDemoUploadAdapter(options)', type: 'UploadAdapter', description: '示範用的假上傳：delayMs、steps、failRate、failNames（第一次失敗、重試成功）、failMessage；回傳 object URL，release 時釋放。' },
        { name: 'uploadError(message)', type: 'function', description: '建立給使用者看的失敗原因（「檔案已存在」），在 adapter 裡 reject 它；其他錯誤只顯示「上傳失敗」。' },
        { name: 'formatFileSize／matchesAccept／downscaleImage', type: 'function', description: '檔案大小（1024 進位、小數一位）、accept 比對、圖片縮小。' },
        { name: 'FILE_UPLOAD_LABELS', type: 'FileUploadLabels', default: '必填', description: '41 句畫面文字（含拍照與預覽對話框）；少一句會在建立元件時丟出錯誤，列出缺的名稱。' },
      ],
    },
  ];
}
