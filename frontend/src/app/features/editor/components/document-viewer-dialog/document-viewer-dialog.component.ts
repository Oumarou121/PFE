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
import { TemplateService } from "../../services/template.service";

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
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${this.document.title}</title>
          <style>
            @page {
              margin: 0;
              size: auto; /* Browser will use values from our CSS variables if possible or we can try to detect orientation from HTML */
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
            }
            /* Reset for print */
            * { box-sizing: border-box; }
            
            /* Core Document Layout (replicated from DocumentRenderService) */
            .document-pages {
               display: block;
            }
            .document-render, .document-page, .preview-page, .sirh-print-page {
              width: var(--page-w, 210mm);
              height: var(--page-h, 297mm);
              background-color: #fff;
              background-image: var(--doc-page-bg-image, none);
              background-size: var(--doc-page-bg-size, cover);
              background-position: var(--doc-page-bg-position, center center);
              background-repeat: var(--doc-page-bg-repeat, no-repeat);
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
              display: grid;
              grid-template-rows: auto minmax(0, 1fr) auto;
              position: relative;
              overflow: hidden;
              page-break-after: always;
              break-after: page;
            }
            .doc-page-header {
              grid-row: 1;
              padding: var(--page-header-top, 5mm) var(--page-mr, 25mm) 3mm var(--page-ml, 25mm);
              font-family: var(--doc-font-body, serif);
              color: var(--doc-color-text, #111);
            }
            .doc-page-body {
              grid-row: 2;
              padding: var(--page-mt, 20mm) var(--page-mr, 25mm) var(--page-mb, 20mm) var(--page-ml, 25mm);
              font-family: var(--doc-font-body, serif);
              color: var(--doc-color-text, #111);
            }
            .doc-page-body.no-header { padding-top: var(--page-mt, 20mm); }
            .doc-page-body.no-footer { padding-bottom: var(--page-mb, 20mm); }
            
            .doc-page-footer {
              grid-row: 3;
              padding: 3mm var(--page-mr, 25mm) var(--page-footer-bottom, 5mm) var(--page-ml, 25mm);
              font-family: var(--doc-font-body, serif);
              color: var(--doc-color-text, #111);
            }
            
            /* Elements styles */
            p { margin: 0 0 0.4em; }
            table { border-collapse: collapse; width: 100%; table-layout: fixed; }
            td, th { border: 1px solid var(--doc-color-border, #ccc); padding: 6px 10px; word-break: break-word; }
            img { max-width: 100%; height: auto; display: block; }
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
}
