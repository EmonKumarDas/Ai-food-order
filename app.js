// app.js — Express server entry point
require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'public', 'images', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
const { initializeDatabase } = require('./db/init');
initializeDatabase();

// Routes
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customer');
const orderRoutes = require('./routes/orders');
const reviewRoutes = require('./routes/reviews');
const shopRoutes = require('./routes/shop');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/reports');

app.use(authRoutes);
app.use(customerRoutes);
app.use(orderRoutes);
app.use(reviewRoutes);
app.use(shopRoutes);
app.use(adminRoutes);
app.use(reportRoutes);

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/login');
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { user: null });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🍽️  Food Ordering System running at http://localhost:${PORT}`);
  console.log(`   Login: http://localhost:${PORT}/login\n`);
  
  // Start scheduler
  try {
    const { startScheduler } = require('./jobs/scheduler');
    startScheduler();
  } catch (err) {
    console.warn('Scheduler not started:', err.message);
  }
});
