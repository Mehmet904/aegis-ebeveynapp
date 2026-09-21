import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Switch, Linking, Alert, Image, Dimensions, Modal, TextInput } from 'react-native';
import { signOut, deleteUser } from 'firebase/auth';
import { ref, update, remove, onValue } from 'firebase/database';
import { auth, db } from '../../utils/firebaseConfig';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import BackgroundService from 'react-native-background-actions';
import WebRTCService from '../../utils/WebRTCService';

const { width } = Dimensions.get('window');

const ProfileScreen = ({ navigation }) => {
  const user = auth.currentUser;

  // ☀️ Tema Yönetimi
  const [isDarkMode, setIsDarkMode] = useState(false);

  const theme = useMemo(() => ({
    bg: isDarkMode ? '#020617' : '#f8fafc',
    blur: isDarkMode ? 'dark' : 'light',
    surface: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.9)',
    surfaceBorder: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    accent: '#6366f1',
    danger: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
    iconBg: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
    inputBg: isDarkMode ? 'rgba(0,0,0,0.3)' : '#f1f5f9'
  }), [isDarkMode]);

  // State'ler
  const [profileImage, setProfileImage] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [editNameModal, setEditNameModal] = useState(false);
  const [tempName, setTempName] = useState('');

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false); // Yeni: Biyometrik Kilit

  const [notifPermission, setNotifPermission] = useState('loading');
  const [micPermission, setMicPermission] = useState('loading');
  const [childrenData, setChildrenData] = useState([]);

  const triggerHaptic = (style = 'Light') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle[style]).catch(() => { });
  };

  useEffect(() => {
    checkPermissions();
    loadUserData();
    loadChildrenData();
  }, []);

  const loadUserData = () => {
    if (!user) return;
    const userRef = ref(db, `users/${user.uid}`);
    onValue(userRef, (snap) => {
      const data = snap.val();
      if (data) {
        setProfileImage(data.profileImage || null);
        setDisplayName(data.displayName || 'Sistem Yöneticisi');
        if (data.settings) {
          setNotificationsEnabled(data.settings.notifications ?? true);
          setSoundEnabled(data.settings.sound ?? true);
          setBiometricEnabled(data.settings.biometric ?? false);
        }
      }
    });
  };

  const loadChildrenData = () => {
    if (!user) return;
    const linkedRef = ref(db, `users/${user.uid}/linkedChildren`);
    onValue(linkedRef, (snap) => {
      const val = snap.val();
      if (!val) { setChildrenData([]); return; }

      const uids = Object.keys(val);
      uids.forEach(uid => {
        onValue(ref(db, `users/${uid}`), (childSnap) => {
          const cData = childSnap.val();
          if (cData) {
            setChildrenData(prev => {
              const filtered = prev.filter(c => c.uid !== uid);
              return [...filtered, { uid, ...cData }];
            });
          }
        });
      });
    });
  };

  // 📸 Profil Resmi Seçme
  const pickImage = async () => {
    triggerHaptic('Medium');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri iznine ihtiyacımız var.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.2,
      base64: true,
    });

    if (!result.canceled) {
      const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
      try {
        await update(ref(db, `users/${user.uid}`), { profileImage: base64Img });
        triggerHaptic('Success');
      } catch (err) {
        triggerHaptic('Error');
        Alert.alert('Hata', 'Resim güncellenirken bir sorun oluştu.');
      }
    }
  };

  // ✏️ İsim Güncelleme
  const handleUpdateName = async () => {
    if (!tempName.trim()) return;
    triggerHaptic('Medium');
    try {
      await update(ref(db, `users/${user.uid}`), { displayName: tempName.trim() });
      triggerHaptic('Success');
      setEditNameModal(false);
    } catch (err) {
      triggerHaptic('Error');
    }
  };

  const toggleSetting = async (key, value) => {
    triggerHaptic('Light');
    if (key === 'notifications') setNotificationsEnabled(value);
    if (key === 'sound') setSoundEnabled(value);
    if (key === 'biometric') setBiometricEnabled(value);

    if (user) {
      await update(ref(db, `users/${user.uid}/settings`), { [key]: value });
    }
  };

  const checkPermissions = async () => {
    const { status: notifStatus } = await Notifications.getPermissionsAsync();
    setNotifPermission(notifStatus);
    const { status: micStatus } = await Audio.getPermissionsAsync();
    setMicPermission(micStatus);
  };

  const requestPermission = async (type) => {
    triggerHaptic('Medium');
    if (type === 'notification') {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotifPermission(status);
      if (status !== 'granted') openDeviceSettings();
    } else if (type === 'mic') {
      const { status } = await Audio.requestPermissionsAsync();
      setMicPermission(status);
      if (status !== 'granted') openDeviceSettings();
    }
  };

  const openDeviceSettings = () => {
    Alert.alert("İzin Gerekli", "Sistemin tam verimli çalışması için cihaz ayarlarından izin vermeniz gerekiyor.", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Ayarları Aç", onPress: () => Linking.openSettings() }
    ]);
  };

  const handleDeleteAccount = () => {
    triggerHaptic('Heavy');
    Alert.alert("DİKKAT: Hesabı Sil", "Hesabınızı ve çocuklarınızla olan tüm bağlantı verilerini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.", [
      { text: "Vazgeç", style: "cancel", onPress: () => triggerHaptic('Light') },
      {
        text: "Kalıcı Olarak Sil", style: "destructive", onPress: async () => {
          try {
            await remove(ref(db, `users/${user.uid}`));
            await deleteUser(user);
            navigation.replace('Login');
          } catch (error) {
            Alert.alert("Hata", "Güvenlik nedeniyle bu işlem için hesabınızdan çıkış yapıp tekrar girmeniz gerekmektedir.");
          }
        }
      }
    ]);
  };

  const handleLogout = async () => {
    triggerHaptic('Heavy');
    Alert.alert(
      "Ağdan Ayrıl",
      "Sistemden çıkış yapmak istediğinize emin misiniz? Bu cihazın ağ ile tüm bağlantısı kesilecektir.",
      [
        { text: "İptal", style: "cancel", onPress: () => triggerHaptic('Light') },
        {
          text: "Çıkış Yap",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Sunucu Bildirimlerini Kes (DB'den Token'ı Sil)
              if (auth.currentUser) {
                await update(ref(db, `users/${auth.currentUser.uid}`), { pushToken: null });
              }

              // 2. Cihazda Bekleyen veya Fırlatılacak Tüm Bildirimleri İptal Et
              await Notifications.cancelAllScheduledNotificationsAsync();
              await Notifications.dismissAllNotificationsAsync();

              // 3. Arka Plan Motorunu ve WebRTC'yi Durdur
              await BackgroundService.stop();
              WebRTCService.stop();
              if (WebRTCService.socket) {
                WebRTCService.socket.disconnect();
              }

              // 4. Firebase Oturumunu Kapat ve Login'e Dön
              await signOut(auth);
              navigation.replace('Login');
            } catch (error) {
              Alert.alert("Hata", "Çıkış yapılırken bir sorun oluştu.");
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* 🌌 Holografik Arka Plan */}
      <View style={styles.absoluteBackground}>
        <LinearGradient colors={isDarkMode ? ['#312e81', 'transparent'] : ['#e0e7ff', 'transparent']} style={styles.glowTopRight} />
        <LinearGradient colors={isDarkMode ? ['#064e3b', 'transparent'] : ['#d1fae5', 'transparent']} style={styles.glowTopLeft} />
      </View>

      {/* 🌟 Yüzen Taktiksel Header */}
      <BlurView intensity={isDarkMode ? 70 : 90} tint={theme.blur} style={[styles.floatingHeader, { borderColor: theme.surfaceBorder, backgroundColor: theme.surface }]}>
        <TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.iconBg }]} onPress={() => { triggerHaptic(); navigation.goBack(); }}>
          <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Sistem Ayarları</Text>
          <Text style={{ color: theme.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>YÖNETİCİ PANELİ</Text>
        </View>
        <TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.iconBg }]} onPress={() => { triggerHaptic('Heavy'); setIsDarkMode(!isDarkMode); }}>
          <Ionicons name={isDarkMode ? "moon" : "sunny"} size={20} color={isDarkMode ? "#38bdf8" : theme.warning} />
        </TouchableOpacity>
      </BlurView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* 📸 EBEVEYN KİMLİĞİ VE ABONELİK */}
        <View style={styles.profileSection}>
          <TouchableOpacity style={styles.avatarLarge} activeOpacity={0.8} onPress={pickImage}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.avatarFallback}>
                <Ionicons name="person" size={36} color="#fff" />
              </LinearGradient>
            )}
            <View style={[styles.editBadge, { borderColor: theme.bg }]}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.nameRow} onPress={() => { setTempName(displayName); setEditNameModal(true); triggerHaptic('Light'); }}>
            <Text style={[styles.userName, { color: theme.textPrimary }]}>{displayName}</Text>
            <Ionicons name="pencil" size={16} color={theme.textSecondary} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
          <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{user?.email}</Text>

          <View style={styles.proBadgeRow}>
            <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.proBadge}>
              <Ionicons name="star" size={12} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.proText}>AEGIS PRO AKTİF</Text>
            </LinearGradient>
          </View>
        </View>

        {/* ⚙️ UYGULAMA TERCİHLERİ */}
        <BlurView intensity={isDarkMode ? 40 : 100} tint={theme.blur} style={[styles.sectionCard, { borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Genel Tercihler</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                <Ionicons name="notifications" size={20} color={theme.accent} />
              </View>
              <View>
                <Text style={[styles.settingText, { color: theme.textPrimary }]}>Anlık Bildirimler</Text>
                <Text style={[styles.settingSubText, { color: theme.textSecondary }]}>S.O.S. ve konum uyarıları</Text>
              </View>
            </View>
            <Switch value={notificationsEnabled} onValueChange={(val) => toggleSetting('notifications', val)} trackColor={{ false: theme.surfaceBorder, true: theme.accent }} thumbColor="#fff" />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                <Ionicons name="volume-high" size={20} color={theme.warning} />
              </View>
              <View>
                <Text style={[styles.settingText, { color: theme.textPrimary }]}>Taktiksel Sesler</Text>
                <Text style={[styles.settingSubText, { color: theme.textSecondary }]}>Alarm durumlarında ses çal</Text>
              </View>
            </View>
            <Switch value={soundEnabled} onValueChange={(val) => toggleSetting('sound', val)} trackColor={{ false: theme.surfaceBorder, true: theme.warning }} thumbColor="#fff" />
          </View>

          <View style={[styles.settingRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                <Ionicons name="finger-print" size={20} color={theme.success} />
              </View>
              <View>
                <Text style={[styles.settingText, { color: theme.textPrimary }]}>Biyometrik Güvenlik</Text>
                <Text style={[styles.settingSubText, { color: theme.textSecondary }]}>Uygulama açılışını kilitle</Text>
              </View>
            </View>
            <Switch value={biometricEnabled} onValueChange={(val) => toggleSetting('biometric', val)} trackColor={{ false: theme.surfaceBorder, true: theme.success }} thumbColor="#fff" />
          </View>
        </BlurView>

        {/* 🛡️ ÇOCUK CİHAZI SENSÖR DURUMLARI (GÜNCELLENDİ) */}
        {childrenData.length > 0 && (
          <BlurView intensity={isDarkMode ? 40 : 100} tint={theme.blur} style={[styles.sectionCard, { borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Terminal Sensörleri (Hedef Cihazlar)</Text>
            {childrenData.map((child, index) => {
              // Firebase'den gelen verileri alıyoruz
              const p = child.permissions || {};

              const permsList = [
                { label: 'GPS Konum İzni', status: p.location, icon: 'location' },
                { label: 'Uygulama Kullanım Takibi', status: p.usage, icon: 'apps' },
                { label: 'Arama Kaydı Erişimi', status: p.callLog, icon: 'call' },
                { label: 'Pil Kısıtlamasız Mod', status: p.battery, icon: 'battery-charging' },
                { label: 'Sistem Bildirimleri', status: p.notification, icon: 'notifications' },
              ];

              return (
                <View key={child.uid} style={[styles.childPermBox, { backgroundColor: theme.iconBg, borderColor: theme.surfaceBorder }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                    {child.profileImage ? (
                      <Image source={{ uri: child.profileImage }} style={styles.childAvatar} />
                    ) : (
                      <View style={[styles.childAvatarFallback, { backgroundColor: theme.accent }]}>
                        <Text style={{ color: '#fff', fontWeight: '900' }}>{(child.displayName || 'C').charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View>
                      <Text style={[styles.childPermName, { color: theme.textPrimary }]}>{child.displayName || child.email}</Text>
                      <Text style={{ fontSize: 10, color: theme.success, fontWeight: '800' }}>BAĞLANTI: {child.connectionType || 'Mobil'}</Text>
                    </View>
                  </View>

                  {permsList.map((item, i) => (
                    <View key={i} style={[styles.childPermItem, { marginBottom: 8, opacity: item.status ? 1 : 0.8 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name={item.icon} size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                        <Text style={[styles.childPermLabel, { color: theme.textPrimary }]}>{item.label}</Text>
                      </View>
                      <View style={[styles.permStatusBadge, { backgroundColor: item.status ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                        <Text style={[styles.permStatusText, { color: item.status ? theme.success : theme.danger, fontSize: 10, fontWeight: '900' }]}>
                          {item.status ? "AÇIK" : "KAPALI"}
                        </Text>
                        <Ionicons name={item.status ? "checkmark-circle" : "close-circle"} size={14} color={item.status ? theme.success : theme.danger} style={{ marginLeft: 4 }} />
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}
          </BlurView>
        )}

        {/* ℹ️ DESTEK VE BİLGİ */}
        <View style={styles.supportSection}>
          <TouchableOpacity style={[styles.supportBtn, { backgroundColor: theme.iconBg }]} activeOpacity={0.7}>
            <Ionicons name="help-buoy" size={18} color={theme.textPrimary} />
            <Text style={[styles.supportBtnText, { color: theme.textPrimary }]}>Yardım Merkezi</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.supportBtn, { backgroundColor: theme.iconBg }]} activeOpacity={0.7}>
            <Ionicons name="document-text" size={18} color={theme.textPrimary} />
            <Text style={[styles.supportBtnText, { color: theme.textPrimary }]}>Gizlilik Politikası</Text>
          </TouchableOpacity>
        </View>

        {/* ⚠️ DANGER ZONE */}
        <View style={styles.dangerZone}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LinearGradient colors={['#334155', '#0f172a']} style={styles.logoutGradient}>
              <Ionicons name="log-out" size={20} color="#fff" />
              <Text style={styles.logoutBtnText}>Güvenli Çıkış Yap</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.deleteBtn, { borderColor: theme.danger, backgroundColor: 'rgba(239, 68, 68, 0.05)' }]} onPress={handleDeleteAccount}>
            <Ionicons name="trash" size={18} color={theme.danger} style={{ marginRight: 8 }} />
            <Text style={[styles.deleteBtnText, { color: theme.danger }]}>Hesabı Kalıcı Olarak Sil</Text>
          </TouchableOpacity>
        </View>

        {/* VERSİYON BİLGİSİ */}
        <Text style={styles.versionText}>Aegis Protocol v2.4.1</Text>

      </ScrollView>

      {/* ✏️ İSİM DÜZENLEME MODALI */}
      <Modal visible={editNameModal} transparent animationType="fade">
        <BlurView intensity={isDarkMode ? 40 : 20} tint="dark" style={styles.modalOverlay}>
          <View style={[styles.editBox, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Görünen Adı Düzenle</Text>

            <TextInput
              style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.inputBg, borderColor: theme.surfaceBorder }]}
              value={tempName}
              onChangeText={setTempName}
              placeholder="Adınız veya Unvanınız"
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.surfaceBorder }]} onPress={() => { triggerHaptic('Light'); setEditNameModal(false); }}>
                <Text style={[styles.cancelText, { color: theme.textPrimary }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtnModal, { backgroundColor: theme.accent }]} onPress={handleUpdateName}>
                <Text style={styles.saveTextModal}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>

    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },

  absoluteBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },
  glowTopRight: { position: 'absolute', top: -50, right: -50, width: 350, height: 350, borderRadius: 175, opacity: 0.5 },
  glowTopLeft: { position: 'absolute', top: 100, left: -100, width: 300, height: 300, borderRadius: 150, opacity: 0.3 },

  floatingHeader: { position: 'absolute', top: 55, left: 15, right: 15, flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 25, borderWidth: 1, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, zIndex: 10 },
  headerBtn: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 15 },
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 130, paddingBottom: 50 },

  // Profil Alanı
  profileSection: { alignItems: 'center', marginBottom: 35 },
  avatarLarge: { width: 96, height: 96, borderRadius: 38, elevation: 15, shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, position: 'relative' },
  avatarFallback: { width: '100%', height: '100%', borderRadius: 38, justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 38, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  editBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#6366f1', width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 3 },

  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, paddingHorizontal: 10 },
  userName: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  userEmail: { fontSize: 13, marginTop: 4, fontWeight: '600' },

  proBadgeRow: { marginTop: 12 },
  proBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  proText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  sectionCard: { borderRadius: 30, padding: 22, marginBottom: 20, borderWidth: 1, overflow: 'hidden' },
  sectionTitle: { fontSize: 11, fontWeight: '900', marginBottom: 20, textTransform: 'uppercase', letterSpacing: 1.5 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, borderBottomWidth: 1, marginBottom: 15 },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  settingText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  settingSubText: { fontSize: 11, marginTop: 3, fontWeight: '600' },

  permRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, borderBottomWidth: 1, marginBottom: 15 },

  childPermBox: { padding: 18, borderRadius: 20, marginBottom: 15, borderWidth: 1 },
  childAvatarFallback: { width: 36, height: 36, borderRadius: 18, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  childAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12, borderWidth: 1 },
  childPermName: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  childPermItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  childPermLabel: { fontSize: 12, fontWeight: '700' },
  permStatusBadge: { flexDirection: 'row', alignItems: 'center' },
  permStatusText: { fontSize: 11, fontWeight: '900', marginLeft: 6, letterSpacing: 1 },

  supportSection: { flexDirection: 'row', gap: 10, marginBottom: 30 },
  supportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 18 },
  supportBtnText: { fontSize: 13, fontWeight: '800', marginLeft: 8 },

  dangerZone: { marginTop: 10 },
  logoutBtn: { borderRadius: 20, overflow: 'hidden', marginBottom: 15, elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10 },
  logoutGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60 },
  logoutBtnText: { marginLeft: 10, color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, borderRadius: 20, borderWidth: 1 },
  deleteBtnText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },

  versionText: { textAlign: 'center', marginTop: 25, fontSize: 11, color: '#94a3b8', fontWeight: '700', letterSpacing: 1 },

  // İsim Düzenleme Modalı
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 20 },
  editBox: { width: '100%', borderRadius: 30, padding: 30, borderWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '900', marginBottom: 25, textAlign: 'center', letterSpacing: -0.5 },
  input: { borderRadius: 16, paddingHorizontal: 20, height: 60, fontSize: 16, fontWeight: '800', borderWidth: 1, marginBottom: 25 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 18, borderRadius: 16, alignItems: 'center', borderWidth: 1 },
  cancelText: { fontWeight: '900', fontSize: 15 },
  saveBtnModal: { flex: 1, paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  saveTextModal: { fontWeight: '900', fontSize: 15, color: '#fff' }
});