-- Pricing rules.
--
--   price_lists       a discount off the catalog price for every customer on the list
--   volume_discounts  quantity breaks, for one category or (category_id NULL) all products
--   customer_prices   a fixed (contract) price for one customer and product; beats everything
--
-- Order lines keep the catalog price and the rule that set the price, so the
-- discount stays visible on the invoice after prices change.
USE b2b_management;

CREATE TABLE IF NOT EXISTS price_lists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    discount_percent DECIMAL(5,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_price_lists_discount CHECK (discount_percent > 0 AND discount_percent <= 50)
);

CREATE TABLE IF NOT EXISTS volume_discounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NULL,
    min_quantity INT NOT NULL,
    discount_percent DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_volume_discounts_category
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    CONSTRAINT chk_volume_discounts_quantity CHECK (min_quantity >= 2),
    CONSTRAINT chk_volume_discounts_discount CHECK (discount_percent > 0 AND discount_percent <= 50)
);

CREATE TABLE IF NOT EXISTS customer_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    product_id INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    note VARCHAR(255),
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_customer_prices UNIQUE (customer_id, product_id),
    CONSTRAINT fk_customer_prices_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_prices_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_prices_created_by
        FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT chk_customer_prices_price CHECK (unit_price >= 0)
);

SET @has_price_list := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'price_list_id'
);
SET @sql := IF(
    @has_price_list = 0,
    'ALTER TABLE customers
        ADD COLUMN price_list_id INT NULL,
        ADD CONSTRAINT fk_customers_price_list FOREIGN KEY (price_list_id) REFERENCES price_lists(id)',
    'SELECT ''customers already has price_list_id'' AS info'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

-- NULL list_price on older lines means "no discount recorded".
SET @has_list_price := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'list_price'
);
SET @sql := IF(
    @has_list_price = 0,
    'ALTER TABLE order_items
        ADD COLUMN list_price DECIMAL(10,2) NULL,
        ADD COLUMN price_source ENUM(''list'', ''price_list'', ''volume'', ''contract'', ''quote'') NULL',
    'SELECT ''order_items already has list_price'' AS info'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;
