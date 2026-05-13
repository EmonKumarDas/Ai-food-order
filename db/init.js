// db/init.js — Creates all SQLite tables
const db = require('./database');

function initializeDatabase() {
  console.log('🔧 Initializing database tables...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer','shop','admin')),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      shop_name TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      category_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      image_url TEXT,
      is_available INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      shop_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','preparing','delivered','cancelled')),
      total_amount REAL NOT NULL,
      delivery_address TEXT,
      payment_method TEXT DEFAULT 'cod',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      shop_id INTEGER NOT NULL,
      star_rating INTEGER NOT NULL CHECK(star_rating BETWEEN 1 AND 5),
      review_text TEXT,
      sentiment_label TEXT CHECK(sentiment_label IN ('positive','neutral','negative')),
      sentiment_score REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      product_id INTEGER,
      alert_message TEXT NOT NULL,
      alert_type TEXT DEFAULT 'negative_spike',
      is_read INTEGER DEFAULT 0,
      is_resolved INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  try {
    db.exec(`ALTER TABLE products ADD COLUMN latitude REAL`);
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE products ADD COLUMN longitude REAL`);
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE shops ADD COLUMN latitude REAL`);
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE shops ADD COLUMN longitude REAL`);
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN reset_token TEXT`);
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE users ADD COLUMN reset_expires DATETIME`);
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE shops ADD COLUMN cover_image_url TEXT`);
  } catch(e) {}

  // Create useful indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_reviews_shop ON reviews(shop_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON reviews(sentiment_label);
    CREATE INDEX IF NOT EXISTS idx_alerts_shop ON ai_alerts(shop_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_read ON ai_alerts(is_read);
  `);

  console.log('✅ All tables and indexes created successfully.');
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
  process.exit(0);
}

module.exports = { initializeDatabase };
