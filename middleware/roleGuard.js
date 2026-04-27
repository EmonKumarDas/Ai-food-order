// middleware/roleGuard.js — Role-based access control
function roleGuard(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return res.redirect('/login');
    }

    if (!allowedRoles.includes(req.user.role)) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
      }
      // Redirect to appropriate dashboard based on role
      switch (req.user.role) {
        case 'customer': return res.redirect('/home');
        case 'shop': return res.redirect('/shop/dashboard');
        case 'admin': return res.redirect('/admin/dashboard');
        default: return res.redirect('/login');
      }
    }

    next();
  };
}

module.exports = { roleGuard };
