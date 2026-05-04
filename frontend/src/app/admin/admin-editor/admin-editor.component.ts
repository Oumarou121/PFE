import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../core/services/db.service';
import { TemplateApiService } from '../../core/services/template-api.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-admin-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: \
    <div style="padding: 20px;">
      <!-- TEMPORARY SKELETON REPLICATING LEGACY -->
      <div class="tname-bar" style="display:flex; align-items:center; gap:10px; margin-bottom: 10px; background: white; padding: 12px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
        <input class="tname-input" [(ngModel)]="templateName" placeholder="Nom du template" style="flex:1; border: 1px solid #ccc; padding: 8px; border-radius: 4px;" />
        <span class="save-st" style="font-size:12px; color:green; margin-left:10px;" *ngIf="saveStatus">{{ saveStatus }}</span>
        
        <button class="btn ghost sm" (click)="preview()" style="padding: 6px 12px; border-radius: 4px; border: 1px solid #ccc; background: #f9f9f9; cursor: pointer;">
          Aperçu
        </button>
        <button class="btn success" (click)="saveTemplate()" style="padding: 6px 12px; border-radius: 4px; background: #007bff; color: white; border: none; cursor: pointer;">
          Enregistrer
        </button>
      </div>

      <!-- TIP-TAP TOOLBAR -->
      <div class="editor-toolbar" style="display:flex; flex-wrap: wrap; gap: 8px; background: white; padding: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 20px; align-items: center;">
        <button (click)="toggleBold()" [class.active]="activeEditor?.isActive('bold')" title="Gras"><b>B</b></button>
        <button (click)="toggleItalic()" [class.active]="activeEditor?.isActive('italic')" title="Italique"><i>I</i></button>
        
        <span class="divider" style="color: #ccc; margin: 0 4px;">|</span>
        
        <button (click)="insertTable()" title="Insérer un tableau">Tab</button>
        <button (click)="activeEditor?.chain().focus().addColumnAfter().run()" [disabled]="!activeEditor?.isActive('table')" title="Ajouter une colonne">+ Col</button>
        <button (click)="activeEditor?.chain().focus().addRowAfter().run()" [disabled]="!activeEditor?.isActive('table')" title="Ajouter une ligne">+ Ligne</button>
        <button (click)="activeEditor?.chain().focus().deleteTable().run()" [disabled]="!activeEditor?.isActive('table')" title="Supprimer le tableau" style="color:red;">- Tab</button>

        <span class="divider" style="color: #ccc; margin: 0 4px;">|</span>

        <select #varSelect (change)="insertVariable(varSelect.value); varSelect.value=''" style="padding:4px 8px; border: 1px solid #ccc; border-radius:4px; max-width: 200px;">
          <option value="">-- Insérer une variable --</option>
          <option value="{{{{ nom_salarie }}}}">Nom du salarié</option>
          <option value="{{{{ salaire_base }}}}">Salaire de base</option>
          <option value="{{{{ date_embauche }}}}">Date d'embauche</option>
        </select>

        <span style="font-size:12px; color:#888; margin-left:auto;">(Cliquez dans l'En-tête, le Corps ou le Pied de page pour éditer)</span>
      </div>

      <!-- PAGE CANVAS avec Header, Body et Footer -->
      <div class="pcanvas" style="background:#eef0f3; padding:20px; display:flex; justify-content:center;">
        <div class="a4-page" style="background:white; width:210mm; min-height:297mm; padding:20mm; box-shadow:0 1px 3px rgba(0,0,0,0.1); display:flex; flex-direction:column;">
          
          <div id="sec-header" style="min-height:60px; border-bottom: 2px dashed #e0e0e0; margin-bottom: 15px; padding-bottom: 10px;">
            <div class="tiptap-wrapper" #ckHeader></div>
          </div>
          
          <div id="sec-body" style="flex:1;">
            <div class="tiptap-wrapper" #ckBody></div>
          </div>

          <div id="sec-footer" style="min-height:60px; border-top: 2px dashed #e0e0e0; margin-top: 15px; padding-top: 10px;">
            <div class="tiptap-wrapper" #ckFooter></div>
          </div>

        </div>
      </div>
    </div>
  \,
  styles: [\
    .tiptap-wrapper { outline: none; min-height: 50px; font-family: "Times New Roman", Times, serif; }
    .tiptap-wrapper p { margin-bottom: 1em; }
    .ProseMirror { min-height: 50px; outline: none; }
    .ProseMirror table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 0; overflow: hidden; }
    .ProseMirror table td, .ProseMirror table th { min-width: 1em; border: 1px solid #ced4da; padding: 3px 5px; vertical-align: top; box-sizing: border-box; position: relative; }
    .ProseMirror table th { font-weight: bold; text-align: left; background-color: #f1f3f5; }
    .editor-toolbar button { border: 1px solid #ccc; background: white; border-radius: 3px; padding: 4px 8px; cursor: pointer; }
    .editor-toolbar button:disabled { opacity: 0.5; cursor: not-allowed; }
    .editor-toolbar button.active { background: #e0e0e0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); }
  \]
})
export class AdminEditorComponent implements OnChanges, OnDestroy {
  @Input() templateId!: string | null;
  @Input() templateName: string = '';

  @ViewChild('ckHeader', { static: true }) ckHeaderRef!: ElementRef;
  @ViewChild('ckBody', { static: true }) ckBodyRef!: ElementRef;
  @ViewChild('ckFooter', { static: true }) ckFooterRef!: ElementRef;

  public headerEditor: any = null;
  public bodyEditor: any = null;
  public footerEditor: any = null;
  
  public activeEditor: any = null; // Suit l'éditeur en cours d'utilisation
  public saveStatus: string = '';

  constructor(private db: DbService, private api: TemplateApiService, private cdr: ChangeDetectorRef) {}

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['templateId'] && this.templateId) {
      await this.initEditors();
    }
  }

  async initEditors() {
    this.ngOnDestroy(); // Nettoie les anciens éditeurs si existants

    const ESM = 'https://esm.sh';
    const V = '2.4.0';

    try {
      let tpl: any = null;
      try {
        // Tentative de récupération depuis le backend C#
        tpl = await firstValueFrom(this.api.getTemplateById(this.templateId!));
      } catch (e) {
        console.warn('Fallback: Chargement du template depuis le legacy DB', e);
        tpl = this.db.getTemplate(this.templateId!);
      }

      const headerHtml = tpl?.header || \<p style="text-align: right; color: #888;">Mon En-tête</p>\;
      const bodyHtml = tpl?.body || \<p>Édition du template <strong>\</strong></p>\;
      const footerHtml = tpl?.footer || \<p style="text-align: center; color: #888;">Page 1</p>\;

      const { Editor } = await import(\\/@tiptap/core@\\);
      const { default: StarterKit } = await import(\\/@tiptap/starter-kit@\\);
      const { default: TextAlign } = await import(\\/@tiptap/extension-text-align@\\);
      
      // Import des extensions de Tableaux
      const { default: Table } = await import(\\/@tiptap/extension-table@\\);
      const { default: TableRow } = await import(\\/@tiptap/extension-table-row@\\);
      const { default: TableHeader } = await import(\\/@tiptap/extension-table-header@\\);
      const { default: TableCell } = await import(\\/@tiptap/extension-table-cell@\\);

      const extensions = [
        StarterKit,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell
      ];

      const createTipTap = (element: any, content: string) => {
        return new Editor({
          element,
          extensions,
          content,
          onTransaction: () => {
            this.cdr.detectChanges();
          },
          onFocus: ({ editor }: any) => {
            this.activeEditor = editor;
            this.cdr.detectChanges();
          }
        });
      };

      this.headerEditor = createTipTap(this.ckHeaderRef.nativeElement, headerHtml);
      this.bodyEditor = createTipTap(this.ckBodyRef.nativeElement, bodyHtml);
      this.footerEditor = createTipTap(this.ckFooterRef.nativeElement, footerHtml);

      // Par défaut, le corps est actif
      this.activeEditor = this.bodyEditor;

    } catch (err) {
      console.error('Failed to load TipTap and Extensions from ESM', err);
    }
  }

  // --- TOOLBAR ACTIONS ---

  toggleBold() {
    this.activeEditor?.chain().focus().toggleBold().run();
  }

  toggleItalic() {
    this.activeEditor?.chain().focus().toggleItalic().run();
  }

  insertTable() {
    this.activeEditor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  insertVariable(variable: string) {
    if (!variable || !this.activeEditor) return;
    this.activeEditor.chain().focus().insertContent(variable).run();
  }

  // ----------------------

  saveTemplate() {
    if (!this.bodyEditor || !this.templateId) return;
    
    this.saveStatus = 'Enregistrement...';
    
    let tpl = this.db.getTemplate(this.templateId);
    if (!tpl) {
      // Si inexistant dans l'ancien système, on initialise un objet de base
      tpl = {
        id: this.templateId,
        familyId: null, // Idéalement, devrait être passé par AdminComponent
      };
    }

    // Capture les 3 zones
    tpl.header = this.headerEditor.getHTML();
    tpl.body = this.bodyEditor.getHTML();
    tpl.footer = this.footerEditor.getHTML();
    
    tpl.nom = this.templateName;
    tpl.updatedAt = new Date().toISOString();
    
    // Sauvegarde en parallèle sur le nouveau Back-End C#
    this.api.saveTemplate(tpl).subscribe({
      next: (res) => {
        this.saveStatus = 'Enregistré avec succès !';
        setTimeout(() => this.saveStatus = '', 3000);
        
        // On synchronise la mémoire Angular/Legacy pour parité
        this.db.saveTemplate(tpl);
      },
      error: (err) => {
        console.error('Erreur API C# lors de la sauvegarde:', err);
        // Mode dégradé si le C# est down : sauvegarde au moins locale
        this.db.saveTemplate(tpl);
        this.saveStatus = 'Enregistré localement (API C# inaccessible)';
        setTimeout(() => this.saveStatus = '', 3000);
      }
    });
  }

  preview() {
    if (!this.bodyEditor) return;
    
    // Concaténer virtuellement pour l'aperçu
    const h = this.headerEditor.getHTML();
    const b = this.bodyEditor.getHTML();
    const f = this.footerEditor.getHTML();
    
    const newWindow = window.open('', '_blank', 'width=800,height=800');
    if (newWindow) {
      newWindow.document.write(\
        <html>
          <head>
            <title>Aperçu: \</title>
            <style>
              @page { size: A4; margin: 20mm; }
              body { font-family: "Times New Roman", Times, serif; }
              .header { border-bottom: 1px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
              .footer { border-top: 1px solid #000; padding-top: 20px; margin-top: 20px; color: #555; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #000; padding: 5px; }
            </style>
          </head>
          <body>
            <div class="header">\</div>
            <div class="body">\</div>
            <div class="footer">\</div>
          </body>
        </html>
      \);
      newWindow.document.close();
    }
  }

  ngOnDestroy() {
    if (this.headerEditor) this.headerEditor.destroy();
    if (this.bodyEditor) this.bodyEditor.destroy();
    if (this.footerEditor) this.footerEditor.destroy();
    this.activeEditor = null;
  }
}
