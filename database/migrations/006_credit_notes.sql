-- Returns and credit notes. A credit note lists the returned lines of a
-- completed order and reduces what the customer owes. When the customer has
-- already paid more than the reduced total, the excess is refunded and the
-- refund is recorded on the credit note. Credit notes are never edited or
-- deleted.
USE b2b_management;

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

-- Returned goods that go back on the shelf are a new kind of stock movement.
ALTER TABLE stock_movements
    MODIFY COLUMN type ENUM('opening', 'sale', 'sale_cancelled', 'purchase_receipt', 'adjustment', 'customer_return') NOT NULL;

SET @has_credit_note := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stock_movements' AND COLUMN_NAME = 'credit_note_id'
);
SET @sql := IF(
    @has_credit_note = 0,
    'ALTER TABLE stock_movements
        ADD COLUMN credit_note_id INT NULL AFTER purchase_order_id,
        ADD CONSTRAINT fk_movements_credit_note FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id)',
    'SELECT ''stock_movements already has credit_note_id'' AS info'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;
