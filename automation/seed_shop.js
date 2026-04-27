const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Configure database to forcefully activate the shop
const dbPath = path.resolve(__dirname, '../db/food_ordering.db');
const db = new Database(dbPath);

const BASE_URL = 'http://localhost:3000';
const NUM_POSTS = 50;

const categories = ['Burgers', 'Pizza', 'Desserts', 'Drinks', 'Healthy', 'Sushi', 'Pasta', 'Tacos'];
const adjectives = ['Spicy', 'Cheesy', 'Double', 'Classic', 'Deluxe', 'Vegan', 'Crispy', 'Smoky', 'Gourmet', 'Ultimate'];
const nouns = ['Burger', 'Pizza', 'Salad', 'Roll', 'Bowl', 'Fries', 'Shake', 'Cake', 'Taco', 'Sandwich'];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateFoodItem() {
  const category = getRandomItem(categories);
  const name = `${getRandomItem(adjectives)} ${getRandomItem(nouns)}`;
  const price = (Math.random() * 15 + 5).toFixed(2); // $5.00 to $20.00
  const description = `Delicious ${name.toLowerCase()} made with fresh ingredients. Perfect for your cravings!`;
  return { name, category, price, description };
}

async function runAutomation() {
  console.log('🚀 Starting Shop Automation...');
  const shopEmail = `auto_shop_${Date.now()}@test.com`;
  const shopPassword = 'password123';

  // 1. Register Shop Owner
  console.log(`\n📦 Registering Shop Owner: ${shopEmail}`);
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Auto Shop Builder',
      email: shopEmail,
      password: shopPassword,
      role: 'shop',
      shopName: 'The Automated Kitchen'
    })
  });
  const regData = await regRes.json();
  if (!regData.success) {
    console.error('Failed to register:', regData.error);
    return;
  }
  console.log('✅ Shop registered successfully (Pending State).');

  // 2. Force Activate & Set Location via Database
  console.log('🔓 Forcing shop activation & setting NYC location via Database...');
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(shopEmail);
  db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(user.id);
  // Setting a default location (e.g., New York) so products are visible nearby
  db.prepare('UPDATE shops SET is_active = 1, latitude = 40.7128, longitude = -74.0060 WHERE user_id = ?').run(user.id);
  console.log('✅ Shop activated and location set.');

  // 3. Login to get Token
  console.log('\n🔑 Logging in to get session token...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: shopEmail,
      password: shopPassword,
      role: 'shop'
    })
  });
  
  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.error('Failed to login:', loginData.error);
    return;
  }

  // Extract Cookie
  const rawCookies = loginRes.headers.get('set-cookie');
  const tokenCookie = rawCookies ? rawCookies.split(';')[0] : '';
  console.log('✅ Logged in. Token retrieved.');

  // 4. Post 50 Products
  console.log(`\n🍔 Starting to post ${NUM_POSTS} random food items...`);
  
  for (let i = 1; i <= NUM_POSTS; i++) {
    const food = generateFoodItem();
    console.log(`⏳ [${i}/${NUM_POSTS}] Posting: ${food.name} (${food.category}) - $${food.price}`);
    
    try {
      // Fetch random food image
      const imgRes = await fetch(`https://loremflickr.com/400/300/food?random=${i}`);
      const arrayBuffer = await imgRes.arrayBuffer();
      const imageBlob = new Blob([arrayBuffer], { type: 'image/jpeg' });

      // Build Form Data
      const formData = new FormData();
      formData.append('name', food.name);
      formData.append('description', food.description);
      formData.append('price', food.price);
      formData.append('categoryName', food.category);
      formData.append('isAvailable', 'true');
      
      // Give the product the same NYC coordinates so they appear for customers nearby
      formData.append('latitude', '40.7128');
      formData.append('longitude', '-74.0060');
      
      formData.append('image', imageBlob, `food_${i}.jpg`);

      // Post Product
      const postRes = await fetch(`${BASE_URL}/api/shop/products`, {
        method: 'POST',
        headers: {
          'Cookie': tokenCookie
        },
        body: formData
      });

      const postData = await postRes.json();
      if (postData.success) {
        console.log(`   ✅ Success!`);
      } else {
        console.log(`   ❌ Failed: ${postData.error}`);
      }
    } catch (err) {
      console.log(`   ❌ Network Error: ${err.message}`);
    }
    
    // Small delay to prevent overwhelming the server/image provider
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n🎉 Automation Complete! 50 items have been added to the automated shop.');
}

runAutomation();
