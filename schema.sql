-- Products table
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  image_url TEXT,
  category TEXT DEFAULT 'default',
  stock INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_uuid TEXT UNIQUE NOT NULL,
  cart_id TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  payment_status TEXT DEFAULT 'pending',
  stripe_session_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Insert sample products
INSERT INTO products (name, description, price, image_url, category, stock) VALUES
('Rượu Ó Ninh Bình (Chai 500ml)', 'Rượu ó truyền thống Ninh Bình, ủ men lá, 500ml', 120000, 'https://images.unsplash.com/photo-1620908010941-e6c7f4f4f4f4?w=400', 'ruou', 100),
('Rượu Ó Ninh Bình (Chai 1L)', 'Rượu ó truyền thống Ninh Bình, ủ men lá, 1 lít', 220000, 'https://images.unsplash.com/photo-1620908010941-e6c7f4f4f4f4?w=400', 'ruou', 80),
('Rượu Nếp Ninh Bình (500ml)', 'Rượu nếp nguyên chất, ủ 3 tháng, 500ml', 150000, 'https://images.unsplash.com/photo-1620908010941-e6c7f4f4f4f4?w=400', 'ruou', 60),
('Rượu Táo Mèo Ninh Bình (500ml)', 'Rượu táo mèo lên men tự nhiên, 500ml', 180000, 'https://images.unsplash.com/photo-1620908010941-e6c7f4f4f4f4?w=400', 'ruou', 50),
('Quà Set 2 Chai Rượu Ó', 'Set quà gồm 2 chai rượu ó 500ml, hộp gỗ sang trọng', 280000, 'https://images.unsplash.com/photo-1620908010941-e6c7f4f4f4f4?w=400', 'gift', 30);
