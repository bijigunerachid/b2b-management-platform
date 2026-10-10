-- Machine-learning models and their published outputs.
--
-- The Python jobs in ml/ train a model, evaluate it on past data, and write
-- one row to ml_models (with its test results) plus the predictions. The API
-- only reads these tables. Only one version per model name is active; older
-- versions stay listed with their metrics for comparison.
USE b2b_management;

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
