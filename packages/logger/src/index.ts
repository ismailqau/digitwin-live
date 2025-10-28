import winston from 'winston';

const { combine, timestamp, json, printf, colorize } = winston.format;

const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

export function createLogger(serviceName: string) {
  const isDevelopment = process.env.NODE_ENV !== 'production';

  return winston.createLogger({
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    format: combine(timestamp(), json()),
    defaultMeta: { service: serviceName },
    transports: [
      new winston.transports.Console({
        format: isDevelopment ? combine(colorize(), timestamp(), consoleFormat) : json(),
      }),
    ],
  });
}

export const logger = createLogger('clone-system');
