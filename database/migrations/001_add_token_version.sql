-- Adds a per-user session counter. Every JWT embeds the value it was issued
-- with; bumping it (logout, password/role change, deactivation) revokes all
-- of that user's existing sessions immediately.
USE b2b_management;

SET @exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'token_version'
);

SET @sql := IF(
    @exists = 0,
    'ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0',
    'SELECT ''token_version already exists'' AS info'
);

PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;
