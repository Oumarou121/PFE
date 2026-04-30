import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

type LegacyPage = 'login' | 'superAdmin' | 'admin' | 'user';

declare global {
  interface Window {
    SIRHDOC_API_BASE?: string;
  }
}

@Component({
  selector: 'app-legacy-editor-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './legacy-editor-page.component.html',
  styleUrls: ['./legacy-editor-page.component.scss']
})
export class LegacyEditorPageComponent implements OnInit {
  src!: SafeResourceUrl;

  private readonly pageFiles: Record<LegacyPage, string> = {
    login: 'login.html',
    superAdmin: 'superAdmin.html',
    admin: 'admin.html',
    user: 'user.html'
  };

  constructor(
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    window.SIRHDOC_API_BASE = environment.apiUrl.replace(/\/api\/?$/, '');
    this.route.data.subscribe(data => {
      const page = (data['page'] || 'login') as LegacyPage;
      const file = this.pageFiles[page];
      const apiBase = encodeURIComponent(environment.apiUrl.replace(/\/api\/?$/, ''));
      this.src = this.sanitizer.bypassSecurityTrustResourceUrl(`/assets/editor-legacy/${file}?apiBase=${apiBase}`);
    });
  }
}
