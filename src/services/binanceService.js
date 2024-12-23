// src/services/binanceService.js
const Binance = require('binance-api-node').default;
const LoggerService = require('../utils/logger');

class BinanceService {
  constructor() {
    this.client = Binance({
      apiKey: process.env.BINANCE_API_KEY,
      apiSecret: process.env.BINANCE_API_SECRET,
      // Para paper trading usamos el testnet
      testnet: true,
    });

    this.par = 'BTCUSDT';
    this.saldoPapel = {
      USDT: 10000, // Saldo inicial de prueba
      BTC: 0,
    };

    this.estadisticas = {
      operacionesRealizadas: 0,
      gananciasTotal: 0,
      precioPromedioCompra: 0,
      ultimaOperacion: null,
    };

    // Agregar control de intervalos
    this.ultimoLog = Date.now();
    this.intervaloPrecio = 5000; // 5 segundos entre logs de precio
    this.precioActual = 0;
    this.wsConnection = null; // Para mantener referencia al websocket
  }

  async iniciarPaperTrading() {
    try {
      console.log(`
        ====================================
        Iniciando Paper Trading
        Par: ${this.par}
        Saldo Inicial USDT: ${this.saldoPapel.USDT}
        Modo: TestNet
        ====================================
      `);

      // Iniciar el websocket con manejo de reconexión
      this.iniciarWebSocket();

      // Implementar un heartbeat para verificar la conexión
      setInterval(() => {
        if (!this.wsConnection) {
          console.log('WebSocket desconectado. Reiniciando conexión...');
          this.iniciarWebSocket();
        }
      }, 30000); // Verificar cada 30 segundos
    } catch (error) {
      console.error('Error al iniciar paper trading:', error);
      // Reintentar conexión después de un error
      setTimeout(() => this.iniciarPaperTrading(), 5000);
    }
  }

  iniciarWebSocket() {
    try {
      // Cerrar conexión existente si hay alguna
      if (this.wsConnection) {
        this.wsConnection = null;
      }

      // Crear nueva conexión
      this.wsConnection = this.client.ws.trades(this.par, (trade) => {
        this.precioActual = parseFloat(trade.price);

        // Loggear solo cada X segundos
        const ahora = Date.now();
        if (ahora - this.ultimoLog >= this.intervaloPrecio) {
          this.logEstadoActual();
          this.ultimoLog = ahora;

          // Analizar el mercado con el último precio
          this.analizarMercado(this.precioActual).catch((err) => {
            console.error('Error en análisis de mercado:', err);
          });
        }
      });
    } catch (error) {
      console.error('Error al iniciar WebSocket:', error);
      this.wsConnection = null;
    }
  }

  logEstadoActual() {
    const mensaje = `
      ====================================
      Timestamp: ${new Date().toISOString()}
      Par: ${this.par}
      Precio: ${this.precioActual}
      Saldo USDT: ${this.saldoPapel.USDT.toFixed(2)}
      Saldo BTC: ${this.saldoPapel.BTC.toFixed(8)}
      Operaciones: ${this.estadisticas.operacionesRealizadas}
      P&L Total: ${this.estadisticas.gananciasTotal.toFixed(2)} USDT
      ====================================
    `;
    console.log(mensaje);
  }

  async analizarMercado(precioActual) {
    try {
      // Limitar las llamadas a la API
      if (!this.ultimoAnalisis || Date.now() - this.ultimoAnalisis >= 60000) {
        // 1 minuto
        const klines = await this.client.candles({
          symbol: this.par,
          interval: '15m',
          limit: 100,
        });

        // Implementar manejo de errores para las operaciones
        await this.evaluarSeñales(precioActual, klines);
        this.ultimoAnalisis = Date.now();
      }
    } catch (error) {
      console.error('Error en análisis de mercado:', error);
    }
  }

  evaluarSeñales(precioActual, klines) {
    // Ejemplo simple de estrategia
    // En la realidad, aquí implementarías indicadores técnicos más complejos
    const ultimosPreciosCierre = klines.map((k) => parseFloat(k.close));
    const mediaMovil = this.calcularMediaMovil(ultimosPreciosCierre, 20);

    console.log('Media móvil:', mediaMovil);

    if (precioActual > mediaMovil && this.saldoPapel.USDT > 0) {
      this.ejecutarCompraSimulada(precioActual);
    } else if (precioActual < mediaMovil && this.saldoPapel.BTC > 0) {
      this.ejecutarVentaSimulada(precioActual);
    }
  }

  calcularMediaMovil(precios, periodo) {
    const suma = precios.slice(-periodo).reduce((a, b) => a + b, 0);
    return suma / periodo;
  }

  ejecutarCompraSimulada(precio) {
    const montoUSDT = 100;
    if (this.saldoPapel.USDT >= montoUSDT) {
      const cantidadBTC = montoUSDT / precio;
      this.saldoPapel.USDT -= montoUSDT;
      this.saldoPapel.BTC += cantidadBTC;

      this.estadisticas.operacionesRealizadas++;
      this.estadisticas.precioPromedioCompra = precio;
      this.estadisticas.ultimaOperacion = {
        tipo: 'COMPRA',
        precio,
        cantidad: cantidadBTC,
        monto: montoUSDT,
        timestamp: new Date(),
      };

      console.log(`
        =====================================
        SEÑAL DE COMPRA EJECUTADA
        =====================================
        Timestamp: ${new Date().toISOString()}
        Precio de compra: ${precio} USDT
        Cantidad BTC: ${cantidadBTC.toFixed(8)}
        Monto USDT: ${montoUSDT}
        Saldo restante USDT: ${this.saldoPapel.USDT.toFixed(2)}
        Saldo actual BTC: ${this.saldoPapel.BTC.toFixed(8)}
        =====================================
      `);
    }
  }

  ejecutarVentaSimulada(precio) {
    if (this.saldoPapel.BTC > 0) {
      const montoUSDT = this.saldoPapel.BTC * precio;
      const gananciaPerdida =
        montoUSDT -
        this.saldoPapel.BTC * this.estadisticas.precioPromedioCompra;

      this.saldoPapel.USDT += montoUSDT;
      const btcVendido = this.saldoPapel.BTC;
      this.saldoPapel.BTC = 0;

      this.estadisticas.operacionesRealizadas++;
      this.estadisticas.gananciasTotal += gananciaPerdida;
      this.estadisticas.ultimaOperacion = {
        tipo: 'VENTA',
        precio,
        cantidad: btcVendido,
        monto: montoUSDT,
        ganancia: gananciaPerdida,
        timestamp: new Date(),
      };

      console.log(`
        =====================================
        SEÑAL DE VENTA EJECUTADA
        =====================================
        Timestamp: ${new Date().toISOString()}
        Precio de venta: ${precio} USDT
        Cantidad BTC vendida: ${btcVendido.toFixed(8)}
        Monto recibido USDT: ${montoUSDT.toFixed(2)}
        P&L operación: ${gananciaPerdida.toFixed(2)} USDT
        P&L total: ${this.estadisticas.gananciasTotal.toFixed(2)} USDT
        Saldo actual USDT: ${this.saldoPapel.USDT.toFixed(2)}
        =====================================
      `);
    }
  }

  // Método para generar reporte diario
  generarReporteDiario() {
    const reporte = `
      ========================================
      REPORTE DIARIO DE TRADING
      ========================================
      Fecha: ${new Date().toISOString()}
      Par: ${this.par}
      Operaciones realizadas: ${this.estadisticas.operacionesRealizadas}
      P&L Total: ${this.estadisticas.gananciasTotal.toFixed(2)} USDT
      Saldo actual USDT: ${this.saldoPapel.USDT.toFixed(2)}
      Saldo actual BTC: ${this.saldoPapel.BTC.toFixed(8)}
      Última operación: ${JSON.stringify(
        this.estadisticas.ultimaOperacion,
        null,
        2
      )}
      ========================================
    `;

    console.log(reporte);
    return reporte;
  }
}

module.exports = BinanceService;
