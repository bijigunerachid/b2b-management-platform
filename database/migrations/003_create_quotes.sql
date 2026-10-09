-- Quotes (devis): priced offers that can be sent, accepted or rejected,
-- and converted into an order. "Expired" is derived from valid_until, never
-- stored. Items keep the negotiated unit_price and the catalog list_price
-- at quote time so discounts stay accurate if catalog prices change later.
USE b2b_management;

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
