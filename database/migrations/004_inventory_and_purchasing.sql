-- Inventory ledger, suppliers, and purchase orders.
--
-- Invariant: for every product, SUM(stock_movements.quantity) = products.stock.
-- Stock only changes through movements (sale, cancelled sale, purchase
-- receipt, adjustment, opening balance), each recording who, why, and the
-- resulting balance.
USE b2b_management;

CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    contact_name VARCHAR(150),
    email VARCHAR(255),
    phone VARCHAR(30),
    city VARCHAR(100),
    country VARCHAR(100) NOT NULL DEFAULT 'Morocco',
    lead_time_days INT NOT NULL DEFAULT 7,
    notes VARCHAR(1000),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_suppliers_lead_time CHECK (lead_time_days BETWEEN 0 AND 365)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    status ENUM('Draft', 'Ordered', 'Received', 'Cancelled') NOT NULL DEFAULT 'Draft',
    expected_at DATE NULL,
    notes VARCHAR(1000),
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ordered_at TIMESTAMP NULL,
    received_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    CONSTRAINT fk_purchase_orders_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    CONSTRAINT fk_purchase_orders_created_by
        FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT chk_purchase_orders_total CHECK (total_amount >= 0),
    INDEX idx_purchase_orders_status (status)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_po_items_po
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_po_items_product
        FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT chk_po_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_po_items_cost CHECK (unit_cost >= 0)
);

-- History rows belong to the product: deleting an (unused) product removes them.
CREATE TABLE IF NOT EXISTS stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    type ENUM('opening', 'sale', 'sale_cancelled', 'purchase_receipt', 'adjustment') NOT NULL,
    reason VARCHAR(255),
    balance_after INT NOT NULL,
    order_id INT NULL,
    purchase_order_id INT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movements_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_movements_order
        FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT fk_movements_po
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
    CONSTRAINT fk_movements_user
        FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT chk_movements_quantity CHECK (quantity <> 0),
    CONSTRAINT chk_movements_balance CHECK (balance_after >= 0),
    INDEX idx_movements_product (product_id, created_at),
    INDEX idx_movements_created (created_at)
);

-- Per-product reorder point and preferred supplier (added only once).
SET @has_reorder := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'reorder_point'
);
SET @sql := IF(
    @has_reorder = 0,
    'ALTER TABLE products
        ADD COLUMN reorder_point INT NOT NULL DEFAULT 5,
        ADD COLUMN supplier_id INT NULL,
        ADD CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
        ADD CONSTRAINT chk_products_reorder_point CHECK (reorder_point >= 0)',
    'SELECT ''products already has reorder_point'' AS info'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

-- Opening balances so the ledger matches existing stock (idempotent).
INSERT INTO stock_movements (product_id, quantity, type, reason, balance_after)
SELECT p.id, p.stock, 'opening', 'Opening balance', p.stock
FROM products p
WHERE p.stock > 0
  AND NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.product_id = p.id);
