import { Component, inject } from '@angular/core';
import { I18N_CONFIG, I18nService, LanguageSwitcherComponent } from '@admin-template/ui';
import { DEMO_PROJECTS } from '../../showcase/demo-data';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('language-switcher');

/** 示範字典：每種語言一份同形狀的物件。真實專案每個功能各自一份，放在功能資料夾裡。 */
const MESSAGES = {
  'zh-TW': {
    title: '專案清單',
    project: '專案',
    intro: '切換上方的語言，標題、欄名、日期與數字格式都會跟著變。',
    owner: '負責人',
    progress: '進度',
    budget: '預算',
    due: '到期日',
    names: { p1: '官網改版', p2: '客服系統導入', p3: '年度教育訓練', p4: '資料中心搬遷' } as Record<string, string>,
  },
  en: {
    title: 'Projects',
    project: 'Project',
    intro: 'Switch the language above; headings, column names, dates and numbers follow.',
    owner: 'Owner',
    progress: 'Progress',
    budget: 'Budget',
    due: 'Due',
    names: { p1: 'Website redesign', p2: 'Help desk rollout', p3: 'Annual training', p4: 'Data center move' } as Record<string, string>,
  },
  ja: {
    title: 'プロジェクト一覧',
    project: 'プロジェクト',
    intro: '上の言語を切り替えると、見出し・列名・日付・数値の書式が変わります。',
    owner: '担当者',
    progress: '進捗',
    budget: '予算',
    due: '期限',
    names: { p1: 'サイトリニューアル', p2: 'ヘルプデスク導入', p3: '年次研修', p4: 'データセンター移転' } as Record<string, string>,
  },
};

@Component({
  selector: 'app-language-switcher-page',
  imports: [LanguageSwitcherComponent, ShowcasePageComponent, DemoBlockComponent],
  // 只翻譯示範區塊：這一頁自己一個 I18nService，不改 <html lang>、不記住選擇；整個 app 要多語時改用 provideI18n()。
  providers: [{ provide: I18N_CONFIG, useValue: { syncDocument: false, storageKey: null, detectBrowser: false } }, I18nService],
  template: `
    <app-showcase-page [summary]="entry.summary" [whenToUse]="whenToUse" [avoid]="avoid" [source]="entry.source" [usage]="usage" [api]="api">
      <app-demo-block heading="切換示範區塊的語言" description="這一頁的示範區塊有自己的語言狀態；殼層維持繁中。">
        <lib-language-switcher />
        <section class="i18n-demo" [attr.lang]="i18n.current().htmlLang">
          <h3 class="ui-text-subtitle">{{ t().title }}</h3>
          <p class="demo-note">{{ t().intro }}</p>
          <div class="i18n-table-scroll">
            <table class="i18n-table">
              <thead>
                <tr>
                  <th scope="col">{{ t().project }}</th>
                  <th scope="col">{{ t().owner }}</th>
                  <th scope="col" class="num">{{ t().progress }}</th>
                  <th scope="col" class="num">{{ t().budget }}</th>
                  <th scope="col">{{ t().due }}</th>
                </tr>
              </thead>
              <tbody>
                @for (p of projects; track p.id) {
                  <tr>
                    <td>{{ t().names[p.id] }}</td>
                    <td>{{ p.owner }}</td>
                    <td class="num ui-text-numeric">{{ i18n.number(p.progress) }}%</td>
                    <td class="num ui-text-numeric">{{ i18n.number(p.budget) }}</td>
                    <td class="ui-text-numeric">{{ i18n.date(p.dueDate) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="demo-note">{{ i18n.month(today) }}</p>
        </section>
      </app-demo-block>

      <app-demo-block heading="不顯示圖示" description="showIcon=false，例如放在頁尾或已有標籤的設定列。">
        <lib-language-switcher [showIcon]="false" label="Language" />
      </app-demo-block>
    </app-showcase-page>
  `,
  styleUrl: '../../showcase/demo-shared.scss',
  styles: `
    .i18n-demo {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--mat-sys-outline-variant);

      h3 {
        margin: 0;
      }
    }

    .i18n-table-scroll {
      margin-top: 0.75rem;
      overflow-x: auto;
    }

    .i18n-table {
      width: 100%;
      min-width: 32rem;
      border-collapse: collapse;
      font-size: 0.875rem;

      th,
      td {
        padding: 0.5rem 0.75rem 0.5rem 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        text-align: left;
      }

      th {
        color: var(--mat-sys-on-surface-variant);
        font-weight: 600;
      }

      .num {
        text-align: right;
      }
    }
  `,
})
export class LanguageSwitcherPageComponent {
  protected readonly entry = ENTRY;
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translate(MESSAGES);
  protected readonly projects = DEMO_PROJECTS;
  protected readonly today = new Date();

  protected readonly whenToUse = ['使用者不只一種語言（跨國團隊、外籍員工、對外的客戶頁）。', '日期與數字要依語言格式化。'];
  protected readonly avoid = [
    '只有一種語言的專案：不需要 I18nService，字串直接寫在字典檔（例如 core/i18n/zh-tw.ts）。',
    '大量翻譯與翻譯流程（抽字串、翻譯平台）：改用 Angular 內建的 @angular/localize。',
  ];

  protected readonly usage = `// app.config.ts：整個 app 多語（偵測瀏覽器語言、記住選擇、同步 <html lang> 與 DateAdapter）
providers: [provideNativeDateAdapter(), provideI18n({ locales: DEFAULT_LOCALES })]

// 功能元件：每種語言一份同形狀的字典
const MESSAGES = { 'zh-TW': { title: '專案清單' }, en: { title: 'Projects' }, ja: { title: 'プロジェクト一覧' } };
protected readonly i18n = inject(I18nService);
protected readonly t = this.i18n.translate(MESSAGES);

<lib-language-switcher />
<h2>{{ t().title }}</h2>
<span>{{ i18n.date(project.dueDate) }} · {{ i18n.number(project.budget) }}</span>`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-language-switcher',
      rows: [
        { name: 'label', type: 'string', default: "'語言 / Language'", description: '整組按鈕的無障礙名稱；建議多語並列。' },
        { name: '[showIcon]', type: 'boolean', default: 'true', description: '是否顯示地球圖示。' },
      ],
    },
    {
      title: 'I18nService',
      rows: [
        { name: 'locale()／current()', type: 'Signal', description: '目前語言的 id／完整資料（nativeName、intl、htmlLang）。' },
        { name: 'locales', type: 'LocaleOption[]', description: '支援的語言；切換器依此列出。' },
        { name: 'setLocale(id)', type: 'void', description: '切換語言；不支援的 id 會被忽略。' },
        { name: 'translate(dict)', type: 'Signal<M>', description: '取得字典裡目前語言那一份；缺少時退回預設語言。' },
        { name: 'number()／date()／month()', type: 'string', description: '依語言格式化數字、日期（YYYY-MM-DD 當作當地日期）、月份標題。' },
      ],
    },
    {
      title: '設定（provideI18n／I18N_CONFIG）',
      rows: [
        { name: 'locales', type: 'LocaleOption[]', default: 'DEFAULT_LOCALES', description: '繁中、英文、日文；第一筆是預設語言。' },
        { name: 'storageKey', type: 'string | null', default: "'app.locale'", description: '記住選擇的 localStorage key；null 不記住。' },
        { name: 'detectBrowser', type: 'boolean', default: 'true', description: '沒有記住的選擇時依瀏覽器語言。' },
        { name: 'syncDocument', type: 'boolean', default: 'true', description: '同步 <html lang> 與 DateAdapter；只翻譯局部時設 false。' },
      ],
    },
  ];
}
