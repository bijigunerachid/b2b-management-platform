
CREATE DATABASE IF NOT EXISTS b2b_management
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE b2b_management;

-- 1. Roles
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    token_version INT NOT NULL DEFAULT 0,
    -- Portal accounts (role Customer) belong to a customer company; staff keep NULL.
    customer_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_customer (customer_id),
    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- 3a. Price lists (referenced by customers)
CREATE TABLE IF NOT EXISTS price_lists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    discount_percent DECIMAL(5,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_price_lists_discount CHECK (discount_percent > 0 AND discount_percent <= 50)
);

-- 3. Customers
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(30),
    address VARCHAR(255),
    city VARCHAR(100),
    country VARCHAR(100) NOT NULL DEFAULT 'Morocco',
    price_list_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_customers_price_list
        FOREIGN KEY (price_list_id) REFERENCES price_lists(id)
);

-- users.customer_id can only reference customers once that table exists.
-- Added conditionally so this script stays safe to run more than once.
SET @has_fk := (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_customer'
);
SET @sql := IF(@has_fk = 0,
    'ALTER TABLE users ADD CONSTRAINT fk_users_customer FOREIGN KEY (customer_id) REFERENCES customers(id)',
    'SELECT 1');
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

-- 4. Categories
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

-- 4b. Suppliers (referenced by products)
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

-- 5. Products
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    reorder_point INT NOT NULL DEFAULT 5,
    supplier_id INT NULL,
    average_cost DECIMAL(10,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    CONSTRAINT chk_products_reorder_point CHECK (reorder_point >= 0),
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories(id),
    CONSTRAINT chk_products_price CHECK (price >= 0),
    CONSTRAINT chk_products_stock CHECK (stock >= 0),
    CONSTRAINT chk_products_average_cost CHECK (average_cost >= 0)
);

-- 5b. Pricing rules
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

-- 6. Orders
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    status ENUM(
        'Pending',
        'Processing',
        'Completed',
        'Cancelled'
    ) NOT NULL DEFAULT 'Pending',
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT chk_orders_total CHECK (total_amount >= 0)
);

-- 7. Order items
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    list_price DECIMAL(10,2) NULL,
    price_source ENUM('list', 'price_list', 'volume', 'contract', 'quote') NULL,
    unit_cost DECIMAL(10,2) NULL,
    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_order_items_price CHECK (unit_price >= 0)
);

-- 8. Payments (voided rather than deleted, to keep an audit trail)
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    method ENUM('Bank transfer', 'Cheque', 'Cash', 'Card') NOT NULL,
    reference VARCHAR(100),
    paid_at DATE NOT NULL,
    note VARCHAR(255),
    recorded_by INT NULL,
    voided_at TIMESTAMP NULL,
    voided_by INT NULL,
    void_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_order
        FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT fk_payments_recorded_by
        FOREIGN KEY (recorded_by) REFERENCES users(id),
    CONSTRAINT fk_payments_voided_by
        FOREIGN KEY (voided_by) REFERENCES users(id),
    CONSTRAINT chk_payments_amount CHECK (amount > 0),
    INDEX idx_payments_order (order_id, voided_at)
);

-- 9. Quotes (devis) and their lines
CREATE TABLE IF NOT EXISTS quotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    status ENUM('Draft', 'Sent', 'Accepted', 'Rejected', 'Converted') NOT NULL DEFAULT 'Draft',
    valid_until DATE NOT NULL,
    notes VARCHAR(1000),
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL,
    decided_at TIMESTAMP NULL,
    converted_at TIMESTAMP NULL,
    order_id INT NULL UNIQUE,
    CONSTRAINT fk_quotes_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_quotes_created_by
        FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_quotes_order
        FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT chk_quotes_total CHECK (total_amount >= 0),
    INDEX idx_quotes_status (status),
    INDEX idx_quotes_customer (customer_id)
);

CREATE TABLE IF NOT EXISTS quote_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quote_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    list_price DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_quote_items_quote
        FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
    CONSTRAINT fk_quote_items_product
        FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT chk_quote_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_quote_items_price CHECK (unit_price >= 0 AND list_price >= 0)
);

-- 10. Purchasing and the stock ledger (SUM(quantity) per product = products.stock)
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

-- Credit notes (returns). Never edited or deleted.
CREATE TABLE IF NOT EXISTS credit_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    reason ENUM('Damaged in transit', 'Defective', 'Wrong item', 'No longer needed', 'Other') NOT NULL,
    note VARCHAR(500),
    subtotal DECIMAL(12,2) NOT NULL,
    vat DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    refund_method ENUM('Bank transfer', 'Cheque', 'Cash', 'Card') NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_credit_notes_order
        FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT fk_credit_notes_created_by
        FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT chk_credit_notes_total CHECK (total > 0),
    CONSTRAINT chk_credit_notes_refund CHECK (refund_amount >= 0 AND refund_amount <= total),
    INDEX idx_credit_notes_order (order_id),
    INDEX idx_credit_notes_created (created_at)
);

CREATE TABLE IF NOT EXISTS credit_note_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    credit_note_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    restocked BOOLEAN NOT NULL,
    CONSTRAINT fk_credit_note_items_note
        FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id),
    CONSTRAINT fk_credit_note_items_product
        FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT chk_credit_note_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_credit_note_items_price CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    type ENUM('opening', 'sale', 'sale_cancelled', 'purchase_receipt', 'adjustment', 'customer_return') NOT NULL,
    reason VARCHAR(255),
    balance_after INT NOT NULL,
    order_id INT NULL,
    purchase_order_id INT NULL,
    credit_note_id INT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movements_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_movements_order
        FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT fk_movements_po
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
    CONSTRAINT fk_movements_credit_note
        FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id),
    CONSTRAINT fk_movements_user
        FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT chk_movements_quantity CHECK (quantity <> 0),
    CONSTRAINT chk_movements_balance CHECK (balance_after >= 0),
    INDEX idx_movements_product (product_id, created_at),
    INDEX idx_movements_created (created_at)
);

-- Initial roles
INSERT IGNORE INTO roles (name)
VALUES ('Admin'), ('Manager'), ('Employee'), ('Customer'), ('Accountant'), ('Warehouse');

-- Audit log (append-only)
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    user_name VARCHAR(201),
    user_role VARCHAR(50),
    action VARCHAR(60) NOT NULL,
    entity_type VARCHAR(40),
    entity_id VARCHAR(40),
    summary VARCHAR(255) NOT NULL,
    changes JSON NULL,
    details JSON NULL,
    method VARCHAR(10),
    path VARCHAR(255),
    status SMALLINT,
    ip VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_log_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_created (created_at),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_user (user_id, created_at),
    INDEX idx_audit_action (action)
);

-- Machine-learning models (written by the jobs in ml/, read by the API)
CREATE TABLE IF NOT EXISTS ml_models (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL,
    version VARCHAR(30) NOT NULL,
    trained_at DATETIME NOT NULL,
    metrics JSON NOT NULL,
    details JSON NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ml_models_version (name, version),
    INDEX idx_ml_models_active (name, is_active)
);

-- Units expected to sell in the `horizon_weeks` weeks after `origin_week`
-- (a Monday), with an 80% interval.
CREATE TABLE IF NOT EXISTS demand_forecasts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    product_id INT NOT NULL,
    origin_week DATE NOT NULL,
    horizon_weeks TINYINT NOT NULL,
    units DECIMAL(10, 2) NOT NULL,
    lower_units DECIMAL(10, 2) NOT NULL,
    upper_units DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_demand_forecasts_model
        FOREIGN KEY (model_id) REFERENCES ml_models(id) ON DELETE CASCADE,
    CONSTRAINT fk_demand_forecasts_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY uq_demand_forecasts (model_id, product_id)
);

-- Late-payment risk scores (written by the jobs in ml/)
CREATE TABLE IF NOT EXISTS payment_risk_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    order_id INT NOT NULL,
    probability DECIMAL(5, 4) NOT NULL,
    facts JSON NULL,
    CONSTRAINT fk_payment_risk_model
        FOREIGN KEY (model_id) REFERENCES ml_models(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_risk_order
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT chk_payment_risk_probability CHECK (probability BETWEEN 0 AND 1),
    UNIQUE KEY uq_payment_risk (model_id, order_id)
);

-- Verify tables and roles
SHOW TABLES;

SELECT id, name
FROM roles
ORDER BY id;