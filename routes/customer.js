// routes/customer.js — Home, products, cart
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { suggestProductsForUser } = require('../services/geminiService');

function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI/180);
  const dLon = (lon2 - lon1) * (Math.PI/180);
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) +
            Math.cos(lat1*(Math.PI/180))*Math.cos(lat2*(Math.PI/180)) *
            Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// GET /home — Customer dashboard page
router.get('/home', requireAuth, roleGuard('customer'), (req, res) => {
  res.render('customer/home', { user: req.user });
});

// GET /checkout — Checkout page
router.get('/checkout', requireAuth, roleGuard('customer'), (req, res) => {
  res.render('customer/checkout', { user: req.user });
});

// GET /orders — Order history page
router.get('/orders', requireAuth, roleGuard('customer'), (req, res) => {
  res.render('customer/orders', { user: req.user });
});

// GET /review/:orderId — Review page
router.get('/review/:orderId', requireAuth, roleGuard('customer'), (req, res) => {
  const order = db.prepare(`
    SELECT o.*, s.shop_name 
    FROM orders o 
    JOIN shops s ON o.shop_id = s.id 
    WHERE o.id = ? AND o.user_id = ? AND o.status = 'delivered'
  `).get(req.params.orderId, req.user.id);

  if (!order) {
    return res.redirect('/orders');
  }

  const items = db.prepare(`
    SELECT oi.*, p.name as product_name, p.image_url
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(order.id);

  res.render('customer/review', { user: req.user, order, items });
});

// --- API Routes ---

// GET /api/products — List all available products
router.get('/api/products', (req, res) => {
  try {
    const { category, shop, search, sort, page = 1, limit = 20, lat, lng } = req.query;
    const offset = (page - 1) * limit;
    let params = [];
    let where = ['p.is_available = 1', 's.is_active = 1'];

    if (category) {
      where.push('c.name = ?');
      params.push(category);
    }

    if (shop) {
      where.push('s.id = ?');
      params.push(shop);
    }

    if (search) {
      where.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    let orderBy = 'p.created_at DESC';
    if (sort === 'price_asc') orderBy = 'p.price ASC';
    if (sort === 'price_desc') orderBy = 'p.price DESC';
    if (sort === 'rating') orderBy = 'avg_rating DESC';
    if (sort === 'newest') orderBy = 'p.created_at DESC';

    const query = `
      SELECT p.*, s.shop_name, c.name as category_name,
        COALESCE((SELECT AVG(r.star_rating) FROM reviews r WHERE r.product_id = p.id), 0) as avg_rating,
        COALESCE((SELECT COUNT(r.id) FROM reviews r WHERE r.product_id = p.id), 0) as review_count
      FROM products p
      JOIN shops s ON p.shop_id = s.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderBy}
    `;

    let products = db.prepare(query).all(...params);

    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      products = products.map(p => {
        p.distance = getDistance(userLat, userLng, p.latitude, p.longitude);
        return p;
      }); // Removed distance filter so all products are visible
      
      products.sort((a, b) => a.distance - b.distance);
    }

    const total = products.length;
    
    // Apply pagination
    products = products.slice(offset, offset + parseInt(limit));

    res.json({ products, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Products fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/categories — List all categories
router.get('/api/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT DISTINCT c.name, c.id, c.shop_id
      FROM categories c
      JOIN shops s ON c.shop_id = s.id
      WHERE s.is_active = 1
      ORDER BY c.name
    `).all();
    
    // Get unique category names
    const uniqueNames = [...new Set(categories.map(c => c.name))];
    res.json({ categories: uniqueNames });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/shops — List all active shops
router.get('/api/shops', (req, res) => {
  try {
    const shops = db.prepare(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM products WHERE shop_id = s.id AND is_available = 1) as product_count,
        (SELECT COALESCE(AVG(r.star_rating), 0) FROM reviews r WHERE r.shop_id = s.id) as avg_rating
      FROM shops s 
      WHERE s.is_active = 1
      ORDER BY s.shop_name
    `).all();
    res.json({ shops });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shops' });
  }
});

// GET /api/orders/my — Customer's order history
router.get('/api/orders/my', requireAuth, roleGuard('customer'), (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT o.*, s.shop_name,
        (SELECT COUNT(*) FROM reviews r WHERE r.order_id = o.id AND r.user_id = o.user_id) as has_review
      FROM orders o
      JOIN shops s ON o.shop_id = s.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `).all(req.user.id);

    // Get items for each order
    for (let order of orders) {
      order.items = db.prepare(`
        SELECT oi.*, p.name as product_name, p.image_url
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `).all(order.id);
    }

    res.json({ orders });
  } catch (err) {
    console.error('Order history error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/recent — Last 5 orders for reorder
router.get('/api/orders/recent', requireAuth, roleGuard('customer'), (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT o.*, s.shop_name
      FROM orders o
      JOIN shops s ON o.shop_id = s.id
      WHERE o.user_id = ? AND o.status = 'delivered'
      ORDER BY o.created_at DESC
      LIMIT 5
    `).all(req.user.id);

    for (let order of orders) {
      order.items = db.prepare(`
        SELECT oi.*, p.name as product_name, p.image_url, p.price as current_price, p.is_available
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `).all(order.id);
    }

    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recent orders' });
  }
});

// GET /api/suggestions — AI-powered product suggestions
router.get('/api/suggestions', requireAuth, roleGuard('customer'), async (req, res) => {
  try {
    // First check if user has any delivered orders at all
    const hasOrders = db.prepare(`
      SELECT COUNT(*) as cnt FROM orders 
      WHERE user_id = ? AND status = 'delivered'
    `).get(req.user.id);

    const availableProducts = db.prepare(`
      SELECT p.id, p.name, p.price, p.image_url, s.shop_name,
        COALESCE((SELECT AVG(r.star_rating) FROM reviews r WHERE r.product_id = p.id), 0) as avg_rating
      FROM products p
      JOIN shops s ON p.shop_id = s.id
      WHERE p.is_available = 1 AND s.is_active = 1
    `).all();

    if (!hasOrders || hasOrders.cnt === 0) {
      const trending = [...availableProducts].sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0)).slice(0, 6);
      return res.json({ suggestions: trending, type: 'trending' });
    }

    const reviewHistory = db.prepare(`
      SELECT r.star_rating, r.review_text, p.name as product_name
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
      LIMIT 10
    `).all(req.user.id);

    // No reviews = no personalized suggestions. Return trending.
    if (!reviewHistory || reviewHistory.length === 0) {
      const trending = [...availableProducts].sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0)).slice(0, 6);
      return res.json({ suggestions: trending, type: 'trending' });
    }

    const suggestedNames = await suggestProductsForUser(reviewHistory, availableProducts);
    
    // Match suggested names to actual products
    const suggestions = availableProducts.filter(p => 
      suggestedNames.some(name => 
        p.name.toLowerCase().includes(name.toLowerCase()) || 
        name.toLowerCase().includes(p.name.toLowerCase())
      )
    ).slice(0, 6);

    // Fallback if AI matched nothing but user had reviews
    if (suggestions.length === 0) {
      const trending = [...availableProducts].sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0)).slice(0, 6);
      return res.json({ suggestions: trending, type: 'trending' });
    }

    res.json({ suggestions, type: 'personalized' });
  } catch (err) {
    console.error('Suggestions error:', err);
    res.json({ suggestions: [], type: 'error' });
  }
});

module.exports = router;
