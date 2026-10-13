import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataTableCellDirective, DataTableColumn, DataTableComponent, StatusChipComponent } from '@admin-template/ui';
import { ADMIN_DATA_TABLE_LABELS } from '../../shared/ui/data-table-labels';
import { SHOWCASE_ENTRIES, SHOWCASE_GROUPS, showcaseRoute } from '../../showcase/showcase-registry';
import { PLANNED_ITEMS, detailOf } from '../../showcase/showcase-catalog';

interface CatalogRow {
  id: string;
  title: string;
  kind: string;
  group: string;
  status: 'done' | 'planned';
  priority: string;
  summary: string;
  route: string | null;
}

const GROUP_LABEL = new Map(SHOWCASE_GROUPS.map((g) => [g.id, g.label]));

/** 首頁：範本是什麼、怎麼開新專案，以及完整的元件目錄（已完成＋規劃中）。 */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, DataTableComponent, DataTableCellDirective, StatusChipComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent {
  protected readonly tableLabels = ADMIN_DATA_TABLE_LABELS;
  protected readonly gapListUrl = 'https://claude.ai/artifact/A1g9Ydjq7sGjfdmpQkXipw';

  protected readonly rows: CatalogRow[] = [
    ...SHOWCASE_ENTRIES.map((e) => ({
      id: e.id,
      title: e.title,
      kind: e.group === 'templates' ? '頁面樣板' : '元件',
      group: GROUP_LABEL.get(e.group) ?? '',
      status: 'done' as const,
      priority: '—',
      summary: detailOf(e.id).summary,
      route: showcaseRoute(e),
    })),
    ...PLANNED_ITEMS.map((p, i) => ({
      id: `planned-${i}`,
      title: p.title,
      kind: p.kind,
      group: p.kind === '頁面樣板' ? '頁面樣板' : '—',
      status: 'planned' as const,
      priority: p.priority,
      summary: p.summary,
      route: p.kind === '頁面樣板' ? '/templates' : null,
    })),
  ];

  protected readonly doneCount = SHOWCASE_ENTRIES.length;
  protected readonly plannedCount = PLANNED_ITEMS.length;

  protected readonly filter = signal<'all' | 'done' | 'planned'>('all');
  protected readonly visibleRows = computed(() =>
    this.filter() === 'all' ? this.rows : this.rows.filter((r) => r.status === this.filter()),
  );

  protected readonly columns: DataTableColumn<CatalogRow>[] = [
    { key: 'title', label: '名稱', primary: true },
    { key: 'kind', label: '類型' },
    { key: 'group', label: '分組' },
    { key: 'status', label: '狀態', primary: true, exportValue: (r) => this.statusLabel(r) },
    { key: 'priority', label: '優先' },
    { key: 'summary', label: '說明' },
  ];

  protected statusLabel(r: CatalogRow): string {
    return r.status === 'done' ? '已完成' : '規劃中';
  }

  protected readonly steps = [
    { title: '複製', body: '把整個 repo 複製成新專案（不是 npm 套件，沒有升級路徑；之後的改動直接在新專案裡做）。' },
    { title: '改名', body: '改 package.json 的 name、tsconfig 的 @admin-template/* 路徑別名、admin 的 outputPath 與頁首品牌文字。' },
    { title: '刪減', body: '照 docs/guides/theme-pruning.md 刪掉用不到的質地、配色、元件與展示頁。' },
    { title: '開始做', body: 'npm install → npm start；新頁面直接用 libs/ui 的元件與 theme-pack 的 ui-* class。' },
  ];
}
