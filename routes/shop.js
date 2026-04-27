// routes/shop.js — Shop owner routes
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const multer = require('multer');
const path = require('path');

// Multer config for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/images/uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  cb(null, allowed.includes(file.mimetype));
}});

// Helper: get shop for current user
function getShop(userId) {
  return db.prepare('SELECT * FROM shops WHERE user_id = ?').get(userId);
}

// Page routes
router.get('/shop/dashboard', requireAuth, roleGuard('shop'), (req, res) => {
  const shop = getShop(req.user.id);
  if (!shop) return res.render('shop/setup', { user: req.user });
  res.render('shop/dashboard', { user: req.user, shop });
});

router.get('/shop/menu', requireAuth, roleGuard('shop'), (req, res) => {
  const shop = getShop(req.user.id);
  if (!shop) return res.redirect('/shop/dashboard');
  res.render('shop/menu', { user: req.user, shop });
});

router.get('/shop/orders', requireAuth, roleGuard('shop'), (req, res) => {
  const shop = getShop(req.user.id);
  if (!shop) return res.redirect('/shop/dashboard');
  res.render('shop/orders', { user: req.user, shop });
});

router.get('/shop/reviews', requireAuth, roleGuard('shop'), (req, res) => {
  const shop = getShop(req.user.id);
  if (!shop) return res.redirect('/shop/dashboard');
  res.render('shop/reviews', { user: req.user, shop });
});

router.get('/shop/reports', requireAuth, roleGuard('shop'), (req, res) => {
  const shop = getShop(req.user.id);
  if (!shop) return res.redirect('/shop/dashboard');
  res.render('shop/reports', { user: req.user, shop });
});

// API: Setup shop
router.post('/api/shop/setup', requireAuth, roleGuard('shop'), (req, res) => {
  try {
    const { shopName, description, latitude, longitude } = req.body;
    if (!shopName) return res.status(400).json({ error: 'Shop name required' });
    const existing = getShop(req.user.id);
    if (existing) return res.status(409).json({ error: 'Shop already exists' });
    db.prepare('INSERT INTO shops (user_id, shop_name, description, latitude, longitude) VALUES (?, ?, ?, ?, ?)').run(req.user.id, shopName, description || '', latitude || null, longitude || null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create shop' });
  }
});

// API: Update shop location
router.put('/api/shop/location', requireAuth, roleGuard('shop'), (req, res) => {
  try {
    const shop = getShop(req.user.id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    const { latitude, longitude } = req.body;
    db.prepare('UPDATE shops SET latitude = ?, longitude = ? WHERE id = ?').run(latitude, longitude, shop.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// API: Get shop products
router.get('/api/shop/products', requireAuth, roleGuard('shop'), (req, res) => {
  try {
    const shop = getShop(req.user.id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    const products = db.prepare(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.shop_id = ? ORDER BY p.created_at DESC`).all(shop.id);
    const categories = db.prepare('SELECT * FROM categories WHERE shop_id = ?').all(shop.id);
    res.json({ products, categories });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// API: Add product
router.post('/api/shop/products', requireAuth, roleGuard('shop'), upload.single('image'), (req, res) => {
  try {
    const shop = getShop(req.user.id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    const { name, description, price, categoryId, categoryName, isAvailable, latitude, longitude } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price required' });
    
    let catId = categoryId;
    if (categoryName && !categoryId) {
      const cat = db.prepare('INSERT INTO categories (shop_id, name) VALUES (?, ?)').run(shop.id, categoryName);
      catId = cat.lastInsertRowid;
    }
    
    const imageUrl = req.file ? `/images/uploads/${req.file.filename}` : '/images/products/default.jpg';
    db.prepare('INSERT INTO products (shop_id, category_id, name, description, price, image_url, is_available, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(shop.id, catId || null, name, description || '', parseFloat(price), imageUrl, isAvailable !== 'false' ? 1 : 0, latitude || null, longitude || null);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// API: Edit product
router.put('/api/shop/products/:id', requireAuth, roleGuard('shop'), upload.single('image'), (req, res) => {
  try {
    const shop = getShop(req.user.id);
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND shop_id = ?').get(req.params.id, shop.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const { name, description, price, categoryId, isAvailable, latitude, longitude } = req.body;
    const imageUrl = req.file ? `/images/uploads/${req.file.filename}` : product.image_url;
    db.prepare('UPDATE products SET name = ?, description = ?, price = ?, category_id = ?, image_url = ?, is_available = ?, latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude) WHERE id = ?').run(name || product.name, description ?? product.description, price ? parseFloat(price) : product.price, categoryId || product.category_id, imageUrl, isAvailable !== undefined ? (isAvailable === 'true' || isAvailable === '1' ? 1 : 0) : product.is_available, latitude || null, longitude || null, product.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// API: Delete product
router.delete('/api/shop/products/:id', requireAuth, roleGuard('shop'), (req, res) => {
  try {
    const shop = getShop(req.user.id);
    db.prepare('DELETE FROM products WHERE id = ? AND shop_id = ?').run(req.params.id, shop.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// API: Shop orders
router.get('/api/shop/orders', requireAuth, roleGuard('shop'), (req, res) => {
  try {
    const shop = getShop(req.user.id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    const { status, date } = req.query;
    let where = ['o.shop_id = ?'];
    let params = [shop.id];
    if (status) { where.push('o.status = ?'); params.push(status); }
    if (date) { where.push('DATE(o.created_at) = ?'); params.push(date); }
    const orders = db.prepare(`SELECT o.*, u.name as customer_name FROM orders o JOIN users u ON o.user_id = u.id WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC`).all(...params);
    for (let order of orders) {
      order.items = db.prepare(`SELECT oi.*, p.name as product_name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`).all(order.id);
    }
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// API: Dashboard stats
router.get('/api/shop/stats', requireAuth, roleGuard('shop'), (req, res) => {
  try {
    const shop = getShop(req.user.id);
    if (!shop) return res.json({});
    const today = new Date().toISOString().split('T')[0];
    const stats = {
      totalProducts: db.prepare('SELECT COUNT(*) as c FROM products WHERE shop_id = ?').get(shop.id).c,
      todayOrders: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE shop_id = ? AND DATE(created_at) = ?`).get(shop.id, today).c,
      pendingOrders: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE shop_id = ? AND status IN ('pending','confirmed','preparing')`).get(shop.id).c,
      todayRevenue: db.prepare(`SELECT COALESCE(SUM(total_amount),0) as r FROM orders WHERE shop_id = ? AND DATE(created_at) = ? AND status != 'cancelled'`).get(shop.id, today).r,
      avgRating: db.prepare(`SELECT COALESCE(AVG(star_rating),0) as r FROM reviews WHERE shop_id = ?`).get(shop.id).r,
      totalReviews: db.prepare('SELECT COUNT(*) as c FROM reviews WHERE shop_id = ?').get(shop.id).c,
      unreadAlerts: db.prepare('SELECT COUNT(*) as c FROM ai_alerts WHERE shop_id = ? AND is_read = 0').get(shop.id).c
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// API: Shop alerts
router.get('/api/shop/alerts', requireAuth, roleGuard('shop'), (req, res) => {
  try {
    const shop = getShop(req.user.id);
    if (!shop) return res.json({ alerts: [] });
    const alerts = db.prepare(`SELECT a.*, p.name as product_name FROM ai_alerts a LEFT JOIN products p ON a.product_id = p.id WHERE a.shop_id = ? ORDER BY a.created_at DESC LIMIT 50`).all(shop.id);
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// API: Mark alert as read
router.patch('/api/shop/alerts/:id/read', requireAuth, roleGuard('shop'), (req, res) => {
  try {
    const shop = getShop(req.user.id);
    db.prepare('UPDATE ai_alerts SET is_read = 1 WHERE id = ? AND shop_id = ?').run(req.params.id, shop.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

module.exports = router;
