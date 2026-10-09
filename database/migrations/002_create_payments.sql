-- Payments received against an order's invoice. Rows are never deleted:
-- a mistaken payment is voided (voided_at + reason) so the history stays
-- auditable. Only non-voided rows count toward the amount paid.
USE b2b_management;

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
