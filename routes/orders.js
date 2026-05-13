// routes/orders.js — Order CRUD
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

// POST /api/orders — Create a new order from cart data
router.post('/api/orders', requireAuth, roleGuard('customer'), (req, res) => {
  try {
    const { items, deliveryAddress, paymentMethod = 'cod' } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    if (!deliveryAddress || deliveryAddress.trim().length < 5) {
      return res.status(400).json({ error: 'Please provide a valid delivery address' });
    }

    // Validate all items belong to the same shop and are available
    const productIds = items.map(i => i.productId);
    const placeholders = productIds.map(() => '?').join(',');
    const products = db.prepare(`
      SELECT p.*, s.is_active as shop_active 
      FROM products p 
      JOIN shops s ON p.shop_id = s.id 
      WHERE p.id IN (${placeholders})
    `).all(...productIds);

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'Some products not found' });
    }

    const unavailable = products.filter(p => !p.is_available || !p.shop_active);
    if (unavailable.length > 0) {
      return res.status(400).json({ 
        error: 'Some products are unavailable', 
        unavailable: unavailable.map(p => p.name) 
      });
    }

    // Group items by shop
    const shopGroups = {};
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!shopGroups[product.shop_id]) shopGroups[product.shop_id] = [];
      shopGroups[product.shop_id].push({ ...item, product });
    }

    const orderIds = [];

    // Create separate orders per shop
    const createOrder = db.transaction(() => {
      for (const [shopId, shopItems] of Object.entries(shopGroups)) {
        const totalAmount = shopItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

        const orderResult = db.prepare(`
          INSERT INTO orders (user_id, shop_id, status, total_amount, delivery_address, payment_method) 
          VALUES (?, ?, 'pending', ?, ?, ?)
        `).run(req.user.id, parseInt(shopId), totalAmount, deliveryAddress.trim(), paymentMethod);

        const orderId = orderResult.lastInsertRowid;
        orderIds.push(orderId);

        for (const item of shopItems) {
          db.prepare(`
            INSERT INTO order_items (order_id, product_id, quantity, unit_price) 
            VALUES (?, ?, ?, ?)
          `).run(orderId, item.productId, item.quantity, item.product.price);
        }
      }
    });

    createOrder();

    res.json({ success: true, orderIds, message: 'Order placed successfully!' });
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// POST /api/payment/confirm — Confirm payment simulator
router.post('/api/payment/confirm', requireAuth, roleGuard('customer'), (req, res) => {
  try {
    const { orderIds, method } = req.body;
    if (!orderIds || !method) return res.status(400).json({ error: 'Invalid payment data' });
    
    const ids = orderIds.split(',').map(id => parseInt(id.trim()));
    const placeholders = ids.map(() => '?').join(',');
    
    db.prepare(`UPDATE orders SET status = 'confirmed' WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, req.user.id);
    
    res.json({ success: true, message: 'Payment confirmed' });
  } catch (err) {
    console.error('Payment confirm error:', err);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// GET /api/orders/:id — Single order detail
router.get('/api/orders/:id', requireAuth, (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, s.shop_name, u.name as customer_name
      FROM orders o
      JOIN shops s ON o.shop_id = s.id
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `).get(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Permission check
    if (req.user.role === 'customer' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const items = db.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(order.id);

    res.json({ order: { ...order, items } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// PATCH /api/orders/:id/status — Update order status
router.patch('/api/orders/:id/status', requireAuth, roleGuard('shop', 'admin'), (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['confirmed', 'preparing', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Shop owners can only update their own shop's orders
    if (req.user.role === 'shop') {
      const shop = db.prepare('SELECT id FROM shops WHERE user_id = ?').get(req.user.id);
      if (!shop || order.shop_id !== shop.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Validate status flow
    const flow = { 'pending': ['confirmed', 'cancelled'], 'confirmed': ['preparing', 'cancelled'], 'preparing': ['delivered'], 'delivered': [], 'cancelled': [] };
    if (!flow[order.status]?.includes(status)) {
      return res.status(400).json({ error: `Cannot change status from ${order.status} to ${status}` });
    }

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);

    res.json({ success: true, message: `Order status updated to ${status}` });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;
