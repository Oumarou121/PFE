import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import {
  ToastNotificationComponent,
  NotificationOptions,
} from "../../shared/components/toast-notification/toast-notification.component";

@Injectable({
  providedIn: "root",
})
export class NotificationService {
  constructor(private snackBar: MatSnackBar) {}


  showSuccess(message: string, duration: number = 3000): void {
    this.openComponent({ message, type: "success", duration });
  }


  showError(message: string, duration: number = 5000): void {
    this.openComponent({ message, type: "error", duration });
  }


  showInfo(message: string, duration: number = 3000): void {
    this.openComponent({ message, type: "info", duration });
  }


  showWarning(message: string, duration: number = 4000): void {
    this.openComponent({ message, type: "warning", duration });
  }

  private openComponent(options: NotificationOptions): void {
    const ref = this.snackBar.openFromComponent(ToastNotificationComponent, {
      data: options,
      duration: options.duration ?? 3000,
      horizontalPosition: "right",
      verticalPosition: "top",
      panelClass: ["mat-custom-snackbar"],
    });

    ref.afterDismissed().subscribe((res) => {
      if ((res as any)?.dismissedByAction && options.onAction) {
        try {
          options.onAction();
        } catch {}
      }
    });
  }
}
