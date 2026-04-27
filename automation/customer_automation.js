const Database = require('better-sqlite3');
const path = require('path');
const readline = require('readline');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, '../db/food_ordering.db');
const db = new Database(dbPath);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function runCustomerAutomation() {
  console.log('🚀 Welcome to the Headless Customer Automation Builder!');
  
  const numCustInput = await askQuestion('\n👉 How many customer accounts do you want to create? (Default: 5): ');
  const NUM_CUSTOMERS = numCustInput.trim() ? parseInt(numCustInput) : 5;

  const numOrdersInput = await askQuestion('👉 How many orders per customer? (Default: 2): ');
  const NUM_ORDERS = numOrdersInput.trim() ? parseInt(numOrdersInput) : 2;

  const numReviewsInput = await askQuestion('👉 How many reviews per customer? (Default: 2): ');
  const NUM_REVIEWS = numReviewsInput.trim() ? parseInt(numReviewsInput) : 2;
  
  rl.close();

  console.log(`\n🧑‍🤝‍🧑 Generating ${NUM_CUSTOMERS} customers headlessly...`);
  const passwordHash = await bcrypt.hash('password123', 10);
  
  // Get available products to create orders
  const availableProducts = db.prepare('SELECT id, shop_id, price FROM products WHERE is_available = 1').all();

  if (availableProducts.length === 0) {
      console.log('⚠️ No products available in the database. Please run the visual shop automation first.');
      return;
  }

  for (let c = 1; c <= NUM_CUSTOMERS; c++) {
    const custName = `Auto Customer ${c}`;
    const custEmail = `customer_${Date.now()}_${c}@test.com`;
    
    const insertCust = db.prepare('INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)');
    const custResult = insertCust.run(custName, custEmail, passwordHash, 'customer', 1);
    const customerId = custResult.lastInsertRowid;
    
    // Create Orders
    const customerOrders = [];
    for (let o = 1; o <= NUM_ORDERS; o++) {
      if (availableProducts.length === 0) break;
      
      // Pick a random product
      const product = getRandomItem(availableProducts);
      const qty = Math.floor(Math.random() * 3) + 1; // 1 to 3 items
      const totalAmount = product.price * qty;
      
      const insertOrder = db.prepare(`
        INSERT INTO orders (user_id, shop_id, status, total_amount, delivery_address, payment_method) 
        VALUES (?, ?, 'delivered', ?, '123 Auto Gen Street, NY', 'cod')
      `);
      const orderResult = insertOrder.run(customerId, product.shop_id, totalAmount);
      const orderId = orderResult.lastInsertRowid;
      customerOrders.push({ orderId, shopId: product.shop_id, productId: product.id });
      
      db.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price) 
        VALUES (?, ?, ?, ?)
      `).run(orderId, product.id, qty, product.price);
    }
    
    // Create Reviews
    const positiveReviews = ["Amazing food!", "Loved it, highly recommended.", "Tastes really good.", "Will order again!"];
    const negativeReviews = ["Not what I expected.", "Too cold when it arrived.", "Tastes a bit weird.", "Would not recommend.", "Portion was too small.", "Did not taste fresh."];
    
    for (let r = 1; r <= Math.min(NUM_REVIEWS, customerOrders.length); r++) {
      const orderObj = customerOrders[r - 1]; // Pick an order
      // Random rating 1-5
      const rating = Math.floor(Math.random() * 5) + 1;
      let reviewText = "";
      let sentiment = "neutral";
      
      if (rating >= 4) {
        reviewText = getRandomItem(positiveReviews);
        sentiment = "positive";
      } else if (rating <= 2) {
        reviewText = getRandomItem(negativeReviews);
        sentiment = "negative";
      } else {
        reviewText = "It was okay, nothing special.";
        sentiment = "neutral";
      }
      
      db.prepare(`
        INSERT INTO reviews (user_id, order_id, product_id, shop_id, star_rating, review_text, sentiment_label, sentiment_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(customerId, orderObj.orderId, orderObj.productId, orderObj.shopId, rating, reviewText, sentiment, (rating/5).toFixed(1));
    }
  }
  
  console.log(`✅ Automatically generated ${NUM_CUSTOMERS} customers with ${NUM_ORDERS} orders and ${NUM_REVIEWS} reviews each!`);
}

runCustomerAutomation();
