import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// 🔔 ÖN PLAN YÖNETİCİSİ (Foreground Handler)
// Uygulama açıkken (ekrandayken) bir SOS veya Geofence bildirimi gelirse
// sessizce geçiştirilmesini engeller, yukarıdan düşmesini ve ses çalmasını sağlar.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, 
    shouldPlaySound: true, 
    shouldSetBadge: true,  
  }),
});

/**
 * 📲 Cihazın Push Token'ını alır ve izinleri yönetir.
 */
export async function registerForPushNotificationsAsync() {
  let token;

  // 1. Fiziksel Cihaz Kontrolü
  if (!Device.isDevice) {
    console.warn('⚠️ Simülatörde Push Bildirimleri kullanılamaz.');
    return null;
  }

  // 2. Mevcut İzin Durumunu Kontrol Et
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // 3. İzin Yoksa İste
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  // 4. İzin Hala Verilmediyse Çık
  if (finalStatus !== 'granted') {
    console.warn('❌ Sistem bildirim izni reddedildi!');
    return null;
  }

  // 5. Android Kanallarını Yapılandır (Token almadan önce hazır olmalı)
  setupNotificationChannels();

  // 6. Expo Push Token Al
  try {
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;

    if (!projectId) {
      console.error('❌ Proje ID bulunamadı.');
      return null;
    }

    // Token alma işlemini zaman aşımı (timeout) ile sarmalayalım
    const tokenPromise = Notifications.getExpoPushTokenAsync({ projectId });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT')), 10000)
    );

    const tokenData = await Promise.race([tokenPromise, timeoutPromise]);
    token = tokenData.data;
    
  } catch (e) {
    if (e.message.includes('SERVICE_NOT_AVAILABLE') || e.message === 'TIMEOUT') {
      //console.warn('⚠️ Google Play Servisleri şu an yanıt vermiyor. Cihazın internetini ve Play Store durumunu kontrol edin.');
    } else {
      console.error('❌ Token alınırken beklenmedik hata:', e);
    }
    return null; // Uygulamanın çökmesini engellemek için null dönüyoruz
  }

  return token;
}

/**
 * 🎛️ TAKTİKSEL BİLDİRİM KANALLARI (Sadece Android)
 * iOS, bildirim kanallarını işletim sistemi düzeyinde otomatik yönetir.
 */
export function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    
    // 🚨 1. ACİL DURUM (SOS) KANALI (Maksimum Öncelik)
    Notifications.setNotificationChannelAsync('sos-alerts-pro', {
      name: '🚨 ACİL DURUM (SOS)',
      description: 'Hayati tehlike uyarıları - Kapatmayın!',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 1000, 500, 1000, 500, 1000],
      lightColor: '#FF0000',
      showBadge: true,
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC, // Kilit ekranında %100 görünür
      bypassDnd: true, // Rahatsız Etmeyin modunu deler geçer
    });

    // 📍 2. SANAL SINIR VE HIZ KANALI (Yüksek Öncelik)
    Notifications.setNotificationChannelAsync('geofence-alerts', {
      name: '📍 Sınır ve Hız İhlalleri',
      description: 'Güvenli alan giriş/çıkış ve araç hız uyarıları.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#f59e0b',
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // 🎙️ 3. YASAL DİNLEME VE ARAMA KANALI (Ekran Uyandıran Kanal)
    Notifications.setNotificationChannelAsync('webrtc-call', {
      name: '📞 Canlı İletişim',
      description: 'Ebeveyn sesli bağlantı veya kamera isteği',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 500, 500],
      lightColor: '#10b981',
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // 💬 4. STANDART İLETİŞİM KANALI (Mesajlar)
    Notifications.setNotificationChannelAsync('default', {
      name: '💬 Genel İletişim',
      description: 'Aile içi sohbet ve sistem durum mesajları.',
      importance: Notifications.AndroidImportance.HIGH, // Mesajların ekrana düşmesi için HIGH yaptık
      vibrationPattern: [0, 250],
      lightColor: '#6366f1',
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}