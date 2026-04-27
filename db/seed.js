// db/seed.js — Demo data for development
const db = require('./database');
const { initializeDatabase } = require('./init');
const bcrypt = require('bcrypt');

async function seed() {
  console.log('🌱 Seeding database with demo data...');
  
  // Initialize tables first
  initializeDatabase();

  // Clear existing data
  db.exec(`
    DELETE FROM ai_alerts;
    DELETE FROM reviews;
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM products;
    DELETE FROM categories;
    DELETE FROM shops;
    DELETE FROM sessions;
    DELETE FROM users;
  `);

  const hash = await bcrypt.hash('password123', 10);

  // --- USERS ---
  const insertUser = db.prepare(`INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`);
  
  const admin = insertUser.run('Admin User', 'admin@foodie.com', hash, 'admin');
  const shopOwner1 = insertUser.run('Marco Rossi', 'marco@pizzapalace.com', hash, 'shop');
  const shopOwner2 = insertUser.run('Sakura Tanaka', 'sakura@sushispot.com', hash, 'shop');
  const shopOwner3 = insertUser.run('John Smith', 'john@burgerhouse.com', hash, 'shop');
  const customer1 = insertUser.run('Alice Johnson', 'alice@mail.com', hash, 'customer');
  const customer2 = insertUser.run('Bob Williams', 'bob@mail.com', hash, 'customer');
  const customer3 = insertUser.run('Charlie Brown', 'charlie@mail.com', hash, 'customer');

  // --- SHOPS ---
  const insertShop = db.prepare(`INSERT INTO shops (user_id, shop_name, description, image_url) VALUES (?, ?, ?, ?)`);
  
  const shop1 = insertShop.run(shopOwner1.lastInsertRowid, 'Pizza Palace', 'Authentic Italian pizzas made with love and fresh ingredients.', '/images/shops/pizza-palace.jpg');
  const shop2 = insertShop.run(shopOwner2.lastInsertRowid, 'Sushi Spot', 'Fresh Japanese sushi and bento boxes crafted by master chefs.', '/images/shops/sushi-spot.jpg');
  const shop3 = insertShop.run(shopOwner3.lastInsertRowid, 'Burger House', 'Premium handcrafted burgers with gourmet toppings.', '/images/shops/burger-house.jpg');

  // --- CATEGORIES ---
  const insertCat = db.prepare(`INSERT INTO categories (shop_id, name) VALUES (?, ?)`);
  
  // Pizza Palace categories
  const catPizza = insertCat.run(shop1.lastInsertRowid, 'Pizzas');
  const catPasta = insertCat.run(shop1.lastInsertRowid, 'Pasta');
  const catDrinksPP = insertCat.run(shop1.lastInsertRowid, 'Drinks');

  // Sushi Spot categories
  const catSushi = insertCat.run(shop2.lastInsertRowid, 'Sushi Rolls');
  const catBento = insertCat.run(shop2.lastInsertRowid, 'Bento Boxes');
  const catDrinksSS = insertCat.run(shop2.lastInsertRowid, 'Beverages');

  // Burger House categories
  const catBurger = insertCat.run(shop3.lastInsertRowid, 'Burgers');
  const catSides = insertCat.run(shop3.lastInsertRowid, 'Sides');
  const catDrinksBH = insertCat.run(shop3.lastInsertRowid, 'Drinks');

  // --- PRODUCTS ---
  const insertProd = db.prepare(`INSERT INTO products (shop_id, category_id, name, description, price, image_url) VALUES (?, ?, ?, ?, ?, ?)`);

  // Pizza Palace products
  insertProd.run(shop1.lastInsertRowid, catPizza.lastInsertRowid, 'Margherita Pizza', 'Classic mozzarella, fresh basil, and tomato sauce', 12.99, '/images/products/margherita.jpg');
  insertProd.run(shop1.lastInsertRowid, catPizza.lastInsertRowid, 'Pepperoni Pizza', 'Loaded with premium pepperoni and melted cheese', 14.99, '/images/products/pepperoni.jpg');
  insertProd.run(shop1.lastInsertRowid, catPizza.lastInsertRowid, 'BBQ Chicken Pizza', 'Smoky BBQ sauce, grilled chicken, and red onions', 15.99, '/images/products/bbq-chicken.jpg');
  insertProd.run(shop1.lastInsertRowid, catPasta.lastInsertRowid, 'Spaghetti Carbonara', 'Creamy egg-based sauce with crispy pancetta', 13.99, '/images/products/carbonara.jpg');
  insertProd.run(shop1.lastInsertRowid, catPasta.lastInsertRowid, 'Penne Arrabbiata', 'Spicy tomato sauce with garlic and red chili', 11.99, '/images/products/arrabbiata.jpg');
  insertProd.run(shop1.lastInsertRowid, catDrinksPP.lastInsertRowid, 'Italian Lemonade', 'Refreshing homemade lemonade with a hint of mint', 4.99, '/images/products/lemonade.jpg');

  // Sushi Spot products
  insertProd.run(shop2.lastInsertRowid, catSushi.lastInsertRowid, 'California Roll', 'Crab, avocado, and cucumber wrapped in seasoned rice', 9.99, '/images/products/california-roll.jpg');
  insertProd.run(shop2.lastInsertRowid, catSushi.lastInsertRowid, 'Dragon Roll', 'Eel and cucumber inside, avocado on top', 13.99, '/images/products/dragon-roll.jpg');
  insertProd.run(shop2.lastInsertRowid, catSushi.lastInsertRowid, 'Spicy Tuna Roll', 'Fresh tuna with spicy mayo and scallions', 11.99, '/images/products/spicy-tuna.jpg');
  insertProd.run(shop2.lastInsertRowid, catBento.lastInsertRowid, 'Teriyaki Chicken Bento', 'Grilled chicken with rice, salad, and miso soup', 14.99, '/images/products/teriyaki-bento.jpg');
  insertProd.run(shop2.lastInsertRowid, catBento.lastInsertRowid, 'Salmon Bento', 'Grilled salmon with steamed vegetables and rice', 16.99, '/images/products/salmon-bento.jpg');
  insertProd.run(shop2.lastInsertRowid, catDrinksSS.lastInsertRowid, 'Matcha Latte', 'Premium Japanese matcha with steamed milk', 5.99, '/images/products/matcha.jpg');

  // Burger House products
  insertProd.run(shop3.lastInsertRowid, catBurger.lastInsertRowid, 'Classic Smash Burger', 'Double smashed patties with American cheese', 10.99, '/images/products/smash-burger.jpg');
  insertProd.run(shop3.lastInsertRowid, catBurger.lastInsertRowid, 'Bacon Avocado Burger', 'Crispy bacon, fresh avocado, and chipotle mayo', 13.99, '/images/products/bacon-avocado.jpg');
  insertProd.run(shop3.lastInsertRowid, catBurger.lastInsertRowid, 'Mushroom Swiss Burger', 'Sautéed mushrooms with melted Swiss cheese', 12.99, '/images/products/mushroom-swiss.jpg');
  insertProd.run(shop3.lastInsertRowid, catSides.lastInsertRowid, 'Loaded Fries', 'Crispy fries with cheese sauce and jalapeños', 6.99, '/images/products/loaded-fries.jpg');
  insertProd.run(shop3.lastInsertRowid, catSides.lastInsertRowid, 'Onion Rings', 'Golden crispy beer-battered onion rings', 5.99, '/images/products/onion-rings.jpg');
  insertProd.run(shop3.lastInsertRowid, catDrinksBH.lastInsertRowid, 'Chocolate Milkshake', 'Rich and creamy chocolate milkshake', 6.99, '/images/products/milkshake.jpg');

  // --- ORDERS ---
  const insertOrder = db.prepare(`INSERT INTO orders (user_id, shop_id, status, total_amount, delivery_address) VALUES (?, ?, ?, ?, ?)`);
  const insertItem = db.prepare(`INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)`);

  // Order 1 - Alice orders from Pizza Palace (delivered)
  const order1 = insertOrder.run(customer1.lastInsertRowid, shop1.lastInsertRowid, 'delivered', 27.98, '123 Main St, Apt 4B');
  insertItem.run(order1.lastInsertRowid, 1, 1, 12.99);
  insertItem.run(order1.lastInsertRowid, 2, 1, 14.99);

  // Order 2 - Bob orders from Sushi Spot (delivered)
  const order2 = insertOrder.run(customer2.lastInsertRowid, shop2.lastInsertRowid, 'delivered', 23.98, '456 Oak Ave');
  insertItem.run(order2.lastInsertRowid, 7, 1, 9.99);
  insertItem.run(order2.lastInsertRowid, 8, 1, 13.99);

  // Order 3 - Charlie orders from Burger House (preparing)
  const order3 = insertOrder.run(customer3.lastInsertRowid, shop3.lastInsertRowid, 'preparing', 24.98, '789 Elm Blvd');
  insertItem.run(order3.lastInsertRowid, 13, 1, 10.99);
  insertItem.run(order3.lastInsertRowid, 14, 1, 13.99);

  // Order 4 - Alice orders from Sushi Spot (delivered)
  const order4 = insertOrder.run(customer1.lastInsertRowid, shop2.lastInsertRowid, 'delivered', 30.98, '123 Main St, Apt 4B');
  insertItem.run(order4.lastInsertRowid, 10, 1, 14.99);
  insertItem.run(order4.lastInsertRowid, 11, 1, 16.99);

  // Order 5 - Bob orders from Pizza Palace (pending)
  const order5 = insertOrder.run(customer2.lastInsertRowid, shop1.lastInsertRowid, 'pending', 26.98, '456 Oak Ave');
  insertItem.run(order5.lastInsertRowid, 3, 1, 15.99);
  insertItem.run(order5.lastInsertRowid, 5, 1, 11.99);

  // --- REVIEWS ---
  const insertReview = db.prepare(`INSERT INTO reviews (user_id, order_id, product_id, shop_id, star_rating, review_text, sentiment_label, sentiment_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  insertReview.run(customer1.lastInsertRowid, order1.lastInsertRowid, 1, shop1.lastInsertRowid, 5, 'Absolutely amazing Margherita! The crust was perfectly crispy and the basil was so fresh.', 'positive', 0.95);
  insertReview.run(customer1.lastInsertRowid, order1.lastInsertRowid, 2, shop1.lastInsertRowid, 4, 'Good pepperoni pizza, though a bit greasy. Still enjoyed it overall.', 'positive', 0.72);
  insertReview.run(customer2.lastInsertRowid, order2.lastInsertRowid, 7, shop2.lastInsertRowid, 5, 'Best California roll in town! So fresh and perfectly portioned.', 'positive', 0.97);
  insertReview.run(customer2.lastInsertRowid, order2.lastInsertRowid, 8, shop2.lastInsertRowid, 3, 'Dragon roll was okay. Expected more eel flavor. Presentation was nice though.', 'neutral', 0.45);
  insertReview.run(customer1.lastInsertRowid, order4.lastInsertRowid, 10, shop2.lastInsertRowid, 5, 'Teriyaki chicken was cooked perfectly. The miso soup was a nice touch!', 'positive', 0.91);
  insertReview.run(customer1.lastInsertRowid, order4.lastInsertRowid, 11, shop2.lastInsertRowid, 2, 'Salmon was overcooked and the rice was cold. Very disappointing for the price.', 'negative', 0.18);

  console.log('✅ Demo data seeded successfully!');
  console.log('');
  console.log('📋 Login credentials (all passwords: password123):');
  console.log('   Admin:      admin@foodie.com');
  console.log('   Shop Owner: marco@pizzapalace.com');
  console.log('   Shop Owner: sakura@sushispot.com');
  console.log('   Shop Owner: john@burgerhouse.com');
  console.log('   Customer:   alice@mail.com');
  console.log('   Customer:   bob@mail.com');
  console.log('   Customer:   charlie@mail.com');
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
