import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Notification } from '../types';
import { persistStorage } from './persistStorage';

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  getUnreadCount: () => number;
  reset: () => void;
}

export const useNotifications = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      
      addNotification: (notificationData) => {
        const newNotification: Notification = {
          ...notificationData,
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          read: false,
          createdAt: new Date().toISOString(),
        };
        
        set((state) => ({
          notifications: [newNotification, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));
      },
      
      markAsRead: (id) => {
        set((state) => {
          const updatedNotifications = state.notifications.map((notification) =>
            notification.id === id ? { ...notification, read: true } : notification
          );
          
          const unreadCount = updatedNotifications.filter(n => !n.read).length;
          
          return {
            notifications: updatedNotifications,
            unreadCount,
          };
        });
      },
      
      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((notification) => ({
            ...notification,
            read: true,
          })),
          unreadCount: 0,
        }));
      },
      
      deleteNotification: (id) => {
        set((state) => {
          const notification = state.notifications.find(n => n.id === id);
          const wasUnread = notification && !notification.read;
          
          return {
            notifications: state.notifications.filter((notification) => notification.id !== id),
            unreadCount: wasUnread ? state.unreadCount - 1 : state.unreadCount,
          };
        });
      },
      
      clearAllNotifications: () => {
        set({
          notifications: [],
          unreadCount: 0,
        });
      },
      
      getUnreadCount: () => {
        return get().unreadCount;
      },
      
      reset: () => {
        set({
          notifications: [],
          unreadCount: 0,
        });
      },
    }),
    {
      name: 'myra-notifications',
      version: 1,
      storage: persistStorage,
    }
  )
);
