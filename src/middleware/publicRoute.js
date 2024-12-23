const publicRoute = (req, res, next) => {
  req.oidc = req.oidc || {};
  req.oidc.isAuthenticated = () => true;
  next();
};

module.exports = publicRoute;
