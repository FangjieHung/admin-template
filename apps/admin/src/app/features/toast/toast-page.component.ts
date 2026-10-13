import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { TOAST_DURATIONS, ToastService, ToastType } from '@admin-template/ui';
import { TOAST_PROVIDERS } from '../../shared/ui/component-label-providers';
import { DEMO_PROJECTS, DemoProject } from '../../showcase/demo-data';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('toast');

interface TypeDemo {
  type: ToastType;
  label: string;
  message: string;
}

/** 提示訊息展示頁（/components/toast）：4 種類型、復原動作、錯誤常駐、一次一則。 */
@Component({
  selector: 'app-toast-page',
  imports: [MatButtonModule, ShowcasePageComponent, DemoBlockComponent],
  providers: [...TOAST_PROVIDERS],
  templateUrl: './toast-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './toast-page.component.scss'],
})
export class ToastPageComponent {
  private readonly toast = inject(ToastService);
  protected readonly entry = ENTRY;
  protected readonly result = signal('（尚未操作）');

  protected readonly types: TypeDemo[] = [
    { type: 'success', label: '成功', message: '已儲存變更' },
    { type: 'info', label: '資訊', message: '已複製分享連結' },
    { type: 'warning', label: '警告', message: '網路不穩，變更會在連線恢復後同步' },
    { type: 'error', label: '錯誤', message: '儲存失敗，請確認網路連線後再試一次' },
  ];

  protected readonly durations = (Object.keys(TOAST_DURATIONS) as ToastType[]).map((type) => ({
    type,
    label: this.types.find((t) => t.type === type)?.label ?? type,
    duration: TOAST_DURATIONS[type],
  }));

  protected show(demo: TypeDemo): void {
    void this.toast.show(demo.type, demo.message).afterDismissed.then(() => this.result.set(`「${demo.message}」已關閉`));
    this.result.set(`顯示${demo.label}：${demo.message}`);
  }

  // ---- 復原 ----
  protected readonly projects = signal<readonly DemoProject[]>(DEMO_PROJECTS);

  protected async remove(project: DemoProject): Promise<void> {
    const before = this.projects();
    this.projects.set(before.filter((p) => p.id !== project.id));
    const ref = this.toast.success(`已刪除「${project.name}」`, { action: '復原' });
    this.result.set(`已刪除「${project.name}」，4 秒內可以按「復原」`);
    if (await ref.actionClicked) {
      // 放回原本的位置（刪除之後清單可能又變過，以目前的清單為準插回去）。
      const order = DEMO_PROJECTS.map((p) => p.id);
      this.projects.update((list) =>
        [...list, project].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
      );
      this.result.set(`已復原「${project.name}」`);
    }
  }

  protected resetProjects(): void {
    this.projects.set(DEMO_PROJECTS);
    this.result.set('示範清單已重設');
  }

  // ---- 一次一則 ----
  protected burst(): void {
    this.toast.info('第 1 則：開始同步');
    this.toast.info('第 2 則：同步到一半');
    this.toast.success('第 3 則：同步完成');
    this.result.set('連續送出 3 則：畫面上只會留下最後一則');
  }

  protected showPersistentError(): void {
    this.toast.error('匯出失敗，請稍後再試一次');
    this.result.set('錯誤會一直留著，直到按關閉或出現下一則提示');
  }

  protected dismiss(): void {
    this.toast.dismiss();
    this.result.set('已用 dismiss() 關掉目前的提示');
  }

  protected readonly whenToUse = [
    '操作完成後的簡短確認（已儲存、已複製），使用者不必回應。',
    '可以復原的動作：直接執行，再給「復原」。',
    '背景作業失敗（匯出、同步）：錯誤提示會留著，直到使用者關掉。',
  ];
  protected readonly avoid = [
    '需要使用者決定才能繼續：用確認對話框。',
    '表單欄位的錯誤：寫在欄位下方，不要用提示訊息。',
    '整塊內容載入失敗：在原地顯示錯誤狀態與重試（見「載入、空白、錯誤」）。',
  ];

  protected readonly usage = `// 頁面或 app 根層的 providers（一次）：服務本身與關閉鈕文字。
providers: [provideToast({ close: '關閉' })]

private readonly toast = inject(ToastService);

this.toast.success('已儲存變更');
this.toast.error('儲存失敗，請確認網路連線後再試一次'); // 不會自動消失，有關閉鈕

// 復原：actionClicked 在按下動作鈕時是 true，自動消失或被取代時是 false
const ref = this.toast.success('已刪除「官網改版」', { action: '復原' });
if (await ref.actionClicked) this.restore();`;

  protected readonly api: ApiSection[] = [
    {
      title: 'ToastService',
      rows: [
        { name: 'success(message, options?)', type: 'ToastRef', description: '成功，4 秒後消失。' },
        { name: 'info(message, options?)', type: 'ToastRef', description: '資訊，4 秒後消失。' },
        { name: 'warning(message, options?)', type: 'ToastRef', description: '警告，6 秒後消失（多一句後果要讀）。' },
        { name: 'error(message, options?)', type: 'ToastRef', description: '錯誤，不會自動消失，有關閉鈕；報讀器 assertive 立刻念。' },
        { name: 'show(type, message, options?)', type: 'ToastRef', description: '同上，類型由參數決定。' },
        { name: 'dismiss()', type: 'void', description: '關掉目前的提示。' },
        { name: 'options.action', type: 'string', default: '—', description: '唯一一個動作鈕的文字（例：「復原」）。' },
      ],
    },
    {
      title: 'ToastRef',
      rows: [
        { name: 'actionClicked', type: 'Promise<boolean>', description: '按了動作鈕為 true；自動消失、按關閉、被下一則取代為 false。' },
        { name: 'afterDismissed', type: 'Promise<void>', description: '提示消失後 resolve。' },
        { name: 'dismiss()', type: 'void', description: '關掉這一則。' },
      ],
    },
    {
      title: '注入',
      rows: [
        { name: 'provideToast(labels)', type: 'Provider[]', default: '必填', description: '提供 ToastService 與 TOAST_LABELS（close：錯誤提示關閉鈕的無障礙名稱）。' },
        { name: 'TOAST_DURATIONS', type: 'Record<ToastType, number | null>', description: '各類型的時長（毫秒），null＝不自動消失。' },
      ],
    },
  ];
}
