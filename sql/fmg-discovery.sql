-- FMG read-only discovery. Run against a disposable/test copy when possible.
-- Does not insert. Avoids SELECT * and customer PII dumps.

-- 1. Object types
SELECT s.name AS schema_name, o.name AS object_name, o.type, o.type_desc
FROM sys.objects AS o
JOIN sys.schemas AS s ON s.schema_id = o.schema_id
WHERE o.name IN (
    'ProdView','OrgView','OrgGvariView','GvariView','UserNameGvariView',
    'ActionsView','ActionsSagad','ActionsProd','ActionsQseli','ActionsFg',
    'ActionsOrgT','ActionsReg','ActionsGvari','ActionsOrgCategory',
    'OnlineReal1','OnlineReal2'
)
ORDER BY o.name;

-- 2. Columns, types, nullability, identity, computed, defaults
SELECT
    OBJECT_SCHEMA_NAME(c.object_id) AS schema_name,
    OBJECT_NAME(c.object_id) AS object_name,
    c.name AS column_name,
    t.name AS type_name,
    c.max_length,
    c.precision,
    c.scale,
    c.is_nullable,
    c.is_identity,
    c.is_computed,
    dc.definition AS default_definition
FROM sys.columns AS c
JOIN sys.types AS t ON t.user_type_id = c.user_type_id
LEFT JOIN sys.default_constraints AS dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE OBJECT_NAME(c.object_id) IN (
    'ProdView','OrgView','OrgGvariView','GvariView','UserNameGvariView',
    'ActionsView','ActionsSagad','ActionsProd','ActionsQseli','ActionsFg',
    'ActionsOrgT','ActionsReg','ActionsGvari','ActionsOrgCategory',
    'OnlineReal1','OnlineReal2'
)
ORDER BY object_name, c.column_id;

-- 3. Keys and indexes for order tables
SELECT
    OBJECT_NAME(i.object_id) AS object_name,
    i.name AS index_name,
    i.is_primary_key,
    i.is_unique,
    i.type_desc
FROM sys.indexes AS i
WHERE OBJECT_NAME(i.object_id) IN ('OnlineReal1','OnlineReal2')
ORDER BY object_name, i.index_id;

SELECT
    fk.name AS foreign_key,
    OBJECT_NAME(fk.parent_object_id) AS parent_table,
    COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS parent_column,
    OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
    COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column
FROM sys.foreign_keys AS fk
JOIN sys.foreign_key_columns AS fkc ON fkc.constraint_object_id = fk.object_id
WHERE OBJECT_NAME(fk.parent_object_id) IN ('OnlineReal1','OnlineReal2')
   OR OBJECT_NAME(fk.referenced_object_id) IN ('OnlineReal1','OnlineReal2');

-- 4. Triggers on OnlineReal1/2
SELECT
    OBJECT_NAME(t.parent_id) AS table_name,
    t.name AS trigger_name,
    t.is_disabled,
    OBJECT_DEFINITION(t.object_id) AS definition
FROM sys.triggers AS t
WHERE OBJECT_NAME(t.parent_id) IN ('OnlineReal1','OnlineReal2');

SELECT OBJECT_NAME(m.object_id) AS view_name, m.definition
FROM sys.sql_modules AS m
JOIN sys.objects AS o ON o.object_id = m.object_id
WHERE o.name IN ('ProdView','OrgView','OrgGvariView','GvariView','ActionsView');

-- 5. Procedures/functions that reference OnlineReal1/2 or pricing
SELECT DISTINCT OBJECT_SCHEMA_NAME(d.referencing_id) AS schema_name, OBJECT_NAME(d.referencing_id) AS object_name, o.type_desc
FROM sys.sql_expression_dependencies AS d
JOIN sys.objects AS o ON o.object_id = d.referencing_id
WHERE d.referenced_entity_name IN ('OnlineReal1','OnlineReal2','ActionsView','ProdView')
ORDER BY object_name;

-- 6. Bounded domain samples (no personal data)
SELECT TOP 20 FG, COUNT(*) AS cnt
FROM dbo.OrgView
GROUP BY FG
ORDER BY cnt DESC;

SELECT TOP 20 IdActionsT, ActionsT, COUNT(*) AS cnt
FROM dbo.ActionsView
GROUP BY IdActionsT, ActionsT
ORDER BY cnt DESC;

SELECT TOP 20 IdRealT, COUNT(*) AS cnt
FROM dbo.OnlineReal1
GROUP BY IdRealT
ORDER BY cnt DESC;

SELECT TOP 20 IdVisitStatus, COUNT(*) AS cnt
FROM dbo.OnlineReal1
GROUP BY IdVisitStatus
ORDER BY cnt DESC;

SELECT TOP 20 IdMdz, COUNT(*) AS cnt
FROM dbo.OnlineReal1
GROUP BY IdMdz
ORDER BY cnt DESC;
