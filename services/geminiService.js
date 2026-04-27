// services/geminiService.js — All Google Gemini API calls
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

let genAI = null;
let model = null;

function getModel() {
  if (!model) {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.warn('⚠️  GEMINI_API_KEY not set. AI features will use fallback responses.');
      return null;
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
  }
  return model;
}

// AI Provider Wrapper with Gemini Primary and OpenRouter Fallback
async function generateAIContent(prompt, maxRetries = 2) {
  const m = getModel();
  
  // Try Gemini Primary
  if (m) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await m.generateContent(prompt);
        return result.response.text().trim();
      } catch (err) {
        console.warn(`Gemini API error (attempt ${attempt + 1}): ${err.message}`);
        if (attempt === maxRetries - 1) break; // Move to OpenRouter
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  // Try OpenRouter Fallback
  console.warn('🔄 Switching to OpenRouter free models...');
  try {
    const openRouterKey = process.env.OPENROUTER_API_KEY || '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';
    
    // Native fetch is available in Node 18+
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Food Ordering'
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    if (!response.ok) throw new Error(`OpenRouter API error: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (err) {
    console.error('❌ OpenRouter also failed:', err.message);
    throw new Error('All AI providers failed');
  }
}

// 1. Sentiment Analysis
async function analyzeSentiment(text) {
  const prompt = `Analyze the sentiment of this food review. Return ONLY valid JSON with no markdown formatting, no code blocks, just the raw JSON object: { "label": "positive" or "neutral" or "negative", "score": a number between 0.0 and 1.0 where 1.0 is most positive }\n\nReview: "${text}"`;

  try {
    const responseText = await generateAIContent(prompt);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        label: parsed.label || 'neutral',
        score: typeof parsed.score === 'number' ? parsed.score : 0.5
      };
    }
    return fallbackSentiment(text);
  } catch (err) {
    return fallbackSentiment(text);
  }
}

// 2. Daily Summary
async function generateDailySummary(reviews) {
  const reviewTexts = reviews.map((r, i) => `${i + 1}. [${r.star_rating}★] "${r.review_text}"`).join('\n');
  const prompt = `You are a food business analyst. Summarize the key customer feedback themes from these food reviews today and highlight any critical issues. Write 2-3 concise paragraphs.\n\nToday's Reviews:\n${reviewTexts}\n\nProvide actionable insights for the restaurant owner.`;

  try {
    return await generateAIContent(prompt);
  } catch (err) {
    return generateFallbackDailySummary(reviews);
  }
}

// 3. Weekly Insight
async function generateWeeklyInsight(data) {
  const prompt = `You are a food business analyst. Given this weekly performance data for a food shop, identify trends and give actionable suggestions for the owner. Use bullet points.\n\nData:\n- Top products: ${JSON.stringify(data.topProducts)}\n- Worst products: ${JSON.stringify(data.worstProducts)}\n- Total orders: ${data.totalOrders}\n- Average rating: ${data.avgRating}\n- Sentiment breakdown: Positive: ${data.positiveCount}, Neutral: ${data.neutralCount}, Negative: ${data.negativeCount}\n- Peak time analysis (reviews by hour with mood): ${JSON.stringify(data.peakTimeAnalysis)}\n\nProvide specific, actionable recommendations.`;

  try {
    return await generateAIContent(prompt);
  } catch (err) {
    return generateFallbackWeeklyInsight(data);
  }
}

// 4. Loyalty Prediction
async function generateLoyaltyPrediction(data) {
  const prompt = `Based on this food business's customer data, predict customer loyalty and order likelihood for next month. Analyze the following stats to determine which customers will likely return, and provide specific retention strategies.\n\nData:\n- Loyalty Stats (High/Medium/At Risk): ${JSON.stringify(data.loyaltyStats)}\n- Top Customers: ${JSON.stringify(data.loyaltyData.slice(0, 5))}\n\nProvide structured predictions and specific retention actions.`;

  try {
    return await generateAIContent(prompt);
  } catch (err) {
    return generateFallbackLoyaltyPrediction(data);
  }
}

// 5. Growth Suggestion
async function generateGrowthSuggestion(data) {
  const prompt = `Based on this monthly customer review data for a food business, provide specific business growth suggestions. Focus heavily on menu pricing, quality improvements, and marketing based on customer feedback (e.g. if pizzas get great reviews but burgers get complaints about price, suggest reducing burger price or improving quality).\n\nMonthly Data:\n- Most reviewed items: ${JSON.stringify(data.mostReviewed)}\n- Average sentiment score: ${data.avgSentiment}\n- Total revenue: $${data.totalRevenue}\n\nProvide structured recommendations with clear action items.`;

  try {
    return await generateAIContent(prompt);
  } catch (err) {
    return generateFallbackGrowthSuggestion(data);
  }
}

// 5. Product Suggestions for User
async function suggestProductsForUser(reviewHistory, availableProducts) {
  if (!reviewHistory || reviewHistory.length === 0) return [];

  const history = reviewHistory.map(r => `- Rated "${r.product_name}" ${r.star_rating}★: "${r.review_text || 'No comment'}"`).join('\n');
  const products = availableProducts.map(p => p.name).join(', ');
  const prompt = `Based on this customer's review history, suggest 4-6 products they might enjoy from the available menu. Return ONLY a JSON array of product names, no markdown.\n\nCustomer's past reviews:\n${history}\n\nAvailable products: ${products}`;

  try {
    const responseText = await generateAIContent(prompt);
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (err) {
    return fallbackSuggestions(reviewHistory, availableProducts);
  }
}

// 6. Translate Text
async function translateText(text, targetLang) {
  const langName = targetLang === 'bn' ? 'Bengali' : 'English';
  const prompt = `Translate the following text to ${langName}. Preserve all Markdown formatting, line breaks, emojis, and bullet points exactly. Return ONLY the translated text, nothing else.\n\nText to translate:\n${text}`;
  
  try {
    return await generateAIContent(prompt);
  } catch (err) {
    console.error('Translation error:', err);
    return `[Translation Failed] ${text}`;
  }
}

// --- Fallback functions ---
function fallbackSentiment(text) {
  const lower = text.toLowerCase();
  const positiveWords = ['amazing', 'great', 'excellent', 'delicious', 'love', 'best', 'perfect', 'fresh', 'wonderful', 'fantastic', 'good', 'tasty', 'enjoyed', 'recommend'];
  const negativeWords = ['terrible', 'awful', 'bad', 'worst', 'disgusting', 'cold', 'stale', 'overcooked', 'undercooked', 'disappointing', 'horrible', 'bland', 'gross', 'rude'];

  let posCount = positiveWords.filter(w => lower.includes(w)).length;
  let negCount = negativeWords.filter(w => lower.includes(w)).length;

  if (posCount > negCount) return { label: 'positive', score: Math.min(0.5 + posCount * 0.15, 0.95) };
  if (negCount > posCount) return { label: 'negative', score: Math.max(0.5 - negCount * 0.15, 0.05) };
  return { label: 'neutral', score: 0.5 };
}

function generateFallbackDailySummary(reviews) {
  const pos = reviews.filter(r => r.sentiment_label === 'positive').length;
  const neg = reviews.filter(r => r.sentiment_label === 'negative').length;
  const total = reviews.length;

  return `Today we received ${total} review(s). ${pos} were positive and ${neg} were negative. ${total === 0 ? 'No reviews to analyze yet.' : 'Overall customer satisfaction appears ' + (pos > neg ? 'strong' : neg > pos ? 'concerning — action may be needed' : 'mixed') + '.'}`;
}

function generateFallbackWeeklyInsight(data) {
  return `This week saw ${data.totalOrders || 0} orders with an average rating of ${data.avgRating || 'N/A'}. ${data.positiveCount > data.negativeCount ? 'Customer sentiment is trending positive.' : 'There are some areas that need attention based on negative feedback.'}`;
}

function generateFallbackLoyaltyPrediction(data) {
  return `You have ${data.loyaltyStats.high} highly loyal customers, ${data.loyaltyStats.medium} medium, and ${data.loyaltyStats.atRisk} at risk. Focus on rewarding your high loyalty customers to ensure they return next month, and reach out to the at-risk group with a targeted promotion.`;
}

function generateFallbackGrowthSuggestion(data) {
  return `Monthly revenue: $${data.totalRevenue || 0}. Average sentiment: ${data.avgSentiment || 'N/A'}. Analyze the pricing of your most reviewed items to ensure they match customer expectations. Address recurring complaints immediately to improve retention.`;
}

function fallbackSuggestions(reviewHistory, availableProducts) {
  // CRITICAL: Never suggest products to users without review history
  if (!reviewHistory || reviewHistory.length === 0) return [];
  
  // Try to suggest products similar to what the user rated highly
  const likedProducts = reviewHistory
    .filter(r => r.star_rating >= 4)
    .map(r => r.product_name.toLowerCase());
  
  if (likedProducts.length === 0) {
    // User has reviews but none rated highly — return top-rated available products
    const sorted = [...availableProducts].sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
    return sorted.slice(0, 4).map(p => p.name);
  }
  
  // Return products the user hasn't reviewed yet, prioritizing by rating
  const reviewedNames = reviewHistory.map(r => r.product_name.toLowerCase());
  const unreviewed = availableProducts.filter(p => !reviewedNames.includes(p.name.toLowerCase()));
  const sorted = unreviewed.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
  return sorted.slice(0, 4).map(p => p.name);
}

module.exports = {
  analyzeSentiment,
  generateDailySummary,
  generateWeeklyInsight,
  generateLoyaltyPrediction,
  generateGrowthSuggestion,
  suggestProductsForUser,
  translateText
};
