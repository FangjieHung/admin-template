import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
  it('顯示版本號與版權文字', () => {
    const fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Admin Template');
    expect(text).toContain('©');
    expect(text).toContain(String(new Date().getFullYear()));
  });
});
