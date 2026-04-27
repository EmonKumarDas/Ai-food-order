// services/sentimentService.js — Sentiment analysis logic
const { analyzeSentiment } = require('./geminiService');

async function analyzeReviewSentiment(reviewText) {
  if (!reviewText || reviewText.trim().length < 3) {
    return { label: 'neutral', score: 0.5 };
  }
  return await analyzeSentiment(reviewText);
}

module.exports = { analyzeReviewSentiment };
