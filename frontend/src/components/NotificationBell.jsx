import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Bell,
  CalendarClock,
  CheckCheck,
  CircleAlert,
  ClipboardCheck,
  UserRound,
} from "lucide-react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";

const notificationIcons = {
  account_approved: BadgeCheck,
  event_reminder: CalendarClock,
  planner_overdue: CircleAlert,
  profile_updated: UserRound,
  quiz_completed: ClipboardCheck,
};

export default function NotificationBell() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const containerRef = useRef(null);

  const loadNotifications = useCallback(async (signal) => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Unable to load notifications.");
      }
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
      setError("");
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setError(requestError.message || "Unable to load notifications.");
        console.error(requestError);
      }
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoadId = window.setTimeout(
      () => loadNotifications(controller.signal),
      0,
    );
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        loadNotifications();
      }
    };

    const intervalId = window.setInterval(refreshWhenVisible, 15_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      controller.abort();
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;

    const handleOutsidePointer = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const markRead = async (notificationId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/notifications/${notificationId}/read`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Unable to update notification.");
      }
      await loadNotifications();
    } catch (requestError) {
      setError(requestError.message || "Unable to update notification.");
      console.error(requestError);
    }
  };

  const markAllRead = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Unable to update notifications.");
      }
      await loadNotifications();
    } catch (requestError) {
      setError(requestError.message || "Unable to update notifications.");
      console.error(requestError);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={() => {
          const willOpen = !open;
          setOpen(willOpen);
          if (willOpen) loadNotifications();
        }}
        className="relative rounded-xl border border-blue-100 p-2 text-slate-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:text-slate-100 dark:hover:bg-gray-700 sm:p-2.5"
      >
        <Bell size={18} aria-hidden="true" className="sm:h-5 sm:w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          aria-label="Notifications"
          className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {unreadCount ? `${unreadCount} unread` : "You’re all caught up"}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800"
              >
                <CheckCheck size={15} />
                Mark all read
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="max-h-[min(28rem,65vh)] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No notifications yet.
              </p>
            ) : (
              notifications.map((notification) => {
                const Icon = notificationIcons[notification.kind] || Bell;
                return (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => {
                      if (!notification.read_at) markRead(notification.id);
                    }}
                    className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70 ${
                      notification.read_at ? "" : "bg-blue-50/70 dark:bg-blue-950/20"
                    }`}
                  >
                    <span className={`mt-0.5 rounded-lg p-2 ${
                      notification.read_at
                        ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
                    }`}>
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {notification.title}
                        </span>
                        {!notification.read_at && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                        )}
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-slate-600 dark:text-slate-300">
                        {notification.message}
                      </span>
                      <time className="mt-1.5 block text-xs text-slate-400">
                        {new Date(notification.created_at).toLocaleString()}
                      </time>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
