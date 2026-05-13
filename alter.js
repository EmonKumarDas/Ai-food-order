const db = require('./db/database');

try {
  db.exec('ALTER TABLE users ADD COLUMN reset_token TEXT');
  db.exec('ALTER TABLE users ADD COLUMN reset_expires DATETIME');
  console.log('Successfully added reset_token and reset_expires columns');
} catch (e) {
  if (e.message.includes('duplicate column name')) {
    console.log('Columns already exist');
  } else {
    console.error('Error:', e.message);
  }
}
