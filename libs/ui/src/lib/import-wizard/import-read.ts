import { decodeText, parseCsv } from './import-csv';
import { ImportSheet, ImportWorkbook } from './import-wizard.types';

/** 匯入精靈接受的副檔名（同 `<input accept>`）。 */
export const IMPORT_ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls,text/csv,text/tab-separated-values';

/** 是不是 Excel 檔（看副檔名）。 */
export function isSpreadsheetFile(name: string): boolean {
  return /\.(xlsx|xls|xlsm)$/i.test(name);
}

/** 讀出檔案的位元組（jsdom 等沒有 Blob.arrayBuffer 的環境改用 FileReader）。 */
export function readBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * 讀檔：CSV／TSV／TXT 自己解析（UTF-8，失敗時 Big5）；Excel 用 SheetJS（`import('xlsx')`，第一次選 Excel 檔時才下載）。
 * 每個工作表的每一列都是文字（日期轉成 yyyy-mm-dd），完全空白的列略過。
 */
export async function readImportFile(file: File): Promise<ImportWorkbook> {
  const bytes = await readBytes(file);
  if (isSpreadsheetFile(file.name)) {
    return { fileName: file.name, sheets: await readSpreadsheet(bytes), encoding: null };
  }
  const { text, encoding } = decodeText(bytes);
  const delimiter = /\.tsv$/i.test(file.name) ? '\t' : undefined;
  return { fileName: file.name, sheets: [{ name: file.name, rows: parseCsv(text, delimiter) }], encoding };
}

async function readSpreadsheet(bytes: Uint8Array): Promise<ImportSheet[]> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(bytes, { type: 'array', cellDates: true });
  return workbook.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      raw: false,
      dateNF: 'yyyy-mm-dd',
      defval: '',
      blankrows: false,
    });
    return {
      name,
      rows: rows
        .map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))))
        .filter((row) => row.some((cell) => cell.trim() !== '')),
    };
  });
}
