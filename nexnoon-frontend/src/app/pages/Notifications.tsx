import BrandLoader from '@/app/components/BrandLoader';
import { useState, useEffect, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Award,
  Bell,
  Calendar,
  CheckCheck,
  DollarSign,
  MessageSquare,
  Settings2,
  Trash2,
  Video,
} from 'lucide-react';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Button } from '@/app/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { notificationService } from '@/lib/api';
import { ENV } from '@/config/env';
import type { NotificationType } from '@/types/api';

type NotificationUI = {
  id: string | number;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  actionUrl?: string;
};

function formatTimeAgo(createdAt: string): string {
  const d = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return d.toLocaleDateString();
}

function typeMeta(type: NotificationType) {
  switch (type) {
    case 'class':
      return {
        icon: Video,
        label: 'Class',
        tone: 'bg-[#eef2f8] text-[#3a5f8a]',
      };
    case 'payment':
      return {
        icon: DollarSign,
        label: 'Billing',
        tone: 'bg-[#eef6ef] text-[#2f6b3a]',
      };
    case 'achievement':
      return {
        icon: Award,
        label: 'Achievement',
        tone: 'bg-[#f5f0e6] text-[#8a6a2f]',
      };
    case 'message':
      return {
        icon: MessageSquare,
        label: 'Message',
        tone: 'bg-[#f0ebe3] text-[#5c564e]',
      };
    case 'system':
    default:
      return {
        icon: Bell,
        label: 'System',
        tone: 'bg-[#f0ebe3] text-[#5c564e]',
      };
  }
}

export default function Notifications() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<NotificationUI[]>([]);
  const [loading, setLoading] = useState(false);

  const useRealData = !ENV.ENABLE_DEMO_MODE && isAuthenticated;

  useEffect(() => {
    if (!useRealData) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    notificationService
      .getMyNotifications({ pageSize: 100 })
      .then((res) => {
        setNotifications(
          (res.data || []).map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            time: formatTimeAgo(n.createdAt),
            read: n.read,
            actionUrl: n.actionUrl,
          }))
        );
      })
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, [useRealData]);

  const markAsRead = (id: string | number) => {
    if (useRealData && typeof id === 'string') {
      notificationService.markAsRead(id).catch(() => {});
    }
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
    );
  };

  const markAllAsRead = () => {
    if (useRealData) {
      notificationService.markAllAsRead().catch(() => {});
    }
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
  };

  const deleteNotification = (id: string | number, e: MouseEvent) => {
    e.stopPropagation();
    if (useRealData && typeof id === 'string') {
      notificationService.deleteNotification(id).catch(() => {});
    }
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  };

  const handleNotificationClick = (notification: NotificationUI) => {
    markAsRead(notification.id);
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const filteredNotifications = notifications.filter((notif) =>
    filter === 'all' ? true : !notif.read
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#f7f5f1] text-[#14110e]">
      <Header variant="light" />

      <main className="pb-16">
        {/* Page intro */}
        <section className="border-b border-[#ebe6de] bg-gradient-to-b from-white to-[#f7f5f1]">
          <div className="w-[90vw] max-w-3xl mx-auto pt-10 md:pt-14 pb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a847a] mb-3">
              Inbox
            </p>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-serif text-4xl md:text-[2.75rem] tracking-tight leading-none">
                  Notifications
                </h1>
                <p className="mt-3 text-[#7a746a]">
                  {loading
                    ? 'Loading your updates…'
                    : unreadCount > 0
                      ? `${unreadCount} unread · class, billing, and account updates`
                      : 'You’re all caught up'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {unreadCount > 0 ? (
                  <Button
                    type="button"
                    onClick={markAllAsRead}
                    variant="outline"
                    className="h-10 rounded-full border-[#e0dbd2] bg-white px-4 text-[#14110e] hover:bg-[#f0ebe3]"
                  >
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Mark all read
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className="h-10 rounded-full bg-[#14110e] px-4 text-white hover:bg-[#2a2520]"
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  Preferences
                </Button>
              </div>
            </div>

            {!useRealData ? (
              <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[#ebe6de] bg-white px-5 py-4">
                <p className="text-sm text-[#6b655c]">
                  Sign in to see class reminders, enrollments, and messages in one place.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-full bg-[#14110e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2a2520]"
                >
                  Sign in
                </Link>
              </div>
            ) : null}

            <div
              className="mt-6 inline-flex rounded-full border border-[#ebe6de] bg-white p-1"
              role="tablist"
              aria-label="Notification filters"
            >
              {(
                [
                  ['all', `All · ${notifications.length}`],
                  ['unread', `Unread · ${unreadCount}`],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={filter === value}
                  onClick={() => setFilter(value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    filter === value
                      ? 'bg-[#14110e] text-white'
                      : 'text-[#6b655c] hover:text-[#14110e]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="w-[90vw] max-w-3xl mx-auto pt-8">
          {loading ? (
            <div className="rounded-[1.75rem] border border-[#ebe6de] bg-white py-16">
              <BrandLoader />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="rounded-[1.75rem] border border-[#ebe6de] bg-white px-8 py-16 text-center">
              <span className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0ebe3] text-[#6b655c]">
                <Bell className="h-6 w-6" />
              </span>
              <h2 className="font-serif text-2xl tracking-tight">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </h2>
              <p className="mt-2 mx-auto max-w-sm text-sm text-[#7a746a] leading-relaxed">
                {filter === 'unread'
                  ? 'Everything is clear. New class and account updates will show up here.'
                  : 'When you enroll, get messages, or have a session starting soon, you’ll see it here.'}
              </p>
              {filter === 'unread' && notifications.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className="mt-6 text-sm font-semibold text-[#3a5f8a] hover:underline"
                >
                  View all notifications
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="overflow-hidden rounded-[1.75rem] border border-[#ebe6de] bg-white divide-y divide-[#ebe6de]">
              {filteredNotifications.map((notification) => {
                const meta = typeMeta(notification.type);
                const Icon = meta.icon;
                return (
                  <li key={notification.id}>
                    <div
                      role={notification.actionUrl ? 'link' : undefined}
                      tabIndex={notification.actionUrl ? 0 : undefined}
                      onClick={() => handleNotificationClick(notification)}
                      onKeyDown={(e) => {
                        if (
                          notification.actionUrl &&
                          (e.key === 'Enter' || e.key === ' ')
                        ) {
                          e.preventDefault();
                          handleNotificationClick(notification);
                        }
                      }}
                      className={`group relative flex items-start gap-4 px-5 py-4 sm:px-6 sm:py-5 transition-colors ${
                        notification.actionUrl ? 'cursor-pointer' : ''
                      } ${
                        notification.read
                          ? 'bg-white hover:bg-[#faf9f6]'
                          : 'bg-[#f7f5f1] hover:bg-[#f3f0ea]'
                      }`}
                    >
                      {!notification.read ? (
                        <span
                          className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[#889dd1]"
                          aria-hidden
                        />
                      ) : null}

                      <span
                        className={`mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${meta.tone}`}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3
                                className={`text-[15px] tracking-tight ${
                                  notification.read
                                    ? 'font-semibold text-[#14110e]'
                                    : 'font-bold text-[#14110e]'
                                }`}
                              >
                                {notification.title}
                              </h3>
                              <span className="rounded-full bg-[#f0ebe3] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6b655c]">
                                {meta.label}
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm leading-relaxed text-[#6b655c]">
                              {notification.message}
                            </p>
                            <p className="mt-2 text-xs text-[#9a948a]">{notification.time}</p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            {!notification.read ? (
                              <span
                                className="mr-1 h-2 w-2 rounded-full bg-[#889dd1]"
                                title="Unread"
                              />
                            ) : null}
                            <button
                              type="button"
                              aria-label="Delete notification"
                              onClick={(e) => deleteNotification(notification.id, e)}
                              className="rounded-xl p-2 text-[#c4bdb2] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-[#f0ebe3] hover:text-[#b42318]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Tips strip — not a card grid */}
          <div className="mt-10 grid gap-6 border-t border-[#ebe6de] pt-10 sm:grid-cols-3">
            <div>
              <Calendar className="h-5 w-5 text-[#889dd1] mb-3" />
              <h3 className="text-sm font-semibold tracking-tight">Never miss a class</h3>
              <p className="mt-1 text-sm text-[#7a746a] leading-relaxed">
                Session reminders arrive here before live class starts.
              </p>
            </div>
            <div>
              <MessageSquare className="h-5 w-5 text-[#889dd1] mb-3" />
              <h3 className="text-sm font-semibold tracking-tight">Stay in the loop</h3>
              <p className="mt-1 text-sm text-[#7a746a] leading-relaxed">
                Enrollment, assignments, and instructor updates land in one inbox.
              </p>
            </div>
            <div>
              <Settings2 className="h-5 w-5 text-[#889dd1] mb-3" />
              <h3 className="text-sm font-semibold tracking-tight">Tune your alerts</h3>
              <p className="mt-1 text-sm text-[#7a746a] leading-relaxed">
                Choose what you hear about in notification preferences.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
