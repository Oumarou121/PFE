IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[User]')
      AND name = N'ModuleIds'
)
BEGIN
    ALTER TABLE [dbo].[User]
    ADD [ModuleIds] nvarchar(max) NOT NULL
        CONSTRAINT [DF_User_ModuleIds] DEFAULT (N'[]');
END;
