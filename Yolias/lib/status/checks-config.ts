// Status check settings (D-181): pure, shared with Yolias Admin.

export interface StatusSettings {
  intervalMinutes: number;
  failThreshold: number;
  queueDegradedMinutes: number;
  queueOutageMinutes: number;
  failureRateDegraded: number;
  failureRateOutage: number;
  slowMs: number;
}

export const DEFAULT_STATUS_SETTINGS: StatusSettings = {
  intervalMinutes: 5, failThreshold: 2, queueDegradedMinutes: 15, queueOutageMinutes: 60, failureRateDegraded: 0.2, failureRateOutage: 0.5, slowMs: 3000,
};
export const STATUS_SETTINGS_KEY = "status_settings";

export function parseStatusSettings(v: unknown): StatusSettings {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const num = (k: keyof StatusSettings, min: number, max: number) => {
    const n = Number(o[k]);
    return Number.isFinite(n) && n >= min && n <= max ? n : DEFAULT_STATUS_SETTINGS[k];
  };
  return {
    intervalMinutes: num("intervalMinutes", 1, 60), failThreshold: num("failThreshold", 1, 10),
    queueDegradedMinutes: num("queueDegradedMinutes", 1, 1440), queueOutageMinutes: num("queueOutageMinutes", 2, 2880),
    failureRateDegraded: num("failureRateDegraded", 0.01, 1), failureRateOutage: num("failureRateOutage", 0.02, 1), slowMs: num("slowMs", 200, 30000),
  };
}

