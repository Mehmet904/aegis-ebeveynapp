import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StatusBar, StyleSheet } from 'react-native';
import AppNavigator, { navigationRef } from './navigation/AppNavigator';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './utils/firebaseConfig';
import { ref, set, update } from 'firebase/database'; 
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager'; 
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import WebRTCService from './utils/WebRTCService';
import { registerForPushNotificationsAsync, setupNotificationChannels } from './utils/notificationHelper';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) return;
  if (data) {
    const payload = data.notification?.request?.content?.data || data.notification?.data;
    
    // 🔥 WHATSAPP ARKA PLAN İLETİLDİ ONAYI
    if (payload?.action === 'NEW_MESSAGE' && payload.chatRoomId && payload.msgId) {
       try { 
         // Bildirim telefona iner inmez Firebase'i güncelleyip gönderene çift gri tik yaktırır
         await update(ref(db, `chats/${payload.chatRoomId}/${payload.msgId}`), {
           isDelivered: true
         }); 
       } catch(e){}
    }
  }
});

Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isSOS = notification.request.content.data?.action === 'SOS';
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: isSOS ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    const authSubscription = onAuthStateChanged(auth, async (user) => {
      if (user) {
        WebRTCService.connect(user.uid);
        setupNotificationChannels();
        const token = await registerForPushNotificationsAsync();
        
        const tokenString = typeof token === 'object' ? token.data : token;
        
        if (tokenString) {
          await set(ref(db, `users/${user.uid}/pushToken`), tokenString);
        }
      } else {
        WebRTCService.stop();
      }
      setAuthReady(true);
    });

const foregroundSub = Notifications.addNotificationReceivedListener(notification => {
  const payload = notification.request.content.data;
  
  // 🔥 UYGULAMA AÇIKKEN İLETİLDİ ONAYI
  if (payload?.action === 'NEW_MESSAGE' && payload.chatRoomId && payload.msgId) {
     update(ref(db, `chats/${payload.chatRoomId}/${payload.msgId}`), {
       isDelivered: true
     }).catch(()=>{});
  }
});

    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (navigationRef.isReady()) {
        if (data?.action === 'SOS' || data?.action === 'GEOFENCE') {
          navigationRef.navigate('AlertsScreen'); 
        }
      }
    });

    return () => {
      authSubscription();
      foregroundSub.remove();
      responseSub.remove();
    };
  }, []);

  useEffect(() => {
    if (authReady && navigationRef.isReady() && lastNotificationResponse) {
      const data = lastNotificationResponse.notification.request.content.data;
      if (data?.action === 'SOS' || data?.action === 'GEOFENCE') {
        navigationRef.navigate('AlertsScreen');
      }
    }
  }, [lastNotificationResponse, authReady]);

  if (!authReady) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient colors={['#020617', '#0f172a']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.logoContainer}>
          <View style={styles.iconGlow}>
            <Ionicons name="shield-checkmark" size={70} color="#6366f1" />
          </View>
          <Text style={styles.brandTitle}>AEGIS</Text>
          <Text style={styles.brandSubtitle}>KOMUTA MERKEZİ</Text>
        </View>
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <AppNavigator />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617' },
  logoContainer: { alignItems: 'center', marginBottom: 60 },
  iconGlow: { padding: 20, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 60, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.2)' },
  brandTitle: { fontSize: 32, fontWeight: '900', color: '#f8fafc', letterSpacing: 8 },
  brandSubtitle: { fontSize: 12, fontWeight: '800', color: '#6366f1', letterSpacing: 6, marginTop: 4 },
  loaderBox: { position: 'absolute', bottom: 80, alignItems: 'center' }
});