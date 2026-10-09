
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id) REFERENCES roles(id)
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Categories
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories(id),
    CONSTRAINT chk_products_price CHECK (price >= 0),
    CONSTRAINT chk_products_stock CHECK (stock >= 0)
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

-- Initial roles
INSERT IGNORE INTO roles (name)
VALUES ('Admin'), ('Manager'), ('Employee');

-- Verify tables and roles
SHOW TABLES;

SELECT id, name
FROM roles
ORDER BY id;