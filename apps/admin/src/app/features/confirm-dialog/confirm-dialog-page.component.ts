import { Component, Injector, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { openConfirmDialog } from '@admin-template/ui';
import { CONFIRM_DIALOG_LABEL_PROVIDERS } from '../../shared/ui/component-label-providers';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('confirm-dialog');

@Component({
  selector: 'app-confirm-dialog-page',
  imports: [MatButtonModule, ShowcasePageComponent, DemoBlockComponent],
  providers: [...CONFIRM_DIALOG_LABEL_PROVIDERS],
  template: `
    <app-showcase-page [summary]="entry.summary" [whenToUse]="whenToUse" [avoid]="avoid" [source]="entry.source" [usage]="usage" [api]="api">
      <app-demo-block heading="三種寫法" description="危險動作（預設）確認鈕用錯誤色；一般確認用主色；也可以加標題、改按鈕文字。">
        <div class="demo-row">
          <button type="button" matButton="outlined" (click)="deleteProject()">刪除專案</button>
          <button type="button" matButton="outlined" (click)="submitReport()">送出報告</button>
          <button type="button" matButton="outlined" (click)="archive()">封存工單</button>
        </div>
        <p class="demo-note" aria-live="polite">結果：{{ result() }}</p>
      </app-demo-block>
      <app-demo-block heading="輸入確認字樣" description="影響很大又無法復原的動作（刪除帳號、刪除整個專案）：要先輸入指定的字樣，確認鈕才按得下去。">
        <div class="demo-row">
          <button type="button" matButton="outlined" (click)="deleteWorkspace()">刪除整個專案</button>
        </div>
        <p class="demo-note" aria-live="polite">結果：{{ typedResult() }}</p>
      </app-demo-block>
    </app-showcase-page>
  `,
  styleUrl: '../../showcase/demo-shared.scss',
})
export class ConfirmDialogPageComponent {
  // 用頁面的 injector 開對話框：CONFIRM_DIALOG_LABELS 只在這一頁的 providers 提供，對話框也讀得到。
  private readonly injector = inject(Injector);
  protected readonly entry = ENTRY;
  protected readonly result = signal('（尚未操作）');
  protected readonly typedResult = signal('（尚未操作）');

  protected async deleteProject(): Promise<void> {
    const ok = await openConfirmDialog(this.injector, { message: '確定刪除「官網改版」？刪除後無法復原。', confirmLabel: '刪除' });
    this.result.set(ok ? '已刪除（示範）' : '取消刪除');
  }

  protected async submitReport(): Promise<void> {
    const ok = await openConfirmDialog(this.injector, { message: '送出後主管會收到通知。', tone: 'primary', confirmLabel: '送出' });
    this.result.set(ok ? '已送出（示範）' : '先不送出');
  }

  protected async archive(): Promise<void> {
    const ok = await openConfirmDialog(this.injector, {
      title: '封存 12 張工單？',
      message: '封存的工單不會出現在清單裡，但可以從「已封存」檢視找回。',
      confirmLabel: '封存',
      cancelLabel: '先不要',
      tone: 'primary',
    });
    this.result.set(ok ? '已封存（示範）' : '沒有封存');
  }

  protected async deleteWorkspace(): Promise<void> {
    const ok = await openConfirmDialog(
      this.injector,
      {
        title: '刪除整個專案？',
        message: '專案裡的 128 張工單、留言與附件會一起刪除，無法復原。',
        confirmLabel: '刪除專案',
        typeToConfirm: { text: '官網改版', label: '輸入專案名稱「官網改版」確認' },
      },
      { width: '420px' },
    );
    this.typedResult.set(ok ? '已刪除（示範）' : '取消刪除');
  }

  protected readonly whenToUse = ['刪除、作廢、送出等不可復原或會通知別人的動作。', '一次影響多筆資料的批次動作。'];
  protected readonly avoid = [
    '可以復原的動作：直接執行，再用提示訊息提供「復原」（見「提示訊息」展示頁）。',
    '需要填寫內容才能確認：做成一般對話框表單。',
  ];

  protected readonly usage = `// app.config.ts 或頁面的 providers（一次）：預設按鈕文字。
providers: [{ provide: CONFIRM_DIALOG_LABELS, useValue: { confirm: '確認', cancel: '取消' } }]

// 傳入頁面的 injector：對話框讀得到頁面層提供的文字。
private readonly injector = inject(Injector);

const ok = await openConfirmDialog(this.injector, {
  message: '確定刪除「官網改版」？刪除後無法復原。',
  confirmLabel: '刪除',
});
if (ok) this.delete();

// 影響很大又無法復原：要先輸入確認字樣。
await openConfirmDialog(this.injector, {
  message: '專案裡的工單、留言與附件會一起刪除，無法復原。',
  confirmLabel: '刪除專案',
  typeToConfirm: { text: '官網改版', label: '輸入專案名稱「官網改版」確認' },
});`;

  protected readonly api: ApiSection[] = [
    {
      title: 'openConfirmDialog(injector, data, config?)',
      rows: [
        { name: 'injector', type: 'Injector', default: '必填', description: '呼叫端的 inject(Injector)；從它讀預設文字，也當成對話框的 injector（頁面 providers 才找得到）。' },
        { name: 'data.message', type: 'string', default: '必填', description: '要確認的事，寫成完整的一句話。' },
        { name: 'data.title', type: 'string', default: '—', description: '選填標題。' },
        { name: 'data.confirmLabel', type: 'string', default: 'labels.confirm', description: '確認鈕文字，最好是動詞。' },
        { name: 'data.cancelLabel', type: 'string', default: 'labels.cancel', description: '取消鈕文字。' },
        { name: 'data.tone', type: "'danger' | 'primary'", default: "'danger'", description: '確認鈕用錯誤色或主色。' },
        {
          name: 'data.typeToConfirm',
          type: '{ text, label, hint? }',
          default: '—',
          description: '要先輸入 text（忽略前後空白）確認鈕才能按；label 是輸入框標籤。開啟時聚焦輸入框，輸入正確後按 Enter 也算確認。',
        },
        { name: 'config', type: 'MatDialogConfig', default: "{ width: '360px' }", description: '其他對話框設定。' },
        { name: '回傳', type: 'Promise<boolean>', description: '按確認為 true；取消、Esc、點遮罩為 false。' },
      ],
    },
    {
      title: '注入',
      rows: [{ name: 'CONFIRM_DIALOG_LABELS', type: 'ConfirmDialogLabels', default: '選填', description: '預設的確認／取消文字（app 或頁面層都可以）；data 沒給又沒提供時，開啟前就報錯。' }],
    },
  ];
}
