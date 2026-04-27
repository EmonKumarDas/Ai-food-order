// middleware/auth.js — JWT verification middleware
const jwt = require('jsonwebtoken');
const db = require('../db/database');
require('dotenv').config();

function requireAuth(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/login');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, name, email, role, is_active FROM users WHERE id = ?').get(decoded.userId);

    if (!user || !user.is_active) {
      res.clearCookie('token');
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Account not found or deactivated' });
      }
      return res.redirect('/login');
    }

    req.user = user;
    next();
  } catch (err) {
    res.clearCookie('token');
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    return res.redirect('/login');
  }
}

// Optional auth - doesn't redirect, just attaches user if available
function optionalAuth(req, res, next) {
  const token = req.cookies?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = db.prepare('SELECT id, name, email, role, is_active FROM users WHERE id = ?').get(decoded.userId);
      if (user && user.is_active) {
        req.user = user;
      }
    } catch (err) {
      // Token invalid, continue without user
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
