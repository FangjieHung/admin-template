import { DataTableLabels } from '@admin-template/ui';
import { ZH_TW } from '../../core/i18n/zh-tw';

/** admin 全站共用的 DataTable 文案，避免每頁重複組裝。 */
export const ADMIN_DATA_TABLE_LABELS: DataTableLabels = {
  exportExcel: ZH_TW.common.exportExcel,
  selectAll: ZH_TW.common.selectAll,
  deselectAll: ZH_TW.common.deselectAll,
  selectRow: ZH_TW.common.selectRow,
  batchDelete: ZH_TW.common.batchDelete,
  selectedCount: ZH_TW.common.selectedCount,
  exportSelected: ZH_TW.common.exportSelected,
  expandRow: ZH_TW.common.expandRow,
  collapseRow: ZH_TW.common.collapseRow,
  exportFailedText: ZH_TW.common.exportFailedText,
  // 只有開了 [pageable]／[columnChooser] 的表格才會用到。
  paging: ZH_TW.listView.paging,
  columnChooser: ZH_TW.listView.columnChooser,
};
