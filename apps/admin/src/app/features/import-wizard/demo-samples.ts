/**
 * 匯入精靈展示頁的示範檔案：不用自己準備檔案，也能走完每一種情況。全部在瀏覽器裡產生，不另放靜態檔。
 * - 乾淨的 CSV：欄位名稱與範本相同，全部可以匯入。
 * - 有問題的 CSV：全形欄位名稱、多一欄備註（引號裡有逗號與換行）、格式錯誤、檔案內重複、已存在的 Email、
 *   一筆匯入時會被拒絕的網域（示範「失敗」與錯誤報告）。
 * - Big5 的 CSV：台灣 Excel「另存 CSV」的預設編碼。
 * - Excel：兩個工作表（第一個是資料，第二個是說明），第一次載入時才下載讀寫 Excel 的程式。
 */

const CLEAN_CSV = [
  '姓名,Email,電話,公司,標籤,生日',
  '周詩涵,shihan.zhou@example.com,0912-100-201,晨光設計,客戶,1991-04-12',
  '謝柏翰,bohan.xie@example.com,02-2711-3302,遠帆貿易,供應商,1985-09-30',
  '郭欣怡,xinyi.guo@example.com,0933-208-415,青田顧問,VIP,1993-01-08',
  '洪品睿,pinrui.hong@example.com,04-2255-7781,晨光設計,合作夥伴,',
  '曾婉婷,wanting.zeng@example.com,0955-610-022,北辰物流,客戶,1988-12-24',
  '邱文傑,wenjie.qiu@example.com,,遠帆貿易,供應商,1979-06-03',
].join('\r\n');

const MESSY_CSV = [
  '\u3000姓名＊,Ｅ－ｍａｉｌ,手機,公司名稱,分類,出生日期,備註',
  '廖佳穎,jiaying.liao@example.com,0912-345-678,晨光設計,貴賓,1990/3/8,"老客戶，年底回訪"',
  '賴思妤,siyu.lai@example,0922-111-333,青田顧問,客戶,1992-07-15,Email 少了 .com',
  '徐柏翰,bohan.xu@example.com,12,遠帆貿易,客戶,1987-02-30,電話與生日都不對',
  ',noname@example.com,0933-222-444,北辰物流,供應商,,沒有姓名',
  '蘇欣怡,xinyi.su@example.com,0955-666-777,晨光設計,同事,1995-10-01,標籤不在選項裡',
  '王小明,ming@example.com,0912-000-111,晨光設計,客戶,1989-05-20,Email 已經在聯絡人裡',
  '廖佳穎,JIAYING.LIAO@example.com,0912-345-678,晨光設計,VIP,1990-03-08,和第 2 列重複（大小寫不同）',
  '謝婉婷,wanting.xie@blocked.test,02-2345-6789,遠帆貿易,合作夥伴,1994年11月2日,"這個網域匯入時會被拒絕\n（示範失敗）"',
  '郭品睿,pinrui.guo@example.com,0988-123-456,青田顧問,廠商,1983.8.19,',
  '曾文傑,wenjie.zeng@example.com,(02) 2700-1234,北辰物流,顧客,1990-01-31,',
].join('\r\n');

/** Big5 編碼的 CSV（4 列：姓名、Email、電話、公司、標籤、生日）。用 Python 的 `'…'.encode('big5')` 產生。 */
const BIG5_BASE64 =
  'qW2mVyxFbWFpbCy5cbjcLKS9pXEsvNDF0iylzaTpDQqqTLJRquIsc2h1ZmVuQGV4YW1wbGUuY29tLDAyLTIzNDUtNjc4OSyx4aX6s12tcCyryKThLDE5ODgvNS8xMg0KtsCrVKe7LGp1bmhvbmdAZXhhbXBsZS5jb20sMDkzMy00NTYtNzg5LLu3pny2VKn2LKjRwLOw0ywxOTc5LTExLTAzDQqnZKjOu1Qsamlhcm9uZ0BleGFtcGxlLmNvbSwwOTIxLTExMS0yMjIsseGl+rNdrXAsVklQLDE5OTKmfjKk6zI5pOkNCg==';

const STAMP = Date.UTC(2026, 9, 14);
const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

export type DemoSampleId = 'clean' | 'messy' | 'big5' | 'xlsx';

export const DEMO_SAMPLES: readonly { id: DemoSampleId; label: string }[] = [
  { id: 'clean', label: '乾淨的 CSV' },
  { id: 'messy', label: '有問題的 CSV' },
  { id: 'big5', label: 'Big5 編碼的 CSV' },
  { id: 'xlsx', label: 'Excel（兩個工作表）' },
];

export async function demoSample(id: DemoSampleId): Promise<File> {
  switch (id) {
    case 'clean':
      return new File([BOM, CLEAN_CSV], '聯絡人-範例.csv', { type: 'text/csv', lastModified: STAMP });
    case 'messy':
      return new File([BOM, MESSY_CSV], '聯絡人-待整理.csv', { type: 'text/csv', lastModified: STAMP });
    case 'big5':
      return new File([base64Bytes(BIG5_BASE64)], '聯絡人-Big5.csv', { type: 'text/csv', lastModified: STAMP });
    case 'xlsx':
      return demoWorkbook();
  }
}

function base64Bytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Excel：第一個工作表是聯絡人（生日是真的日期格式），第二個是說明文字。 */
async function demoWorkbook(): Promise<File> {
  const XLSX = await import('xlsx');
  const rows = CLEAN_CSV.split('\r\n').map((line) => line.split(','));
  const data = rows.map((row, i) => row.map((cell, c) => (i > 0 && c === 5 && cell ? new Date(`${cell}T00:00:00`) : cell)));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(data, { cellDates: true, dateNF: 'yyyy-mm-dd' }), '聯絡人');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['這個工作表是說明，不要匯入。'], ['資料在「聯絡人」工作表。']]), '說明');
  const buffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buffer], '聯絡人-範例.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    lastModified: STAMP,
  });
}
