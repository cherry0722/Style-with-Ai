import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../store/notifications';
import { Notification } from '../types';
import { theme } from '../theme';

const NOTIFICATION_ICONS = {
  outfit: 'shirt',
  weather: 'cloud',
  event: 'calendar',
  reminder: 'alarm',
  system: 'information-circle',
} as const;

const NOTIFICATION_COLORS = {
  outfit: theme.colors.accent,
  weather: theme.colors.info,
  event: theme.colors.warning,
  reminder: theme.colors.error,
  system: theme.colors.gray600,
} as const;

export default function NotificationsScreen() {
  const { notifications, markAsRead, markAllAsRead, deleteNotification, unreadCount } = useNotifications();
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());

  const handleMarkAsRead = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
  };

  const handleDeleteNotification = (notification: Notification) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteNotification(notification.id),
        },
      ]
    );
  };

  const handleMarkAllAsRead = () => {
    if (unreadCount > 0) {
      markAllAsRead();
    }
  };

  const handleSelectNotification = (id: string) => {
    setSelectedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedNotifications.size === 0) return;
    
    Alert.alert(
      'Delete Notifications',
      `Are you sure you want to delete ${selectedNotifications.size} notification(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            selectedNotifications.forEach(id => deleteNotification(id));
            setSelectedNotifications(new Set());
          },
        },
      ]
    );
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - notificationTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return notificationTime.toLocaleDateString();
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const isSelected = selectedNotifications.has(item.id);
    const iconName = NOTIFICATION_ICONS[item.type] || 'information-circle';
    const iconColor = NOTIFICATION_COLORS[item.type] || theme.colors.gray600;

    return (
      <Pressable
        style={[
          styles.notificationCard,
          !item.read && styles.unreadNotification,
          isSelected && styles.selectedNotification,
        ]}
        onPress={() => handleMarkAsRead(item)}
        onLongPress={() => handleSelectNotification(item.id)}
      >
        <View style={styles.notificationContent}>
          <View style={[styles.notificationIcon, { backgroundColor: iconColor + '20' }]}>
            <Ionicons name={iconName as any} size={20} color={iconColor} />
          </View>
          
          <View style={styles.notificationText}>
            <Text style={[styles.notificationTitle, !item.read && styles.unreadText]}>
              {item.title}
            </Text>
            <Text style={styles.notificationMessage}>{item.message}</Text>
            <Text style={styles.notificationTime}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
          
          <View style={styles.notificationActions}>
            {!item.read && <View style={styles.unreadDot} />}
            <Pressable
              style={styles.deleteButton}
              onPress={() => handleDeleteNotification(item)}
            >
              <Ionicons name="trash-outline" size={16} color={theme.colors.textTertiary} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  if (notifications.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="notifications-outline" size={64} color={theme.colors.textTertiary} />
        <Text style={styles.emptyTitle}>No notifications yet</Text>
        <Text style={styles.emptySubtitle}>
          You'll see outfit suggestions, weather alerts, and event reminders here
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.subtitle}>{unreadCount} unread</Text>
          )}
        </View>
        
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <Pressable style={styles.markAllButton} onPress={handleMarkAllAsRead}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </Pressable>
          )}
          
          {selectedNotifications.size > 0 && (
            <Pressable style={styles.deleteSelectedButton} onPress={handleDeleteSelected}>
              <Ionicons name="trash" size={16} color={theme.colors.white} />
              <Text style={styles.deleteSelectedText}>
                Delete ({selectedNotifications.size})
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography['2xl'],
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  headerActions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    alignItems: 'center' as const,
  },
  markAllButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
  },
  markAllText: {
    fontSize: theme.typography.sm,
    color: theme.colors.accent,
    fontWeight: theme.typography.medium,
  },
  deleteSelectedButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.md,
  },
  deleteSelectedText: {
    fontSize: theme.typography.sm,
    color: theme.colors.white,
    fontWeight: theme.typography.medium,
  },
  listContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  separator: {
    height: theme.spacing.sm,
  },
  notificationCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  unreadNotification: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accent,
  },
  selectedNotification: {
    backgroundColor: theme.colors.accent + '10',
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  notificationContent: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: theme.spacing.md,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.lg,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  notificationText: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: theme.typography.base,
    fontWeight: theme.typography.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  unreadText: {
    fontWeight: theme.typography.bold,
  },
  notificationMessage: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.base * theme.typography.lineHeight,
    marginBottom: theme.spacing.xs,
  },
  notificationTime: {
    fontSize: theme.typography.xs,
    color: theme.colors.textTertiary,
  },
  notificationActions: {
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.accent,
  },
  deleteButton: {
    padding: theme.spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: theme.typography.xl,
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: theme.typography.base,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: theme.typography.base * theme.typography.lineHeight,
  },
};
