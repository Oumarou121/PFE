/**
 * editor-extensions.ts  —  PHASE 3 (Migration tiptap-open-source)
 *
 * CHANGEMENTS PAR RAPPORT À L'ORIGINAL :
 *
 * 1. ResizableImage  → remplacé par ImagePlus (tiptap-image-plus)
 *    - Supprime EditorImageResizeService et toute la logique DOM manuelle
 *    - Le resize, l'alignement et le ratio sont gérés nativement par la NodeView
 *
 * 2. TableCellExt + TableHeaderExt + TableRow → remplacés par
 *    WithoutPagination.{ TablePlus, TableCellPlus, TableHeaderPlus, TableRowPlus }
 *    (tiptap-table-plus)
 *    - Ajoute duplicateColumn / duplicateRow sans code custom
 *    - IMPORTANT : les attributs custom backgroundColor/textColor/textAlign/verticalAlign
 *      sont conservés via TableCellWithStyle / TableHeaderWithStyle (voir ci-dessous)
 *      pour préserver la compatibilité HTML stocké en base.
 *
 * 3. SHARED_EXTENSIONS → remplacé par buildEditorExtensions(section, config?)
 *    - Injecte PaginationPlus (tiptap-pagination-plus) uniquement sur la section "body"
 *    - header / footer / editors charte graphique gardent les extensions légères
 *
 * 4. FontSize reste inchangé (extension custom introuvable dans les libs).
 *
 * STABILITÉ HTML : parseHTML/renderHTML des cellules sont préservés à l'identique
 * pour ne pas corrompre le HTML stocké en base de données.
 */

import { Extension, mergeAttributes, Node } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import FontFamily from "@tiptap/extension-font-family";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TableRow from "@tiptap/extension-table-row";

// ── Nouvelles dépendances open-source ────────────────────────────────────────
import { ImagePlus } from "tiptap-image-plus";
import { WithoutPagination } from "tiptap-table-plus";
import { PaginationPlus, PAGE_SIZES } from "tiptap-pagination-plus";

const { TablePlus, TableCellPlus, TableHeaderPlus } = WithoutPagination;

export const DocumentRoot = Node.create({
  name: "doc",
  topNode: true,
  content: "documentPage+",
});

export const DocumentPage = Node.create({
  name: "documentPage",
  content: "pageHeader? pageBody pageFooter?",
  isolating: true,
  defining: true,
  parseHTML() {
    return [{ tag: "div[data-document-page]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "document-page-node",
        "data-document-page": "true",
      }),
      0,
    ];
  },
});

export const PageHeader = Node.create({
  name: "pageHeader",
  content: "block*",
  isolating: true,
  defining: true,
  parseHTML() {
    return [{ tag: "section[data-page-header]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        class: "document-page-header",
        "data-page-header": "true",
      }),
      0,
    ];
  },
});

export const PageBody = Node.create({
  name: "pageBody",
  content: "block+",
  isolating: true,
  defining: true,
  parseHTML() {
    return [{ tag: "main[data-page-body]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "main",
      mergeAttributes(HTMLAttributes, {
        class: "document-page-body",
        "data-page-body": "true",
      }),
      0,
    ];
  },
});

export const PageFooter = Node.create({
  name: "pageFooter",
  content: "block*",
  isolating: true,
  defining: true,
  parseHTML() {
    return [{ tag: "section[data-page-footer]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        class: "document-page-footer",
        "data-page-footer": "true",
      }),
      0,
    ];
  },
});

// ─── FontSize ─────────────────────────────────────────────────────────────────
// Conservé tel quel — aucune lib open-source ne couvre cette extension.

export const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) =>
              attributes["fontSize"]
                ? { style: `font-size: ${attributes["fontSize"]}` }
                : {},
          },
        },
      },
    ];
  },
});

// ─── renderTableCellStyle ─────────────────────────────────────────────────────
// BUG FIX: Tiptap appelle renderHTML une fois PAR attribut en lui passant
// l'objet attrs complet. On ne doit émettre le style complet qu'une seule fois
// (sur backgroundColor), et retourner {} pour les autres pour éviter de
// dupliquer le style inline. Le style manquant était causé par un retour {}
// sur textColor / textAlign / verticalAlign alors qu'ils devaient y figurer.

export function renderTableCellStyle(
  attributes: Record<string, unknown>,
): Record<string, string> {
  const styles: string[] = [];

  if (
    attributes["backgroundColor"] &&
    attributes["backgroundColor"] !== "transparent"
  ) {
    styles.push(`background-color:${attributes["backgroundColor"]}`);
  }
  if (attributes["textColor"]) {
    styles.push(`color:${attributes["textColor"]}`);
  }
  if (attributes["textAlign"]) {
    styles.push(`text-align:${attributes["textAlign"]}`);
  }
  if (attributes["verticalAlign"]) {
    styles.push(`vertical-align:${attributes["verticalAlign"]}`);
  }

  return styles.length ? { style: styles.join(";") } : {};
}

// ─── TableCellWithStyle ───────────────────────────────────────────────────────
// TableCellPlus étendu avec les attributs custom de style.
// BUG FIX: renderHTML ne doit être défini que sur UN SEUL attribut (le premier
// rencontré lors du rendu, ici backgroundColor) afin que Tiptap n'appelle
// renderTableCellStyle qu'une seule fois et n'ajoute pas plusieurs attributs
// « style » en double sur le <td>/<th>. Les autres attributs retournent {}.

export const TableCellWithStyle = TableCellPlus.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
        // BUG FIX: renderHTML est appelé une seule fois avec TOUS les attrs.
        // On y regroupe tous les styles custom pour éviter les doublons.
        renderHTML: renderTableCellStyle,
      },
      textColor: {
        default: null,
        parseHTML: (element) => element.style.color || null,
        // Retourne {} : le style est déjà inclus par backgroundColor.renderHTML.
        renderHTML: () => ({}),
      },
      textAlign: {
        default: null,
        parseHTML: (element) => element.style.textAlign || null,
        renderHTML: () => ({}),
      },
      verticalAlign: {
        default: null,
        parseHTML: (element) => element.style.verticalAlign || null,
        renderHTML: () => ({}),
      },
    };
  },
});

// ─── TableHeaderWithStyle ─────────────────────────────────────────────────────
// Même correction que TableCellWithStyle pour les cellules d'en-tête.

export const TableHeaderWithStyle = TableHeaderPlus.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
        renderHTML: renderTableCellStyle,
      },
      textColor: {
        default: null,
        parseHTML: (element) => element.style.color || null,
        renderHTML: () => ({}),
      },
      textAlign: {
        default: null,
        parseHTML: (element) => element.style.textAlign || null,
        renderHTML: () => ({}),
      },
      verticalAlign: {
        default: null,
        parseHTML: (element) => element.style.verticalAlign || null,
        renderHTML: () => ({}),
      },
    };
  },
});

// ─── Config PaginationPlus ────────────────────────────────────────────────────
// Convertit les marges mm (stockées dans le template) en pixels (96 dpi).

function mmToPx(mm: number): number {
  return Math.round((mm * 96) / 25.4);
}

export interface PaginationConfig {
  orientation: "portrait" | "landscape";
  marginTop: number;    // mm
  marginBottom: number; // mm
  marginLeft: number;   // mm
  marginRight: number;  // mm
  headerTop?: number;   // mm
  footerBottom?: number; // mm
  contentMarginTop?: number; // mm
  contentMarginBottom?: number; // mm
  headerHtml?: string;
  footerHtml?: string;
  customHeader?: Record<number, { headerLeft: string; headerRight: string }>;
  customFooter?: Record<number, { footerLeft: string; footerRight: string }>;
}

function buildPaginationPlusConfig(config?: PaginationConfig) {
  const portrait = !config || config.orientation !== "landscape";
  // A4: 210×297 mm → 794×1123 px (96 dpi)
  const pageWidth  = portrait ? 794 : 1123;
  const pageHeight = portrait ? 1123 : 794;

  return PaginationPlus.configure({
    enabled: true,
    pageWidth,
    pageHeight,
    pageGap: 40,
    pageGapBorderSize: 1,
    pageGapBorderColor: "#d1d5db", // Gris un peu plus soutenu pour la ligne de séparation
    pageBreakBackground: "#f0f2f5", // Doit correspondre au fond du pcanvas dans admin.component.scss
    marginTop:    config ? mmToPx(config.headerTop ?? config.marginTop)    : mmToPx(20),
    marginBottom: config ? mmToPx(config.footerBottom ?? config.marginBottom) : mmToPx(20),
    marginLeft:   config ? mmToPx(config.marginLeft)   : mmToPx(25),
    marginRight:  config ? mmToPx(config.marginRight)  : mmToPx(25),
    contentMarginTop:    config ? mmToPx(config.contentMarginTop ?? 0) : 0,
    contentMarginBottom: config ? mmToPx(config.contentMarginBottom ?? 0) : 0,
    headerLeft:  config?.headerHtml ?? "",
    headerRight: "",
    footerLeft:  config?.footerHtml ?? "",
    footerRight: "",
    customHeader: config?.customHeader ?? {},
    customFooter: config?.customFooter ?? {},
  });
}

// ─── Extensions de base (partagées par tous les éditeurs) ────────────────────
// Ces extensions n'incluent PAS PaginationPlus.

const BASE_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
  TextStyle,
  FontSize,
  Color,
  FontFamily,
  Underline,
  Highlight.configure({ multicolor: true }),
  Link.configure({ openOnClick: false, autolink: true }),
  // BUG FIX: inline:true supprime le bouton "Centrer" dans les contrôles de
  // position de ImagePlus (voir PositionController.createPositionControls).
  // On passe inline:false pour avoir Gauche / Centre / Droite disponibles.
  // allowBase64:true conservé pour le support des uploads locaux.
  ImagePlus.configure({ inline: false, allowBase64: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  // TablePlus remplace Table + ajoute duplicateRow/duplicateColumn
  TablePlus.configure({ resizable: true }),
  TableRow,
  // TableCellWithStyle/TableHeaderWithStyle préservent les attrs custom de style
  TableCellWithStyle,
  TableHeaderWithStyle,
];

const STRUCTURED_DOCUMENT_EXTENSIONS = [
  DocumentRoot,
  DocumentPage,
  PageHeader,
  PageBody,
  PageFooter,
  StarterKit.configure({
    document: false,
    heading: { levels: [1, 2, 3, 4] },
  }),
  TextStyle,
  FontSize,
  Color,
  FontFamily,
  Underline,
  Highlight.configure({ multicolor: true }),
  Link.configure({ openOnClick: false, autolink: true }),
  // BUG FIX: inline:false pour activer le bouton Centre (voir BASE_EXTENSIONS).
  ImagePlus.configure({ inline: false, allowBase64: true }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  TablePlus.configure({ resizable: true }),
  TableRow,
  TableCellWithStyle,
  TableHeaderWithStyle,
];

// ─── buildEditorExtensions ────────────────────────────────────────────────────
// Factory qui injecte PaginationPlus uniquement sur la section "body".
// header / footer / éditeurs charte graphique utilisent les extensions de base.
//
// Usage dans ensureEditorInstance() et createGraphicCharterEditor() :
//   extensions: buildEditorExtensions(section, config)

export function buildEditorExtensions(
  section: "header" | "body" | "footer",
  paginationConfig?: PaginationConfig,
) {
  if (section === "body") {
    return [
      ...BASE_EXTENSIONS,
      buildPaginationPlusConfig(paginationConfig),
    ];
  }
  return [...BASE_EXTENSIONS];
}

export function buildStructuredDocumentExtensions(
  paginationConfig?: PaginationConfig,
) {
  return [
    ...STRUCTURED_DOCUMENT_EXTENSIONS,
    buildPaginationPlusConfig(paginationConfig),
  ];
}

// ─── SHARED_EXTENSIONS (compatibilité rétrograde) ────────────────────────────
// Conservé pour les éditeurs charte graphique qui n'ont pas de section.
// À terme, remplacer par buildEditorExtensions("header") dans le code appelant.

export const SHARED_EXTENSIONS = BASE_EXTENSIONS;
