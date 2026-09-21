import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar, Linking, Platform, Animated, ScrollView, AppState } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { Camera } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../utils/firebaseConfig';
import { ref, get } from 'firebase/database';
import * as Haptics from 'expo-haptics';
import * as IntentLauncher from 'expo-intent-launcher';
import { checkForPermission } from '@justdice/react-native-usage-stats';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

const AuthLoader = ({ navigation }) => {
  const [isChild, setIsChild] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingPerms, setCheckingPerms] = useState(false);

  const [perms, setPerms] = useState({
    location: false,
    background: false,
    notifications: false,
    microphone: false,
    camera: false,
    usage: false,
    battery: false
  });

  const triggerHaptic = (style = 'Light') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle[style]).catch(() => { });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userSnap = await get(ref(db, `users/${user.uid}`));
          const role = userSnap.val()?.role;

          // 🚀 DEĞİŞİKLİK BURADA: Sadece ebeveyn girişine izin ver
          if (role === 'parent') {
            navigation.replace('ParentHome');
          } else {
            // Eğer yanlışlıkla çocuk hesabıyla girilmeye çalışılırsa at
            Alert.alert("Erişim Reddedildi", "Bu uygulama sadece yönetici (ebeveyn) hesapları içindir.");
            auth.signOut();
          }
        } catch (error) {
          navigation.replace('Login');
        }
      } else {
        navigation.replace('Login');
      }
    });

    return () => unsubscribe();
  }, []);

  // Ayarlardan uygulamaya geri dönüldüğünde izinleri otomatik tekrar kontrol et
  useEffect(() => {
    if (!isChild) return;
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkAllPermissions();
      }
    });
    return () => appStateSub.remove();
  }, [isChild]);

  const checkAllPermissions = async () => {
    setCheckingPerms(true);

    const loc = await Location.getForegroundPermissionsAsync();
    const bgLoc = await Location.getBackgroundPermissionsAsync();
    const notif = await Notifications.getPermissionsAsync();
    const mic = await Audio.getPermissionsAsync();
    const cam = await Camera.getCameraPermissionsAsync();

    let usageGranted = false;
    if (Platform.OS === 'android') {
      usageGranted = await checkForPermission();
    } else {
      usageGranted = true; // iOS'ta usage stats yok, direkt true say
    }

    // Pil optimizasyonu için manuel bir bayrak (flag) kullanıyoruz
    const batteryFlag = await AsyncStorage.getItem('askedBatteryOpt');

    const currentPerms = {
      location: loc.status === 'granted',
      background: bgLoc.status === 'granted',
      notifications: notif.status === 'granted',
      microphone: mic.status === 'granted',
      camera: cam.status === 'granted',
      usage: usageGranted,
      battery: batteryFlag === 'true'
    };

    setPerms(currentPerms);
    setCheckingPerms(false);

    // 🔥 TÜM İZİNLER YEŞİL İSE ANA EKRANA GEÇİŞE İZİN VER!
    const allDone = Object.values(currentPerms).every(v => v === true);
    if (allDone) {
      navigation.replace('ChildHome');
    }
  };

  const requestPermission = async (type) => {
    triggerHaptic('Medium');

    try {
      if (type === 'location') {
        await Location.requestForegroundPermissionsAsync();
      }
      else if (type === 'background') {
        const fg = await Location.getForegroundPermissionsAsync();
        if (fg.status !== 'granted') {
          Alert.alert("Önce üstteki 'Hassas Konum' iznini vermelisiniz.");
          return;
        }

        Alert.alert(
          "Arka Plan Konum İzni",
          "Aegis Protocol, uygulama kapalıyken bile ailenizin konumunuzu görebilmesi ve sanal sınır uyarıları alabilmesi için 'Arka Plan Konum' verilerini toplar. Lütfen ayarlardan 'Her Zaman İzin Ver' seçeneğini seçin.",
          [
            { text: "Kabul Etmiyorum", style: "cancel" },
            {
              text: "Anladım, İzin Ver",
              onPress: async () => {
                await Location.requestBackgroundPermissionsAsync();
                setTimeout(checkAllPermissions, 1500); // Kullanıcı ayarlardan dönene kadar bekle
              }
            }
          ]
        );
        return;

      }
      else if (type === 'notifications') {
        await Notifications.requestPermissionsAsync();
      }
      else if (type === 'microphone') {
        await Audio.requestPermissionsAsync();
      }
      else if (type === 'camera') {
        await Camera.requestCameraPermissionsAsync();
      }
      else if (type === 'usage') {
        if (Platform.OS === 'android') {
          Alert.alert("Kullanım İzni", "Açılan ekranda 'Aegis Protocol'ü bulup erişime izin verin.");
          await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.USAGE_ACCESS_SETTINGS);
        }
      }
      else if (type === 'battery') {
        if (Platform.OS === 'android') {
          await AsyncStorage.setItem('askedBatteryOpt', 'true');
          // DİKKAT: Kullanıcıyı menüde yormak yerine direkt önüne izin pop-up'ı çıkartıyoruz!
          await IntentLauncher.startActivityAsync(
            'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
            { data: `package:${Application.applicationId}` }
          );
        }
      }
    } catch (e) {
      console.warn(e);
      Linking.openSettings();
    }

    setTimeout(checkAllPermissions, 1500);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={['#020617', '#0f172a']} style={StyleSheet.absoluteFillObject} />
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const PermItem = ({ label, isOk, icon, type, sub }) => (
    <BlurView intensity={20} tint="light" style={[styles.permCard, { borderColor: isOk ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)' }]}>
      <View style={[styles.iconCircle, { backgroundColor: isOk ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
        <Ionicons name={icon} size={22} color={isOk ? '#10b981' : '#ef4444'} />
      </View>
      <View style={{ flex: 1, marginLeft: 15 }}>
        <Text style={styles.permLabel}>{label}</Text>
        <Text style={styles.permSub}>{sub}</Text>
      </View>
      {isOk ? (
        <Ionicons name="checkmark-circle" size={26} color="#10b981" />
      ) : (
        <TouchableOpacity style={styles.fixBtn} onPress={() => requestPermission(type)}>
          <Text style={styles.fixBtnText}>AÇ</Text>
        </TouchableOpacity>
      )}
    </BlurView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#020617', '#0f172a']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <View style={styles.shieldIcon}>
          <Ionicons name="shield-half" size={50} color="#6366f1" />
        </View>
        <Text style={styles.title}>Sistem Kurulumu</Text>
        <Text style={styles.subtitle}>Cihazın Aegis ağına bağlanabilmesi ve korunabilmesi için aşağıdaki tüm kalkanları aktif etmelisin.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PermItem label="Hassas Konum" sub="Anlık GPS takibi için" isOk={perms.location} icon="location" type="location" />
        <PermItem label="Arka Plan İzleme" sub="Uygulama kapalıyken koruma ('Her Zaman' seçin)" isOk={perms.background} icon="sync" type="background" />
        <PermItem label="Mikrofon Erişimi" sub="Telsiz ve acil durum dinlemesi" isOk={perms.microphone} icon="mic" type="microphone" />
        <PermItem label="Görüntü Aktarımı" sub="Canlı kamera bağlantısı" isOk={perms.camera} icon="videocam" type="camera" />
        <PermItem label="Sistem Bildirimleri" sub="Ailenden gelen acil mesajlar" isOk={perms.notifications} icon="notifications" type="notifications" />
        <PermItem label="Kullanım İzni" sub="Açılan listeden Aegis'i bulup izin verin" isOk={perms.usage} icon="pie-chart" type="usage" />
        <PermItem label="Pil Kısıtlamasını Kaldır" sub="Açılan menüden 'Kısıtlanmamış' seçin" isOk={perms.battery} icon="battery-charging" type="battery" />
      </ScrollView>

      <View style={styles.footer}>
        <ActivityIndicator color={checkingPerms ? "#6366f1" : "transparent"} size="small" />
        <Text style={styles.footerText}>TÜM SİSTEMLERİN YEŞİL OLMASI BEKLENİYOR</Text>
      </View>
    </View>
  );
};

export default AuthLoader;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginTop: 70, paddingHorizontal: 25, marginBottom: 20 },
  shieldIcon: { padding: 15, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 30, marginBottom: 15 },
  title: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 10, lineHeight: 20, fontWeight: '600' },
  scroll: { paddingHorizontal: 20, paddingBottom: 100 },
  permCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, marginBottom: 12, borderWidth: 1, overflow: 'hidden' },
  iconCircle: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  permLabel: { color: '#f8fafc', fontSize: 15, fontWeight: '900' },
  permSub: { color: '#64748b', fontSize: 11, marginTop: 4, fontWeight: '600' },
  fixBtn: { backgroundColor: '#6366f1', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  fixBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  footer: { position: 'absolute', bottom: 30, width: '100%', alignItems: 'center' },
  footerText: { color: '#475569', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 8 }
});