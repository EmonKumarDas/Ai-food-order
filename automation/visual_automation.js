const puppeteer = require('puppeteer');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const https = require('https');
const readline = require('readline');

const BASE_URL = 'http://localhost:3000';
const dbPath = path.resolve(__dirname, '../db/food_ordering.db');
const db = new Database(dbPath);

const categories = ['Burgers', 'Pizza', 'Desserts', 'Drinks', 'Healthy'];
const adjectives = ['Spicy', 'Cheesy', 'Double', 'Classic', 'Deluxe'];
const nouns = ['Burger', 'Pizza', 'Salad', 'Roll', 'Bowl'];

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

// Helper to download image for Puppeteer file upload
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        const redirectUrl = new URL(res.headers.location, url).href;
        https.get(redirectUrl, (res2) => {
          res2.pipe(fs.createWriteStream(filepath)).on('finish', resolve);
        }).on('error', reject);
      } else {
        res.pipe(fs.createWriteStream(filepath)).on('finish', resolve);
      }
    }).on('error', reject);
  });
}

async function runVisualAutomation() {
  console.log('🚀 Welcome to the VISUAL Shop Automation Builder!');
  
  const numInput = await askQuestion('👉 How many food items do you want to add? (Default: 50): ');
  const NUM_POSTS = numInput.trim() ? parseInt(numInput) : 50;

  console.log('\n🌍 PROXIMITY ALERT: Your customer homepage filters out foods that are more than 50km away from your physical location.');
  console.log('To ensure you can actually see these automated foods, please enter your approximate Latitude and Longitude.');
  console.log('If you do not know them, you can find them on Google Maps by right-clicking your location.');
  
  const latInput = await askQuestion('\n👉 Enter your Latitude (Default New York: 40.7128): ');
  const lngInput = await askQuestion('👉 Enter your Longitude (Default New York: -74.0060): ');
  
  const latitude = latInput.trim() ? parseFloat(latInput) : 40.7128;
  const longitude = lngInput.trim() ? parseFloat(lngInput) : -74.0060;
  
  rl.close();

  const shopEmail = `visual_shop_${Date.now()}@test.com`;
  const shopPassword = 'password123';

  // Ensure tmp directory exists for images
  const tmpDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

  // Launch Chrome Visually
  const browser = await puppeteer.launch({
    headless: false, // THIS IS WHAT MAKES IT VISUAL!
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  // Grant geolocation permissions so the app accepts our injected coordinates
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(BASE_URL, ['geolocation']);
  
  const page = await browser.newPage();
  
  // Inject the requested GPS coordinates into Chromium
  await page.setGeolocation({ latitude, longitude });

  console.log(`\n📦 Registering Shop Owner visually...`);
  await page.goto(`${BASE_URL}/register`);
  await page.select('#role', 'shop');
  await page.type('#name', 'Visual Auto Shop');
  await page.type('#shopName', 'The Visual Kitchen');
  await page.type('#email', shopEmail);
  await page.type('#password', shopPassword);
  
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForSelector('#successModal', { visible: true })
  ]);
  
  console.log('✅ Registered! (Pending State)');

  // Force Activate via Database (Bypass Admin)
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(shopEmail);
  db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(user.id);
  db.prepare('UPDATE shops SET is_active = 1 WHERE user_id = ?').run(user.id);
  console.log('🔓 Database activated the shop.');

  // Login visually
  console.log('🔑 Logging in visually...');
  await page.goto(`${BASE_URL}/login`);
  await page.select('#role', 'shop'); // Select 'Shop Owner' role
  await page.type('#email', shopEmail);
  await page.type('#password', shopPassword);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation()
  ]);
  
  console.log('✅ Logged in to Dashboard!');

  // Set Location Visually
  console.log('📍 Setting shop location to New York...');
  // We can just click the save location button since it will use the default or auto-detected map center
  await page.waitForSelector('button[onclick="saveLocation()"]');
  await page.click('button[onclick="saveLocation()"]');
  await new Promise(r => setTimeout(r, 2000)); // wait for toast

  // Go to Menu
  await page.goto(`${BASE_URL}/shop/menu`);

  console.log(`\n🍔 Posting ${NUM_POSTS} items visually...`);
  for (let i = 1; i <= NUM_POSTS; i++) {
    const name = `${getRandomItem(adjectives)} ${getRandomItem(nouns)}`;
    const category = getRandomItem(categories);
    const price = (Math.random() * 15 + 5).toFixed(2);
    
    console.log(`⏳ [${i}/${NUM_POSTS}] Visually typing: ${name}`);

    // Download image
    const imgPath = path.join(tmpDir, `food_${i}.jpg`);
    const searchTag = encodeURIComponent(name.split(' ')[1].toLowerCase());
    await downloadImage(`https://loremflickr.com/400/300/${searchTag},food/all?random=${i}`, imgPath);

    // Click Add Product
    await page.evaluate(() => document.querySelector('button[onclick="showAddModal()"]').click());
    await page.waitForSelector('#product-modal', { visible: true });
    
    // Fill form
    await page.type('#p-name', name);
    await page.type('#p-price', price.toString());
    
    // Category
    await page.select('#p-cat', '__custom__');
    await page.waitForSelector('#customCatGroup', { visible: true });
    await page.type('#p-cat-custom', category);

    await page.type('#p-desc', `Delicious ${name}. Automatically generated visually!`);
    
    // Upload file
    const fileInput = await page.$('#p-image');
    await fileInput.uploadFile(imgPath);

    // Submit
    await page.evaluate(() => document.querySelector('#productForm button[type="submit"]').click());
    
    // Wait for modal to close and table to refresh
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n🎉 Visual Automation Complete!');
  console.log(`\n================================`);
  console.log(`Shop Email: ${shopEmail}`);
  console.log(`Password:   ${shopPassword}`);
  console.log(`================================\n`);

  // Cleanup tmp images
  fs.readdirSync(tmpDir).forEach(f => fs.unlinkSync(path.join(tmpDir, f)));
  
  // Leave browser open for developer to verify
  console.log('Leaving browser open for you to verify. Close it manually when done.');
}

runVisualAutomation();
