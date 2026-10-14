import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewEncapsulation,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { CdkStep } from '@angular/cdk/stepper';
import { AbstractControl } from '@angular/forms';
import { Subscription } from 'rxjs';

/**
 * 步驟精靈裡的一步（放在 `<lib-step-wizard>` 裡）。內容就是元件裡面放的東西；只有目前這一步會顯示，
 * 其他步驟的內容不在畫面上，但元件與表單狀態都留著（換步驟不會清掉已填的值）。
 *
 * 繼承 CDK 的 `CdkStep`，沿用它的輸入：`label`（步驟名稱，必填）、`stepControl`（這一步的 FormGroup，
 * 下一步時驗證它）、`optional`（選填步驟，可以跳過）、`errorMessage`（整組驗證失敗時摘要下方的補充說明）、
 * `completed`（不用表單時自己標記完成）、`editable`（false：完成後不能再回來改）。
 */
@Component({
  selector: 'lib-wizard-step',
  template: '<ng-template><ng-content /></ng-template>',
  providers: [{ provide: CdkStep, useExisting: forwardRef(() => WizardStepComponent) }],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  exportAs: 'libWizardStep',
})
export class WizardStepComponent extends CdkStep implements OnChanges, OnDestroy {
  /** 步驟標題下方的一句說明。 */
  readonly description = input('');
  /**
   * 錯誤摘要列出的欄位：表單控制項名稱（巢狀用 `a.b`）→ 欄位標籤，依畫面上的順序。
   * 下一步被擋下時，摘要列出其中無效的欄位，並把焦點移到第一個無效欄位
   * （找 `[data-field="名稱"]` 或 `[formControlName="名稱"]` 裡第一個可以聚焦的元素）。
   */
  readonly fieldLabels = input<Readonly<Record<string, string>>>({});

  /** 驗證失敗過：按下一步／完成被擋下，或非線性模式帶著錯誤離開。之後只要還有錯就顯示錯誤狀態。 */
  readonly attempted = signal(false);
  /** 輸入、表單值或狀態改變就加一，讓精靈重新計算每一步的狀態（stepControl 的狀態不是 signal）。 */
  readonly revision = signal(0);

  private controlSub: Subscription | null = null;
  private watched: AbstractControl | null = null;

  override ngOnChanges(changes?: SimpleChanges): void {
    super.ngOnChanges();
    if (!changes || changes['stepControl']) this.watchControl();
    this.bump();
  }

  ngOnDestroy(): void {
    this.controlSub?.unsubscribe();
  }

  /** 讓精靈重新計算狀態。 */
  bump(): void {
    this.revision.update((v) => v + 1);
  }

  /** 這一步的表單現在無效（停用的欄位不算）。 */
  isInvalid(): boolean {
    return !!this.stepControl?.invalid;
  }

  /** 不能往後走：無效或還在非同步驗證中。 */
  isBlocking(): boolean {
    const control = this.stepControl;
    return !!control && (control.invalid || control.pending);
  }

  override reset(): void {
    super.reset();
    this.attempted.set(false);
    this.bump();
  }

  private watchControl(): void {
    if (this.watched === (this.stepControl ?? null)) return;
    this.controlSub?.unsubscribe();
    this.watched = this.stepControl ?? null;
    this.controlSub = this.watched ? this.watched.events.subscribe(() => this.bump()) : null;
  }
}
