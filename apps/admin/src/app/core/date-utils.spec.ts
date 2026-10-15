import { describe, it, expect } from 'vitest';
import { fmtDate, fmtDateAs, fmtDateTime, fmtDateTimeAs, fmtIsoDate } from './date-utils';

describe('fmtDate', () => {
  it('格式為 YYYY/MM/DD', () => {
    expect(fmtDate(new Date(2026, 8, 30))).toBe('2026/09/30');
  });

  it('月份與日期個位數補零', () => {
    expect(fmtDate(new Date(2026, 0, 5))).toBe('2026/01/05');
  });
});

describe('fmtDateTime', () => {
  // 固定參考日期（「今天」），不依賴測試執行當下的實際日期。
  const now = new Date(2026, 8, 23, 12, 0);

  it('與參考日期同年 → MM/DD HH:mm（不印年份）', () => {
    // 2026-09-20T01:00:00Z 是 UTC，本地（UTC+8）是 2026/09/20 09:00。
    expect(fmtDateTime('2026-09-20T01:00:00.000Z', now)).toBe('09/20 09:00');
  });

  it('跨年 → YYYY/MM/DD HH:mm', () => {
    // 2025-09-20T01:00:00Z 本地是 2025/09/20 09:00，年份與參考日期（2026）不同。
    expect(fmtDateTime('2025-09-20T01:00:00.000Z', now)).toBe('2025/09/20 09:00');
  });

  it('午夜邊界：UTC 時間換算成本地時間會跨到隔天，一律以本地日期為準', () => {
    // 2026-09-22T16:30:00Z + 8 小時 = 本地 2026/09/23 00:30（跨過午夜）。
    expect(fmtDateTime('2026-09-22T16:30:00.000Z', now)).toBe('09/23 00:30');
  });

  it('不傳參考日期時預設用目前時間（與今天同年不印年份）', () => {
    const thisYear = new Date().getFullYear();
    const iso = new Date(thisYear, 0, 1, 8, 30).toISOString();
    expect(fmtDateTime(iso)).not.toMatch(/^\d{4}\//);
  });
});

describe('fmtIsoDate', () => {
  it('純日期字串（YYYY-MM-DD）→ YYYY/MM/DD，不印時間', () => {
    expect(fmtIsoDate('2026-12-31')).toBe('2026/12/31');
  });

  it('即使是同年，也一律印出完整年份（與 fmtDateTime 不同）', () => {
    const thisYear = new Date().getFullYear();
    expect(fmtIsoDate(`${thisYear}-01-01`)).toBe(`${thisYear}/01/01`);
  });
});

describe('fmtDateAs／fmtDateTimeAs（設定頁「偏好」的日期格式）', () => {
  const d = new Date(2026, 8, 5);
  const now = new Date(2026, 8, 23, 12, 0);

  it('四種格式排列年、月、日；ymd-slash 等於全站預設的 fmtDate', () => {
    expect(fmtDateAs('ymd-slash', d)).toBe(fmtDate(d));
    expect(fmtDateAs('ymd-dash', d)).toBe('2026-09-05');
    expect(fmtDateAs('dmy-slash', d)).toBe('05/09/2026');
    expect(fmtDateAs('mdy-slash', d)).toBe('09/05/2026');
  });

  it('日期時間：同年省略年份、跨年加上年份，月日順序跟著格式；ymd-slash 等於 fmtDateTime', () => {
    const sameYear = new Date(2026, 8, 20, 9, 0).toISOString();
    const lastYear = new Date(2025, 8, 20, 9, 0).toISOString();
    expect(fmtDateTimeAs('ymd-slash', sameYear, now)).toBe(fmtDateTime(sameYear, now));
    expect(fmtDateTimeAs('dmy-slash', sameYear, now)).toBe('20/09 09:00');
    expect(fmtDateTimeAs('ymd-dash', sameYear, now)).toBe('09-20 09:00');
    expect(fmtDateTimeAs('dmy-slash', lastYear, now)).toBe('20/09/2025 09:00');
    expect(fmtDateTimeAs('mdy-slash', lastYear, now)).toBe('09/20/2025 09:00');
  });
});
