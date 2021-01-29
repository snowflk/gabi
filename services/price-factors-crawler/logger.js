const winston = require('winston');
const {format} = winston;

const ConsoleLogFormat = format.printf(({level, message, timestamp}) => {
    return `${timestamp} [${level}]: ${message}`;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    format: format.combine(
        format.colorize(),
        format.timestamp(),
        format.json(),
        format.label(),
        ConsoleLogFormat,
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({filename: 'crawler.log'})
    ]
});

module.exports = logger;