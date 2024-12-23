require('dotenv').config();
const express = require('express');
const { auth } = require('express-openid-connect');
const routes = require('./routes');
const LoggerService = require('./utils/logger');
const BinanceService = require('./services/binanceService');
const { errorHandler, requestLogger, rateLimiter } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Auth0
const config = {
  authRequired: false, // Cambiado a true para requerir autenticación en todas las rutas
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET, // Debe estar en .env
  baseURL: process.env.AUTH0_BASE_URL || `http://localhost:${PORT}`,
  clientID: process.env.AUTH0_CLIENT_ID,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
};

// Middleware básico
app.use(express.json());
app.use(requestLogger);
app.use(rateLimiter);

// Auth0 middleware
app.use(auth(config));

// Ruta de prueba para ver el estado de autenticación
app.get('/', (req, res) => {
  if (req.oidc.isAuthenticated()) {
    res.send(`
      <h1>Autenticado como ${req.oidc.user.name}</h1>
      <p>Email: ${req.oidc.user.email}</p>
      <a href="/logout">Cerrar sesión</a>
    `);
  } else {
    res.send(`
      <h1>No autenticado</h1>
      <a href="/login">Iniciar sesión</a>
    `);
  }
});

// Usar las rutas - ahora protegidas por auth
app.use('/api', routes);

// Middleware de manejo de errores
app.use(errorHandler);

const binanceService = new BinanceService();

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  LoggerService.iniciarLogsPorMinuto();

  // Logear la api key y secret key

  // Iniciar trading
  //binanceService.iniciarPaperTrading();

  // Generar reporte cada 24 horas
  // setInterval(() => {
  //   binanceService.generarReporteDiario();
  // }, 24 * 60 * 60 * 1000);
});
