export type CalibrationStatus =
  | "verified_live"
  | "fixture_verified"
  | "synthetic_only"
  | "unavailable_in_environment"
  | "needs_browser_capture";

export interface SourceCalibration {
  source: string;
  status: CalibrationStatus;
  lastChecked: string | null;
  notes: string;
}

export const SOURCE_CALIBRATIONS: Record<string, SourceCalibration> = {
  yargitay: {
    source: "yargitay",
    status: "synthetic_only",
    lastChecked: null,
    notes: "Endpoint: emsal.yargitay.gov.tr/BilgiBankasiIslem. Tested only with synthetic fixtures. Run probe:precedents to verify live."
  },
  danistay: {
    source: "danistay",
    status: "synthetic_only",
    lastChecked: null,
    notes: "Endpoint: karararama.danistay.gov.tr/YargitayBilgiBankasiIstemciService. Tested only with synthetic fixtures. Run probe:precedents to verify live."
  },
  aym: {
    source: "aym",
    status: "synthetic_only",
    lastChecked: null,
    notes: "AYM adapter is mock-only. No live endpoint integration yet."
  }
};
