import { Component, signal } from '@angular/core';
import { SignatureAsset, SignaturePadComponent } from '@car-rental/ui';
import { SIGNATURE_PAD_LABEL_PROVIDERS } from '../../shared/ui/component-label-providers';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('signature-pad');

@Component({
  selector: 'app-signature-pad-page',
  imports: [SignaturePadComponent, ShowcasePageComponent, DemoBlockComponent],
  providers: [...SIGNATURE_PAD_LABEL_PROVIDERS],
  template: `
    <app-showcase-page [summary]="entry.summary" [whenToUse]="whenToUse" [avoid]="avoid" [source]="entry.source" [usage]="usage" [api]="api">
      <div class="demo-grid">
        <app-demo-block heading="預設" description="手寫或切換成打字簽名；勾選確認後才能送出。">
          <lib-signature-pad (signed)="signed.set($event)" />
          @if (signed(); as asset) {
            <p class="demo-note" aria-live="polite">已存檔：<code>{{ asset.assetId }}</code></p>
            @if (asset.url) {
              <img class="signature-preview" [src]="asset.url" alt="剛才的簽名" />
            }
          }
        </app-demo-block>

        <app-demo-block heading="不需要勾選確認" description="requireAcknowledge=false：有簽名內容就能確認（例如簽收、簽到）。">
          <lib-signature-pad [requireAcknowledge]="false" (signed)="quick.set($event)" />
          @if (quick(); as asset) {
            <p class="demo-note" aria-live="polite">已存檔：<code>{{ asset.assetId }}</code></p>
          }
        </app-demo-block>

        <app-demo-block heading="停用" description="disabled：例如文件已簽署，或還沒輪到這位簽署人。">
          <lib-signature-pad [disabled]="true" />
        </app-demo-block>
      </div>
    </app-showcase-page>
  `,
  styleUrl: '../../showcase/demo-shared.scss',
  styles: `
    .signature-preview {
      display: block;
      max-width: 100%;
      margin-top: 0.5rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-small);
    }
  `,
})
export class SignaturePadPageComponent {
  protected readonly entry = ENTRY;
  protected readonly signed = signal<SignatureAsset | null>(null);
  protected readonly quick = signal<SignatureAsset | null>(null);

  protected readonly whenToUse = ['需要一筆「本人確認」的證據：簽收、同意書、交接單。', '手機與平板上用手指簽；不方便手寫時改用打字簽名。'];
  protected readonly avoid = ['具法律效力的電子簽章：需要憑證與稽核流程，這個元件只擷取簽名圖。'];

  protected readonly usage = `// 頁面 providers：文字（必填）與儲存方式（選填，預設只存在記憶體）
providers: [
  { provide: SIGNATURE_PAD_LABELS, useValue: MY_LABELS },
  { provide: SIGNATURE_STORE, useClass: UploadSignatureStore }, // store(file, filename) => Promise<{ assetId, url }>
]

<lib-signature-pad (signed)="onSigned($event)" />

<!-- 放進對話框：隱藏自帶的確認鈕，由對話框的按鈕呼叫 confirm() -->
<lib-signature-pad #pad [showConfirmButton]="false" />
<button matButton="filled" [disabled]="!pad.canConfirm()" (click)="pad.confirm()">送出</button>`;

  protected readonly api: ApiSection[] = [
    {
      title: '輸入與輸出',
      rows: [
        { name: '[showConfirmButton]', type: 'boolean', default: 'true', description: '是否顯示自帶的確認鈕。' },
        { name: '[requireAcknowledge]', type: 'boolean', default: 'true', description: '是否要先勾選確認框。' },
        { name: '[disabled]', type: 'boolean', default: 'false', description: '停用整個簽名板。' },
        { name: '(signed)', type: 'SignatureAsset', description: '存檔成功後送出 { assetId, url }；不含簽名內容本身。' },
      ],
    },
    {
      title: '公開成員',
      rows: [
        { name: 'canConfirm()', type: 'Signal<boolean>', description: '目前可以確認（有內容、已勾選、未停用、不在存檔中）。' },
        { name: 'confirm()', type: 'Promise<SignatureAsset | undefined>', description: '存檔並送出 signed；不能確認時不做任何事。' },
        { name: 'submitting()', type: 'Signal<boolean>', description: '正在存檔。' },
      ],
    },
    {
      title: '注入',
      rows: [
        { name: 'SIGNATURE_PAD_LABELS', type: 'SignaturePadLabels', default: '必填', description: '所有文字；notice 選填（簽名區下方的附註）。' },
        { name: 'SIGNATURE_STORE', type: 'SignatureStore', default: 'ObjectUrlSignatureStore', description: '簽名存到哪裡；預設只存在記憶體（blob: 網址）。' },
      ],
    },
  ];
}
