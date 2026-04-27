// routes/reviews.js — Review submission + sentiment
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { analyzeReviewSentiment } = require('../services/sentimentService');
const { checkNegativeSpike } = require('../services/alertService');

// POST /api/reviews/analyze
router.post('/api/reviews/analyze', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 3) return res.json({ label: 'neutral', score: 0.5 });
    const sentiment = await analyzeReviewSentiment(text);
    res.json(sentiment);
  } catch (err) {
    res.json({ label: 'neutral', score: 0.5 });
  }
});

// POST /api/reviews
router.post('/api/reviews', requireAuth, roleGuard('customer'), async (req, res) => {
  try {
    const { orderId, productId, starRating, reviewText } = req.body;
    if (!orderId || !starRating) return res.status(400).json({ error: 'Order ID and star rating required' });
    if (starRating < 1 || starRating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

    const order = db.prepare(`SELECT * FROM orders WHERE id = ? AND user_id = ? AND status = 'delivered'`).get(orderId, req.user.id);
    if (!order) return res.status(400).json({ error: 'Invalid or undelivered order' });

    let sentiment = { label: 'neutral', score: 0.5 };
    if (reviewText && reviewText.trim().length > 3) sentiment = await analyzeReviewSentiment(reviewText);

    const result = db.prepare(`INSERT INTO reviews (user_id, order_id, product_id, shop_id, star_rating, review_text, sentiment_label, sentiment_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(req.user.id, orderId, productId || null, order.shop_id, starRating, reviewText || null, sentiment.label, sentiment.score);

    if (productId && sentiment.label === 'negative') checkNegativeSpike(productId, order.shop_id);

    res.json({ success: true, reviewId: result.lastInsertRowid, sentiment });
  } catch (err) {
    console.error('Review error:', err);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// GET /api/reviews/product/:id
router.get('/api/reviews/product/:id', (req, res) => {
  try {
    const reviews = db.prepare(`SELECT r.*, u.name as user_name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.product_id = ? ORDER BY r.created_at DESC`).all(req.params.id);
    const stats = db.prepare(`SELECT COUNT(*) as total, AVG(star_rating) as avg_rating FROM reviews WHERE product_id = ?`).get(req.params.id);
    res.json({ reviews, stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

module.exports = router;
