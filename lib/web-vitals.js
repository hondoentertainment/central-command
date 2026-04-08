/**
 * Lightweight Web Vitals tracking using PerformanceObserver.
 * Measures LCP, FID, CLS, INP, and TTFB without any external library.
 *
 * Usage:
 *   import { trackVitals } from "./lib/web-vitals.js";
 *   trackVitals();                       // logs to console
 *   trackVitals({ onMetric: fn });       // custom callback per metric
 */

const LOG_PREFIX = "[web-vitals]";

function report(name, value, options) {
  const entry = { name, value: Math.round(value * 1000) / 1000, ts: Date.now() };

  if (options.onMetric) {
    try { options.onMetric(entry); } catch (_) { /* swallow */ }
  }

  if (options.debug) {
    console.log(`${LOG_PREFIX} ${name}: ${entry.value}`);
  }
}

function observeLCP(opts) {
  try {
    let lastEntry;
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        lastEntry = entry;
      }
    });
    po.observe({ type: "largest-contentful-paint", buffered: true });

    // Report the final LCP value when the page becomes hidden
    const onHidden = () => {
      if (lastEntry) {
        report("LCP", lastEntry.startTime, opts);
        lastEntry = null;
      }
      removeEventListener("visibilitychange", onHidden, true);
    };
    addEventListener("visibilitychange", onHidden, true);
  } catch (_) { /* unsupported */ }
}

function observeFID(opts) {
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        report("FID", entry.processingStart - entry.startTime, opts);
      }
    });
    po.observe({ type: "first-input", buffered: true });
  } catch (_) { /* unsupported */ }
}

function observeCLS(opts) {
  try {
    let clsValue = 0;
    let sessionValue = 0;
    let sessionEntries = [];

    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Ignore shifts that follow recent user input
        if (entry.hadRecentInput) continue;

        const firstEntry = sessionEntries[0];
        const lastEntry = sessionEntries[sessionEntries.length - 1];

        // Start a new session window if gap > 1s or window > 5s
        if (
          sessionEntries.length > 0 &&
          (entry.startTime - lastEntry.startTime > 1000 ||
            entry.startTime - firstEntry.startTime > 5000)
        ) {
          sessionValue = 0;
          sessionEntries = [];
        }

        sessionEntries.push(entry);
        sessionValue += entry.value;

        if (sessionValue > clsValue) {
          clsValue = sessionValue;
        }
      }
    });
    po.observe({ type: "layout-shift", buffered: true });

    const onHidden = () => {
      report("CLS", clsValue, opts);
      removeEventListener("visibilitychange", onHidden, true);
    };
    addEventListener("visibilitychange", onHidden, true);
  } catch (_) { /* unsupported */ }
}

function observeINP(opts) {
  try {
    let maxDuration = 0;
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // duration includes processing + presentation delay
        if (entry.duration > maxDuration) {
          maxDuration = entry.duration;
        }
      }
    });
    po.observe({ type: "event", buffered: true, durationThreshold: 16 });

    const onHidden = () => {
      if (maxDuration > 0) {
        report("INP", maxDuration, opts);
      }
      removeEventListener("visibilitychange", onHidden, true);
    };
    addEventListener("visibilitychange", onHidden, true);
  } catch (_) { /* unsupported */ }
}

function observeTTFB(opts) {
  try {
    const [nav] = performance.getEntriesByType("navigation");
    if (nav) {
      report("TTFB", nav.responseStart, opts);
    }
  } catch (_) { /* unsupported */ }
}

/**
 * Begin tracking all Core Web Vitals.
 * @param {Object} [options]
 * @param {boolean} [options.debug] - Log metrics to console (default: true in dev)
 * @param {(metric: {name:string, value:number, ts:number}) => void} [options.onMetric] - Callback per metric
 */
export function trackVitals(options = {}) {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;

  const isDev =
    location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const opts = { debug: isDev, ...options };

  observeTTFB(opts);
  observeLCP(opts);
  observeFID(opts);
  observeCLS(opts);
  observeINP(opts);
}
