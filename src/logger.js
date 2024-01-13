// logger.js
class Logger {
  constructor(enabled) {
    this.enabled = enabled;
  }

  log(...args) {
    if (this.enabled) {
      console.log(...args);
    }
  }

  // You can also add wrappers for other console methods if needed
  error(...args) {
    if (this.enabled) {
      console.error(...args);
    }
  }

  warn(...args) {
    if (this.enabled) {
      console.warn(...args);
    }
  }
}

// Export an instance of Logger for each file with logging enabled or disabled
export const serverLogger = new Logger(true); 
export const clientLogger = new Logger(false); 
export const feedsLogger = new Logger(true); 
export const similLogger = new Logger(false); 
export const similWorkerLogger = new Logger(false); 
export const graphLogger = new Logger(true); 
export const visualGraphLogger = new Logger(true); 
export const forceAtlasLogger = new Logger(false); 

