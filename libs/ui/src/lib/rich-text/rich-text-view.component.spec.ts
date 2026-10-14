import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RichTextViewComponent } from './rich-text-view.component';

@Component({
  imports: [RichTextViewComponent],
  template: '<lib-rich-text-view [html]="html()" />',
})
class HostComponent {
  readonly html = signal('');
}

async function render(html: string) {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.html.set(html);
  fixture.detectChanges();
  await fixture.whenStable();
  const body = (fixture.nativeElement as HTMLElement).querySelector('.lib-rich-text-view__body') as HTMLElement;
  return { fixture, body };
}

describe('RichTextViewComponent', () => {
  it('顯示段落、粗體、清單、引用、連結與提及小標籤', async () => {
    const { body } = await render(
      '<p>請 <span data-type="mention" data-id="u2" data-label="王小明">@王小明</span> 看<strong>報價</strong></p><ul><li>一</li></ul><blockquote>引用</blockquote><p><a href="https://example.com">連結</a></p>',
    );
    const mention = body.querySelector('.lib-rich-text-mention') as HTMLElement;
    expect(mention.textContent).toBe('@王小明');
    expect(mention.getAttribute('data-id')).toBe('u2');
    expect(body.querySelector('strong')?.textContent).toBe('報價');
    expect(body.querySelector('ul li')?.textContent).toBe('一');
    expect(body.querySelector('blockquote')?.textContent).toBe('引用');
    const link = body.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('XSS：<script>、onerror、javascript: 都不會出現在畫面上', async () => {
    const { body } = await render(
      '<p>正常</p><script>window.__xss = 1</script><img src="x" onerror="window.__xss = 2"><p onmouseover="window.__xss = 3"><a href="javascript:window.__xss=4">點我</a><a href="  jav&#x0A;ascript:alert(1)">也點我</a></p><iframe srcdoc="<script>parent.__xss=5</script>"></iframe>',
    );
    expect(body.querySelector('script, img, iframe')).toBeNull();
    expect(body.querySelector('a')).toBeNull();
    const html = body.innerHTML;
    expect(html).not.toMatch(/on\w+=/i);
    expect(html).not.toContain('javascript');
    expect(body.textContent).toBe('正常點我也點我');
    expect((window as { __xss?: number }).__xss).toBeUndefined();
  });

  it('內容換掉時重畫；空值畫成空白', async () => {
    const { fixture, body } = await render('<p>一</p>');
    fixture.componentInstance.html.set('<p>二</p>');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(body.innerHTML).toBe('<p>二</p>');
    fixture.componentInstance.html.set('');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(body.innerHTML).toBe('');
  });
});
