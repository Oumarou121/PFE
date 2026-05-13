import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit } from "@angular/core";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { DocumentRecord } from "../../models/document.model";

@Component({
  selector: "app-document-viewer-dialog",
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: "./document-viewer-dialog.component.html",
  styleUrls: ["./document-viewer-dialog.component.scss"],
})
export class DocumentViewerDialogComponent implements OnInit {
  document: DocumentRecord;
  sanitizedHtml: SafeHtml;

  constructor(
    public dialogRef: MatDialogRef<DocumentViewerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { document: DocumentRecord },
    private sanitizer: DomSanitizer,
  ) {
    this.document = data.document;
    this.sanitizedHtml = this.sanitizer.bypassSecurityTrustHtml(
      data.document.fullHtml,
    );
  }

  ngOnInit(): void {}

  close(): void {
    this.dialogRef.close();
  }

  download(): void {
    const blob = new Blob([this.document.fullHtml], {
      type: "text/html;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${this.document.title}.html`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  print(): void {
    const printWindow = window.open("", "", "height=400,width=800");
    if (printWindow) {
      printWindow.document.write(this.document.fullHtml);
      printWindow.document.close();
      printWindow.print();
    }
  }
}
