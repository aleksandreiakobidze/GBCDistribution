-- Run as SQL sysadmin on the FMG LAN host (documented example: 192.168.0.200).
-- Gives login [AI] read on FMG views and (later) write on incoming order tables.
-- Do not grant db_owner.
-- VPN clients must not connect here. Only the office Laravel origin PC uses this login.

USE [SBS_RSF];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'AI')
    CREATE USER [AI] FOR LOGIN [AI];
GO

GRANT SELECT ON OBJECT::dbo.OrgView TO [AI];
GRANT SELECT ON OBJECT::dbo.ProdView TO [AI];
GRANT SELECT ON OBJECT::dbo.OrgGvariView TO [AI];
GRANT SELECT ON OBJECT::dbo.GvariView TO [AI];
GRANT SELECT ON OBJECT::dbo.UserNameGvariView TO [AI];
GRANT SELECT ON OBJECT::dbo.ActionsView TO [AI];
GRANT SELECT ON OBJECT::dbo.ActionsSagad TO [AI];
GRANT SELECT ON OBJECT::dbo.ActionsProd TO [AI];
GRANT SELECT ON OBJECT::dbo.ActionsQseli TO [AI];
GRANT SELECT ON OBJECT::dbo.ActionsFg TO [AI];
GRANT SELECT ON OBJECT::dbo.ActionsOrgT TO [AI];
GRANT SELECT ON OBJECT::dbo.ActionsReg TO [AI];
GRANT SELECT ON OBJECT::dbo.ActionsGvari TO [AI];
GRANT SELECT ON OBJECT::dbo.ActionsOrgCategory TO [AI];
GRANT SELECT ON OBJECT::dbo.OnlineReal1 TO [AI];
GRANT SELECT ON OBJECT::dbo.OnlineReal2 TO [AI];
GRANT SELECT ON sys.objects TO [AI];
GRANT SELECT ON sys.columns TO [AI];
GRANT SELECT ON sys.types TO [AI];
GRANT SELECT ON sys.indexes TO [AI];
GRANT SELECT ON sys.foreign_keys TO [AI];
GRANT SELECT ON sys.foreign_key_columns TO [AI];
GRANT SELECT ON sys.triggers TO [AI];
GRANT SELECT ON sys.sql_modules TO [AI];
GRANT SELECT ON sys.sql_expression_dependencies TO [AI];
GRANT VIEW DEFINITION TO [AI];
GO

-- Writes stay disabled in the app until mapping is verified.
-- GRANT INSERT ON OBJECT::dbo.OnlineReal1 TO [AI];
-- GRANT INSERT ON OBJECT::dbo.OnlineReal2 TO [AI];
GO
