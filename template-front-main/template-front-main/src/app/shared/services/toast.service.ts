import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  constructor(private snackBar: MatSnackBar) {}

  showSuccess(message: string, duration: number = 3500): void {
    const config: MatSnackBarConfig = {
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
      panelClass: ['success-toast']
    };
    this.snackBar.open(`✓ ${message}`, '', config);
  }

  showError(message: string, duration: number = 4000): void {
    const config: MatSnackBarConfig = {
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
      panelClass: ['error-toast']
    };
    this.snackBar.open(`✕ ${message}`, '', config);
  }

  showWarning(message: string, duration: number = 3500): void {
    const config: MatSnackBarConfig = {
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
      panelClass: ['warning-toast']
    };
    this.snackBar.open(`⚠ ${message}`, '', config);
  }

  showInfo(message: string, duration: number = 3000): void {
    const config: MatSnackBarConfig = {
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
      panelClass: ['info-toast']
    };
    this.snackBar.open(`ℹ ${message}`, '', config);
  }
}