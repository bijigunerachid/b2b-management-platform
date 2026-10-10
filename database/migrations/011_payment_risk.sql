-- Late-payment risk scores, written by `python -m b2b_ml risk` (see ml/).
--
-- One row per open invoice that isn't late yet: the probability it will be
-- paid more than 7 days after its due date, and the facts behind the score
-- (the customer's payment history and the main reasons) so the app can
-- explain it. Replaced on every training run.
USE b2b_management;

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
