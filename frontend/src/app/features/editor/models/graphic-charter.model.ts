export interface PageMargins {
  mt: number;
  mb: number;
  ml: number;
  mr: number;
}

export interface PageBackground {
  enabled: boolean;
  image: string;
  size: 'cover' | 'contain' | '100% 100%';
  position: string;
  repeat: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
}

export interface GraphicCharterConfig {
  identity: {
    officialName: string;
    directorName: string;
    slogan: string;
    logoText: string;
  };
  colors: Record<string, string>;
  typography: {
    bodyFont: string;
    headingFont: string;
  };
  layout: {
    orientation: 'portrait' | 'landscape';
    pageMargins: PageMargins;
    headerFooterDistances: {
      headerTop: number;
      footerBottom: number;
    };
    pageBackground: PageBackground;
  };
  header: {
    enabledByDefault: boolean;
    displayMode: 'all' | 'first' | 'even' | 'odd';
    html: string;
  };
  footer: {
    enabledByDefault: boolean;
    displayMode: 'all' | 'first' | 'even' | 'odd';
    html: string;
  };
  watermark: {
    enabled: boolean;
    text: string;
    color: string;
    opacity: number;
  };
}

export interface GraphicCharterRecord {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  config: GraphicCharterConfig;
}
