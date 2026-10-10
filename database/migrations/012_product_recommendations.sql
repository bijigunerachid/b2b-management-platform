-- Product recommendations, written by `python -m b2b_ml recommend` (see ml/).
--
-- Up to 10 products per customer that they haven't bought yet but are likely
-- to need, best first, with the reason (a product they bought that these are
-- often bought with, or popularity in the categories they buy). Replaced on
-- every training run.
USE b2b_management;

CREATE TABLE IF NOT EXISTS product_recommendations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    model_id INT NOT NULL,
    customer_id INT NOT NULL,
    product_id INT NOT NULL,
    rank_position TINYINT NOT NULL,
    score DOUBLE NOT NULL,
    reason JSON NULL,
    CONSTRAINT fk_recommendations_model
        FOREIGN KEY (model_id) REFERENCES ml_models(id) ON DELETE CASCADE,
    CONSTRAINT fk_recommendations_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    CONSTRAINT fk_recommendations_product
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY uq_recommendations (model_id, customer_id, product_id),
    INDEX idx_recommendations_customer (customer_id, rank_position)
);
