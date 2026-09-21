import BrandLoader from '@/app/components/BrandLoader';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Bell, CheckCheck, Trash2, Settings, Users, Video, Award, DollarSign, MessageSquare, Calendar } from 'lucide-react';
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

export default function Notifications() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
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

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'class':
        return <Video className="h-5 w-5" />;
      case 'payment':
        return <DollarSign className="h-5 w-5" />;
      case 'achievement':
        return <Award className="h-5 w-5" />;
      case 'message':
        return <MessageSquare className="h-5 w-5" />;
      case 'system':
        return <Bell className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getIconColor = (type: NotificationType) => {
    switch (type) {
      case 'class':
        return 'bg-blue-100 text-blue-600';
      case 'payment':
        return 'bg-green-100 text-green-600';
      case 'achievement':
        return 'bg-yellow-100 text-yellow-600';
      case 'message':
        return 'bg-purple-100 text-purple-600';
      case 'system':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const markAsRead = (id: string | number) => {
    if (useRealData && typeof id === 'string') {
      notificationService.markAsRead(id).catch(() => {});
    }
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    if (useRealData) {
      notificationService.markAllAsRead().catch(() => {});
    }
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, read: true }))
    );
  };

  const deleteNotification = (id: string | number, e: React.MouseEvent) => {
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
    <div className="min-h-screen bg-gray-50">
      <Header variant="light" />
      
      <main className="py-12">
        <div className="w-[90vw] max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            {!useRealData && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                Sign in to see your notifications.
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-black mb-2">Notifications</h1>
                <p className="text-gray-600">
                  {loading ? 'Loading...' : unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <Button
                    onClick={markAllAsRead}
                    variant="outline"
                    className="border-gray-300 rounded-lg"
                  >
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Mark all as read
                  </Button>
                )}
                <Button
                  onClick={() => navigate('/settings')}
                  variant="outline"
                  className="border-gray-300 rounded-lg"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-black text-white'
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'unread'
                    ? 'bg-black text-white'
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="space-y-3">
            {loading ? (
              <div className="bg-white border border-gray-300 rounded-xl p-12 text-center text-gray-600">
                <BrandLoader />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="bg-white border border-gray-300 rounded-xl p-12 text-center">
                <Bell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-black mb-2">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
                </h3>
                <p className="text-gray-600">
                  {filter === 'unread'
                    ? 'All caught up! You\'re all set.'
                    : 'You\'ll be notified about class updates, messages, and more.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`bg-white border rounded-xl p-4 transition-all group ${
                    notification.read
                      ? 'border-gray-300 hover:border-gray-400'
                      : 'border-blue-200 bg-blue-50/30 hover:border-blue-300'
                  } ${notification.actionUrl ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getIconColor(notification.type)}`}>
                      {getIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <h3 className={`font-bold ${notification.read ? 'text-black' : 'text-blue-900'}`}>
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1.5"></div>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{notification.time}</span>
                        <button
                          onClick={(e) => deleteNotification(notification.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-all"
                        >
                          <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Info Cards */}
          {filteredNotifications.length > 0 && (
            <div className="mt-12 grid md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-300 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-black mb-2">Never Miss a Class</h3>
                <p className="text-sm text-gray-600">
                  Get notified before your live sessions start
                </p>
              </div>

              <div className="bg-white border border-gray-300 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-black mb-2">Stay Connected</h3>
                <p className="text-sm text-gray-600">
                  Instant updates from your Nexnoon Experts
                </p>
              </div>

              <div className="bg-white border border-gray-300 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mx-auto mb-3">
                  <Settings className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-black mb-2">Customize Alerts</h3>
                <p className="text-sm text-gray-600">
                  Control what notifications you receive
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}