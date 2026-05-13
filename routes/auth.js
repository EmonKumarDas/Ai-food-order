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
      const user = db.prepare('SELECT role, is_active FROM users WHERE id = ?').get(decoded.userId);
      if (user && user.is_active) {
        switch (user.role) {
          case 'customer': return res.redirect('/home');
          case 'shop': return res.redirect('/shop/dashboard');
          case 'admin': return res.redirect('/admin/dashboard');
        }
      } else {
        res.clearCookie('token');
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

// GET /forgot-password
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password');
});

// POST /api/auth/forgot-password
router.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      // Return success even if not found for security reasons
      return res.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

    db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?')
      .run(resetToken, expires, email);

    // Send password reset email
    const { sendPasswordResetEmail } = require('../services/emailService');
    const emailSent = await sendPasswordResetEmail(email, resetToken);

    if (emailSent) {
      res.json({ success: true, message: 'A password reset link has been sent to your email address.' });
    } else {
      // Fallback: log to console if email sending fails
      console.log(`\n🔑 PASSWORD RESET LINK FOR ${email}:`);
      console.log(`http://localhost:${process.env.PORT || 3000}/reset-password?token=${resetToken}\n`);
      res.json({ success: true, message: 'Password reset link generated. Check your email or server console.' });
    }
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /reset-password
router.get('/reset-password', (req, res) => {
  const token = req.query.token;
  if (!token) return res.redirect('/login');
  
  const user = db.prepare('SELECT * FROM users WHERE reset_token = ? AND reset_expires > ?').get(token, new Date().toISOString());
  if (!user) {
    return res.send('<h2>Invalid or expired reset link.</h2><a href="/forgot-password">Try again</a>');
  }
  
  res.render('reset-password', { token });
});

// POST /api/auth/reset-password
router.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const user = db.prepare('SELECT * FROM users WHERE reset_token = ? AND reset_expires > ?').get(token, new Date().toISOString());
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    const passwordHash = await bcrypt.hash(password, 10);
    db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?')
      .run(passwordHash, user.id);

    res.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
