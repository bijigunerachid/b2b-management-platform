-- Emails to clients: quotes, invoices and payment reminders.
--
-- Each customer has a language for emails and can opt out of reminders.
-- email_log keeps every email the app wrote, sent or not: with no mail server
-- configured (or in demo mode) emails are only saved here, so the outbox can
-- still be read in the app. dedupe_key stops the same reminder going out twice,
-- even with several API instances.
USE b2b_management;

SET @has_column := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'email_language'
);
SET @sql := IF(@has_column = 0,
    "ALTER TABLE customers
        ADD COLUMN email_language ENUM('en', 'fr', 'ar') NOT NULL DEFAULT 'fr',
        ADD COLUMN payment_reminders TINYINT(1) NOT NULL DEFAULT 1",
    'SELECT 1');
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

CREATE TABLE IF NOT EXISTS email_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('quote', 'invoice', 'reminder') NOT NULL,
    customer_id INT NULL,
    order_id INT NULL,
    quote_id INT NULL,
    recipient VARCHAR(255) NOT NULL,
    language ENUM('en', 'fr', 'ar') NOT NULL,
    subject VARCHAR(255) NOT NULL,
    html MEDIUMTEXT NOT NULL,
    text_body MEDIUMTEXT NOT NULL,
    -- sent: handed to the mail server; failed: the server refused it;
    -- outbox: saved only (no mail server set up, or demo mode).
    status ENUM('sent', 'failed', 'outbox') NOT NULL,
    error VARCHAR(500) NULL,
    message_id VARCHAR(255) NULL,
    sent_by INT NULL,
    dedupe_key VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_email_log_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_email_log_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    CONSTRAINT fk_email_log_quote FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE SET NULL,
    CONSTRAINT fk_email_log_user FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_email_log_dedupe (dedupe_key),
    INDEX idx_email_log_created (created_at),
    INDEX idx_email_log_order (order_id),
    INDEX idx_email_log_quote (quote_id)
);
