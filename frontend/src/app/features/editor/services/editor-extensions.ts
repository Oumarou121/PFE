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
// Préservé à l'identique — DocumentRenderService dépend de ces styles inline.

export function renderTableCellStyle(
  attributes: Record<string, unknown>,
): Record<string, string> {
  const styles = [
    attributes["backgroundColor"] &&
    attributes["backgroundColor"] !== "transparent"
      ? `background-color:${attributes["backgroundColor"]}`
      : "",
    attributes["textColor"] ? `color:${attributes["textColor"]}` : "",
    attributes["textAlign"] ? `text-align:${attributes["textAlign"]}` : "",
    attributes["verticalAlign"]
      ? `vertical-align:${attributes["verticalAlign"]}`
      : "",
  ].filter(Boolean);
  return styles.length ? { style: styles.join(";") } : {};
}

// ─── TableCellWithStyle ───────────────────────────────────────────────────────
// TableCellPlus (tiptap-table-plus) étendu avec les attributs custom de style.
// parseHTML/renderHTML conservés à l'identique pour la compatibilité base.

export const TableCellWithStyle = TableCellPlus.extend({
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

// ─── TableHeaderWithStyle ─────────────────────────────────────────────────────
// TableHeaderPlus (tiptap-table-plus) étendu avec les mêmes attributs de style.

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
  headerHtml?: string;
  footerHtml?: string;
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
    pageGapBorderColor: "#e5e7eb",
    pageBreakBackground: "#f9fafb",
    marginTop:    config ? mmToPx(config.marginTop)    : mmToPx(20),
    marginBottom: config ? mmToPx(config.marginBottom) : mmToPx(20),
    marginLeft:   config ? mmToPx(config.marginLeft)   : mmToPx(25),
    marginRight:  config ? mmToPx(config.marginRight)  : mmToPx(25),
    contentMarginTop:    0,
    contentMarginBottom: 0,
    headerLeft:  config?.headerHtml ?? "",
    headerRight: "",
    footerLeft:  config?.footerHtml ?? "",
    footerRight: "",
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
  // ImagePlus remplace ResizableImage + EditorImageResizeService
  // inline:true conserve le comportement existant (images dans le flux de texte)
  ImagePlus.configure({ inline: true, allowBase64: true }),
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
  ImagePlus.configure({ inline: true, allowBase64: true }),
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

export function buildStructuredDocumentExtensions() {
  return [...STRUCTURED_DOCUMENT_EXTENSIONS];
}

// ─── SHARED_EXTENSIONS (compatibilité rétrograde) ────────────────────────────
// Conservé pour les éditeurs charte graphique qui n'ont pas de section.
// À terme, remplacer par buildEditorExtensions("header") dans le code appelant.

export const SHARED_EXTENSIONS = BASE_EXTENSIONS;
