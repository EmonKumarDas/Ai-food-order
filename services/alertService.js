// services/alertService.js — Alert generation logic
const db = require('../db/database');

// Check if a product has received 3+ negative reviews in the last 2 hours
function checkNegativeSpike(productId, shopId) {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  const count = db.prepare(`
    SELECT COUNT(*) as cnt FROM reviews 
    WHERE product_id = ? AND shop_id = ? 
    AND sentiment_label = 'negative' 
    AND created_at >= ?
  `).get(productId, shopId, twoHoursAgo);

  if (count.cnt >= 3) {
    // Check if we already have an unresolved alert for this product in the last 2 hours
    const existing = db.prepare(`
      SELECT id FROM ai_alerts 
      WHERE product_id = ? AND shop_id = ? 
      AND is_resolved = 0 
      AND created_at >= ?
    `).get(productId, shopId, twoHoursAgo);

    if (!existing) {
      const product = db.prepare('SELECT name FROM products WHERE id = ?').get(productId);
      const alertMessage = `⚠️ Alert: "${product?.name || 'Unknown product'}" has received ${count.cnt} negative reviews in the last 2 hours. Immediate attention required.`;
      
      db.prepare(`
        INSERT INTO ai_alerts (shop_id, product_id, alert_message, alert_type) 
        VALUES (?, ?, ?, 'negative_spike')
      `).run(shopId, productId, alertMessage);

      console.log(`🚨 Alert created for product ${productId} in shop ${shopId}`);
      return true;
    }
  }
  return false;
}

// Scan all products for negative spikes (used by cron job)
function scanAllProductsForAlerts() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const products = db.prepare(`
    SELECT DISTINCT product_id, shop_id FROM reviews 
    WHERE sentiment_label = 'negative' 
    AND created_at >= ?
    AND product_id IS NOT NULL
  `).all(twoHoursAgo);

  let alertsCreated = 0;
  for (const p of products) {
    if (checkNegativeSpike(p.product_id, p.shop_id)) {
      alertsCreated++;
    }
  }
  return alertsCreated;
}

module.exports = { checkNegativeSpike, scanAllProductsForAlerts };
