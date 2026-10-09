
USE b2b_management;

-- Sample customers
INSERT INTO customers
    (company_name, contact_name, email, phone, city, country)
SELECT
    'Atlas Distribution', 'Youssef Amrani',
    'youssef@example.com', '0612345678', 'Agadir', 'Morocco'
WHERE NOT EXISTS (
    SELECT 1 FROM customers
    WHERE email = 'youssef@example.com'
);

INSERT INTO customers
    (company_name, contact_name, email, phone, city, country)
SELECT
    'Souss Trading', 'Salma Idrissi',
    'salma@example.com', '0623456789', 'Tiznit', 'Morocco'
WHERE NOT EXISTS (
    SELECT 1 FROM customers
    WHERE email = 'salma@example.com'
);

INSERT INTO customers
    (company_name, contact_name, email, phone, city, country)
SELECT
    'Maghreb Supplies', 'Amine El Fassi',
    'amine@example.com', '0634567890', 'Agadir', 'Morocco'
WHERE NOT EXISTS (
    SELECT 1 FROM customers
    WHERE email = 'amine@example.com'
);

-- Sample categories
INSERT IGNORE INTO categories (name, description)
VALUES
    ('Electronics', 'Electronic devices and accessories'),
    ('Office Supplies', 'Office and stationery products'),
    ('Furniture', 'Office furniture and equipment');

-- Sample products: insert only when the product does not exist
INSERT INTO products
    (category_id, name, description, price, stock, is_active)
SELECT
    c.id, 'Wireless Mouse', 'Wireless USB mouse',
    120.00, 25, 1
FROM categories c
WHERE c.name = 'Electronics'
AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Wireless Mouse'
);

INSERT INTO products
    (category_id, name, description, price, stock, is_active)
SELECT
    c.id, 'USB Keyboard', 'Standard USB keyboard',
    150.00, 15, 1
FROM categories c
WHERE c.name = 'Electronics'
AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'USB Keyboard'
);

INSERT INTO products
    (category_id, name, description, price, stock, is_active)
SELECT
    c.id, 'A4 Paper Pack', '500 sheets of A4 paper',
    55.00, 40, 1
FROM categories c
WHERE c.name = 'Office Supplies'
AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'A4 Paper Pack'
);

INSERT INTO products
    (category_id, name, description, price, stock, is_active)
SELECT
    c.id, 'Office Chair', 'Adjustable office chair',
    850.00, 4, 1
FROM categories c
WHERE c.name = 'Furniture'
AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Office Chair'
);

-- Verify the sample data
SELECT id, company_name, email FROM customers;
SELECT id, name, description FROM categories;
SELECT id, name, price, stock, is_active FROM products;
SELECT id, name FROM roles;