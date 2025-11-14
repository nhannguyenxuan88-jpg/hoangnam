export const formatCurrency = (v: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    v
  );
export const formatDate = (
  iso: string | Date | undefined | null,
  short = true
) => {
  if (!iso) return "--";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "--";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  if (short) return `${dd}/${mm}/${yyyy}`;
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
};

// Format work order ID for display. Uses optional store prefix (e.g., SC). If the ID
// already starts with the prefix, return as-is. If ID looks like WO-<timestamp>, convert
// to <PREFIX>-YYYYMMDD-<last6digits> for better readability.
export const formatWorkOrderId = (id?: string | null, storePrefix?: string) => {
  if (!id) return "";
  const prefix = storePrefix || "SC";
  // If ID starts with prefix and has a numeric timestamp following it (e.g., SC-<timestamp>), capture it.
  let match = id.match(new RegExp(`^${prefix}-(\\d{10,})`, "i"));

  // Otherwise, detect legacy WO-<timestamp> or any long numeric timestamp.
  if (!match) match = id.match(/WO-(\d+)/i) || id.match(/(\d{10,})/);
  if (match && match[1]) {
    const ts = match[1];
    const num = Number(ts);
    if (!Number.isNaN(num)) {
      const d = new Date(num);
      if (!Number.isNaN(d.getTime())) {
        const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}${String(d.getDate()).padStart(2, "0")}`;
        const suffix = String(ts).slice(-6).padStart(6, "0");
        return `${prefix}-${dateStr}-${suffix}`;
      }
    }
  }
  // Default: return original id
  return id;
};

// Generic formatter that preserves the original prefix (e.g., SALE, INV) while
// converting any embedded epoch timestamp into a readable YYYYMMDD-suffix form.
export const formatAnyId = (id?: string | null, storePrefix?: string) => {
  if (!id) return "";
  // Capture format PREFIX-<timestamp> where timestamp is 10+ digits
  const withPrefix = id.match(/^([A-Z0-9_-]+)-(\d{10,})$/i);
  if (withPrefix) {
    const originalPrefix = withPrefix[1];
    const ts = withPrefix[2];
    const num = Number(ts);
    if (!Number.isNaN(num)) {
      const d = new Date(num);
      if (!Number.isNaN(d.getTime())) {
        const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}${String(d.getDate()).padStart(2, "0")}`;
        const suffix = String(ts).slice(-6).padStart(6, "0");
        return `${originalPrefix}-${dateStr}-${suffix}`;
      }
    }
  }

  // If we reach here, fallback to: detect any bare long numeric timestamp and apply store prefix
  const numMatch = id.match(/(\d{10,})/);
  if (numMatch) {
    const ts = numMatch[1];
    const num = Number(ts);
    if (!Number.isNaN(num)) {
      const d = new Date(num);
      if (!Number.isNaN(d.getTime())) {
        const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}${String(d.getDate()).padStart(2, "0")}`;
        const suffix = String(ts).slice(-6).padStart(6, "0");
        const prefix = storePrefix || "SC";
        return `${prefix}-${dateStr}-${suffix}`;
      }
    }
  }

  return id;
};
