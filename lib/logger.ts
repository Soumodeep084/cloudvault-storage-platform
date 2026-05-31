type LogContext = Record<string, unknown>;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
}

function writeLog(level: "info" | "warn" | "error", message: string, context?: LogContext) {
  const payload = context && Object.keys(context).length > 0 ? { ...context } : undefined;
  if (payload) {
    if (payload.error !== undefined) {
      payload.error = serializeError(payload.error);
    }
    console[level](`${message} ${JSON.stringify(payload)}`);
    return;
  }

  console[level](message);
}

export const logger = {
  info(message: string, context?: LogContext) {
    writeLog("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    writeLog("warn", message, context);
  },
  error(message: string, context?: LogContext) {
    writeLog("error", message, context);
  },
};
