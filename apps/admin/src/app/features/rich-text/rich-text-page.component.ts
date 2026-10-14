import { Component, computed, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import {
  CommentDeleteEvent,
  CommentEditEvent,
  CommentItem,
  CommentSubmitEvent,
  CommentThreadComponent,
  MentionSource,
  RichTextEditorComponent,
  RichTextViewComponent,
  mentionIdsOf,
} from '@admin-template/ui';
import { CONFIRM_DIALOG_LABEL_PROVIDERS, FEEDBACK_STATE_LABEL_PROVIDERS } from '../../shared/ui/component-label-providers';
import { RICH_TEXT_LABEL_PROVIDERS } from '../../shared/ui/rich-text-labels';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';
import { DEMO_ME, DEMO_PEOPLE, demoComments, searchDemoPeople } from './demo-rich-text-data';

const ENTRY = detailOf('rich-text');

/** 示範的寫入延遲（送出、編輯、刪除）。 */
const SAVE_DELAY = 600;

/** 富文字、留言與 @提及展示頁（/components/rich-text）。 */
@Component({
  selector: 'app-rich-text-page',
  imports: [
    ReactiveFormsModule,
    MatSlideToggle,
    RichTextEditorComponent,
    RichTextViewComponent,
    CommentThreadComponent,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  providers: [...RICH_TEXT_LABEL_PROVIDERS, ...CONFIRM_DIALOG_LABEL_PROVIDERS, ...FEEDBACK_STATE_LABEL_PROVIDERS],
  templateUrl: './rich-text-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './rich-text-page.component.scss'],
})
export class RichTextPageComponent {
  protected readonly entry = ENTRY;

  // ---- (a) 搭配 reactive form ----
  /** 最近幾次提及搜尋的查詢字（看得出中文輸入法組字中沒有搜尋）。 */
  protected readonly searchLog = signal<readonly string[]>([]);
  protected readonly mentionSource: MentionSource = (query) => {
    this.searchLog.update((log) => [...log, query].slice(-6));
    return searchDemoPeople(query);
  };
  protected readonly note = new FormControl(
    '<p>會議室投影機已送修，<strong>週四上午</strong>原廠取件。<span data-type="mention" data-id="p-wu" data-label="吳怡君">@吳怡君</span> 請通知客戶：</p><ul><li>備用機借到送修回來為止</li><li>歸還時帶回 HDMI 線</li></ul>',
    { nonNullable: true, validators: [Validators.required] },
  );
  protected readonly noteValue = signal(this.note.value);
  protected readonly mentionIds = signal<readonly string[]>(mentionIdsOf(this.note.value));
  protected readonly mentionNames = computed(() =>
    this.mentionIds().map((id) => DEMO_PEOPLE.find((p) => p.id === id)?.name ?? id),
  );

  // ---- (b) 字數上限 ----
  protected readonly limited = new FormControl(
    '<p>這段備註有 60 字的上限：接近上限時欄位下方顯示剩幾個字，超過時欄位變成錯誤狀態，表單也是 invalid。</p>',
    { nonNullable: true },
  );
  protected readonly limitedStatus = signal(this.limited.status);

  // ---- (c) 唯讀與停用 ----
  protected readonly readonlyValue = new FormControl(
    '<p>唯讀：可以選取、複製，不能編輯，也不顯示工具列。連結 <a href="https://example.com">example.com</a> 照常可以點。</p>',
    { nonNullable: true },
  );
  protected readonly disabledValue = new FormControl(
    { value: '<p>停用：整個欄位與工具列都不能操作（表單的 disable() 或 [disabled] 輸入）。</p>', disabled: true },
    { nonNullable: true },
  );

  // ---- (d) 留言串 ----
  protected readonly me = DEMO_ME;
  protected readonly comments = signal<readonly CommentItem[]>(demoComments(Date.now()));
  /** 示範：下一次送出／編輯／刪除失敗（看錯誤與重試）。 */
  protected readonly failNext = signal(false);
  private seq = 0;

  constructor() {
    this.note.valueChanges.subscribe((value) => this.noteValue.set(value));
    this.limited.statusChanges.subscribe((status) => this.limitedStatus.set(status));
  }

  protected onSubmit(event: CommentSubmitEvent): void {
    event.respondWith(
      this.simulate(() => {
        const me = this.me;
        this.comments.update((list) => [
          ...list,
          { id: `new-${++this.seq}`, author: { id: me.id, name: me.name, avatar: me.avatar }, html: event.html, createdAt: Date.now() },
        ]);
      }),
    );
  }

  protected onEdit(event: CommentEditEvent): void {
    event.respondWith(
      this.simulate(() =>
        this.comments.update((list) => list.map((c) => (c.id === event.id ? { ...c, html: event.html, editedAt: Date.now() } : c))),
      ),
    );
  }

  protected onDelete(event: CommentDeleteEvent): void {
    event.respondWith(this.simulate(() => this.comments.update((list) => list.filter((c) => c.id !== event.id))));
  }

  protected resetComments(): void {
    this.comments.set(demoComments(Date.now()));
  }

  /** 模擬寫入：延遲後成功；開了「下一次失敗」就失敗一次。 */
  private simulate(apply: () => void): Promise<void> {
    const fail = this.failNext();
    if (fail) this.failNext.set(false);
    return new Promise((resolve, reject) =>
      setTimeout(() => {
        if (fail) {
          reject(new Error('示範失敗'));
          return;
        }
        apply();
        resolve();
      }, SAVE_DELAY),
    );
  }

  protected readonly whenToUse = [
    '工單、案件、專案的備註與內部協作：需要粗體、清單、連結，或要提及同事讓對方收到通知。',
    '留言串：一則一則的討論，自己的留言可以修改、刪除，送出失敗時內容不會不見。',
    '把使用者輸入的 HTML 顯示出來（lib-rich-text-view）：元件自己用白名單清理，script、事件屬性、javascript: 連結都會被拿掉。',
  ];
  protected readonly avoid = [
    '單行或短文字（標題、名稱）：用一般的 matInput。',
    '要排版成文件（標題層級、表格、圖片、多欄）：這個編輯器刻意只支援協作需要的格式。',
    '需要多人同時編輯同一段文字：這裡沒有協同編輯（CRDT）。',
  ];

  protected readonly usage = `// 頁面的 providers：畫面文字（{label}、{keys}、{count}、{query}、{name}、{time} 會被換掉）
providers: [{ provide: RICH_TEXT_LABELS, useValue: ZH_TW_RICH_TEXT }]

// 提及的資料來源：回傳 Promise 或 Observable（中文輸入法組字確定後才會呼叫）
readonly people: MentionSource = (query) => this.api.searchPeople(query);
readonly note = new FormControl('', { nonNullable: true });

<lib-rich-text-editor
  [formControl]="note"
  placeholder="寫下備註，輸入 @ 提及同事"
  [mentionSource]="people"
  [maxLength]="500"
  (mentions)="mentionIds.set($event)"
/>

<!-- 顯示：元件自己用白名單清理 -->
<lib-rich-text-view [html]="note.value" />

<!-- 留言串：受控，事件裡用 respondWith(promise) 回報成功或失敗 -->
<lib-comment-thread
  [comments]="comments()"
  [currentUserId]="me.id"
  [mentionSource]="people"
  (commentSubmit)="$event.respondWith(api.addComment($event.html, $event.mentions))"
  (commentEdit)="$event.respondWith(api.editComment($event.id, $event.html, $event.mentions))"
  (commentDelete)="$event.respondWith(api.removeComment($event.id))"
/>`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-rich-text-editor 輸入與輸出',
      rows: [
        { name: 'formControl／ngModel', type: 'string（HTML）', description: '值是 HTML 字串；空白內容是空字串。只會出現 p、br、strong、em、ul、ol、li、blockquote、a 與提及標記。' },
        { name: '[mentionSource]', type: 'MentionSource', default: 'null', description: '(query) => Promise | Observable<{ id, name, description?, avatar? }[]>。輸入 @ 打開清單：↑↓ 選擇、Enter 或 Tab 確認、Esc 關閉；中文輸入法組字中不搜尋。' },
        { name: '[maxLength]', type: 'number | null', default: 'null', description: '字數上限（純文字長度，提及算「@名字」）。接近時顯示「剩 N 字」，超過時是錯誤狀態，表單錯誤 maxlength。' },
        { name: 'placeholder', type: 'string', default: "''", description: '沒有內容時的提示（報讀器念 aria-placeholder）。' },
        { name: '[readonly]／[disabled]', type: 'boolean', default: 'false', description: '唯讀不顯示工具列、可以選取；停用整個欄位與工具列不能操作（也可以用表單的 disable()）。' },
        { name: 'minHeight／maxHeight', type: 'string', default: "'6rem'／'20rem'", description: '編輯區高度；內容超過 maxHeight 時在框內捲動。' },
        { name: 'ariaLabel／ariaLabelledby／ariaDescribedby', type: 'string', description: '編輯區的無障礙名稱與說明（沒給名稱時用 RICH_TEXT_LABELS.editor）。' },
        { name: '(mentions)', type: 'string[]', description: '被提及的人的 id（依出現順序、不重複），清單改變時送出。' },
        { name: '(contentChange)', type: 'RichTextContent', description: '每次編輯後的 html、text、mentions、length。' },
        { name: '(submitShortcut)', type: 'void', description: '⌘↵／Ctrl+↵（留言串用來送出）。' },
      ],
    },
    {
      title: '工具列與快捷鍵',
      rows: [
        { name: '粗體／斜體', type: '⌘B／⌘I（Windows：Ctrl）', description: '按鈕有 aria-pressed（游標所在的格式）、提示顯示快捷鍵、aria-keyshortcuts。' },
        { name: '項目清單／編號清單／引用', type: '⌘⇧8／⌘⇧7／⌘⇧B', description: '也可以在行首輸入「- 」「1. 」「> 」。' },
        { name: '連結', type: '沒有快捷鍵', description: '⌘K 是全站搜尋（⌘⇧K 也會打開它，Firefox 又把 Ctrl+Shift+K 留給開發者工具）；按鈕打開小視窗，只接受 http、https、mailto。' },
        { name: '清除格式', type: '⌘\\', description: '拿掉選取範圍的粗體、斜體、連結，清單與引用變回段落。' },
        { name: '工具列鍵盤', type: '← → Home End', description: '整個工具列只有一個 Tab 停點（roving tabindex）。' },
      ],
    },
    {
      title: 'lib-comment-thread',
      rows: [
        { name: '[comments]', type: 'CommentItem[]', default: '必填', description: '{ id, author: { id, name, avatar? }, html, createdAt, editedAt? }，舊到新。元件不自己存資料。' },
        { name: '[currentUserId]', type: 'string | null', default: 'null', description: '作者是自己的留言可以編輯（原地換成編輯器，Esc 取消）與刪除（確認對話框）。' },
        { name: '[visibleCount]', type: 'number', default: '5', description: '先顯示最新的幾則；較早的摺成「顯示較早的 M 則」。' },
        { name: '[mentionSource]／[maxLength]／[canComment]', type: '—', description: '輸入框與編輯器的提及來源、字數上限；canComment=false 時沒有輸入框。' },
        { name: '(commentSubmit)／(commentEdit)／(commentDelete)', type: 'Comment…Event', description: '帶 html、text、mentions（刪除只有 id）。在處理函式裡同步呼叫 event.respondWith(promise)：處理中停用輸入，reject 時保留內容、顯示錯誤、可以重試。' },
      ],
    },
    {
      title: 'lib-rich-text-view 與工具函式',
      rows: [
        { name: 'lib-rich-text-view [html]', type: 'string', description: '顯示 HTML：元件自己用白名單重建節點（不用 innerHTML），連結加 rel="noopener noreferrer"、target="_blank"，提及畫成小標籤。' },
        { name: 'sanitizeRichTextHtml(html)', type: 'string', description: '同一份白名單，回傳清理後的 HTML（例如存進資料庫前）。' },
        { name: 'mentionIdsOf(html)', type: 'string[]', description: '從 HTML 取出提及的 id。' },
        { name: 'normalizeLinkHref(text)', type: 'string | null', description: '網址驗證：只接受 http、https、mailto；網域補 https://、Email 補 mailto:。' },
        { name: 'RICH_TEXT_LABELS', type: 'RichTextLabels', default: '必填', description: '47 句畫面文字（工具列、連結、提及、字數、留言串）；少一句會在建立元件時丟出錯誤。' },
      ],
    },
  ];
}
