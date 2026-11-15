import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FC,
} from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  AlertOctagon,
  X,
  ExternalLink,
  Bell,
  Clock,
  Layers,
} from 'lucide-react';
import { useAlertWatcher } from '../../hooks/useAlertWatcher';
import {
  selectNewAlerts,
  sortAlerts,
  severityLabel,
} from '../../lib/alertPopups';
import type { Alert } from '../../api/types';

interface ToastItemProps {
  alert: Alert;
  callsign: string;
  usingMock: boolean;
  onDismiss: (id: string) => void;
}

const TOAST_DURATION_MS = 12000;

const ToastItem: FC<ToastItemProps> = ({
  alert,
  callsign,
  usingMock,
  onDismiss,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TOAST_DURATION_MS);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  useEffect(() => {
    const tickInterval = 100;
    const interval = setInterval(() => {
      if (!isPausedRef.current) {
        setTimeLeft((prev) => {
          const next = prev - tickInterval;
          if (next <= 0) {
            clearInterval(interval);
            onDismiss(alert.id);
            return 0;
          }
          return next;
        });
      }
    }, tickInterval);

    return () => clearInterval(interval);
  }, [alert.id, onDismiss]);

  const progressPercent = Math.max(0, Math.min(100, (timeLeft / TOAST_DURATION_MS) * 100));
  const isWarning = alert.severity === 'warning';
  const badgeClasses = isWarning
    ? 'bg-amber-950/80 text-amber-300 border-amber-700/80'
    : 'bg-amber-900/40 text-amber-200 border-amber-600/60';

  return (
    <div
      className={`alert-toast ${isWarning ? 'is-warning' : 'is-watch'} text-slate-100 flex flex-col gap-2.5`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      tabIndex={0}
      role="status"
    >
      {/* Top Header: Severity + Callsign + Close */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-bold tracking-wider uppercase border ${badgeClasses}`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            {severityLabel(alert.severity)}
          </span>
          <span className="font-mono text-sm font-semibold text-slate-200">
            {callsign}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(alert.id)}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          aria-label={`Dismiss ${alert.severity} alert for ${callsign}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Biometric Divergence & Risk Window */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-300">
        <span>
          CRI {alert.criFrom.toFixed(1)} &rarr; {alert.criTo.toFixed(1)}
        </span>
        <span className="flex items-center gap-1 text-slate-400 text-[11px]">
          <Clock className="w-3 h-3 text-cyan-400" />
          ~{alert.predictedWindowHours} h risk window
        </span>
      </div>

      {/* Driver Chips */}
      {alert.drivers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {alert.drivers.slice(0, 2).map((driver, idx) => (
            <span
              key={idx}
              className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/80 text-slate-300"
            >
              {driver}
            </span>
          ))}
        </div>
      )}

      {/* Alert Message */}
      <p className="text-xs text-slate-300 font-sans leading-relaxed">
        {alert.message}
      </p>

      {/* Footer Disclaimer & Offline Badge */}
      <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between gap-2 text-[10px] text-slate-400">
        <span className="italic leading-tight">
          Risk flag and suggested countermeasures only. Not a medical diagnosis.
        </span>
        {usingMock && (
          <span className="synthetic-chip shrink-0">Offline mock data</span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Link
          to={`/alert/${alert.crewId}`}
          onClick={() => onDismiss(alert.id)}
          className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-mono font-medium bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 transition-colors"
        >
          <span>View alert</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
        <button
          type="button"
          onClick={() => onDismiss(alert.id)}
          className="px-2.5 py-1 rounded text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          Dismiss
        </button>
      </div>

      {/* 12s Auto-Dismiss Progress Bar */}
      <div
        className="alert-toast-progress text-amber-500"
        style={{ width: `${progressPercent}%` }}
      />
    </div>
  );
};

export const AlertPopupHost: FC = () => {
  const { sol, alerts, callsigns, usingMock } = useAlertWatcher();
  const seenRef = useRef<Record<string, number>>({});
  const prevSolRef = useRef<number>(sol);

  const [toastQueue, setToastQueue] = useState<Alert[]>([]);
  const [criticalAlert, setCriticalAlert] = useState<Alert | null>(null);

  const dismissBtnRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // Monitor alerts and sol changes
  useEffect(() => {
    // If sol is LOWER than previous sol (replay restarted/stepped back), reset seen
    if (sol < prevSolRef.current) {
      seenRef.current = {};
    }
    prevSolRef.current = sol;

    const { fresh, nextSeen } = selectNewAlerts(alerts, seenRef.current);
    seenRef.current = nextSeen;

    if (fresh.length > 0) {
      const sorted = sortAlerts(fresh);
      const criticals = sorted.filter((a) => a.severity === 'critical');
      const nonCriticals = sorted.filter((a) => a.severity !== 'critical');

      if (criticals.length > 0) {
        setCriticalAlert(criticals[0]);
      }

      if (nonCriticals.length > 0) {
        setToastQueue((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const toAdd = nonCriticals.filter((a) => !existingIds.has(a.id));
          return [...prev, ...toAdd];
        });
      }
    }
  }, [alerts, sol]);

  // Focus trap and Escape key listener for critical modal
  useEffect(() => {
    if (criticalAlert) {
      prevFocusRef.current = document.activeElement as HTMLElement;
      // Focus moves to dismiss button on open
      setTimeout(() => {
        dismissBtnRef.current?.focus();
      }, 30);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          setCriticalAlert(null);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        // Focus returns to previous element on close
        prevFocusRef.current?.focus();
      };
    }
  }, [criticalAlert]);

  const handleDismissToast = useCallback((id: string) => {
    setToastQueue((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleDismissCritical = useCallback(() => {
    setCriticalAlert(null);
  }, []);

  const visibleToasts = toastQueue.slice(0, 3);
  const hiddenCount = toastQueue.length - visibleToasts.length;

  return (
    <div className="alert-popup-host" aria-label="Global Risk Alert Popups">
      {/* Critical Alert Modal (takes over visually) */}
      {criticalAlert && (
        <div
          className="critical-modal-backdrop"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="critical-alert-title"
        >
          <div className="critical-modal-card text-slate-100 flex flex-col gap-4">
            {/* Header: Severity Badge + Callsign + Close */}
            <div className="flex items-center justify-between border-b border-red-900/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold tracking-wider uppercase bg-red-950/90 text-red-300 border border-red-700 shadow-md shadow-red-950/50">
                  <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />
                  {severityLabel('critical')}
                </span>
                <h2
                  id="critical-alert-title"
                  className="font-mono text-base font-bold text-white tracking-tight"
                >
                  {callsigns[criticalAlert.crewId] || criticalAlert.crewId}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleDismissCritical}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                aria-label="Close critical alert dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* CRI Drop & Window */}
            <div className="flex items-center justify-between font-mono text-sm bg-red-950/30 p-2.5 rounded-lg border border-red-900/40 text-red-200">
              <span className="font-semibold">
                CRI {criticalAlert.criFrom.toFixed(1)} &rarr; {criticalAlert.criTo.toFixed(1)}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-red-300">
                <Clock className="w-3.5 h-3.5 text-red-400" />
                ~{criticalAlert.predictedWindowHours} h risk window
              </span>
            </div>

            {/* Drivers */}
            {criticalAlert.drivers.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Identified Stress Factors:
                </span>
                <div className="flex flex-wrap gap-2">
                  {criticalAlert.drivers.slice(0, 2).map((d, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 text-xs font-mono rounded bg-slate-900 border border-red-800/80 text-red-300 font-medium"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Alert Message */}
            <p className="text-sm text-slate-200 font-sans leading-relaxed">
              {criticalAlert.message}
            </p>

            {/* Mandatory Disclaimer & Mock Badge */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-400">
              <p className="italic text-[11px] leading-tight">
                Risk flag and suggested countermeasures only. Not a medical diagnosis.
              </p>
              {usingMock && (
                <span className="synthetic-chip shrink-0">Offline mock data</span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                ref={dismissBtnRef}
                type="button"
                onClick={handleDismissCritical}
                className="px-4 py-2 rounded-lg text-xs font-mono font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
              >
                Dismiss
              </button>
              <Link
                to={`/alert/${criticalAlert.crewId}`}
                onClick={handleDismissCritical}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-bold bg-red-600 hover:bg-red-500 text-white transition-colors shadow-lg shadow-red-950/60"
              >
                <span>View alert</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Non-Critical Toast Stack (watch / warning) */}
      <div
        className="alert-toast-stack"
        role="status"
        aria-live="polite"
      >
        {visibleToasts.map((alert) => (
          <ToastItem
            key={alert.id}
            alert={alert}
            callsign={callsigns[alert.crewId] || alert.crewId}
            usingMock={usingMock}
            onDismiss={handleDismissToast}
          />
        ))}

        {/* Overflow Indicator for more than 3 visible toasts */}
        {hiddenCount > 0 && (
          <div className="pointer-events-auto flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-xs font-mono text-cyan-300 shadow backdrop-blur">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              +{hiddenCount} more risk alert{hiddenCount > 1 ? 's' : ''} queued
            </span>
            <button
              type="button"
              onClick={() => setToastQueue([])}
              className="text-[11px] text-slate-400 hover:text-white transition-colors underline"
            >
              Dismiss all
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Header Notification Bell Icon with active risk counter badge and dropdown drawer.
 */
export const NotificationBell: FC = () => {
  const { alerts, callsigns } = useAlertWatcher();
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const hasCritical = alerts.some((a) => a.severity === 'critical');
  const alertCount = alerts.length;

  return (
    <div className="relative" ref={bellRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="glass-btn-sm relative p-2 rounded-lg text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
        aria-label={`Risk alerts notification bell (${alertCount} active)`}
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" />
        {alertCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center px-1 rounded-full text-[10px] font-mono font-bold leading-none ${
              hasCritical
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-amber-500 text-slate-950'
            }`}
          >
            {alertCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu when clicked */}
      {open && (
        <div className="glass-dropdown absolute right-0 mt-2 w-80 sm:w-96 rounded-xl p-3 shadow-2xl z-[95]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs font-mono">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-cyan-400" />
              Active Risk Alerts ({alertCount})
            </span>
            <span className="text-[11px] text-slate-400">Mission Feed</span>
          </div>

          {alertCount === 0 ? (
            <div className="py-6 text-center text-xs font-mono text-slate-400">
              No active risk alerts on current sol.
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 flex flex-col gap-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-200">
                      {callsigns[a.crewId] || a.crewId}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase border ${
                        a.severity === 'critical'
                          ? 'bg-red-950 text-red-300 border-red-800'
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}
                    >
                      {severityLabel(a.severity)}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    CRI {a.criFrom.toFixed(1)} &rarr; {a.criTo.toFixed(1)} &bull; ~{a.predictedWindowHours}h window
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-2">
                    {a.message}
                  </p>
                  <Link
                    to={`/alert/${a.crewId}`}
                    onClick={() => setOpen(false)}
                    className="self-end text-[11px] font-mono text-cyan-400 hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    <span>View alert details</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
