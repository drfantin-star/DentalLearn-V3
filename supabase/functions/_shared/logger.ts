// Structured JSON logger for Edge Functions.
//
// Les logs sont émis sur stdout au format JSON, une ligne par événement,
// pour que Supabase Logs (Logflare) puisse les indexer et permettre le
// filtrage par `function`, `level`, `event`, etc.
//
// Règle RGPD (handoff §4.9) : aucune PII dans les logs.

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

export class Logger {
  constructor(private readonly fn: string) {}

  private emit(level: LogLevel, event: string, ctx: LogContext = {}): void {
    const line = {
      ts: new Date().toISOString(),
      level,
      function: this.fn,
      event,
      ...ctx,
    };
    const serialized = JSON.stringify(line);
    if (level === "error") console.error(serialized);
    else if (level === "warn") console.warn(serialized);
    else console.log(serialized);
  }

  debug(event: string, ctx?: LogContext): void { this.emit("debug", event, ctx); }
  info(event: string, ctx?: LogContext): void  { this.emit("info",  event, ctx); }
  warn(event: string, ctx?: LogContext): void  { this.emit("warn",  event, ctx); }
  error(event: string, ctx?: LogContext): void { this.emit("error", event, ctx); }
}
