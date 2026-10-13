import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SIGNATURE_STORE, SignatureAsset, SignatureStore } from './signature-store';
import { SIGNATURE_PAD_LABELS, SignaturePadLabels } from './signature-pad-labels';
import { SignaturePadComponent } from './signature-pad.component';

const LABELS: SignaturePadLabels = {
  drawTab: '手寫簽名',
  typeTab: '打字簽名',
  canvasAriaLabel: '簽名畫布',
  emptyDrawHint: '請在框內用滑鼠或手指簽名',
  typedNameLabel: '簽署人姓名',
  typedNamePlaceholder: '請輸入姓名',
  clear: '清除重寫',
  acknowledge: '我確認以上內容無誤',
  confirmSign: '確認簽署',
  signing: '處理中…',
  notice: '示範用簽名，不具法律效力',
};

class FakeSignatureStore implements SignatureStore {
  readonly stored: Array<{ file: Blob; filename: string }> = [];
  private counter = 0;

  store(file: Blob, filename: string): Promise<SignatureAsset> {
    this.stored.push({ file, filename });
    this.counter += 1;
    return Promise.resolve({ assetId: `sig-asset-${this.counter}`, url: `blob:sig-${this.counter}` });
  }
}

function createFixture() {
  const fixture = TestBed.createComponent(SignaturePadComponent);
  fixture.detectChanges();
  // jsdom 沒有裝 `canvas` 套件時，canvas.toBlob() 的 callback 永遠不會被呼叫（見元件內註解），
  // 測試改為直接覆寫 captureDrawingBlob，只驗證元件邏輯（何時呼叫、傳什麼給 asset store），
  // 不驗證真正的畫布轉檔（那是瀏覽器原生 API 的職責，不是本元件的邏輯）。
  fixture.componentInstance['captureDrawingBlob'] = () =>
    Promise.resolve(new Blob(['fake-png-bytes'], { type: 'image/png' }));
  return fixture;
}

function dispatchPointer(el: Element, type: string, x: number, y: number): void {
  el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true }));
}

function drawStroke(fixture: ReturnType<typeof createFixture>): void {
  const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
  dispatchPointer(canvas, 'pointerdown', 10, 10);
  dispatchPointer(canvas, 'pointermove', 20, 20);
  dispatchPointer(canvas, 'pointerup', 20, 20);
  fixture.detectChanges();
}

/**
 * jsdom 的 canvas.getContext('2d') 一律回傳 null（見上方註解），沒辦法用真的 2D context
 * 驗證「筆畫有沒有畫到目前的畫布上」。這裡改用一個可觀察呼叫紀錄的假 context 取代它：
 * 每次呼叫 getContext('2d') 都回傳一顆「新」的假 context 物件並記錄下來，這樣就能驗證
 * 「元件在 draw→type→draw 來回切換後，畫圖呼叫是否落在最新一次取得的 context 上」——
 * 這正是本迴歸測試要抓的 bug：舊寫法把 ctx 快取成欄位，畫布重建後仍沿用舊 context，
 * 即使畫布本身已經從 DOM 卸載，等於是把筆畫（stroke 呼叫）畫進一顆沒人看得到的物件。
 */
function stubCanvasContext() {
  const original = HTMLCanvasElement.prototype.getContext;
  const contexts: Array<{ calls: string[]; strokeStyles: string[] }> = [];

  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    contextId: string,
    ...rest: unknown[]
  ): unknown {
    if (contextId !== '2d') {
      return (original as (...a: unknown[]) => unknown).apply(this, [contextId, ...rest]);
    }
    const calls: string[] = [];
    const strokeStyles: string[] = [];
    let strokeStyle = 'rgb(0, 0, 0)';
    const fakeCtx = {
      lineWidth: 0,
      lineCap: 'butt',
      beginPath: () => calls.push('beginPath'),
      moveTo: () => calls.push('moveTo'),
      lineTo: () => calls.push('lineTo'),
      stroke: () => calls.push('stroke'),
      clearRect: () => calls.push('clearRect'),
    };
    Object.defineProperty(fakeCtx, 'strokeStyle', {
      get: () => strokeStyle,
      set: (value: string) => {
        strokeStyle = value;
        strokeStyles.push(value);
      },
    });
    contexts.push({ calls, strokeStyles });
    return fakeCtx;
  } as typeof HTMLCanvasElement.prototype.getContext;

  return {
    contexts,
    restore: () => {
      HTMLCanvasElement.prototype.getContext = original;
    },
  };
}

describe('SignaturePadComponent', () => {
  let assetGateway: FakeSignatureStore;

  beforeEach(() => {
    assetGateway = new FakeSignatureStore();
    TestBed.configureTestingModule({
      providers: [
        { provide: SIGNATURE_STORE, useValue: assetGateway },
        { provide: SIGNATURE_PAD_LABELS, useValue: LABELS },
      ],
    });
  });

  it('預設是手寫模式，畫布尚未有筆畫前「清除重寫」按鈕停用，確認簽署也停用', () => {
    const fixture = createFixture();
    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(fixture.componentInstance['canConfirm']()).toBe(false);
  });

  it('pointer 事件畫出筆畫後 hasDrawing 變 true；但未勾選確認前仍不能簽署', () => {
    const fixture = createFixture();
    drawStroke(fixture);

    expect(fixture.componentInstance['hasDrawing']()).toBe(true);
    expect(fixture.componentInstance['canConfirm']()).toBe(false); // 尚未勾選確認同意
  });

  it('勾選確認同意後，有筆畫時 canConfirm 變 true', () => {
    const fixture = createFixture();
    drawStroke(fixture);
    fixture.componentInstance['toggleAcknowledged'](true);

    expect(fixture.componentInstance['canConfirm']()).toBe(true);
  });

  it('清除重寫：清空目前筆畫，canConfirm 變回 false', () => {
    const fixture = createFixture();
    drawStroke(fixture);
    fixture.componentInstance['toggleAcknowledged'](true);
    expect(fixture.componentInstance['canConfirm']()).toBe(true);

    fixture.componentInstance['clear']();
    fixture.detectChanges();

    expect(fixture.componentInstance['hasDrawing']()).toBe(false);
    expect(fixture.componentInstance['canConfirm']()).toBe(false);
  });

  it('切換為打字簽名模式：鍵盤輸入姓名（不經過任何 pointer 事件）即可讓 canConfirm 成立', () => {
    const fixture = createFixture();
    fixture.componentInstance['switchMode']('type');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();

    input.value = '王小明';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance['typedName']()).toBe('王小明');
    fixture.componentInstance['toggleAcknowledged'](true);

    expect(fixture.componentInstance['canConfirm']()).toBe(true);
  });

  it('打字簽名模式下，僅有空白字元不算有效輸入', () => {
    const fixture = createFixture();
    fixture.componentInstance['switchMode']('type');
    fixture.componentInstance['onTypedNameInput']('   ');
    fixture.componentInstance['toggleAcknowledged'](true);

    expect(fixture.componentInstance['canConfirm']()).toBe(false);
  });

  it('確認簽署：手寫模式下透過 SIGNATURE_STORE 存檔，只 emit 不透明的 assetId/url，不外洩簽名內容本身', async () => {
    const fixture = createFixture();
    const emitted: SignatureAsset[] = [];
    fixture.componentInstance.signed.subscribe((a) => emitted.push(a));

    drawStroke(fixture);
    fixture.componentInstance['toggleAcknowledged'](true);
    await fixture.componentInstance['confirm']();

    expect(assetGateway.stored).toHaveLength(1);
    expect(assetGateway.stored[0].file.type).toBe('image/png');
    expect(emitted).toEqual([{ assetId: 'sig-asset-1', url: 'blob:sig-1' }]);
  });

  it('確認簽署：打字簽名模式下也是透過 SIGNATURE_STORE 存檔（存成文字檔），不是傳姓名字串出去', async () => {
    const fixture = createFixture();
    const emitted: SignatureAsset[] = [];
    fixture.componentInstance.signed.subscribe((a) => emitted.push(a));

    fixture.componentInstance['switchMode']('type');
    fixture.componentInstance['onTypedNameInput']('陳大同');
    fixture.componentInstance['toggleAcknowledged'](true);
    await fixture.componentInstance['confirm']();

    expect(assetGateway.stored).toHaveLength(1);
    expect(assetGateway.stored[0].file.type).toBe('text/plain');
    expect(emitted).toEqual([{ assetId: 'sig-asset-1', url: 'blob:sig-1' }]);
  });

  it('未勾選確認同意或沒有簽名內容時呼叫 confirm 是 no-op，不會呼叫 asset store', async () => {
    const fixture = createFixture();
    const emitted: SignatureAsset[] = [];
    fixture.componentInstance.signed.subscribe((a) => emitted.push(a));

    await fixture.componentInstance['confirm'](); // 什麼都沒填、也沒勾選
    expect(assetGateway.stored).toHaveLength(0);
    expect(emitted).toHaveLength(0);

    drawStroke(fixture); // 有畫但沒勾選確認
    await fixture.componentInstance['confirm']();
    expect(assetGateway.stored).toHaveLength(0);
  });

  it('labels.notice 有值時顯示附註', () => {
    const fixture = createFixture();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('不具法律效力');
  });

  it('requireAcknowledge=false 時不顯示勾選框，有簽名內容就能確認', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('requireAcknowledge', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-checkbox')).toBeNull();
    drawStroke(fixture);
    expect(fixture.componentInstance['canConfirm']()).toBe(true);
  });

  it('disabled 時不接受筆畫，也不能確認', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    dispatchPointer(canvas, 'pointerdown', 10, 10);
    dispatchPointer(canvas, 'pointermove', 20, 20);
    expect(fixture.componentInstance['hasDrawing']()).toBe(false);
    fixture.componentInstance['onTypedNameInput']('王小明');
    fixture.componentInstance['switchMode']('type');
    fixture.componentInstance['toggleAcknowledged'](true);
    expect(fixture.componentInstance['canConfirm']()).toBe(false);
  });

  it('手寫筆色讀取目前主題的文字色，而非硬編碼深色', () => {
    const stub = stubCanvasContext();
    vi.stubGlobal('getComputedStyle', () => ({ color: 'rgb(17, 34, 51)' }));
    try {
      const fixture = createFixture();
      drawStroke(fixture);

      expect(stub.contexts[0].strokeStyles).toContain('rgb(17, 34, 51)');
    } finally {
      vi.unstubAllGlobals();
      stub.restore();
    }
  });

  it(
    '迴歸：手寫→切換打字→切回手寫後再畫一次，第二次筆畫必須畫在「目前」畫布的 context 上，' +
      '不能沿用切換前已卸載的舊畫布 context（曾經的 bug：ctx 快取在 ngAfterViewInit，' +
      '@if 重建畫布後 viewChild 指向新畫布，但快取的 ctx 仍是舊的，筆畫全部落空、' +
      '使用者卻毫無所覺地簽出一張空白 PNG）',
    () => {
      const stub = stubCanvasContext();
      try {
        const fixture = createFixture();

        // 第一次在初始畫布上畫一筆：應該取得並使用第 1 顆 context。
        drawStroke(fixture);
        expect(stub.contexts).toHaveLength(1);
        expect(stub.contexts[0].calls).toContain('stroke');

        // 切到打字模式（畫布連同其 context 一起從 DOM 卸載），再切回手寫模式——
        // @if 會重新建立一個全新的 <canvas> 元素。
        fixture.componentInstance['switchMode']('type');
        fixture.detectChanges();
        fixture.componentInstance['switchMode']('draw');
        fixture.detectChanges();

        // 在「新」畫布上再畫一次：修好的元件必須重新取得 context（第 2 顆），
        // 且真正的 stroke 呼叫要打在這顆新 context 上，不是第 1 顆已卸載的舊 context。
        drawStroke(fixture);

        expect(stub.contexts).toHaveLength(2);
        expect(stub.contexts[1].calls).toContain('stroke');
        // 舊 context 在第二次繪圖之後不應該再收到任何新呼叫——證明筆畫沒有誤畫回舊畫布。
        expect(stub.contexts[0].calls.filter((c) => c === 'stroke')).toHaveLength(1);

        expect(fixture.componentInstance['hasDrawing']()).toBe(true);
        fixture.componentInstance['toggleAcknowledged'](true);
        expect(fixture.componentInstance['canConfirm']()).toBe(true);
      } finally {
        stub.restore();
      }
    },
  );

  it('confirm() 會回傳與 signed 事件相同的資產紀錄，供外層容器（對話框）直接取用', async () => {
    const fixture = createFixture();
    fixture.componentInstance['switchMode']('type');
    fixture.componentInstance['onTypedNameInput']('陳大同');
    fixture.componentInstance['toggleAcknowledged'](true);

    await expect(fixture.componentInstance.confirm()).resolves.toEqual({
      assetId: 'sig-asset-1',
      url: 'blob:sig-1',
    });
  });

  it('showConfirmButton=false 時不渲染自帶的確認簽署鈕（由外層容器提供）', () => {
    const fixture = createFixture();
    const confirmText = LABELS.confirmSign;
    const buttonTexts = () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttonTexts()).toContain(confirmText);

    fixture.componentRef.setInput('showConfirmButton', false);
    fixture.detectChanges();
    expect(buttonTexts()).not.toContain(confirmText);
  });
});
