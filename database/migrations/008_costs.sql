-- Costs, for margin reporting.
--
--   products.average_cost   weighted average purchase cost, updated on every
--                           purchase receipt (or set by hand on the product)
--   order_items.unit_cost   the product's average cost when the line was sold,
--                           so later cost changes don't rewrite past margins
--
-- Existing rows are backfilled: products from their received purchase orders,
-- or an estimate when they were never purchased; order lines from the product.
USE b2b_management;

SET @has_cost := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'average_cost'
);
SET @sql := IF(
    @has_cost = 0,
    'ALTER TABLE products
        ADD COLUMN average_cost DECIMAL(10,2) NULL,
        ADD CONSTRAINT chk_products_average_cost CHECK (average_cost >= 0)',
    'SELECT ''products already has average_cost'' AS info'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @has_line_cost := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_items' AND COLUMN_NAME = 'unit_cost'
);
SET @sql := IF(
    @has_line_cost = 0,
    'ALTER TABLE order_items ADD COLUMN unit_cost DECIMAL(10,2) NULL',
    'SELECT ''order_items already has unit_cost'' AS info'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

-- Keep in sync with backfillCosts() in backend/src/services/costs.js.
UPDATE products p
LEFT JOIN (
    SELECT poi.product_id, SUM(poi.quantity * poi.unit_cost) / SUM(poi.quantity) AS cost
    FROM purchase_order_items poi
    INNER JOIN purchase_orders po ON po.id = poi.purchase_order_id
    WHERE po.status = 'Received'
    GROUP BY poi.product_id
) received ON received.product_id = p.id
SET p.average_cost = ROUND(COALESCE(received.cost, p.price * (0.45 + MOD(p.id * 37, 30) / 100)), 2)
WHERE p.average_cost IS NULL;

UPDATE order_items oi
INNER JOIN products p ON p.id = oi.product_id
SET oi.unit_cost = p.average_cost
WHERE oi.unit_cost IS NULL;
