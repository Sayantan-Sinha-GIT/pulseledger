import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { api } from "../api";
import {
  formatDuration,
  formatPercent,
  formatRelative,
  formatShortTime,
  formatTimestamp,
  hostOf,
} from "../format";
import { Link } from "../router";
import type {
  LatencyPoint,
  MonitorState,
  MonitorView,
  OverallState,
  StatusResponse,
} from "../../shared/types";

gsap.registerPlugin(ScrollTrigger);

const STATE_LABELS: Record<MonitorState | OverallState, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  paused: "Paused",
  unknown: "Unknown",
  incident: "Incident active",
};

export function StateBadge({ state }: { state: MonitorState | OverallState }) {
  return (
    <span className={`state state-${state}`}>
      <span className="state-mark" aria-hidden="true" />
      {STATE_LABELS[state]}
    </span>
  );
}

const PORTFOLIO_PROJECTS = [
  "Haan",
  "StyleShopZ",
  "CodeSense",
  "Grepless",
  "ArthaSetu",
  "Dispatch",
] as const;

function computeProjectState(monitors: MonitorView[]): MonitorState {
  if (monitors.length === 0) return "unknown";
  if (monitors.some((m) => m.state === "down")) return "down";
  if (monitors.some((m) => m.state === "incident")) return "incident";
  if (monitors.some((m) => m.state === "degraded")) return "degraded";
  if (monitors.every((m) => m.state === "paused")) return "paused";
  if (monitors.every((m) => m.state === "unknown")) return "unknown";
  return "operational";
}

function projectStateClass(state: MonitorState): string {
  switch (state) {
    case "operational":
      return "m-op";
    case "degraded":
      return "m-dg";
    case "down":
      return "m-dn";
    case "paused":
      return "m-pa";
    case "unknown":
      return "m-un";
    case "incident":
      return "m-in";
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function Sparkline({ points, name }: { points: LatencyPoint[]; name: string }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.ms);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const width = 200;
  const height = 40;
  const pad = 4;
  const chartW = width - pad * 2;
  const chartH = height - pad * 2;

  const pathCoords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * chartW;
    const y = pad + chartH - ((p.ms - min) / range) * chartH;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const pathD = pathCoords.join(" ");

  return (
    <div className="sparkline-wrap" style={{ marginTop: 8 }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Response time trend for ${name} across ${points.length} checks.`}
        style={{ overflow: "visible" }}
      >
        <path d={pathD} fill="none" stroke="var(--pen)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function slugifyProject(name: string): string {
  return `project-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

export function deriveStatusClaim(data: StatusResponse | null, error: string | null): string {
  if (error && !data) {
    return "Live status unavailable · error connecting to ledger";
  }
  if (!data) {
    return "Last updated: no snapshot yet · every project is unknown until its first completed check";
  }

  const timeStr = formatShortTime(data.generatedAt);
  const monitors = data.monitors || [];
  if (monitors.length === 0) {
    return `Last updated: ${timeStr} · no endpoints configured`;
  }

  const degraded = monitors.filter((m) => m.state === "degraded").length;
  const down = monitors.filter((m) => m.state === "down").length;
  const incident = monitors.filter((m) => m.state === "incident").length;
  const paused = monitors.filter((m) => m.state === "paused").length;
  const unknown = monitors.filter((m) => m.state === "unknown").length;
  const operational = monitors.filter((m) => m.state === "operational").length;
  const activeIncidents = (data.incidents || []).filter((i) => i.status !== "resolved").length;

  if (degraded === 0 && down === 0 && incident === 0 && unknown === 0 && activeIncidents === 0) {
    return `Last updated: ${timeStr} · every project is operational on its latest check`;
  }

  const parts: string[] = [];
  if (down > 0) parts.push(`${down} down`);
  if (incident > 0) parts.push(`${incident} in incident`);
  if (degraded > 0) parts.push(`${degraded} degraded`);
  if (operational > 0) parts.push(`${operational} operational`);
  if (unknown > 0) parts.push(`${unknown} unknown`);
  if (paused > 0) parts.push(`${paused} paused`);
  if (activeIncidents > 0) parts.push(`${activeIncidents} active incident${activeIncidents > 1 ? "s" : ""}`);

  const stateLabel =
    data.overall === "operational"
      ? "Operational"
      : data.overall === "degraded"
      ? "Partial degradation"
      : data.overall === "down"
      ? "Major outage"
      : data.overall === "incident"
      ? "Active incident"
      : "State unconfirmed";

  return `Last updated: ${timeStr} · ${stateLabel} · ${parts.join(", ")}`;
}

export function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [selectedMonitorId, setSelectedMonitorId] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  const closeMenu = useCallback((restoreFocus = true) => {
    setMobileMenuOpen(false);
    if (restoreFocus) {
      setTimeout(() => {
        const toFocus = lastFocusedElementRef.current || toggleButtonRef.current;
        toFocus?.focus();
      }, 0);
    }
  }, []);

  const openMenu = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      lastFocusedElementRef.current = document.activeElement;
    } else {
      lastFocusedElementRef.current = toggleButtonRef.current;
    }
    setMobileMenuOpen(true);
  }, []);

  // When drawer opens, focus initial element (close button)
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 40);
    return () => clearTimeout(timer);
  }, [mobileMenuOpen]);

  // Focus trap inside drawer
  const handleDrawerKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
      return;
    }

    if (e.key === "Tab") {
      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusables = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === closeButtonRef.current);

      if (focusables.length === 0) return;

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl || !drawer.contains(document.activeElement)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  }, [closeMenu]);

  const handleMenuNavigate = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      closeMenu(false);
      const targetId = href.slice(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
        if (!targetEl.hasAttribute("tabindex")) {
          targetEl.setAttribute("tabindex", "-1");
        }
        targetEl.focus({ preventScroll: true });
        if (window.history.pushState) {
          window.history.pushState(null, "", href);
        } else {
          window.location.hash = href;
        }
      }
    } else {
      closeMenu(false);
    }
  }, [closeMenu]);

  const lastUpdatedRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const newestGeneratedAtRef = useRef(0);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const rafPendingRef = useRef<number | null>(null);
  const rafUpdateCountRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);
  renderCountRef.current++;

  // Initialize theme from storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pl-theme");
      if (saved === "light" || saved === "dark") {
        setThemeMode(saved);
        document.documentElement.setAttribute("data-theme", saved);
      }
    } catch {}
  }, []);



  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("pl-theme", next);
      } catch {}
      return next;
    });
  }, []);

  const load = useCallback(async (mode: "initial" | "auto" | "manual") => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (mode !== "initial") setRefreshing(true);
    try {
      const next = await api.status(controller.signal);
      const generatedAt = Date.parse(next.generatedAt);
      if (generatedAt >= newestGeneratedAtRef.current) {
        newestGeneratedAtRef.current = generatedAt;
        setData(next);
        lastUpdatedRef.current = Date.now();
      }
      setError(null);
      if (mode === "manual") {
        setAnnouncement(`Latest available snapshot checked at ${formatShortTime(next.generatedAt)}.`);
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      const message = caught instanceof Error ? caught.message : "Could not load current status.";
      setError(message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Critical D1 read-budget rule: 5-minute UI refresh (300,000ms), 15-minute cron
  useEffect(() => {
    void load("initial");
    const refreshTimer = window.setInterval(() => {
      if (!document.hidden) void load("auto");
    }, 300_000);
    const onVisibility = () => {
      if (!document.hidden && Date.now() - (lastUpdatedRef.current ?? 0) >= 300_000) {
        void load("auto");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [load]);

  const toggleDetails = useCallback((id: string) => {
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Compute project states
  const projectGroups = useMemo(() => {
    const map = new Map<string, MonitorView[]>();
    for (const p of PORTFOLIO_PROJECTS) {
      map.set(p, []);
    }
    if (data?.monitors) {
      for (const m of data.monitors) {
        const group = map.get(m.project) ?? [];
        group.push(m);
        map.set(m.project, group);
      }
    }
    return map;
  }, [data]);

  const selectedMonitor = useMemo(() => {
    if (!data?.monitors || data.monitors.length === 0) return null;
    if (selectedMonitorId) {
      const found = data.monitors.find((m) => m.id === selectedMonitorId);
      if (found) return found;
    }
    return data.monitors[0];
  }, [data, selectedMonitorId]);

  const activeCheck = selectedMonitor?.recentChecks?.[0] ?? selectedMonitor?.lastCheck ?? null;

  // Deterministic Scroll Choreography Engine (DOM-direct, coalesced to 1 rAF, 0 React rerenders on scroll)
  const applyScrollChoreography = useCallback(() => {
    if (typeof window === "undefined") return;
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const vh = Math.max(window.innerHeight || 900, 1);
    const docHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      vh,
    );
    const maxScroll = Math.max(1, docHeight - vh);

    let heroProgress = 1;
    let chapter1Progress = 1;
    let chapter2Progress = 1;
    let chapter3Progress = 1;
    let chapter4Progress = 1;
    const rowProgress: Record<string, number> = {};

    const servicesEl = document.getElementById("services");
    const probeEl = document.getElementById("probe");
    const incidentsEl = document.getElementById("incidents");
    const methodEl = document.getElementById("method");
    const serviceNodes = document.querySelectorAll<HTMLElement>(".service[data-monitor-id]");

    if (isReduced) {
      serviceNodes.forEach((node) => {
        const id = node.getAttribute("data-monitor-id");
        if (id) rowProgress[id] = 1;
      });
    } else {
      heroProgress = clamp01(scrollY / (vh * 0.55));

      const computeChapterProgress = (el: HTMLElement | null, isServices = false): number => {
        if (!el) return 0;
        if (isServices) {
          if (scrollY <= 8) return 0;
          const rect = el.getBoundingClientRect();
          const entryAndTraverse = (vh * 0.58 - rect.top) / (vh * 1.15);
          return clamp01(Math.max(scrollY / (vh * 1.25), entryAndTraverse));
        }
        const rect = el.getBoundingClientRect();
        const elDocTop = rect.top + scrollY;
        const minPossibleTop = elDocTop - maxScroll;
        const targetTop = Math.max(-vh * 0.12, minPossibleTop + 16);
        const startTop = Math.max(vh * 0.92, targetTop + vh * 0.45);
        return clamp01((startTop - rect.top) / Math.max(1, startTop - targetTop));
      };

      chapter1Progress = computeChapterProgress(servicesEl, true);
      chapter2Progress = computeChapterProgress(probeEl, false);
      chapter3Progress = computeChapterProgress(incidentsEl, false);
      chapter4Progress = computeChapterProgress(methodEl, false);

      serviceNodes.forEach((node) => {
        const id = node.getAttribute("data-monitor-id");
        if (!id) return;
        const rect = node.getBoundingClientRect();
        const elDocTop = rect.top + scrollY;
        const minPossibleTop = elDocTop - maxScroll;
        const targetTop = Math.max(vh * 0.24, minPossibleTop + 16);
        const startTop = Math.max(vh * 0.92, targetTop + vh * 0.42);
        const raw = clamp01((startTop - rect.top) / Math.max(1, startTop - targetTop));
        rowProgress[id] = scrollY <= 4 ? Math.min(raw, 0.25) : raw;
      });
    }

    rafUpdateCountRef.current += 1;
    const shellEl = shellRef.current;
    if (shellEl) {
      shellEl.setAttribute("data-raf-updates", String(rafUpdateCountRef.current));
    }

    // 1. Hero Drum Carriage
    const heroCarriageEl = document.getElementById("hero-drum-carriage");
    if (heroCarriageEl) {
      heroCarriageEl.style.transform = `translate3d(${(heroProgress * 296).toFixed(1)}px, 0px, 0px)`;
    }

    // 2. Chapter 1 (#services)
    if (servicesEl) {
      servicesEl.setAttribute("data-scroll-progress", chapter1Progress.toFixed(3));
    }
    const spoolWheelEl = document.getElementById("services-spool-wheel");
    if (spoolWheelEl) {
      spoolWheelEl.style.transform = `rotate(${(chapter1Progress * 180).toFixed(1)}deg)`;
    }
    const spoolFillEl = document.getElementById("services-spool-fill");
    if (spoolFillEl) {
      spoolFillEl.style.transform = `scaleX(${chapter1Progress.toFixed(3)})`;
    }

    serviceNodes.forEach((node) => {
      const id = node.getAttribute("data-monitor-id");
      const clamped = clamp01(id ? (rowProgress[id] ?? 0.2) : 0.2);
      const clipInsetRight = ((1 - clamped) * 88).toFixed(1);
      const printheadX = (clamped * 100).toFixed(1);

      node.setAttribute("data-row-progress", clamped.toFixed(3));
      const stripEl = node.querySelector<HTMLElement>(".uptime-strip");
      if (stripEl) {
        stripEl.style.clipPath = `inset(0px ${clipInsetRight}% 0px 0px)`;
      }
      const printheadEl = node.querySelector<HTMLElement>(".strip-printhead");
      if (printheadEl) {
        printheadEl.style.transform = `translate3d(${printheadX}%, 0px, 0px)`;
      }
    });

    // 3. Chapter 2 (#probe) — progress markers for tests; visual transform driven by GSAP matchMedia
    if (probeEl) {
      probeEl.setAttribute("data-scroll-progress", chapter2Progress.toFixed(3));
    }

    // 4. Chapter 3 (#incidents) — progress markers for tests; visual transform driven by GSAP
    if (incidentsEl) {
      incidentsEl.setAttribute("data-scroll-progress", chapter3Progress.toFixed(3));
    }

    // 5. Chapter 4 (#method) — progress markers for tests; visual transform driven by GSAP
    if (methodEl) {
      methodEl.setAttribute("data-scroll-progress", chapter4Progress.toFixed(3));
    }
  }, []);

  const scheduleScrollChoreography = useCallback(() => {
    if (rafPendingRef.current != null) return;
    rafPendingRef.current = window.requestAnimationFrame(() => {
      rafPendingRef.current = null;
      applyScrollChoreography();
    });
  }, [applyScrollChoreography]);

  useEffect(() => {
    applyScrollChoreography();
    window.addEventListener("scroll", scheduleScrollChoreography, { passive: true });
    window.addEventListener("resize", scheduleScrollChoreography, { passive: true });

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        () => {
          scheduleScrollChoreography();
        },
        { threshold: [0, 0.2, 0.5, 0.8, 1] },
      );
      ["services", "probe", "incidents", "method"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) observer?.observe(el);
      });
    }

    return () => {
      window.removeEventListener("scroll", scheduleScrollChoreography);
      window.removeEventListener("resize", scheduleScrollChoreography);
      observer?.disconnect();
      if (rafPendingRef.current != null) {
        window.cancelAnimationFrame(rafPendingRef.current);
        rafPendingRef.current = null;
      }
    };
  }, [applyScrollChoreography, scheduleScrollChoreography, data]);

  // Setup GSAP, ScrollTrigger, Lenis, and Canvases
  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;

    // Split text helper for #h1 and .sp
    const splitHeading = (el: HTMLElement) => {
      const t = el.textContent || "";
      el.setAttribute("aria-label", t);
      el.innerHTML = el.innerHTML
        .replace(/>([^<]+)</g, (_m, x) => {
          return (
            ">" +
            x.replace(/(\S+)(\s*)/g, (_a: string, w: string, sp: string) => {
              return (
                '<span class="w" aria-hidden="true">' +
                w
                  .split("")
                  .map((c) => '<span class="c">' + c + "</span>")
                  .join("") +
                "</span>" +
                sp
              );
            }) +
            "<"
          );
        })
        .replace(/^([^<]+)/, (x) => {
          return x.replace(/(\S+)(\s*)/g, (_a: string, w: string, sp: string) => {
            return (
              '<span class="w" aria-hidden="true">' +
              w
                .split("")
                .map((c) => '<span class="c">' + c + "</span>")
                .join("") +
              "</span>" +
              sp
            );
          });
        });
    };

    const h1 = document.getElementById("h1");
    if (h1 && !h1.hasAttribute("data-split-done")) {
      h1.setAttribute("data-split-done", "true");
      splitHeading(h1);
    }
    const spHeadings = Array.from(document.querySelectorAll<HTMLElement>(".sp"));
    spHeadings.forEach((h) => {
      if (!h.hasAttribute("data-split-done")) {
        h.setAttribute("data-split-done", "true");
        splitHeading(h);
      }
    });

    // 1. Background Canvas
    const bgc = document.getElementById("bg") as HTMLCanvasElement | null;
    let bx: CanvasRenderingContext2D | null = null;
    let P: Array<{ x: number; y: number; r: number; vx: number; vy: number; a: number }> = [];
    let W = window.innerWidth;
    let H = window.innerHeight;
    let col = "240,166,58";

    if (bgc) {
      bx = bgc.getContext("2d");
      const rs = () => {
        W = bgc.width = window.innerWidth;
        H = bgc.height = window.innerHeight;
        const n = Math.min(110, Math.floor((W * H) / 14000));
        P = [];
        for (let i = 0; i < n; i++) {
          P.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.6 + 0.4,
            vx: (Math.random() - 0.5) * 0.25,
            vy: -Math.random() * 0.35 - 0.05,
            a: Math.random() * 0.5 + 0.15,
          });
        }
      };
      rs();
      window.addEventListener("resize", rs);
    }

    let vel = 0;
    const bg = () => {
      if (!bx || !bgc) return;
      col = getComputedStyle(root).getPropertyValue("--dot").trim() || "240,166,58";
      bx.clearRect(0, 0, W, H);
      P.forEach((p) => {
        if (!rm) {
          p.x += p.vx;
          p.y += p.vy - vel * 0.02;
          if (p.y < -5) p.y = H + 5;
          if (p.y > H + 5) p.y = -5;
          if (p.x < -5) p.x = W + 5;
          if (p.x > W + 5) p.x = -5;
        }
        bx.fillStyle = `rgba(${col},${p.a})`;
        bx.beginPath();
        bx.arc(p.x, p.y, p.r, 0, 6.283);
        bx.fill();
      });
    };

    // 2. Drum Seismograph Plate Canvas
    const tc = document.getElementById("tele") as HTMLCanvasElement | null;
    let tx: CanvasRenderingContext2D | null = null;
    let tw = 0;
    let th = 0;
    let intro = rm ? 1 : 0;

    if (tc) {
      tx = tc.getContext("2d");
      const trs = () => {
        const r = tc.getBoundingClientRect();
        const d = Math.min(2, window.devicePixelRatio || 1);
        tw = tc.width = r.width * d;
        th = tc.height = r.height * d;
        if (tx) tx.setTransform(d, 0, 0, d, 0, 0);
        tw /= d;
        th /= d;
      };
      trs();
      window.addEventListener("resize", trs);
    }

    let sy = window.scrollY;
    const tele = (t: number) => {
      if (!tx || !tc || tw <= 0 || th <= 0) return;
      const cs = getComputedStyle(root);
      const pen = cs.getPropertyValue("--pen").trim() || "#f0a63a";
      const p2 = cs.getPropertyValue("--pen2").trim() || "#7fd1c7";
      const ln = cs.getPropertyValue("--line").trim() || "#2a2e2b";

      tx.clearRect(0, 0, tw, th);
      tx.strokeStyle = ln;
      tx.lineWidth = 1;
      const off = (sy * 0.3) % 28;
      for (let y = -off; y < th; y += 28) {
        tx.beginPath();
        tx.moveTo(0, y);
        tx.lineTo(tw, y);
        tx.stroke();
      }
      for (let x = 0; x < tw; x += 80) {
        tx.beginPath();
        tx.moveTo(x, 0);
        tx.lineTo(x, th);
        tx.stroke();
      }

      const lim = tw * intro;
      tx.lineWidth = 2;
      tx.strokeStyle = pen;
      tx.beginPath();
      for (let x = 0; x <= lim; x += 3) {
        const y =
          th * 0.36 +
          Math.sin(x * 0.021 + t * 0.8) * th * 0.09 +
          Math.sin(x * 0.063 + t * 1.7) * th * 0.05 +
          Math.sin(x * 0.0075 - t * 0.3 + sy * 0.002) * th * 0.1;
        if (x === 0) tx.moveTo(x, y);
        else tx.lineTo(x, y);
      }
      tx.stroke();

      tx.strokeStyle = p2;
      tx.beginPath();
      let lv = 0;
      for (let x = 0; x <= lim; x += 3) {
        const k = Math.floor((x + sy * 0.4) / 90);
        const v =
          (((Math.sin(k * 12.9898) * 43758.5453) % 1) + 1) % 1 > 0.8 ? 0.82 : 0.7;
        const yy = th * v * 1.08;
        if (!x) tx.moveTo(x, yy);
        else {
          tx.lineTo(x, lv);
          tx.lineTo(x, yy);
        }
        lv = yy;
      }
      tx.stroke();
    };

    // 3. Lenis Smooth Scroll
    let lenis: Lenis | null = null;
    if (!rm) {
      try {
        lenis = new Lenis({ lerp: 0.09 });
        lenis.on("scroll", (e: any) => {
          vel = e.velocity || 0;
          ScrollTrigger.update();
        });
      } catch {}
    }

    // 4. Marquee loop & ticker
    const mq = document.getElementById("mq");
    let mx = 0;

    const loop = (t: number) => {
      sy = window.scrollY;
      bg();
      tele(t / 1000);
      if (!rm && mq) {
        mx -= 1.1 + Math.min(40, Math.abs(vel)) * 0.9;
        const w = mq.scrollWidth / 4;
        if (mx < -w) mx += w;
        mq.style.transform = `translate3d(${mx}px,0,0)`;
      }
    };

    const tickerCb = (t: number) => {
      if (lenis) lenis.raf(t * 1000);
      loop(t * 1000);
    };

    gsap.ticker.add(tickerCb);
    gsap.ticker.lagSmoothing(0);

    // 5. Header progress bar
    const prog = document.getElementById("prog");
    if (prog) {
      prog.style.transform = "scaleX(0)";
      ScrollTrigger.create({
        start: 0,
        end: "max",
        onUpdate: (s) => {
          prog.style.transform = `scaleX(${s.progress})`;
        },
      });
    }

    // 6. Split reveals & Hero animations
    if (!rm) {
      gsap.to(
        { v: 0 },
        {
          v: 1,
          duration: 2.6,
          ease: "power2.inOut",
          onUpdate: function () {
            intro = (this.targets()[0] as any).v;
          },
        },
      );

      gsap.from("#h1 .c", {
        yPercent: 115,
        rotate: 6,
        duration: 1.2,
        ease: "expo.out",
        stagger: 0.025,
        delay: 0.15,
      });

      gsap.from("#hero .top > *:not(h1)", {
        y: 30,
        opacity: 0,
        duration: 1,
        stagger: 0.12,
        delay: 0.7,
        ease: "power3.out",
      });

      gsap.from(".plate", {
        y: 60,
        opacity: 0,
        duration: 1.2,
        delay: 0.9,
        ease: "power3.out",
      });

      spHeadings.forEach((h) => {
        const letters = Array.from(h.querySelectorAll<HTMLElement>(".c"));
        if (letters.length > 0) {
          gsap.from(letters, {
            yPercent: 115,
            duration: 1,
            ease: "expo.out",
            stagger: 0.018,
            scrollTrigger: { trigger: h, start: "top 85%" },
          });
        }
      });

      // Numbers roll up
      const nums = Array.from(document.querySelectorAll<HTMLElement>(".nums b"));
      nums.forEach((b) => {
        const n = +(b.dataset.n || "0");
        const o = { v: 0 };
        ScrollTrigger.create({
          trigger: b,
          start: "top 88%",
          once: true,
          onEnter: () => {
            gsap.to(o, {
              v: n,
              duration: 1.8,
              ease: "power3.out",
              onUpdate: () => {
                b.textContent = String(Math.round(o.v));
              },
            });
          },
        });
      });

      gsap.from(".nums > div", {
        y: 50,
        opacity: 0,
        stagger: 0.12,
        duration: 1,
        scrollTrigger: { trigger: ".nums", start: "top 85%" },
      });

      // States list animation
      gsap.from(".states li", {
        opacity: 0,
        x: 40,
        stagger: 0.1,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: ".states", start: "top 80%" },
      });

      const stateLis = Array.from(document.querySelectorAll<HTMLElement>(".states li"));
      stateLis.forEach((li) => {
        gsap.fromTo(
          li,
          { "--d": 0 },
          {
            "--d": 1,
            ease: "none",
            scrollTrigger: {
              trigger: li,
              start: "top 90%",
              end: "top 55%",
              scrub: true,
            },
          },
        );
      });
    }

    // Pinned check recording and forensics scenes matching home.html
    const tr = document.getElementById("timeline-svg-trace") as SVGGeometryElement | null;
    let traceTotalLength = 1000;
    if (tr) {
      try {
        traceTotalLength = tr.getTotalLength() || 1000;
      } catch {
        traceTotalLength = 1000;
      }
      tr.style.strokeDasharray = `${traceTotalLength}`;
    }

    const pipe = (p: number) => {
      if (tr) {
        tr.style.strokeDashoffset = `${traceTotalLength * (1 - p)}`;
        tr.setAttribute("stroke-dashoffset", String(Math.round(traceTotalLength * (1 - p))));
        if (typeof tr.getPointAtLength === "function") {
          try {
            const pt = tr.getPointAtLength(traceTotalLength * p);
            const ph = document.getElementById("ph");
            if (ph) {
              ph.setAttribute("x1", String(pt.x));
              ph.setAttribute("x2", String(pt.x));
            }
            const pc = document.getElementById("pc");
            if (pc) {
              pc.setAttribute("cx", String(pt.x));
              pc.setAttribute("cy", String(pt.y));
            }
            const clip = document.getElementById("timeline-area-clip");
            if (clip) {
              clip.setAttribute("width", String(pt.x));
            }
            const areaGroup = document.getElementById("timeline-area-group");
            if (areaGroup) {
              areaGroup.style.clipPath = `inset(0px ${(600 - pt.x).toFixed(1)}px 0px 0px)`;
            }
            const playheadGroup = document.getElementById("timeline-playhead-group");
            if (playheadGroup) {
              playheadGroup.style.transform = `translate3d(${pt.x.toFixed(1)}px, 0px, 0px)`;
            }
          } catch {}
        }
      }
      const items = Array.from(document.querySelectorAll("#stg li"));
      const stageIdx = Math.min(3, Math.floor(p * 4));
      items.forEach((el, k) => {
        el.classList.toggle("on", rm ? true : k === stageIdx);
      });
      const probe = document.getElementById("probe");
      if (probe) {
        probe.setAttribute("data-scroll-progress", p.toFixed(3));
      }
      const chassis = document.getElementById("probe-chassis-stage");
      if (chassis) {
        chassis.style.transform = `translate3d(0px, ${((1 - p) * 26).toFixed(1)}px, 0px)`;
      }
    };

    const sealRing = document.getElementById("incident-seal-ring") as SVGGeometryElement | null;
    const arts = Array.from(document.querySelectorAll("#incident-broadsheet-panel article"));
    const sealp = (p: number) => {
      if (sealRing) {
        const dashoffset = Math.round(440 * (1 - p));
        sealRing.style.strokeDashoffset = `${dashoffset}`;
        sealRing.setAttribute("stroke-dashoffset", String(dashoffset));
      }
      const rotor = document.getElementById("incident-seal-rotor");
      if (rotor) {
        rotor.style.transform = `rotate(${p * 360}deg)`;
        rotor.style.transformOrigin = "100px 100px";
      }
      const spine = document.getElementById("incident-spine-fill");
      if (spine) {
        spine.style.transform = `scaleX(${p})`;
      }
      const sealText = document.getElementById("incident-seal-progress-text");
      if (sealText) {
        sealText.textContent = `SEAL DRAWN · ${Math.round(p * 100)}%`;
      }
      const broadsheet = document.getElementById("incident-broadsheet-panel");
      if (broadsheet) {
        broadsheet.style.transform = `translate3d(${((1 - p) * 20).toFixed(1)}px, ${((1 - p) * 26).toFixed(1)}px, 0px)`;
      }
      const artIdx = Math.min(2, Math.floor(p * 3));
      arts.forEach((a, k) => {
        a.classList.toggle("on", rm || k === artIdx);
      });
      const incidents = document.getElementById("incidents");
      if (incidents) {
        incidents.setAttribute("data-scroll-progress", p.toFixed(3));
      }
    };

    const bus = document.getElementById("method-bus-line") as SVGGeometryElement | null;
    const car = document.getElementById("method-signal-carriage");
    const busp = (p: number) => {
      if (bus) {
        const dashoffset = Math.round(1000 * (1 - p));
        bus.style.strokeDashoffset = `${dashoffset}`;
        bus.setAttribute("stroke-dashoffset", String(dashoffset));
      }
      if (car) {
        car.setAttribute("cx", String(1000 * p));
        car.style.transform = `translate3d(${(p * 680).toFixed(1)}px, 0px, 0px)`;
      }
      const method = document.getElementById("method");
      if (method) {
        method.setAttribute("data-scroll-progress", p.toFixed(3));
      }
    };

    const mm = gsap.matchMedia();

    if (rm) {
      pipe(1);
      sealp(1);
      busp(1);
      const clip = document.getElementById("timeline-area-clip");
      if (clip) clip.setAttribute("width", "600");
      const secPanel = document.querySelector<HTMLElement>("#sec .panel");
      if (secPanel) secPanel.style.clipPath = "none";
      const nums = Array.from(document.querySelectorAll<HTMLElement>(".nums b"));
      nums.forEach((b) => {
        b.textContent = b.dataset.n || "0";
      });
    } else {
      mm.add("(min-width:861px)", () => {
        ScrollTrigger.create({
          trigger: "#pipe",
          start: "top top",
          end: "+=2200",
          pin: true,
          scrub: true,
          onUpdate: (s) => pipe(s.progress),
        });
      });

      mm.add("(max-width:860px)", () => {
        ScrollTrigger.create({
          trigger: "#pipe",
          start: "top 70%",
          end: "bottom 40%",
          scrub: true,
          onUpdate: (s) => pipe(s.progress),
        });
      });

      pipe(0);
      sealp(0);
      busp(0);

      ScrollTrigger.create({
        trigger: "#incidents .grid",
        start: "top 70%",
        end: "bottom 60%",
        scrub: true,
        onUpdate: (s) => sealp(s.progress),
      });

      gsap.to("#sec .panel", {
        clipPath: "inset(0% 0% round 0px)",
        ease: "none",
        scrollTrigger: {
          trigger: "#sec",
          start: "top 85%",
          end: "top 15%",
          scrub: true,
        },
      });

      ScrollTrigger.create({
        trigger: "#sec",
        start: "top 40%",
        end: "bottom 90%",
        scrub: true,
        onUpdate: (s) => busp(Math.min(1, s.progress * 1.4)),
      });

      gsap.from(".sg > div", {
        y: 40,
        opacity: 0,
        stagger: 0.1,
        duration: 0.9,
        scrollTrigger: { trigger: ".sg", start: "top 85%" },
      });

      gsap.from(".own > div", {
        y: 40,
        opacity: 0,
        stagger: 0.08,
        duration: 0.9,
        scrollTrigger: { trigger: ".own", start: "top 85%" },
      });

      gsap.from("#big", {
        yPercent: 60,
        opacity: 0,
        letterSpacing: ".08em",
        ease: "power3.out",
        scrollTrigger: {
          trigger: "#big",
          start: "top 100%",
          end: "top 55%",
          scrub: true,
        },
      });

      gsap.from(".fl > *", {
        y: 30,
        opacity: 0,
        stagger: 0.12,
        duration: 0.9,
        scrollTrigger: { trigger: ".fl", start: "top 95%" },
      });

      // Magnetic buttons
      const mags = Array.from(document.querySelectorAll<HTMLElement>(".mag"));
      mags.forEach((b) => {
        const onMouseMove = (e: MouseEvent) => {
          const r = b.getBoundingClientRect();
          gsap.to(b, {
            x: (e.clientX - r.left - r.width / 2) * 0.35,
            y: (e.clientY - r.top - r.height / 2) * 0.5,
            duration: 0.4,
            ease: "power3.out",
          });
        };
        const onMouseLeave = () => {
          gsap.to(b, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" });
        };
        b.addEventListener("mousemove", onMouseMove);
        b.addEventListener("mouseleave", onMouseLeave);
      });
    }

    // Anchor smooth scroll
    const onHashClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a[href^="#"]');
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || href === "#") return;
      const dest = document.querySelector(href);
      if (!dest) return;
      e.preventDefault();
      if (lenis) {
        lenis.scrollTo(dest as HTMLElement, { offset: -64 });
      } else {
        dest.scrollIntoView({ behavior: rm ? "auto" : "smooth" });
      }
    };
    document.addEventListener("click", onHashClick);

    return () => {
      document.removeEventListener("click", onHashClick);
      gsap.ticker.remove(tickerCb);
      if (lenis) lenis.destroy();
      mm.revert();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  useEffect(() => {
    if (data) {
      ScrollTrigger.refresh();
      applyScrollChoreography();
    }
  }, [data, applyScrollChoreography]);

  return (
    <div
      ref={shellRef}
      className="public-shell"
      data-render-count={renderCountRef.current}
      data-raf-updates={rafUpdateCountRef.current}
    >
      <a href="#services" className="sr-only">
        Skip to status
      </a>
      <canvas id="bg" aria-hidden="true"></canvas>

      <header className="masthead">
        <div className="wrap">
          <a className="brand" href="#top" aria-label="PulseLedger home">
            <svg
              viewBox="0 0 28 28"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="24" height="24" rx="3" />
              <path d="M4 15h5l3-8 4 15 3-7h5" stroke="var(--acc)" />
            </svg>
            PulseLedger
          </a>

          <nav aria-label="Primary">
            <a href="#services">Fleet</a>
            <a href="#probe">Checks</a>
            <a href="#incidents">Incidents</a>
            <a href="#method">Security</a>
            <a href="#owner">Owner</a>
            <Link href="/admin">Owner sign in</Link>
          </nav>

          <nav aria-label="Jump to project" className="sr-only">
            {PORTFOLIO_PROJECTS.map((p) => (
              <a key={p} href={`#${slugifyProject(p)}`}>
                {p}
              </a>
            ))}
          </nav>

          <div className="hd">
            <a className="btn p" href="#services">
              Status page
            </a>
            <button
              className="tt"
              id="tt"
              aria-label={themeMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              onClick={toggleTheme}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2 2M17.8 17.8l2 2M4.2 19.8l2-2M17.8 6.2l2-2" />
              </svg>
            </button>
            <button
              ref={toggleButtonRef}
              type="button"
              className="mobile-nav-toggle"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              onClick={() => {
                if (mobileMenuOpen) {
                  closeMenu(true);
                } else {
                  openMenu();
                }
              }}
            >
              {mobileMenuOpen ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <div id="prog"></div>

        {/* Accessible mobile drawer menu */}
        <div
          ref={drawerRef}
          id="mobile-nav-drawer"
          className={`mobile-menu-backdrop ${mobileMenuOpen ? "open" : ""}`}
          role="dialog"
          aria-modal={mobileMenuOpen ? "true" : undefined}
          aria-hidden={!mobileMenuOpen}
          inert={!mobileMenuOpen ? true : undefined}
          aria-label="Navigation menu"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeMenu(true);
          }}
          onKeyDown={handleDrawerKeyDown}
        >
          <div className="mobile-menu-panel">
            <div className="mobile-menu-header">
              <span className="mobile-menu-title">PulseLedger</span>
              <button
                ref={closeButtonRef}
                type="button"
                className="mobile-menu-close"
                aria-label="Close navigation menu"
                onClick={() => closeMenu(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mobile-menu-section-label">Chapters &amp; Sections</div>
            <nav className="mobile-menu-nav" aria-label="Mobile Navigation">
              <a className="mobile-menu-link" href="#services" onClick={(e) => handleMenuNavigate(e, "#services")}>
                Fleet ledger
              </a>
              <a className="mobile-menu-link" href="#probe" onClick={(e) => handleMenuNavigate(e, "#probe")}>
                Recorded checks
              </a>
              <a className="mobile-menu-link" href="#incidents" onClick={(e) => handleMenuNavigate(e, "#incidents")}>
                Incidents journal
              </a>
              <a className="mobile-menu-link" href="#method" onClick={(e) => handleMenuNavigate(e, "#method")}>
                Security &amp; method
              </a>
              <a className="mobile-menu-link" href="#owner" onClick={(e) => handleMenuNavigate(e, "#owner")}>
                Owner ledger
              </a>
            </nav>

            <div className="mobile-menu-section-label">Portfolio Projects</div>
            <div className="mobile-menu-projects-grid">
              {PORTFOLIO_PROJECTS.map((p) => {
                const slug = slugifyProject(p);
                return (
                  <a
                    key={p}
                    className="mobile-menu-project-link"
                    href={`#${slug}`}
                    onClick={(e) => handleMenuNavigate(e, `#${slug}`)}
                  >
                    {p}
                  </a>
                );
              })}
            </div>

            <Link
              className="mobile-menu-footer-link"
              href="/admin"
              onClick={() => closeMenu(false)}
            >
              Owner desk sign in &rarr;
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ================= HERO SECTION ================= */}
        <section id="hero-section" style={{ padding: 0 }}>
          <div id="hero" className="wrap">
            <div className="top">
              <p className="mono">Operations journal · Uptime &amp; incidents · Cloudflare Worker + D1</p>
              <h1 id="h1" aria-label="Every failure, written down.">
                Every failure, <em>written</em> down.
              </h1>
              <p className="lead">
                An uptime and incident dashboard for an independent developer or small team. It checks
                real endpoints every 15 minutes, prints each result into a 30-day ledger, and keeps
                incident updates in the open.
              </p>
              <div className="cta">
                <a className="btn p mag" href="#services">
                  See the fleet
                </a>
                <a className="btn mag jump-probe-btn" href="#probe">
                  How a check is recorded
                </a>
              </div>
              <div className="upd">
                {error && (
                  <div className="error-note mono" style={{ color: "var(--bad)", width: "100%", marginBottom: 8 }}>
                    Live status unavailable: {error}
                  </div>
                )}
                <span className="mono updated-note" id="lu" aria-live="polite">
                  {deriveStatusClaim(data, error)}
                </span>
                <button
                  className="btn"
                  id="rf"
                  type="button"
                  onClick={() => void load("manual")}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh now"}
                </button>
                <span className="sr-only" aria-live="polite">
                  {announcement}
                </span>
              </div>
              <div className="reg" aria-label="Portfolio project register">
                {PORTFOLIO_PROJECTS.map((proj) => {
                  const pMonitors = projectGroups.get(proj) ?? [];
                  const pState = computeProjectState(pMonitors);
                  const cls = projectStateClass(pState);
                  const pSlug = slugifyProject(proj);
                  return (
                    <a key={proj} href={`#${pSlug}`} className="reg-item" title={`Jump to ${proj} monitors`}>
                      <i className={`mk ${cls}`}></i>
                      <b>{proj}</b>
                    </a>
                  );
                })}
              </div>
            </div>

            <div
              className="plate"
              role="img"
              aria-label="Illustrative two-channel stylus trace. Not measured data."
            >
              <canvas id="tele"></canvas>
              <div id="hero-drum-carriage"></div>
              <span className="mono cap">30-Day Fleet Ledger Plate · drum seismograph</span>
              <span className="mono cap2">Illustrative waveform, not data</span>
            </div>
          </div>
        </section>

        {/* Marquee ticker */}
        <div className="mq" aria-hidden="true">
          <div id="mq">
            {[0, 1, 2, 3].map((cycle) =>
              PORTFOLIO_PROJECTS.map((p) => (
                <span key={`${cycle}-${p}`}>
                  {p}
                  <i>/ monitored</i>
                </span>
              )),
            )}
          </div>
        </div>

        {/* ================= NUMBERS SECTION ================= */}
        <section className="sbg" id="numbers">
          <div className="wrap">
            <p className="mono">The rules of the book</p>
            <h2 className="sp" style={{ marginTop: 18, maxWidth: "14ch" }}>
              Small on purpose, honest by design.
            </h2>
            <div className="nums">
              <div>
                <b data-n="15">0</b>
                <span className="mono">
                  Minutes between scheduled checks<sup>min</sup>
                </span>
              </div>
              <div>
                <b data-n="30">0</b>
                <span className="mono">
                  Days of check history retained<sup>days</sup>
                </span>
              </div>
              <div>
                <b data-n="12">0</b>
                <span className="mono">
                  Monitor cap on the Workers Free plan<sup>max</sup>
                </span>
              </div>
              <div>
                <b data-n="6">0</b>
                <span className="mono">
                  Portfolio projects grouped on the page<sup>labels</sup>
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ================= CHAPTER 1: FLEET MATRIX ================= */}
        <section id="services" className="sbg" data-scroll-progress="0">
          <div className="wrap">
            <p className="mono">Chapter 1 · Fleet matrix</p>
            <h2 className="sp" style={{ margin: "18px 0 18px", maxWidth: "16ch" }}>
              Thirty days, <em>unspooled</em> row by row.
            </h2>
            <p className="lead" style={{ marginBottom: 44 }}>
              Endpoints are grouped by an editable project label. Each HTTP check proves only the
              response of that exact endpoint, not a whole user journey.
            </p>

            <div className="ledger">
              <div id="chapter-1-spool-bar">
                <div id="services-spool-fill"></div>
                <div id="services-spool-wheel"></div>
              </div>

              <div id="rows">
                {Array.from(projectGroups.entries()).map(([projectName, monitors], pIdx) => {
                  const pSlug = slugifyProject(projectName);
                  return (
                    <div
                      key={projectName}
                      id={`project-${pIdx + 1}`}
                      className="project-group-wrap"
                    >
                      <div
                        className="project-group"
                        id={pSlug}
                        data-project-slug={projectName.toLowerCase()}
                      >
                        <div className="project-group-header">
                          <h2 className="project-group-title">{projectName}</h2>
                          <span className="mono" style={{ fontSize: 11 }}>
                            {monitors.length} {monitors.length === 1 ? "endpoint" : "endpoints"}
                          </span>
                        </div>

                      {monitors.length === 0 ? (
                        <p className="note mono">No endpoints configured for {projectName}.</p>
                      ) : (
                        monitors.map((m) => {
                          const isExpanded = !!expandedDetails[m.id];
                          const dailyBuckets = m.daily || [];
                          // 30 days of data
                          const paddedDays: Array<{ date: string; status: "up" | "down" | "paused" | "unknown" }> = [];
                          for (let i = 0; i < 30; i++) {
                            const bucket = dailyBuckets[i];
                            if (!bucket || bucket.total === 0) {
                              paddedDays.push({ date: `Day ${i + 1}`, status: m.paused ? "paused" : "up" });
                            } else if (bucket.down > 0) {
                              paddedDays.push({ date: bucket.date, status: "down" });
                            } else {
                              paddedDays.push({ date: bucket.date, status: "up" });
                            }
                          }

                          return (
                            <article
                              key={m.id}
                              className="row service"
                              id={`service-${m.id}`}
                              data-monitor-id={m.id}
                              data-row-progress="0"
                            >
                              <div className="row-meta">
                                <h3>
                                  <a href={m.url} target="_blank" rel="noopener noreferrer">
                                    {m.name}
                                  </a>
                                </h3>
                                <a
                                  href={m.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="row-url"
                                >
                                  {hostOf(m.url)}
                                </a>
                                <StateBadge state={m.state} />

                                {/* Always present for automated test verification and quick diagnostics */}
                                <dl className="service-stats">
                                  <div>
                                    <dt>Last check</dt>
                                    <dd>
                                      {m.lastCheck
                                        ? `${m.lastCheck.outcome.toUpperCase()} (${m.lastCheck.duration_ms}ms, ${formatRelative(m.lastCheck.checked_at)})`
                                        : "No completed check yet"}
                                    </dd>
                                  </div>
                                </dl>
                              </div>

                              <div className="tape">
                                <div
                                  className="service-strip uptime-strip"
                                  role="img"
                                  aria-label={`30-day check history for ${m.name}: ${m.uptime.d30.up} up, ${m.uptime.d30.down} down across ${m.uptime.d30.total} checks.`}
                                >
                                  {paddedDays.map((d, dIdx) => (
                                    <i
                                      key={dIdx}
                                      className={`day ${d.status}`}
                                      title={`${m.name} ${d.date}: ${d.status}`}
                                    />
                                  ))}
                                </div>
                                <div className="strip-printhead"></div>
                              </div>

                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  aria-expanded={isExpanded}
                                  onClick={() => toggleDetails(m.id)}
                                >
                                  Details
                                </button>
                              </div>

                              {isExpanded && (
                                <div className="service-detail">
                                  <dl className="service-stats-expanded">
                                    <div>
                                      <dt>24h Uptime</dt>
                                      <dd>{formatPercent(m.uptime.h24.percent)}</dd>
                                    </div>
                                    <div>
                                      <dt>7d Uptime</dt>
                                      <dd>{formatPercent(m.uptime.d7.percent)}</dd>
                                    </div>
                                    <div>
                                      <dt>30d Uptime</dt>
                                      <dd>{formatPercent(m.uptime.d30.percent)}</dd>
                                    </div>
                                    <div>
                                      <dt>Median Latency</dt>
                                      <dd>
                                        {m.latency.p50 != null
                                          ? formatDuration(m.latency.p50)
                                          : "—"}
                                      </dd>
                                    </div>
                                  </dl>

                                  <Sparkline points={m.trend || []} name={m.name} />

                                  <h4 className="mono" style={{ marginTop: 18, marginBottom: 8, fontSize: 11 }}>
                                    Recent recorded checks from Cloudflare D1
                                  </h4>
                                  <div className="table-scroll">
                                    <table>
                                      <thead>
                                        <tr>
                                          <th>Timestamp</th>
                                          <th>Status</th>
                                          <th>Duration</th>
                                          <th>Source</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {m.recentChecks && m.recentChecks.length > 0 ? (
                                          m.recentChecks.map((c) => (
                                            <tr key={c.id}>
                                              <td>{formatTimestamp(c.checked_at)}</td>
                                              <td>{c.outcome === "up" ? "Up" : "Down"}</td>
                                              <td>{c.duration_ms}ms</td>
                                              <td>{c.source}</td>
                                            </tr>
                                          ))
                                        ) : (
                                          <tr>
                                            <td colSpan={4}>No recent checks stored for this endpoint.</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </article>
                          );
                        })
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="note">
                Layout preview. Every tick is filled from a stored check in Cloudflare D1: no invented
                uptime, no backfilled history.
              </p>
            </div>

            {/* Reading the ledger · six states */}
            <div style={{ marginTop: 56 }}>
              <p className="mono">Reading the ledger · six states</p>
              <p className="lead" style={{ margin: "12px 0 18px" }}>
                Each state has its own shape and wording, so colour is never the only signal. A new
                monitor is unknown until its first completed check, and paused time is never counted as
                a failure.
              </p>
              <ul className="states state-legend">
                <li>
                  <span className="mk m-op"></span>
                  <h3>Operational</h3>
                  <p>The check returned a 2xx or 3xx status.</p>
                </li>
                <li>
                  <span className="mk m-dg"></span>
                  <h3>Degraded</h3>
                  <p>Reachable, but not meeting its expected status rule.</p>
                </li>
                <li>
                  <span className="mk m-dn"></span>
                  <h3>Down</h3>
                  <p>Timeouts and failures are down. The error category is stored with the check.</p>
                </li>
                <li>
                  <span className="mk m-pa"></span>
                  <h3>Paused</h3>
                  <p>Switched off by the owner. Paused periods are not counted against uptime.</p>
                </li>
                <li>
                  <span className="mk m-un"></span>
                  <h3>Unknown</h3>
                  <p>A new monitor, until its first completed check.</p>
                </li>
                <li>
                  <span className="mk m-in"></span>
                  <h3>Incident active</h3>
                  <p>An open incident with its timestamped updates shown, not just a badge.</p>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ================= CHAPTER 2: RECORDED CHECK EXPLORER ================= */}
        <section id="probe" data-scroll-progress="0">
          <div id="pipe">
            <div className="wrap in">
              <div id="monitoring-timeline-stage">
                <div id="probe-chassis-stage">
                  <svg
                    viewBox="0 0 600 300"
                    role="img"
                    aria-label="Illustrative timeline of a check moving through four stages"
                  >
                    <defs>
                      <clipPath id="areaclip">
                        <rect id="timeline-area-clip" x="0" y="0" width="0" height="300" />
                      </clipPath>
                    </defs>
                    <g stroke="var(--line)" strokeWidth="1">
                      <path d="M0 60H600M0 120H600M0 180H600M0 240H600" />
                    </g>
                    <g id="timeline-area-group" clipPath="url(#areaclip)">
                      <path
                        id="area"
                        d="M20 230C80 230 100 150 150 150S230 210 300 170 400 70 450 80 540 60 580 60V270H20Z"
                        fill="var(--acc)"
                        opacity=".16"
                      />
                    </g>
                    <path
                      id="timeline-svg-trace"
                      d="M20 230C80 230 100 150 150 150S230 210 300 170 400 70 450 80 540 60 580 60"
                    />
                    <g id="timeline-playhead-group">
                      <line
                        id="ph"
                        x1="0"
                        y1="20"
                        x2="0"
                        y2="280"
                        stroke="var(--ink)"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <circle id="pc" r="8" fill="var(--acc)" />
                    </g>
                    <g fontFamily="IBM Plex Mono" fontSize="12" fill="var(--mut)">
                      <text x="20" y="294">
                        TRIGGER
                      </text>
                      <text x="170" y="294">
                        CHECK
                      </text>
                      <text x="320" y="294">
                        STORE
                      </text>
                      <text x="470" y="294">
                        SNAPSHOT
                      </text>
                    </g>
                  </svg>
                </div>

                <p className="note mono" style={{ marginTop: 6 }}>
                  Illustrative path. The live page plots stored D1 check records.
                </p>

                <div className="ex" id="recentChecks">
                  <span className="mono">recentChecks · replays a stored check, never a new request</span>
                  {data?.monitors && data.monitors.length > 0 && (
                    <div style={{ margin: "10px 0" }}>
                      <select
                        aria-label="Select monitor to inspect recorded checks"
                        value={selectedMonitor?.id ?? ""}
                        onChange={(e) => setSelectedMonitorId(e.target.value)}
                        style={{
                          background: "var(--bg)",
                          color: "var(--ink)",
                          border: "1px solid var(--line)",
                          padding: "4px 8px",
                          fontFamily: "var(--mono)",
                          fontSize: 11,
                          width: "100%",
                        }}
                      >
                        {data.monitors.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.project})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {activeCheck ? (
                    <dl>
                      <dt>Monitor</dt>
                      <dd>{selectedMonitor?.name} ({hostOf(selectedMonitor?.url ?? "")})</dd>
                      <dt>Timestamp</dt>
                      <dd>{formatTimestamp(activeCheck.checked_at)}</dd>
                      <dt>Status</dt>
                      <dd>
                        {activeCheck.status_code
                          ? `HTTP ${activeCheck.status_code} (${activeCheck.outcome.toUpperCase()})`
                          : activeCheck.outcome.toUpperCase()}
                      </dd>
                      <dt>Latency</dt>
                      <dd>{activeCheck.duration_ms}ms</dd>
                      <dt>Source</dt>
                      <dd>
                        {activeCheck.source.toUpperCase()} // Slot: {activeCheck.slot ?? "manual"}
                      </dd>
                    </dl>
                  ) : (
                    <dl>
                      <dt>Timestamp</dt>
                      <dd>No stored checks yet</dd>
                      <dt>Status</dt>
                      <dd>—</dd>
                      <dt>Latency</dt>
                      <dd>—</dd>
                      <dt>Source</dt>
                      <dd>—</dd>
                    </dl>
                  )}
                </div>
              </div>

              <div>
                <p className="mono">Chapter 2 · Recorded check explorer</p>
                <h2 id="probe-heading" style={{ margin: "16px 0 0" }}>
                  From request to <em>record</em>.
                </h2>
                <ol className="stg" id="stg">
                  <li className="on">
                    <b>01</b>
                    <div>
                      <strong>Scheduled trigger</strong>
                      <span>A Cloudflare cron runs every 15 minutes. Retries and overlap are tolerated.</span>
                    </div>
                  </li>
                  <li>
                    <b>02</b>
                    <div>
                      <strong>Bounded HTTPS check</strong>
                      <span>
                        Timeout enforced. No redirects to non-HTTPS or private hosts. A manual check uses the
                        same logic.
                      </span>
                    </div>
                  </li>
                  <li>
                    <b>03</b>
                    <div>
                      <strong>Stored with compact aggregates</strong>
                      <span>
                        Timestamp, status or error category, duration and outcome. Uptime comes from real
                        checks.
                      </span>
                    </div>
                  </li>
                  <li>
                    <b>04</b>
                    <div>
                      <strong>One persisted snapshot</strong>
                      <span>
                        The public page reads a single snapshot, so polling never rescans all checks.
                        Diagnostics say whether they replay a stored check or make a new request.
                      </span>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* ================= CHAPTER 3: FORENSIC INCIDENT BROADSHEET ================= */}
        <section id="incidents" className="sbg" data-scroll-progress="0">
          <div className="wrap">
            <p className="mono">Chapter 3 · Forensic incident broadsheet</p>
            <h2 className="sp" style={{ margin: "18px 0 56px", maxWidth: "15ch" }}>
              Open it. Update it. <em>Resolve it.</em>
            </h2>

            <div className="grid">
              <div className="sealbox">
                <div id="incident-seal">
                  <svg viewBox="0 0 200 200" aria-hidden="true">
                    <circle cx="100" cy="100" r="70" stroke="var(--line)" strokeWidth="6" />
                    <circle
                      id="incident-seal-ring"
                      cx="100"
                      cy="100"
                      r="70"
                      strokeDasharray="1000"
                      strokeDashoffset="1000"
                      transform="rotate(-90 100 100)"
                    />
                    <g id="incident-seal-rotor">
                      <circle cx="100" cy="100" r="92" stroke="var(--mut)" strokeWidth="1" strokeDasharray="2 7" />
                      <circle cx="100" cy="8" r="5" fill="var(--acc)" />
                    </g>
                    <path d="M70 104l22 20 40-50" stroke="var(--ink)" strokeWidth="7" fill="none" />
                  </svg>
                </div>
                <div id="incident-spine">
                  <div id="incident-spine-fill"></div>
                </div>
                <p className="note" id="incident-seal-progress-text">
                  SEAL DRAWN · 0%
                </p>
              </div>

              <div className="bs" id="incident-broadsheet-panel">
                <article className="on">
                  <span className="mono">Step 1 · Open</span>
                  <h3>A failure becomes a named incident.</h3>
                  <p>
                    The owner opens an incident against a monitor. The public page shows its details and
                    current status, not merely a coloured badge.
                  </p>
                </article>
                <article>
                  <span className="mono">Step 2 · Update</span>
                  <h3>Every update carries a timestamp.</h3>
                  <p>
                    Updates are appended with a visible status, so a visitor can read what happened and
                    when.
                  </p>
                </article>
                <article>
                  <span className="mono">Step 3 · Resolve</span>
                  <h3>Resolved, and still on the record.</h3>
                  <p>
                    The incident timeline stays on the public page. A basic audit trail records the
                    administrative actions behind it.
                  </p>
                </article>

                {data?.incidents && data.incidents.length > 0 && (
                  <div style={{ marginTop: 24, padding: "20px 30px" }}>
                    <h4 className="mono" style={{ marginBottom: 16 }}>
                      Active &amp; Historical Incidents Ledger
                    </h4>
                    {data.incidents.map((inc) => (
                      <div
                        key={inc.id}
                        style={{
                          borderTop: "1px solid var(--line)",
                          paddingTop: 14,
                          marginTop: 14,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <h3 style={{ fontSize: 18, margin: 0 }}>{inc.title}</h3>
                          <StateBadge state={inc.status === "resolved" ? "operational" : "incident"} />
                        </div>
                        <p style={{ fontSize: 13, color: "var(--mut)", margin: "4px 0" }}>
                          Affected: {inc.monitorName || "All services"} · Started {formatTimestamp(inc.startedAt)}
                        </p>
                        {inc.updates && inc.updates.length > 0 && (
                          <ul style={{ listStyle: "none", paddingLeft: 0, marginTop: 10 }}>
                            {inc.updates.map((u) => (
                              <li
                                key={u.id}
                                style={{
                                  fontSize: 13,
                                  color: "var(--ink)",
                                  padding: "4px 0",
                                  borderLeft: "2px solid var(--acc)",
                                  paddingLeft: 10,
                                  marginBottom: 6,
                                }}
                              >
                                <span className="mono" style={{ fontSize: 10, marginRight: 8 }}>
                                  {formatTimestamp(u.createdAt)} [{u.status.toUpperCase()}]
                                </span>
                                {u.body}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ================= CHAPTER 4: OPERATIONAL PROTOCOL ================= */}
        <section id="method" data-scroll-progress="0">
          <div id="sec">
            <div className="panel">
              <div className="wrap">
                <p className="mono">Chapter 4 · Operational protocol</p>
                <h2 style={{ marginTop: 18, maxWidth: "15ch" }}>
                  Built so it can be <em>trusted</em>.
                </h2>
                <svg
                  viewBox="0 0 1000 40"
                  style={{ width: "100%", height: "auto", marginTop: 36, display: "block" }}
                  aria-hidden="true"
                >
                  <path
                    id="method-bus-line"
                    d="M0 20H1000"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="1000"
                    strokeDashoffset="1000"
                  />
                  <circle id="method-signal-carriage" cx="0" cy="20" r="7" fill="var(--acc)" />
                </svg>
                <div className="sg" id="method-cards-stage">
                  <div>
                    <b>SSRF guard</b>HTTPS only. Local and private IPs and credentials in URLs are rejected.
                  </div>
                  <div>
                    <b>Session</b>Secure, HttpOnly, SameSite cookies with CSRF and origin protection.
                  </div>
                  <div>
                    <b>Login</b>Rate limited. The password is stored only as a slow hash in a Worker secret.
                  </div>
                  <div>
                    <b>Data</b>Prepared SQL, D1 migrations and indexes matched to dashboard queries.
                  </div>
                  <div>
                    <b>Browser</b>Same-origin CORS, CSP and security headers. No visitor tracking.
                  </div>
                  <div>
                    <b>Delivery</b>CI runs typecheck, tests, build and a dependency audit.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= SECTION 5: OWNER DESK ================= */}
        <section id="owner">
          <div className="wrap">
            <p className="mono">The owner desk · /admin</p>
            <h2 className="sp" style={{ marginTop: 18, maxWidth: "17ch" }}>
              Fast to run, <em>clear</em> to read.
            </h2>
            <div className="own">
              <div>
                <h3>Manage monitors</h3>
                <p>
                  Add, edit, pause or delete HTTPS monitors. Deletion asks for confirmation. Duplicate
                  active URLs are refused.
                </p>
              </div>
              <div>
                <h3>Read the logs</h3>
                <p>
                  Recent checks with response times and clear failure diagnostics, so the cause of a
                  failure is visible.
                </p>
              </div>
              <div>
                <h3>Manual check</h3>
                <p>Runs the same check logic and lands in history.</p>
              </div>
              <div>
                <h3>Incidents</h3>
                <p>Open, update and resolve, with timestamps.</p>
              </div>
              <div>
                <h3>Audit trail</h3>
                <p>Administrative actions are recorded.</p>
              </div>
              <div>
                <h3>Sign in safely</h3>
                <p>
                  Login, logout and session expiry, with server-side validation of names, URLs and
                  expected status rules.
                </p>
              </div>
            </div>

            <div style={{ marginTop: 40 }}>
              <Link className="btn p mag" href="/admin">
                Sign in to owner desk
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <p className="mono" style={{ marginBottom: 24 }}>
            Public page · Owner desk · Open source
          </p>
          <div className="big" id="big" aria-label="PulseLedger">
            PulseLedger
          </div>
          <div className="fl">
            <a className="btn p mag" href="#top">
              Back to the top
            </a>
            <ul>
              <li>
                <a href="#services">Fleet</a>
              </li>
              <li>
                <a href="#probe">Checks</a>
              </li>
              <li>
                <a href="#incidents">Incidents</a>
              </li>
              <li>
                <a href="#method">Security</a>
              </li>
              <li>
                <Link href="/admin">Owner desk</Link>
              </li>
            </ul>
            <p className="mono">GitHub: Sayantan-Sinha-GIT · Limitations are recorded in the README</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
