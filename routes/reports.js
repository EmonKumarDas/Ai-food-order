// routes/reports.js — AI report endpoints
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const db = require('../db/database');
const { getDailyReviewData, getWeeklyReportData, getMonthlyReportData } = require('../services/reportService');
const { generateDailySummary, generateWeeklyInsight, generateLoyaltyPrediction, generateGrowthSuggestion, translateText } = require('../services/geminiService');

// Helper: get shop id for shop owners
function getShopId(user) {
  if (user.role === 'admin') return null; // admin sees all
  const shop = db.prepare('SELECT id FROM shops WHERE user_id = ?').get(user.id);
  return shop ? shop.id : null;
}

// GET /api/reports/daily
router.get('/api/reports/daily', requireAuth, roleGuard('shop', 'admin'), async (req, res) => {
  try {
    const shopId = getShopId(req.user);
    const data = getDailyReviewData(shopId);
    let aiSummary = '';
    if (data.reviews.length > 0) {
      try { aiSummary = await generateDailySummary(data.reviews); } catch (e) { aiSummary = 'AI summary unavailable.'; }
    } else {
      aiSummary = 'No reviews received today yet.';
    }
    res.json({ ...data, aiSummary });
  } catch (err) {
    console.error('Daily report error:', err);
    res.status(500).json({ error: 'Failed to generate daily report' });
  }
});

// GET /api/reports/weekly
router.get('/api/reports/weekly', requireAuth, roleGuard('shop', 'admin'), async (req, res) => {
  try {
    const shopId = getShopId(req.user);
    const data = getWeeklyReportData(shopId);
    let aiInsight = '';
    try { aiInsight = await generateWeeklyInsight(data); } catch (e) { aiInsight = 'AI insight unavailable.'; }
    res.json({ ...data, aiInsight });
  } catch (err) {
    console.error('Weekly report error:', err);
    res.status(500).json({ error: 'Failed to generate weekly report' });
  }
});

// GET /api/reports/loyalty
router.get('/api/reports/loyalty', requireAuth, roleGuard('shop', 'admin'), async (req, res) => {
  try {
    const shopId = getShopId(req.user);
    const data = getMonthlyReportData(shopId);
    let aiPrediction = '';
    try { aiPrediction = await generateLoyaltyPrediction(data); } catch (e) { aiPrediction = 'AI prediction unavailable.'; }
    res.json({ ...data, aiPrediction });
  } catch (err) {
    console.error('Loyalty report error:', err);
    res.status(500).json({ error: 'Failed to generate loyalty report' });
  }
});

// GET /api/reports/growth
router.get('/api/reports/growth', requireAuth, roleGuard('shop', 'admin'), async (req, res) => {
  try {
    const shopId = getShopId(req.user);
    const data = getMonthlyReportData(shopId);
    let aiSuggestion = '';
    try { aiSuggestion = await generateGrowthSuggestion(data); } catch (e) { aiSuggestion = 'AI suggestion unavailable.'; }
    res.json({ ...data, aiSuggestion });
  } catch (err) {
    console.error('Growth report error:', err);
    res.status(500).json({ error: 'Failed to generate growth report' });
  }
});

// POST /api/reports/translate
router.post('/api/reports/translate', requireAuth, roleGuard('shop', 'admin'), async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Text and targetLang are required.' });
    }
    const translatedText = await translateText(text, targetLang);
    res.json({ translatedText });
  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({ error: 'Failed to translate text' });
  }
});

module.exports = router;
