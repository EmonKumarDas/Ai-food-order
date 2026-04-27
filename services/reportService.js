// services/reportService.js — Report data aggregation
const db = require('../db/database');

// --- Daily Report Data ---
function getDailyReviewData(shopId = null) {
  const today = new Date().toISOString().split('T')[0];
  const params = [];
  let shopFilter = '';
  
  if (shopId) {
    shopFilter = 'AND r.shop_id = ?';
    params.push(shopId);
  }

  const reviews = db.prepare(`
    SELECT r.*, p.name as product_name, u.name as user_name
    FROM reviews r
    LEFT JOIN products p ON r.product_id = p.id
    LEFT JOIN users u ON r.user_id = u.id
    WHERE DATE(r.created_at) = ?
    ${shopFilter}
    ORDER BY r.created_at DESC
  `).all(today, ...params);

  const sentimentCounts = db.prepare(`
    SELECT 
      COALESCE(sentiment_label, 'neutral') as label,
      COUNT(*) as count
    FROM reviews r
    WHERE DATE(r.created_at) = ?
    ${shopFilter}
    GROUP BY sentiment_label
  `).all(today, ...params);

  const alerts = db.prepare(`
    SELECT a.*, p.name as product_name
    FROM ai_alerts a
    LEFT JOIN products p ON a.product_id = p.id
    WHERE DATE(a.created_at) = ?
    ${shopId ? 'AND a.shop_id = ?' : ''}
    ORDER BY a.created_at DESC
  `).all(today, ...(shopId ? [shopId] : []));

  return { reviews, sentimentCounts, alerts, date: today };
}

// --- Weekly Report Data ---
function getWeeklyReportData(shopId = null) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const params = [weekAgo];
  let shopFilter = '';

  if (shopId) {
    shopFilter = 'AND r.shop_id = ?';
    params.push(shopId);
  }

  // Top & bottom performers by average star rating
  const topProducts = db.prepare(`
    SELECT p.name, p.id, AVG(r.star_rating) as avg_rating, COUNT(r.id) as review_count
    FROM reviews r
    JOIN products p ON r.product_id = p.id
    WHERE r.created_at >= ? ${shopFilter}
    GROUP BY r.product_id
    ORDER BY avg_rating DESC
    LIMIT 5
  `).all(...params);

  const worstProducts = db.prepare(`
    SELECT p.name, p.id, AVG(r.star_rating) as avg_rating, COUNT(r.id) as review_count
    FROM reviews r
    JOIN products p ON r.product_id = p.id
    WHERE r.created_at >= ? ${shopFilter}
    GROUP BY r.product_id
    ORDER BY avg_rating ASC
    LIMIT 5
  `).all(...params);

  // Review volume by day
  const reviewsByDay = db.prepare(`
    SELECT DATE(r.created_at) as day, COUNT(*) as count,
      SUM(CASE WHEN r.sentiment_label = 'positive' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN r.sentiment_label = 'neutral' THEN 1 ELSE 0 END) as neutral,
      SUM(CASE WHEN r.sentiment_label = 'negative' THEN 1 ELSE 0 END) as negative
    FROM reviews r
    WHERE r.created_at >= ? ${shopFilter}
    GROUP BY DATE(r.created_at)
    ORDER BY day
  `).all(...params);

  // Totals
  const totals = db.prepare(`
    SELECT 
      COUNT(*) as totalReviews,
      AVG(r.star_rating) as avgRating,
      SUM(CASE WHEN r.sentiment_label = 'positive' THEN 1 ELSE 0 END) as positiveCount,
      SUM(CASE WHEN r.sentiment_label = 'neutral' THEN 1 ELSE 0 END) as neutralCount,
      SUM(CASE WHEN r.sentiment_label = 'negative' THEN 1 ELSE 0 END) as negativeCount
    FROM reviews r
    WHERE r.created_at >= ? ${shopFilter}
  `).get(...params);

  const orderCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM orders
    WHERE created_at >= ? ${shopId ? 'AND shop_id = ?' : ''}
  `).get(weekAgo, ...(shopId ? [shopId] : []));

  // Peak time analysis — all sentiments by hour
  const peakTimeAnalysis = db.prepare(`
    SELECT 
      strftime('%H', r.created_at) as hour, 
      COUNT(*) as total,
      SUM(CASE WHEN r.sentiment_label = 'positive' THEN 1 ELSE 0 END) as positive,
      SUM(CASE WHEN r.sentiment_label = 'neutral' THEN 1 ELSE 0 END) as neutral,
      SUM(CASE WHEN r.sentiment_label = 'negative' THEN 1 ELSE 0 END) as negative,
      ROUND(AVG(r.star_rating), 1) as avg_rating
    FROM reviews r
    WHERE r.created_at >= ? ${shopFilter}
    GROUP BY hour
    ORDER BY total DESC
  `).all(...params);

  return {
    topProducts,
    worstProducts,
    reviewsByDay,
    totalOrders: orderCount.cnt,
    avgRating: totals.avgRating ? totals.avgRating.toFixed(1) : 'N/A',
    positiveCount: totals.positiveCount || 0,
    neutralCount: totals.neutralCount || 0,
    negativeCount: totals.negativeCount || 0,
    peakTimeAnalysis
  };
}

// --- Monthly Report Data ---
function getMonthlyReportData(shopId = null) {
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const fourMonthsAgo = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();

  // Customer loyalty
  const loyaltyData = db.prepare(`
    SELECT 
      u.name as customer_name,
      u.id as customer_id,
      COUNT(DISTINCT o.id) as order_count,
      AVG(r.sentiment_score) as avg_sentiment,
      AVG(r.star_rating) as avg_rating
    FROM users u
    JOIN orders o ON u.id = o.user_id
    LEFT JOIN reviews r ON u.id = r.user_id AND r.created_at >= ?
    WHERE o.created_at >= ? AND u.role = 'customer'
    ${shopId ? 'AND o.shop_id = ?' : ''}
    GROUP BY u.id
    ORDER BY order_count DESC
    LIMIT 20
  `).all(monthAgo, monthAgo, ...(shopId ? [shopId] : []));

  // Revenue vs sentiment by month (last 4 months)
  const revenueSentiment = db.prepare(`
    SELECT 
      strftime('%Y-%m', o.created_at) as month,
      SUM(o.total_amount) as revenue,
      (SELECT AVG(sentiment_score) FROM reviews WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', o.created_at) ${shopId ? 'AND shop_id = ' + shopId : ''}) as avg_sentiment
    FROM orders o
    WHERE o.created_at >= ?
    ${shopId ? 'AND o.shop_id = ?' : ''}
    GROUP BY month
    ORDER BY month
  `).all(fourMonthsAgo, ...(shopId ? [shopId] : []));

  // Most reviewed items
  const mostReviewed = db.prepare(`
    SELECT p.name, COUNT(r.id) as review_count, AVG(r.star_rating) as avg_rating
    FROM reviews r
    JOIN products p ON r.product_id = p.id
    WHERE r.created_at >= ?
    ${shopId ? 'AND r.shop_id = ?' : ''}
    GROUP BY r.product_id
    ORDER BY review_count DESC
    LIMIT 10
  `).all(monthAgo, ...(shopId ? [shopId] : []));

  // Revenue total
  const revenueTotal = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total
    FROM orders WHERE created_at >= ?
    ${shopId ? 'AND shop_id = ?' : ''}
  `).get(monthAgo, ...(shopId ? [shopId] : []));

  // Avg sentiment
  const avgSentiment = db.prepare(`
    SELECT COALESCE(AVG(sentiment_score), 0.5) as avg
    FROM reviews WHERE created_at >= ?
    ${shopId ? 'AND shop_id = ?' : ''}
  `).get(monthAgo, ...(shopId ? [shopId] : []));

  return {
    loyaltyData: loyaltyData.map(l => ({
      ...l,
      loyalty: l.order_count >= 5 && (l.avg_sentiment || 0.5) > 0.6 ? 'High' :
               l.order_count <= 1 || (l.avg_sentiment || 0.5) < 0.4 ? 'At Risk' : 'Medium'
    })),
    revenueSentiment,
    mostReviewed,
    totalRevenue: revenueTotal.total.toFixed(2),
    avgSentiment: avgSentiment.avg.toFixed(2),
    loyaltyStats: {
      high: loyaltyData.filter(l => l.order_count >= 5 && (l.avg_sentiment || 0.5) > 0.6).length,
      medium: loyaltyData.filter(l => !(l.order_count >= 5 && (l.avg_sentiment || 0.5) > 0.6) && !(l.order_count <= 1 || (l.avg_sentiment || 0.5) < 0.4)).length,
      atRisk: loyaltyData.filter(l => l.order_count <= 1 || (l.avg_sentiment || 0.5) < 0.4).length
    },
    commonComplaints: [] // Would need NLP to extract
  };
}

module.exports = { getDailyReviewData, getWeeklyReportData, getMonthlyReportData };
