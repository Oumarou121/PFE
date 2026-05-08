import { Component, Inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from "@angular/material/dialog";

type ActionType = "delete" | "warning" | "success" | "info" | "error";

interface DialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  actionType?: ActionType;
  iconColor?: string;
  confirmButtonColor?: string;
  confirmButtonBgColor?: string;
}

@Component({
  selector: "app-confirm-dialog",
  standalone: true,
  imports: [CommonModule, MatDialogModule], // MatDialogModule pour le composant hôte
  templateUrl: "./confirm-dialog.component.html",
  styleUrls: ["./confirm-dialog.component.scss"],
})
export class ConfirmDialogComponent {
  readonly actionTypeClass: string;
  readonly iconColorStyle: { color: string };
  readonly confirmButtonStyle: {
    backgroundColor?: string;
    color?: string;
    borderColor?: string;
  };

  constructor(
    private dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {
    const actionType = data.actionType || "warning";
    this.actionTypeClass = `action-${actionType}`;

    const defaultColors = this.getDefaultColors(actionType);
    this.iconColorStyle = {
      color: data.iconColor || defaultColors.iconColor,
    };
    this.confirmButtonStyle = {
      backgroundColor:
        data.confirmButtonBgColor || defaultColors.confirmButtonBgColor,
      color: data.confirmButtonColor || defaultColors.confirmButtonColor,
      borderColor:
        (data.confirmButtonBgColor || defaultColors.confirmButtonBgColor) +
        "40",
    };
  }

  private getDefaultColors(actionType: ActionType) {
    const colors: Record<ActionType, any> = {
      delete: {
        iconColor: "#dc2626",
        confirmButtonColor: "#ffffff",
        confirmButtonBgColor: "#dc2626",
      },
      warning: {
        iconColor: "#f59e0b",
        confirmButtonColor: "#ffffff",
        confirmButtonBgColor: "#f59e0b",
      },
      success: {
        iconColor: "#10b981",
        confirmButtonColor: "#ffffff",
        confirmButtonBgColor: "#10b981",
      },
      info: {
        iconColor: "#3b82f6",
        confirmButtonColor: "#ffffff",
        confirmButtonBgColor: "#3b82f6",
      },
      error: {
        iconColor: "#ef4444",
        confirmButtonColor: "#ffffff",
        confirmButtonBgColor: "#ef4444",
      },
    };
    return colors[actionType];
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
