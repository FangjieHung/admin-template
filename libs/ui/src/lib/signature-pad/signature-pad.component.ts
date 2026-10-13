import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule, MatCheckboxChange } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SIGNATURE_PAD_LABELS } from './signature-pad-labels';
import { SIGNATURE_STORE, SignatureAsset } from './signature-store';

export type SignatureMode = 'draw' | 'type';

/**
 * 簽名擷取元件，只負責「擷取一筆簽名證據」這一步：
 * - 手寫模式：以 Pointer Events（同時涵蓋滑鼠／觸控／觸控筆）在 canvas 上畫筆畫。
 * - 打字簽名模式：純鍵盤可操作的姓名輸入框，供無法（或不便）用指標裝置簽名的使用者作為替代方案——
 *   這不是「偵測裝置能力後自動切換」，而是一律提供的明確替代入口，行為可預期也方便測試。
 * - 預設要先勾選確認框才能確認簽署（`requireAcknowledge`），避免使用者誤觸直接送出。
 * - 簽名內容（無論是畫布還是打字姓名）一律先透過 `SIGNATURE_STORE` 存成 Blob，
 *   對外只 emit 不透明的 assetId／url，不把簽名圖檔或姓名文字內容本身夾帶送出。
 * - 本元件不知道自己在簽什麼文件——簽完之後要記到哪裡是呼叫端的職責。
 *
 * 嵌入其他容器（例如對話框）時，可用 `showConfirmButton=false` 隱藏自帶的確認鈕，
 * 改由容器讀取 `canConfirm()` 控制自己的按鈕、再呼叫 `confirm()`。
 * 畫面文字由 `SIGNATURE_PAD_LABELS` 提供；儲存方式由 `SIGNATURE_STORE` 提供（預設只存在記憶體）。
 */
@Component({
  selector: 'lib-signature-pad',
  imports: [MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule],
  templateUrl: './signature-pad.component.html',
  styleUrl: './signature-pad.component.scss',
})
export class SignaturePadComponent {
  protected readonly labels = inject(SIGNATURE_PAD_LABELS);

  private readonly assetStore = inject(SIGNATURE_STORE);

  /** 是否顯示元件自帶的「確認簽署」按鈕；由外層容器提供確認鈕時設為 false。 */
  readonly showConfirmButton = input(true);

  /** 是否要先勾選確認框才能確認簽署；false 時不顯示勾選框。 */
  readonly requireAcknowledge = input(true);

  /** 停用整個簽名板（例如文件已簽署、或尚未輪到這位簽署人）。 */
  readonly disabled = input(false);

  /** 簽名存檔成功後送出不透明的資產紀錄（不含簽名內容本身）。 */
  readonly signed = output<SignatureAsset>();

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private isDrawing = false;
  private lastPoint: { x: number; y: number } | undefined;

  protected readonly mode = signal<SignatureMode>('draw');
  protected readonly hasDrawing = signal(false);
  protected readonly typedName = signal('');
  protected readonly acknowledged = signal(false);
  private readonly _submitting = signal(false);
  /** 正在存檔簽名中。 */
  readonly submitting = this._submitting.asReadonly();

  /** 目前模式是否已經有「可視為一筆簽名」的內容：手寫模式看有沒有筆畫，打字模式看姓名去空白後是否非空。 */
  protected readonly hasSignatureInput = computed(() =>
    this.mode() === 'draw' ? this.hasDrawing() : this.typedName().trim().length > 0,
  );

  /** 簽名已完成、可以確認：沒有停用、有簽名內容、（需要時）已勾選確認、且不在存檔中。 */
  readonly canConfirm = computed(
    () =>
      !this.disabled() &&
      this.hasSignatureInput() &&
      (!this.requireAcknowledge() || this.acknowledged()) &&
      !this._submitting(),
  );

  /**
   * 每次要畫圖／清空之前才即時取得 2D context，絕不快取成欄位。
   *
   * 曾經的 bug：原本在 ngAfterViewInit（只會執行一次）把 ctx 存成 private 欄位。
   * 但畫布是包在 `@if (mode() === 'draw')` 底下（見 template）——Angular 的 @if 每次
   * 條件切換都會「銷毀並重建」整段 DOM，不是隱藏／顯示。使用者從手寫模式切到打字模式
   * 再切回手寫模式後，viewChild('canvas') 正確指向新畫布，但快取的 this.ctx 仍指向
   * 舊的、已從 DOM 卸載的畫布——之後的筆畫全部畫到一塊沒人看得到的舊畫布上，
   * hasDrawing 卻仍照常從 pointer 事件變成 true，使用者會簽出一張空白 PNG 卻毫無警示。
   * 改成每次用到就直接向「當下」的 canvasRef() 重新要 context，就不會有這個過期參照問題；
   * 瀏覽器對同一個畫布重複呼叫 getContext('2d') 本來就是回傳同一顆既有物件，成本可忽略。
   */
  private getContext(): CanvasRenderingContext2D | null {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return null;
    // jsdom 在沒有裝 `canvas` npm 套件時，getContext('2d') 會回傳 null（並印出一則
    // "Not implemented" 的警告，這是 jsdom 本身的已知限制，不是本元件的錯誤）。
    // 之後所有畫圖呼叫都要 guard 回傳值存在，真實瀏覽器才會實際落筆。
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineWidth = 2 * this.backingScale(canvas);
      ctx.lineCap = 'round';
      ctx.strokeStyle = getComputedStyle(canvas).color;
    }
    return ctx;
  }

  /**
   * 畫布的 CSS 顯示尺寸會隨容器（例如大尺寸 dialog、手機全螢幕）伸縮，但繪圖座標系是
   * canvas 的 width／height 屬性。兩者不一致時筆畫會偏移、縮放。因此在「還沒有筆畫」時
   * （開始第一筆或清除後）把繪圖緩衝區對齊實際顯示尺寸 × devicePixelRatio，
   * 已有筆畫時不動（改 width 會清空畫布）。jsdom 的 getBoundingClientRect 一律是 0，直接略過。
   */
  private syncCanvasSize(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }

  /** 繪圖緩衝區相對 CSS 顯示尺寸的倍率；無法量測時視為 1。 */
  private backingScale(canvas: HTMLCanvasElement): number {
    const rect = canvas.getBoundingClientRect();
    return rect.width > 0 ? canvas.width / rect.width : 1;
  }

  protected switchMode(mode: SignatureMode): void {
    this.mode.set(mode);
  }

  protected onPointerDown(event: PointerEvent): void {
    if (this.disabled()) return;
    if (!this.hasDrawing()) this.syncCanvasSize();
    this.isDrawing = true;
    this.lastPoint = this.pointFromEvent(event);
    // jsdom 的 canvas 元素沒有實作 setPointerCapture，真實瀏覽器才有這個方法；
    // 用 optional chaining 呼叫，測試環境下安靜跳過，不影響邏輯正確性。
    (event.target as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.isDrawing) return;
    const point = this.pointFromEvent(event);
    const ctx = this.getContext();
    if (ctx && this.lastPoint) {
      ctx.beginPath();
      ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    this.lastPoint = point;
    this.hasDrawing.set(true);
  }

  protected onPointerUp(): void {
    this.isDrawing = false;
    this.lastPoint = undefined;
  }

  /** 事件座標換算成畫布繪圖座標（含 CSS 尺寸與繪圖緩衝區的倍率）。 */
  private pointFromEvent(event: PointerEvent): { x: number; y: number } {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
  }

  /** 清除重寫：依目前模式清空畫布筆畫或已輸入的姓名，不影響已勾選的確認同意狀態。 */
  protected clear(): void {
    if (this.mode() === 'draw') {
      const canvas = this.canvasRef()?.nativeElement;
      const ctx = this.getContext();
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      this.hasDrawing.set(false);
    } else {
      this.typedName.set('');
    }
    this.isDrawing = false;
    this.lastPoint = undefined;
  }

  protected onTypedNameInput(value: string): void {
    this.typedName.set(value);
  }

  protected onTypedNameInputEvent(event: Event): void {
    this.onTypedNameInput((event.target as HTMLInputElement).value);
  }

  protected toggleAcknowledged(checked: boolean): void {
    this.acknowledged.set(checked);
  }

  protected onAcknowledgeChange(event: MatCheckboxChange): void {
    this.toggleAcknowledged(event.checked);
  }

  /**
   * 確認簽署：把簽名內容存進 `SIGNATURE_STORE`，成功後 emit `signed` 並回傳同一筆資產紀錄。
   * 尚未完成簽名（`canConfirm()` 為 false）或無法取得簽名內容時回傳 undefined、不做任何事。
   */
  async confirm(): Promise<SignatureAsset | undefined> {
    if (!this.canConfirm()) return undefined;

    this._submitting.set(true);
    try {
      const blob = this.mode() === 'draw' ? await this.captureDrawingBlob() : this.typedNameBlob();
      if (!blob) return undefined;
      const filename = this.mode() === 'draw' ? 'signature.png' : 'signature-typed.txt';
      const stored = await this.assetStore.store(blob, filename);
      this.signed.emit(stored);
      return stored;
    } finally {
      this._submitting.set(false);
    }
  }

  /**
   * 抽成獨立、可被測試覆寫的方法：canvas.toBlob() 在 jsdom 沒有裝 `canvas` 套件時
   * callback 永遠不會被呼叫（會讓測試卡死），因此測試會直接覆寫這個方法，只驗證
   * 「元件何時呼叫、把結果傳給誰」這一層邏輯，真正的畫布轉檔交給瀏覽器原生實作負責。
   */
  protected captureDrawingBlob(): Promise<Blob | undefined> {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return Promise.resolve(undefined);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? undefined), 'image/png'));
  }

  private typedNameBlob(): Blob {
    return new Blob([this.typedName().trim()], { type: 'text/plain' });
  }
}
