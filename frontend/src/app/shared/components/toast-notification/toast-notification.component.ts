import { Component, Inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import {
  MatSnackBarRef,
  MAT_SNACK_BAR_DATA,
} from "@angular/material/snack-bar";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface NotificationOptions {
  message: string;
  type?: NotificationType;
  duration?: number; // ms, 0 = persistent
  action?: string;
  // Optional callback executed when action clicked (service will call it if present)
  onAction?: () => void;
  iconHtml?: SafeHtml;
}

@Component({
  selector: "app-toast-notification",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="toast-notification"
      [ngClass]="data.type"
      [class.leaving]="leaving"
    >
      <div class="toast-icon">
        <ng-container *ngIf="data.iconHtml; else defaultIcon">
          <div [innerHTML]="data.iconHtml"></div>
        </ng-container>
        <ng-template #defaultIcon>
          <svg
            *ngIf="data.type === 'success'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M20 6L9 17l-5-5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg
            *ngIf="data.type === 'error'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <svg
            *ngIf="data.type === 'warning'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M12 9v4M12 17h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"
              stroke-linecap="round"
            />
          </svg>
          <svg
            *ngIf="data.type === 'info'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </ng-template>
      </div>
      <div class="toast-message">{{ data.message }}</div>
      <button
        *ngIf="data.action"
        class="toast-action"
        (click)="actionClicked()"
      >
        {{ data.action }}
      </button>
      <button class="toast-close" (click)="close()">✕</button>
    </div>
  `,
  styles: [
    `
      .toast-notification {
        display: flex;
        align-items: center;
        gap: 12px;
        background: white;
        border-radius: 12px;
        padding: 12px 16px;
        margin-bottom: 12px;
        box-shadow:
          0 8px 20px rgba(0, 0, 0, 0.12),
          0 2px 4px rgba(0, 0, 0, 0.05);
        border-left: 4px solid;
        animation: slideInRight 0.2s ease forwards;
        max-width: 380px;
        min-width: 260px;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      .toast-notification.leaving {
        animation: slideOutRight 0.2s ease forwards;
      }
      .toast-icon svg {
        width: 20px;
        height: 20px;
      }
      .toast-message {
        flex: 1;
        font-size: 13px;
        font-weight: 500;
        color: #1a1a1a;
        line-height: 1.4;
      }
      .toast-action,
      .toast-close {
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 40px;
        transition: all 0.1s;
      }
      .toast-action {
        color: #217346;
        background: #e9f5ee;
      }
      .toast-action:hover {
        background: #d5eae0;
      }
      .toast-close {
        color: #8f959c;
        font-size: 16px;
        padding: 4px;
      }
      .toast-close:hover {
        color: #505860;
        background: #f0f1f2;
      }
      .toast-notification.success {
        border-left-color: #10b981;
      }
      .toast-notification.error {
        border-left-color: #dc2626;
      }
      .toast-notification.warning {
        border-left-color: #f59e0b;
      }
      .toast-notification.info {
        border-left-color: #3b82f6;
      }
      @keyframes slideInRight {
        from {
          opacity: 0;
          transform: translateX(100px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
      @keyframes slideOutRight {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100px);
        }
      }
    `,
  ],
})
export class ToastNotificationComponent {
  leaving = false;

  constructor(
    private snackRef: MatSnackBarRef<ToastNotificationComponent>,
    @Inject(MAT_SNACK_BAR_DATA) public data: NotificationOptions,
    private sanitizer: DomSanitizer,
  ) {
    if (
      (this.data as any).icon &&
      typeof (this.data as any).icon === "string"
    ) {
      try {
        this.data.iconHtml = this.sanitizer.bypassSecurityTrustHtml(
          (this.data as any).icon,
        );
      } catch {}
    }
  }

  actionClicked() {
    this.snackRef.dismissWithAction();
  }

  close() {
    if (this.leaving) return;
    this.leaving = true;
    setTimeout(() => this.snackRef.dismiss(), 200);
  }
}
