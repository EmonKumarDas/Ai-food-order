// routes/admin.js — Admin routes
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const bcrypt = require('bcrypt');

// Page routes
router.get('/admin/dashboard', requireAuth, roleGuard('admin'), (req, res) => {
  res.render('admin/dashboard', { user: req.user });
});
router.get('/admin/users', requireAuth, roleGuard('admin'), (req, res) => {
  res.render('admin/users', { user: req.user });
});
router.get('/admin/shops', requireAuth, roleGuard('admin'), (req, res) => {
  res.render('admin/shops', { user: req.user });
});
router.get('/admin/orders', requireAuth, roleGuard('admin'), (req, res) => {
  res.render('admin/orders', { user: req.user });
});
router.get('/admin/alerts', requireAuth, roleGuard('admin'), (req, res) => {
  res.render('admin/alerts', { user: req.user });
});
router.get('/admin/reports', requireAuth, roleGuard('admin'), (req, res) => {
  res.render('admin/reports', { user: req.user });
});

// API: Dashboard stats
router.get('/api/admin/stats', requireAuth, roleGuard('admin'), (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const stats = {
      totalUsers: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
      totalShops: db.prepare('SELECT COUNT(*) as c FROM shops').get().c,
      totalOrders: db.prepare('SELECT COUNT(*) as c FROM orders').get().c,
      todayOrders: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE DATE(created_at) = ?`).get(today).c,
      totalRevenue: db.prepare(`SELECT COALESCE(SUM(total_amount),0) as r FROM orders WHERE status != 'cancelled'`).get().r,
      todayRevenue: db.prepare(`SELECT COALESCE(SUM(total_amount),0) as r FROM orders WHERE DATE(created_at) = ? AND status != 'cancelled'`).get(today).r,
      pendingOrders: db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'pending'`).get().c,
      unreadAlerts: db.prepare('SELECT COUNT(*) as c FROM ai_alerts WHERE is_read = 0').get().c,
      avgRating: db.prepare('SELECT COALESCE(AVG(star_rating),0) as r FROM reviews').get().r
    };
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// API: Users list
router.get('/api/admin/users', requireAuth, roleGuard('admin'), (req, res) => {
  try {
    const { role } = req.query;
    let q = 'SELECT id, name, email, role, is_active, created_at FROM users';
    let params = [];
    if (role) { q += ' WHERE role = ?'; params.push(role); }
    q += ' ORDER BY created_at DESC';
    res.json({ users: db.prepare(q).all(...params) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// API: Toggle user active status
router.patch('/api/admin/users/:id/toggle', requireAuth, roleGuard('admin'), (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Cannot deactivate admin' });
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(user.is_active ? 0 : 1, user.id);
    res.json({ success: true, is_active: !user.is_active });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// API: Delete user
router.delete('/api/admin/users/:id', requireAuth, roleGuard('admin'), (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Cannot delete admin' });
    
    // SQLite will cascade delete shops, orders, reviews, sessions, etc.
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    res.json({ success: true, message: 'User deleted permanently' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// API: Reset user password
router.patch('/api/admin/users/:id/reset-password', requireAuth, roleGuard('admin'), async (req, res) => {
  try {
    const hash = await bcrypt.hash('password123', 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
    res.json({ success: true, message: 'Password reset to password123' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// API: All shops
router.get('/api/admin/shops', requireAuth, roleGuard('admin'), (req, res) => {
  try {
    const shops = db.prepare(`SELECT s.*, u.name as owner_name, u.email as owner_email,
      (SELECT COUNT(*) FROM products WHERE shop_id = s.id) as product_count,
      (SELECT COUNT(*) FROM orders WHERE shop_id = s.id) as order_count
      FROM shops s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC`).all();
    res.json({ shops });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shops' });
  }
});

// API: Toggle shop active
router.patch('/api/admin/shops/:id/toggle', requireAuth, roleGuard('admin'), (req, res) => {
  try {
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    const newStatus = shop.is_active ? 0 : 1;
    db.prepare('UPDATE shops SET is_active = ? WHERE id = ?').run(newStatus, shop.id);
    db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newStatus, shop.user_id);
    res.json({ success: true, is_active: newStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update shop' });
  }
});

// API: Delete shop
router.delete('/api/admin/shops/:id', requireAuth, roleGuard('admin'), (req, res) => {
  try {
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(req.params.id);
    if (!shop) return res.status(404).json({ error: 'Shop not found' });
    
    // Deleting the shop cascades into products, orders, categories, reviews.
    db.prepare('DELETE FROM shops WHERE id = ?').run(shop.id);
    res.json({ success: true, message: 'Shop and all related data deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete shop' });
  }
});

// API: All orders (admin)
router.get('/api/admin/orders', requireAuth, roleGuard('admin'), (req, res) => {
  try {
    const { status, shop, date } = req.query;
    let where = [];
    let params = [];
    if (status) { where.push('o.status = ?'); params.push(status); }
    if (shop) { where.push('o.shop_id = ?'); params.push(shop); }
    if (date) { where.push('DATE(o.created_at) = ?'); params.push(date); }
    const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const orders = db.prepare(`SELECT o.*, s.shop_name, u.name as customer_name FROM orders o JOIN shops s ON o.shop_id = s.id JOIN users u ON o.user_id = u.id ${whereStr} ORDER BY o.created_at DESC LIMIT 100`).all(...params);
    for (let order of orders) {
      order.items = db.prepare(`SELECT oi.*, p.name as product_name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`).all(order.id);
    }
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// API: All alerts
router.get('/api/admin/alerts', requireAuth, roleGuard('admin'), (req, res) => {
  try {
    const alerts = db.prepare(`SELECT a.*, p.name as product_name, s.shop_name FROM ai_alerts a LEFT JOIN products p ON a.product_id = p.id LEFT JOIN shops s ON a.shop_id = s.id ORDER BY a.created_at DESC`).all();
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// API: Resolve/dismiss alert
router.patch('/api/admin/alerts/:id', requireAuth, roleGuard('admin'), (req, res) => {
  try {
    const { action } = req.body;
    if (action === 'resolve') {
      db.prepare('UPDATE ai_alerts SET is_resolved = 1, is_read = 1 WHERE id = ?').run(req.params.id);
    } else if (action === 'dismiss') {
      db.prepare('UPDATE ai_alerts SET is_read = 1 WHERE id = ?').run(req.params.id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

module.exports = router;
