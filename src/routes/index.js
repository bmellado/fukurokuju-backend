const router = require('express').Router();
const { requiresAuth } = require('express-openid-connect');

// Ruta pública
router.get('/public', (req, res) => {
  res.json({ message: 'Esta ruta es pública' });
});

// Ruta protegida
router.get('/private', requiresAuth(), (req, res) => {
  res.json({
    message: 'Esta ruta está protegida',
    user: req.oidc.user,
  });
});

module.exports = router;
