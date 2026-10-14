import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ImportWizardLabels } from './import-wizard-labels';
import { sampleValues } from './import-mapping';
import { ImportSchema } from './import-wizard.types';

let nextId = 0;

/**
 * 匯入精靈的「欄位對應」（內部元件，不從 index.ts 匯出）：每個要匯入的欄位選一個檔案裡的欄位，
 * 旁邊列出那一欄的前三個值；沒有被選到的檔案欄位列在下方「不匯入的欄位」。
 */
@Component({
  selector: 'lib-import-mapping',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './import-mapping.component.html',
  styleUrl: './import-mapping.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportMappingComponent {
  readonly schema = input.required<ImportSchema>();
  readonly headers = input.required<readonly string[]>();
  readonly rows = input.required<readonly (readonly string[])[]>();
  readonly form = input.required<FormGroup<Record<string, FormControl<number | null>>>>();
  readonly labels = input.required<ImportWizardLabels>();

  protected readonly uid = `lib-import-mapping-${nextId++}`;
  /** 表單的值（表單事件不是 signal，這裡轉成 signal 讓範例值、「不匯入」與錯誤跟著更新）。 */
  private readonly value = signal<Record<string, number | null>>({});

  /** 每個檔案欄位的範例值（只算一次）。 */
  protected readonly samples = computed(() => {
    const rows = this.rows();
    return this.headers().map((_, i) => sampleValues(rows, i));
  });

  protected readonly unused = computed(() => {
    const used = new Set(Object.values(this.value()).filter((v): v is number => v !== null && v !== undefined));
    return this.headers()
      .map((header, index) => ({ header, index }))
      .filter((column) => !used.has(column.index));
  });

  constructor() {
    effect((onCleanup) => {
      const form = this.form();
      this.value.set(form.getRawValue());
      // events 也包含「碰過」：精靈按下一步時 markAllAsTouched，錯誤訊息要跟著出現。
      const sub = form.events.subscribe(() => this.value.set({ ...form.getRawValue() }));
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected selected(key: string): number | null {
    return this.value()[key] ?? null;
  }

  protected samplesText(index: number | null): string {
    if (index === null) return '';
    const values = this.samples()[index] ?? [];
    return values.length ? values.join('、') : this.labels().noSamples;
  }

  protected invalid(key: string): boolean {
    const control = this.form().controls[key];
    this.value();
    return !!control && control.invalid && control.touched;
  }
}
