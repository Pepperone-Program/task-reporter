type LogContext = Record<string, unknown>;

function serializeContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return "";
  }

  return ` ${JSON.stringify(context)}`;
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(`[task-reporter] ${message}${serializeContext(context)}`);
  },
  warn(message: string, context?: LogContext) {
    console.warn(`[task-reporter] ${message}${serializeContext(context)}`);
  },
  error(message: string, context?: LogContext) {
    console.error(`[task-reporter] ${message}${serializeContext(context)}`);
  },
};
