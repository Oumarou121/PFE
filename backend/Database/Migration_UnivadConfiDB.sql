-- ============================================================
-- Migration : UnivadConfiDB (base de configuration globale)
-- Cible      : SQL Server
-- Usage      : Exécuter UNE FOIS sur la DB UnivadConfiDB
-- ============================================================

-- ── 1. Table family (ressource mutualisée, partagée entre orgs) ────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'family')
BEGIN
  CREATE TABLE [family] (
    id                          NVARCHAR(64)  PRIMARY KEY,
    nom                         NVARCHAR(255) NOT NULL,
    description                 NVARCHAR(MAX) NULL,
    beneficiary_mode            NVARCHAR(32)  NULL DEFAULT 'table',
    beneficiary_table           NVARCHAR(128) NULL,
    beneficiary_table_label     NVARCHAR(255) NULL,
    beneficiary_link_column     NVARCHAR(128) NULL,
    beneficiary_display_column_1 NVARCHAR(128) NULL,
    beneficiary_display_column_2 NVARCHAR(128) NULL,
    beneficiary_sql_text        NVARCHAR(MAX) NULL,
    filter_catalog_json         NVARCHAR(MAX) NULL DEFAULT '[]',
    sql_text                    NVARCHAR(MAX) NULL,
    created_at                  NVARCHAR(64)  NULL,
    classes_json                NVARCHAR(MAX) NOT NULL DEFAULT '[]'
  );
END;

-- Migrations colonnes manquantes
IF COL_LENGTH('family', 'filter_catalog_json') IS NULL
  ALTER TABLE [family] ADD filter_catalog_json NVARCHAR(MAX) NULL DEFAULT '[]';
IF COL_LENGTH('family', 'beneficiary_table_label') IS NULL
  ALTER TABLE [family] ADD beneficiary_table_label NVARCHAR(255) NULL;
IF COL_LENGTH('family', 'beneficiary_link_column') IS NULL
  ALTER TABLE [family] ADD beneficiary_link_column NVARCHAR(128) NULL;
IF COL_LENGTH('family', 'beneficiary_display_column_1') IS NULL
  ALTER TABLE [family] ADD beneficiary_display_column_1 NVARCHAR(128) NULL;
IF COL_LENGTH('family', 'beneficiary_display_column_2') IS NULL
  ALTER TABLE [family] ADD beneficiary_display_column_2 NVARCHAR(128) NULL;

-- ── 2. Table graphic_charter (isolée par organisation via etablissement_id) ─
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'graphic_charter')
BEGIN
  CREATE TABLE [graphic_charter] (
    id               NVARCHAR(64)  PRIMARY KEY,
    etablissement_id INT           NOT NULL,   -- OrganizationId (jamais NULL — 1 org par charte)
    nom              NVARCHAR(255) NOT NULL,
    description      NVARCHAR(MAX) NULL,
    is_default       BIT           NOT NULL DEFAULT 0,
    config_json      NVARCHAR(MAX) NOT NULL DEFAULT '{}',
    created_at       NVARCHAR(64)  NULL,
    updated_at       NVARCHAR(64)  NULL
  );
END;

IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_gc_etab')
  CREATE INDEX idx_gc_etab ON [graphic_charter](etablissement_id);
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_gc_etab_default')
  CREATE INDEX idx_gc_etab_default ON [graphic_charter](etablissement_id, is_default);

-- ── 3. Table template (isolé par organisation via etablissement_id) ─────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'template')
BEGIN
  CREATE TABLE [template] (
    id                    NVARCHAR(64)  PRIMARY KEY,
    family_id             NVARCHAR(64)  NOT NULL,
    etablissement_id      INT           NOT NULL,   -- OrganizationId obligatoire
    graphic_charter_id    NVARCHAR(64)  NULL,
    nom                   NVARCHAR(255) NOT NULL,
    updated_at            NVARCHAR(64)  NULL,
    has_header            BIT           NOT NULL DEFAULT 0,
    has_footer            BIT           NOT NULL DEFAULT 0,
    orientation           NVARCHAR(16)  NULL DEFAULT 'portrait',
    filter_profile_json   NVARCHAR(MAX) NULL DEFAULT '[]',
    section_directions_json NVARCHAR(MAX) NULL DEFAULT '{}',
    page_margins_json     NVARCHAR(MAX) NULL DEFAULT '{}',
    header_html           NVARCHAR(MAX) NULL,
    body_html             NVARCHAR(MAX) NULL,
    footer_html           NVARCHAR(MAX) NULL
  );
END;

IF COL_LENGTH('template', 'filter_profile_json') IS NULL
  ALTER TABLE [template] ADD filter_profile_json NVARCHAR(MAX) NULL DEFAULT '[]';
IF COL_LENGTH('template', 'section_directions_json') IS NULL
  ALTER TABLE [template] ADD section_directions_json NVARCHAR(MAX) NULL DEFAULT '{}';
IF COL_LENGTH('template', 'orientation') IS NULL
  ALTER TABLE [template] ADD orientation NVARCHAR(16) NULL DEFAULT 'portrait';
IF COL_LENGTH('template', 'graphic_charter_id') IS NULL
  ALTER TABLE [template] ADD graphic_charter_id NVARCHAR(64) NULL;

IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_template_family')
  CREATE INDEX idx_template_family ON [template](family_id);
IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'idx_template_etab')
  CREATE INDEX idx_template_etab ON [template](etablissement_id);

-- ── 4. Table table_view_config (configuration globale des vues) ──────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'table_view_config')
BEGIN
  CREATE TABLE [table_view_config] (
    id                  NVARCHAR(64)  PRIMARY KEY,
    table_name          NVARCHAR(128) NOT NULL,
    label               NVARCHAR(255) NOT NULL,
    visible_fields_json NVARCHAR(MAX) NOT NULL DEFAULT '[]',
    editable_fields_json NVARCHAR(MAX) NOT NULL DEFAULT '[]',
    preview_fields_json NVARCHAR(MAX) NOT NULL DEFAULT '[]',
    field_labels_json   NVARCHAR(MAX) NOT NULL DEFAULT '{}',
    field_settings_json NVARCHAR(MAX) NOT NULL DEFAULT '{}',
    created_at          NVARCHAR(64)  NULL,
    updated_at          NVARCHAR(64)  NULL,
    organization_ids_json NVARCHAR(MAX) NULL DEFAULT '[]'
  );
END;

IF COL_LENGTH('table_view_config', 'organization_ids_json') IS NULL
  ALTER TABLE [table_view_config] ADD organization_ids_json NVARCHAR(MAX) NULL DEFAULT '[]';

IF COL_LENGTH('table_view_config', 'field_settings_json') IS NULL
  ALTER TABLE [table_view_config] ADD field_settings_json NVARCHAR(MAX) NOT NULL DEFAULT '{}';
IF COL_LENGTH('table_view_config', 'field_labels_json') IS NULL
  ALTER TABLE [table_view_config] ADD field_labels_json NVARCHAR(MAX) NOT NULL DEFAULT '{}';

-- ── 5. Table app_setting (configurations globales) ───────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'app_setting')
BEGIN
  CREATE TABLE [app_setting] (
    [key]      NVARCHAR(100) PRIMARY KEY,
    value_json NVARCHAR(MAX) NOT NULL
  );
END;
