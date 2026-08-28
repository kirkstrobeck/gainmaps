export type AnalyticsProperties = Record<string, boolean | number | string | null | undefined>;

export const ANALYTICS_EVENTS = {
  copyAction: "gainmaps_copy_action",
  converterHomeFilesSelected: "gainmaps_home_converter_files_selected",
  converterFilesAdded: "gainmaps_converter_files_added",
  converterFilesRejected: "gainmaps_converter_files_rejected",
  converterQueueCleared: "gainmaps_converter_queue_cleared",
  converterRedoRequested: "gainmaps_converter_redo_requested",
  converterWorkerReady: "gainmaps_converter_worker_ready",
  converterWorkerError: "gainmaps_converter_worker_error",
  converterWorkerJobStarted: "gainmaps_converter_worker_job_started",
  converterWorkerJobCompleted: "gainmaps_converter_worker_job_completed",
  converterWorkerJobFailed: "gainmaps_converter_worker_job_failed",
  converterDownloadStarted: "gainmaps_converter_download_started",
  converterAutoDownloadChanged: "gainmaps_converter_auto_download_changed",
  converterGainChanged: "gainmaps_converter_gain_changed",
  displayCheckOpened: "gainmaps_display_check_opened",
  displayCheckAnswered: "gainmaps_display_check_answered",
  displayCheckDismissed: "gainmaps_display_check_dismissed",
  installMethodSelected: "gainmaps_install_method_selected",
  productHuntClicked: "gainmaps_product_hunt_clicked",
  shareAction: "gainmaps_share_action",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export function track(event: AnalyticsEvent, properties: AnalyticsProperties = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.gainmapsPostHog?.capture(event, compactProperties({
      app: "gainmaps",
      ...properties,
    }));
  } catch {
    // Analytics must never affect conversion, navigation, or copy actions.
  }
}

export function fileExtension(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1]!.toLowerCase() : "unknown";
}

export function summarizeFiles(files: readonly File[]): AnalyticsProperties {
  const extensions = [...new Set(files.map((file) => fileExtension(file.name)))].sort();
  const types = [...new Set(files.map((file) => file.type || "unknown"))].sort();
  return {
    file_count: files.length,
    total_bytes: files.reduce((total, file) => total + file.size, 0),
    extensions: extensions.join(","),
    mime_types: types.join(","),
  };
}

export function summarizeFile(file: File): AnalyticsProperties {
  return {
    file_bytes: file.size,
    file_extension: fileExtension(file.name),
    file_type: file.type || "unknown",
  };
}

export function errorBucket(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const lower = text.toLowerCase();
  if (lower.includes("service worker")) return "service_worker";
  if (lower.includes("timeout") || lower.includes("did not start")) return "timeout";
  if (lower.includes("decode") || lower.includes("unsupported")) return "decode";
  if (lower.includes("encode")) return "encode";
  if (lower.includes("network") || lower.includes("fetch")) return "network";
  if (lower.includes("permission") || lower.includes("not allowed")) return "permission";
  return "unknown";
}

function compactProperties(properties: AnalyticsProperties): AnalyticsProperties {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ) as AnalyticsProperties;
}
