import { describe, expect, it } from 'vitest';
import { isAllowedLinkHref, mentionIdsOf, normalizeLinkHref, sanitizeRichTextHtml } from './rich-text-html';

describe('rich-text-html 白名單', () => {
  it('只留下支援的標籤，b/i 轉成 strong/em，其他標籤拆掉保留文字', () => {
    const html = sanitizeRichTextHtml(
      '<h1>標題</h1><p class="x" style="color:red">一<b>粗</b><i>斜</i><font color="red">字</font><u>底</u></p><ul><li>甲</li></ul><ol><li>乙</li></ol><blockquote>引</blockquote>',
    );
    expect(html).toBe(
      '標題<p>一<strong>粗</strong><em>斜</em>字底</p><ul><li>甲</li></ul><ol><li>乙</li></ol><blockquote>引</blockquote>',
    );
  });

  it('<script>、<style>、<iframe>、<img> 連內容整個丟掉', () => {
    const html = sanitizeRichTextHtml(
      '<p>安全</p><script>alert(1)</script><style>p{color:red}</style><iframe src="https://example.com"></iframe><img src="x" onerror="alert(1)"><svg onload="alert(1)"><text>s</text></svg>',
    );
    expect(html).toBe('<p>安全</p>');
    expect(html).not.toContain('alert');
  });

  it('on* 事件屬性、style、class、id 一律不留', () => {
    const html = sanitizeRichTextHtml('<p onclick="alert(1)" id="a" class="b" style="font-size:40px"><strong onmouseover="x()">字</strong></p>');
    expect(html).toBe('<p><strong>字</strong></p>');
  });

  it('javascript:、data:、vbscript: 連結只留文字；混淆過的協定也擋', () => {
    const html = sanitizeRichTextHtml(
      '<p><a href="javascript:alert(1)">a</a><a href="JaVaScRiPt:alert(1)">b</a><a href="java&#x09;script:alert(1)">c</a><a href=" data:text/html,x">d</a><a href="vbscript:x">e</a><a>f</a></p>',
    );
    expect(html).toBe('<p>abcdef</p>');
  });

  it('http／https／mailto 連結加上 rel="noopener noreferrer" 與 target="_blank"，其他屬性拿掉', () => {
    const html = sanitizeRichTextHtml('<p><a href="https://example.com/a?b=1" onclick="x()" title="t">連結</a> <a href="mailto:help@example.com">信</a></p>');
    expect(html).toBe(
      '<p><a href="https://example.com/a?b=1" rel="noopener noreferrer" target="_blank">連結</a> <a href="mailto:help@example.com" rel="noopener noreferrer" target="_blank">信</a></p>',
    );
  });

  it('提及標記只留 data-id、data-label，文字重畫成「@名字」；沒有 id 的拆掉', () => {
    const html = sanitizeRichTextHtml(
      '<p><span data-type="mention" data-id="u1" data-label="王小明" onclick="x()" style="color:red"><b>假的</b></span><span data-type="mention">@無名</span></p>',
    );
    expect(html).toBe('<p><span class="lib-rich-text-mention" data-type="mention" data-id="u1" data-label="王小明">@王小明</span>@無名</p>');
  });

  it('mentionIdsOf 依出現順序列出、不重複', () => {
    const html =
      '<p><span data-type="mention" data-id="b" data-label="乙">@乙</span> <span data-type="mention" data-id="a" data-label="甲">@甲</span> <span data-type="mention" data-id="b" data-label="乙">@乙</span></p>';
    expect(mentionIdsOf(html)).toEqual(['b', 'a']);
  });

  it('空值回傳空字串', () => {
    expect(sanitizeRichTextHtml('')).toBe('');
    expect(sanitizeRichTextHtml(null)).toBe('');
  });
});

describe('連結協定白名單', () => {
  it('只接受 http、https、mailto', () => {
    expect(isAllowedLinkHref('https://example.com')).toBe(true);
    expect(isAllowedLinkHref('http://example.com')).toBe(true);
    expect(isAllowedLinkHref('mailto:a@example.com')).toBe(true);
    expect(isAllowedLinkHref('javascript:alert(1)')).toBe(false);
    expect(isAllowedLinkHref('data:text/html,hi')).toBe(false);
    expect(isAllowedLinkHref('ftp://example.com')).toBe(false);
    expect(isAllowedLinkHref('mailto:')).toBe(false);
    expect(isAllowedLinkHref('https://')).toBe(false);
  });

  it('normalizeLinkHref：網域補 https://、Email 補 mailto:、其他協定或空白回傳 null', () => {
    expect(normalizeLinkHref('  https://example.com/a  ')).toBe('https://example.com/a');
    expect(normalizeLinkHref('www.example.com/docs')).toBe('https://www.example.com/docs');
    expect(normalizeLinkHref('help@example.com')).toBe('mailto:help@example.com');
    expect(normalizeLinkHref('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkHref('ftp://example.com')).toBeNull();
    expect(normalizeLinkHref('not a url')).toBeNull();
    expect(normalizeLinkHref('')).toBeNull();
  });
});
