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

  // print(): void {
  //   const printWindow = window.open("", "_blank");
  //   if (!printWindow) return;
  //   const orientation = this.getSnapshotOrientation();

  //   const html = `
  //     <!DOCTYPE html>
  //     <html>
  //       <head>
  //         <title>${this.document.title}</title>
  //         <style>
  //           @page {
  //             margin: 0;
  //             size: A4 ${orientation};
  //           }
  //           body {
  //             margin: 0;
  //             padding: 0;
  //             background: #fff;
  //           }
  //           * { box-sizing: border-box; }
  //           ${this.documentRender.getDocumentPrintCss()}
  //         </style>
  //       </head>
  //       <body>
  //         <div id="sirh-print-area">
  //           ${this.document.fullHtml}
  //         </div>
  //         <script>
  //           window.onload = function() {
  //             window.print();
  //             setTimeout(function() { window.close(); }, 500);
  //           };
  //         </script>
  //       </body>
  //     </html>
  //   `;

  //   printWindow.document.write(html);
  //   printWindow.document.close();
  // }

  print(): void {
    const orientation = this.getSnapshotOrientation();

    const printContainer = document.createElement("div");
    printContainer.id = "sirh-print-container";

    printContainer.innerHTML = `
    <style>
      @media print {
        @page {
          margin: 0;
          size: A4 ${orientation};
        }

        body * {
          visibility: hidden !important;
        }

        #sirh-print-container,
        #sirh-print-container * {
          visibility: visible !important;
        }

        #sirh-print-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          background: white;
        }

        * {
          box-sizing: border-box;
        }

        ${this.documentRender.getDocumentPrintCss()}
      }
    </style>

    <div id="sirh-print-area">
      ${this.document.fullHtml}
    </div>
  `;

    document.body.appendChild(printContainer);

    setTimeout(() => {
      window.print();

      setTimeout(() => {
        document.body.removeChild(printContainer);
      }, 500);
    }, 100);
  }
  private getSnapshotOrientation(): "portrait" | "landscape" {
    return /--page-orientation\s*:\s*landscape/i.test(this.document.fullHtml)
      ? "landscape"
      : "portrait";
  }
}
