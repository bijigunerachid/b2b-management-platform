-- Finer staff roles and the audit log.
--
-- What each role may do is defined in backend/src/config/permissions.js.
-- The audit log is append-only: the app never updates or deletes rows. It
-- records every successful change made through the API, sign-ins (including
-- failed ones), and old/new values for edited records.
USE b2b_management;

INSERT IGNORE INTO roles (name) VALUES ('Accountant'), ('Warehouse');

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
