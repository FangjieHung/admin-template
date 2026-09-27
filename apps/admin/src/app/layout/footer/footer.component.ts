import { Component } from '@angular/core';
import { ZH_TW_SHELL } from '../../core/i18n/zh-tw-shell';

@Component({
  selector: 'app-footer',
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  protected readonly t = ZH_TW_SHELL;
  protected readonly year = new Date().getFullYear();
  protected readonly version = '0.0.0';
}
