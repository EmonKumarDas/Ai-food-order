const db = require('./database');

console.log('🧹 Preparing to wipe all dummy data...');

try {
  // Clear all transactional and generated data
  db.prepare('DELETE FROM ai_alerts').run();
  db.prepare('DELETE FROM reviews').run();
  db.prepare('DELETE FROM order_items').run();
  db.prepare('DELETE FROM orders').run();
  db.prepare('DELETE FROM products').run();
  db.prepare('DELETE FROM shops').run();
  
  // Clear all users EXCEPT the admin account so you can still log in
  db.prepare("DELETE FROM users WHERE role != 'admin'").run();

  console.log('✅ All dummy data (Shops, Customers, Products, Orders, Reviews, Alerts) has been completely removed!');
  console.log('👑 The Admin account (admin@foodie.com / password123) was kept so you can log in.');
  console.log('You can now create your own original accounts and products.');

} catch (err) {
  console.error('❌ Error wiping data:', err.message);
}
