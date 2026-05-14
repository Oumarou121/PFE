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
import { DocumentRenderService } from "../../services/document-render.service";

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
  documentPreviewCss: SafeHtml;

  constructor(
    public dialogRef: MatDialogRef<DocumentViewerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { document: DocumentRecord },
    private sanitizer: DomSanitizer,
    private documentRender: DocumentRenderService,
  ) {
    this.document = data.document;
    this.sanitizedHtml = this.sanitizer.bypassSecurityTrustHtml(
      data.document.fullHtml,
    );
    this.documentPreviewCss = this.sanitizer.bypassSecurityTrustHtml(
      this.documentRender.getDocumentPrintCss({ preview: true }),
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
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const orientation = this.getSnapshotOrientation();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${this.document.title}</title>
          <style>
            @page {
              margin: 0;
              size: A4 ${orientation};
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
            }
            * { box-sizing: border-box; }
            ${this.documentRender.getDocumentPrintCss()}
          </style>
        </head>
        <body>
          <div id="sirh-print-area">
            ${this.document.fullHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  private getSnapshotOrientation(): "portrait" | "landscape" {
    return /--page-orientation\s*:\s*landscape/i.test(this.document.fullHtml)
      ? "landscape"
      : "portrait";
  }
}
