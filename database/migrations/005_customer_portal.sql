-- Customer portal: client accounts are users with the "Customer" role,
-- linked to the customer company they belong to. Staff accounts keep
-- customer_id NULL. Portal endpoints only ever read data for the signed-in
-- user's customer_id; every staff endpoint rejects the Customer role.
USE b2b_management;

INSERT IGNORE INTO roles (name) VALUES ('Customer');

SET @has_customer := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'customer_id'
);
SET @sql := IF(
    @has_customer = 0,
    'ALTER TABLE users
        ADD COLUMN customer_id INT NULL,
        ADD CONSTRAINT fk_users_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
        ADD INDEX idx_users_customer (customer_id)',
    'SELECT ''users already has customer_id'' AS info'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;
