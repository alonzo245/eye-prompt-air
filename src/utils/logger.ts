/**
 * Logger utility for connection and device communication
 * Logs appear in browser console and can be monitored in dev tools
 */

type LogLevel = 'info' | 'success' | 'error' | 'warn' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: LogLevel, category: string, message: string, _data?: any): string {
    const timestamp = this.formatTimestamp();
    const emoji = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warn: '⚠️',
      debug: '🔍',
    }[level];

    const prefix = `[${timestamp}] ${emoji} [${category}]`;
    return `${prefix} ${message}`;
  }

  private log(level: LogLevel, category: string, message: string, data?: any) {
    const timestamp = this.formatTimestamp();
    const entry: LogEntry = { timestamp, level, category, message, data };
    
    // Store log
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Output to console with appropriate method
    const formattedMessage = this.formatMessage(level, category, message, data);
    
    switch (level) {
      case 'error':
        console.error(formattedMessage, data || '');
        break;
      case 'warn':
        console.warn(formattedMessage, data || '');
        break;
      case 'success':
        console.log(`%c${formattedMessage}`, 'color: #4CAF50; font-weight: bold', data || '');
        break;
      case 'debug':
        console.debug(formattedMessage, data || '');
        break;
      default:
        console.log(formattedMessage, data || '');
    }
  }

  info(category: string, message: string, data?: any) {
    this.log('info', category, message, data);
  }

  success(category: string, message: string, data?: any) {
    this.log('success', category, message, data);
  }

  error(category: string, message: string, data?: any) {
    this.log('error', category, message, data);
  }

  warn(category: string, message: string, data?: any) {
    this.log('warn', category, message, data);
  }

  debug(category: string, message: string, data?: any) {
    this.log('debug', category, message, data);
  }

  // Connection-specific logging methods
  connection(message: string, data?: any) {
    this.info('CONNECTION', message, data);
  }

  connectionSuccess(message: string, data?: any) {
    this.success('CONNECTION', message, data);
  }

  connectionError(message: string, data?: any) {
    this.error('CONNECTION', message, data);
  }

  device(message: string, data?: any) {
    this.info('DEVICE', message, data);
  }

  deviceSuccess(message: string, data?: any) {
    this.success('DEVICE', message, data);
  }

  deviceError(message: string, data?: any) {
    this.error('DEVICE', message, data);
  }

  // Get all logs (useful for debugging)
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Clear logs
  clear() {
    this.logs = [];
  }
}

export const logger = new Logger();

// Expose logger globally for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).eyePromptLogger = logger;
  console.log('%c🔍 Eye Prompt Logger Available', 'color: #667eea; font-weight: bold; font-size: 14px;');
  console.log('%cType window.eyePromptLogger.getLogs() to see all logs', 'color: #999; font-size: 12px;');
}
