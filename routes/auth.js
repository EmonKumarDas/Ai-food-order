// routes/auth.js — Login, register, logout
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
require('dotenv').config();

// GET /login — Render login page
router.get('/login', (req, res) => {
  if (req.cookies?.token) {
    try {
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      const user = db.prepare('SELECT role FROM users WHERE id = ?').get(decoded.userId);
      if (user) {
        switch (user.role) {
          case 'customer': return res.redirect('/home');
          case 'shop': return res.redirect('/shop/dashboard');
          case 'admin': return res.redirect('/admin/dashboard');
        }
      }
    } catch (e) { /* invalid token, show login */ }
  }
  res.render('login', { error: null });
});

// GET /register — Render registration page
router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// POST /api/auth/login — Validate credentials
router.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password, and role are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND role = ?').get(email, role);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email, password, or role' });
    }

    if (!user.is_active) {
      if (user.role === 'shop') {
        return res.status(403).json({ error: 'Your shop account is pending admin approval. Please wait for an admin to activate it.' });
      }
      return res.status(403).json({ error: 'Account has been deactivated' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email, password, or role' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict'
    });

    // Return redirect path based on role
    let redirectPath = '/home';
    if (user.role === 'shop') redirectPath = '/shop/dashboard';
    if (user.role === 'admin') redirectPath = '/admin/dashboard';

    res.json({ 
      success: true, 
      redirectPath,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, shopName } = req.body;
    const userRole = role === 'shop' ? 'shop' : (role === 'admin' ? 'admin' : 'customer');

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const isActive = userRole === 'shop' ? 0 : 1; // Shops are pending by default
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Insert user
    const insertUser = db.prepare(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)'
    );
    const result = insertUser.run(name, email, passwordHash, userRole, isActive);
    const userId = result.lastInsertRowid;

    // If shop owner, create shop entry
    if (userRole === 'shop') {
      const insertShop = db.prepare('INSERT INTO shops (user_id, shop_name, is_active) VALUES (?, ?, ?)');
      insertShop.run(userId, shopName || `${name}'s Shop`, isActive);
      
      // Do not auto-login for shops since they are pending
      return res.json({ success: true, pending: true });
    }

    const token = jwt.sign(
      { userId: result.lastInsertRowid, role: userRole },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'strict'
    });

    const redirectPath = userRole === 'admin' ? '/admin/dashboard' : '/home';
    res.json({ success: true, redirectPath });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout — Clear session
router.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// GET /logout — Browser redirect logout
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

module.exports = router;
