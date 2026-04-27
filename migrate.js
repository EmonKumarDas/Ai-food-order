const db = require('./db/database');
try {
  db.exec('ALTER TABLE products ADD COLUMN latitude REAL');
  db.exec('ALTER TABLE products ADD COLUMN longitude REAL');
  console.log('Migration successful: Added latitude and longitude to products table.');
} catch(e) {
  console.log('Migration error or already migrated:', e.message);
}
