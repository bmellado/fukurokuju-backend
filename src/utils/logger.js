// src/utils/logger.js

class LoggerService {
  static iniciarLogsPorMinuto() {
    const ahora = new Date();
    const segundosRestantes = 60 - ahora.getSeconds();
    const milisegundosRestantes =
      segundosRestantes * 1000 - ahora.getMilliseconds();

    setTimeout(() => {
      this.registrarLog();

      setInterval(() => {
        this.registrarLog();
      }, 60000);
    }, milisegundosRestantes);
  }

  static registrarLog() {
    const tiempo = new Date();
    console.log(`Log del minuto: ${tiempo.toLocaleTimeString()}`);
  }
}

module.exports = LoggerService;
