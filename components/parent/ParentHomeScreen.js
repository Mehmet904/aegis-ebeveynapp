import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, BackHandler, Alert, StatusBar, Dimensions, Modal, Image, TextInput, ActivityIndicator, Animated } from 'react-native';
import { signOut } from 'firebase/auth';
import { ref, onValue, set, update, onChildAdded, get } from 'firebase/database';
import * as Notifications from 'expo-notifications';
import { auth, db } from '../../utils/firebaseConfig';
import { registerForPushNotificationsAsync } from '../../utils/notificationHelper';
import { RTCView } from 'react-native-webrtc';
import WebRTCService from '../../utils/WebRTCService';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

// Böldüğümüz Cihaz Kartı Bileşenini İçeri Aktarıyoruz
import DeviceCard from './DeviceCard';

const { width, height } = Dimensions.get('window');

const ParentHomeScreen = ({ navigation }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const theme = useMemo(() => ({
    bg: isDarkMode ? '#020617' : '#f8fafc',
    surface: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.9)',
    surfaceBorder: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    blur: isDarkMode ? 'dark' : 'light',
    accent: '#6366f1',
    danger: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
    cardBg: isDarkMode ? '#0f172a' : '#ffffff'
  }), [isDarkMode]);

  const [children, setChildren] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [activeMediaType, setActiveMediaType] = useState('audio');
  const [statusText, setStatusText] = useState('');
  const [remoteStream, setRemoteStream] = useState(null);
  const [listeningToChildId, setListeningToChildId] = useState(null);
  const [parentAvatar, setParentAvatar] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);
  const [newName, setNewName] = useState('');
  // 🚀 useState yerine useRef kullanıyoruz ki Firebase dinleyicisi içinde hep GÜNCEL kalsın
  const notifiedLowBatteryRef = useRef({});

  const islandPulse = useRef(new Animated.Value(1)).current;

  const triggerHaptic = (style = 'Light') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle[style]).catch(() => { });
  };

  useEffect(() => {
    if (isListening && activeMediaType === 'audio') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(islandPulse, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(islandPulse, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      ).start();
    } else {
      islandPulse.setValue(1);
    }
  }, [isListening, activeMediaType]);

  useEffect(() => {
    registerForPushNotificationsAsync().then(async (token) => {
      if (token && auth.currentUser) {
        await set(ref(db, `users/${auth.currentUser.uid}/pushToken`), token);
      }
    });

    if (auth.currentUser) {
      WebRTCService.connect(auth.currentUser.uid);
      WebRTCService.onRemoteStreamUpdate = (stream) => setRemoteStream(stream);
      onValue(ref(db, `users/${auth.currentUser.uid}`), (snap) => setParentAvatar(snap.val()?.profileImage || null));
    }

const subscription = Notifications.addNotificationReceivedListener(notification => {
      // 🚀 DEĞİŞİKLİK 1: Bildirim verisinden userId'yi de çekiyoruz
      const { type, action, userId } = notification.request.content.data || {}; 
      
      if (action === 'SOS') {
        triggerHaptic('Heavy');
        
        const title = notification.request.content.title || '🚨 ACİL DURUM SİNYALİ';
        const bodyText = notification.request.content.body 
            ? `${notification.request.content.body}\n\nHemen konumunu kontrol etmek ister misiniz?` 
            : 'Çocuğunuz SOS butonuna bastı! Hemen konumunu kontrol etmek ister misiniz?';

        Alert.alert(
          title,
          bodyText,
          [
            { text: 'Şimdi Değil', style: 'cancel' },
            // 🚀 DEĞİŞİKLİK 2: Harita sayfasına çocuğun ID'sini (childUid) gönderiyoruz
            { text: 'KONUMU GÖR', onPress: () => navigation.navigate('ChildMapScreen', { childUid: userId }) } 
          ]
        );
      }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      // 🚀 DEĞİŞİKLİK 3: Arkaplan bildirimi için de userId'yi çekiyoruz
      const { action, userId } = response.notification.request.content.data || {}; 
      
      if (action === 'SOS') {
        triggerHaptic('Heavy');
        // 🚀 DEĞİŞİKLİK 4: Harita sayfasına çocuğun ID'sini (childUid) gönderiyoruz
        navigation.navigate('ChildMapScreen', { childUid: userId }); 
      }
    });

    return () => {
      WebRTCService.onRemoteStreamUpdate = null;
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isListening) {
      setStatusText(activeMediaType === 'audio' ? 'ORTAM SESİ DİNLENİYOR' : 'CANLI KAMERA AKTİF');
    } else {
      setStatusText('');
    }
    const backAction = () => { if (isListening) { handleStopListening(); return true; } return false; };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isListening, activeMediaType]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    let isMounted = true;
    const linkedRef = ref(db, `users/${user.uid}/linkedChildren`);
    let unsubscribes = [];

    const unsubLinked = onValue(linkedRef, (snap) => {
      const val = snap.val();
      if (!val) { setChildren([]); return; }
      const uids = Object.keys(val);

      uids.forEach(uid => {
        const unsubChild = onValue(ref(db, `users/${uid}`), (userSnap) => {
          const childData = { uid, ...userSnap.val() };

          // 🚀 KRİTİK DÜZELTME: useRef üzerinden kontrol ediyoruz.
          if (childData.batteryLevel <= 10 && !childData.isCharging && !notifiedLowBatteryRef.current[uid]) {
            triggerHaptic('Heavy');
            Alert.alert(
              "⚠️ KRİTİK GÜÇ SEVİYESİ",
              `${childData.displayName || 'Cihaz'} terminalinin şarjı çok düşük (%${childData.batteryLevel})! Cihaz kapanmak üzere olabilir.`
            );
            // Bildirildi olarak işaretle
            notifiedLowBatteryRef.current[uid] = true;
          }

          // Eğer çocuk telefonu şarja takarsa VEYA pili 15'in üzerine çıkarsa kilidi sıfırla ki ileride tekrar uyarı verebilsin
          if ((childData.batteryLevel > 15 || childData.isCharging) && notifiedLowBatteryRef.current[uid]) {
            notifiedLowBatteryRef.current[uid] = false;
          }

          if (isMounted) {
            setChildren(prev => {
              const filtered = prev.filter(c => c.uid !== uid);
              return [...filtered, childData];
            });
          }
        });
        unsubscribes.push(unsubChild);

        const chatRef = ref(db, `chats/${uid}`);
        get(chatRef).then((snap) => {
          const existingChats = new Set();
          if (snap.exists()) Object.keys(snap.val()).forEach(key => existingChats.add(key));

          const unsubChat = onChildAdded(chatRef, async (newSnap) => {
            const msgId = newSnap.key;
            const msgData = newSnap.val();
            if (existingChats.has(msgId)) return;
            existingChats.add(msgId);

            if (msgData.senderId !== user.uid) {
              const childSnap = await get(ref(db, `users/${uid}`));
              const cName = childSnap.val()?.displayName || 'Terminal';

            }
          });

          if (!isMounted) unsubChat();
          else unsubscribes.push(unsubChat);
        });

const alertsRef = ref(db, `alerts/${uid}`);
        get(alertsRef).then((snapshot) => {
          const existingAlertIds = new Set();
          if (snapshot.exists()) Object.keys(snapshot.val()).forEach(key => existingAlertIds.add(key));

          const unsubAlert = onChildAdded(alertsRef, async (newSnap) => {
            const alertId = newSnap.key;
            const alertData = newSnap.val();
            if (existingAlertIds.has(alertId)) return;
            existingAlertIds.add(alertId);

            triggerHaptic('Heavy');

            // 🚀 BİLDİRİM KANALLARI BURAYA EKLENDİ
            const isSOS = alertData.type === 'SOS';
            const targetChannel = isSOS ? 'sos-alerts-pro' : 'geofence-alerts';

            // 🚀 DEĞİŞİKLİK: Veritabanına kaydettiğimiz çocuğun ismini alert başlığına çekiyoruz
            const childName = alertData.childName || 'Çocuğunuz';

            // ✅ SADECE BU KALSIN (Uygulama açıkken ekrana çıkan uyarı kutusu güncellendi)
            Alert.alert(
              isSOS ? `🚨 ${childName} - ACİL SOS!` : `📍 ${childName} - SİSTEM BİLDİRİMİ`, 
              alertData.message
            );
          });

          if (!isMounted) unsubAlert();
          else unsubscribes.push(unsubAlert);
        });
      });
    });

    return () => {
      isMounted = false;
      unsubLinked();
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  const openEditModal = (child) => {
    triggerHaptic('Medium');
    setSelectedChild(child);
    setNewName(child.displayName || '');
    setEditModalVisible(true);
  };

  const handleUpdateChildName = async () => {
    if (!newName.trim()) return;
    try {
      await update(ref(db, `users/${selectedChild.uid}`), { displayName: newName });
      triggerHaptic('Success');
      setEditModalVisible(false);
    } catch (error) { }
  };

  const handleDeleteChild = (child) => {
    triggerHaptic('Heavy');
    Alert.alert("Sistemden Çıkar", "Cihaz bağlantısını kalıcı olarak kesmek istediğinize emin misiniz?", [
      { text: "İptal", style: "cancel", onPress: () => triggerHaptic('Light') },
      {
        text: "Kalıcı Olarak Sil", style: "destructive", onPress: async () => {
          try {
            await set(ref(db, `users/${auth.currentUser.uid}/linkedChildren/${child.uid}`), null);
            await update(ref(db, `users/${child.uid}`), { linkedParent: null });
            triggerHaptic('Success');
            setEditModalVisible(false);
          } catch (error) { }
        }
      }
    ]
    );
  };

  const handleStartConnection = async (childId, mediaType = 'audio') => {
    triggerHaptic('Medium');
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, staysActiveInBackground: true, playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
    if (isListening) handleStopListening();
    setActiveMediaType(mediaType);
    setListeningToChildId(childId);
    setIsListening(true);

    try {
      const childSnap = await get(ref(db, `users/${childId}`));
      const childToken = childSnap.val()?.pushToken;

      if (childToken) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: childToken,
            priority: 'high',
            data: { action: 'WAKE_UP_WEBRTC' }
          }),
        }).catch(() => { });
      }

      setTimeout(async () => {
        try {
          await WebRTCService.call(childId, mediaType);
        } catch (error) {
          setIsListening(false);
          triggerHaptic('Error');
        }
      }, 1500);

    } catch (error) {
      setIsListening(false);
      triggerHaptic('Error');
    }
  };

  const openCameraSelect = (childId) => {
    triggerHaptic('Light');
    Alert.alert("Aktif Lens Seçimi", "Hangi kameraya bağlanmak istiyorsunuz?", [
      { text: "İptal", style: "cancel" },
      { text: "Ön Kamera", onPress: () => handleStartConnection(childId, 'video-front') },
      { text: "Arka Kamera", onPress: () => handleStartConnection(childId, 'video-back') }
    ]);
  };

  const handleStopListening = () => {
    triggerHaptic('Light');
    WebRTCService.stop();
    setIsListening(false);
    setRemoteStream(null);
    setListeningToChildId(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      <View style={styles.absoluteBackground}>
        <LinearGradient colors={isDarkMode ? ['#312e81', 'transparent'] : ['#e0e7ff', 'transparent']} style={styles.glowTopRight} />
        <LinearGradient colors={isDarkMode ? ['#064e3b', 'transparent'] : ['#d1fae5', 'transparent']} style={styles.glowTopLeft} />
      </View>

      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.welcomeText, { color: theme.accent }]}>AEGIS MERKEZİ</Text>
          <Text style={[styles.parentName, { color: theme.textPrimary }]}>Komuta Paneli</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => { triggerHaptic('Heavy'); setIsDarkMode(!isDarkMode); }} style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]} activeOpacity={0.7}>
            <Ionicons name={isDarkMode ? "sunny" : "moon"} size={18} color={isDarkMode ? "#f59e0b" : "#6366f1"} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder, marginLeft: 10 }]} activeOpacity={0.7} onPress={() => { triggerHaptic(); navigation.navigate('AlertsScreen'); }}>
            <View style={styles.notificationDot} />
            <Ionicons name="notifications" size={18} color={theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileBtn} activeOpacity={0.9} onPress={() => { triggerHaptic(); navigation.navigate('ProfileScreen'); }}>
            {parentAvatar ? <Image source={{ uri: parentAvatar }} style={styles.profileImage} /> : <Ionicons name="person" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>

      {remoteStream && activeMediaType === 'audio' && <RTCView streamURL={remoteStream.toURL()} style={{ width: 0, height: 0, position: 'absolute' }} />}

      <Modal visible={isListening && activeMediaType.startsWith('video')} transparent={false} animationType="fade">
        <View style={styles.videoContainer}>
          <StatusBar hidden />
          {remoteStream ? (
            <RTCView streamURL={remoteStream.toURL()} style={styles.fullScreenVideo} objectFit="cover" />
          ) : (
            <View style={styles.videoLoading}>
              <ActivityIndicator size="large" color="#10b981" />
              <Text style={styles.videoLoadingText}>UPLINK ESTABLISHING...</Text>
            </View>
          )}

          <View style={styles.hudOverlay}>
            <View style={styles.hudTopBar}>
              <View style={styles.liveIndicatorBox}>
                <View style={styles.liveRedDot} />
                <Text style={styles.liveIndicatorText}>LIVE FEED</Text>
              </View>
              <Text style={styles.hudTime}>{new Date().toLocaleTimeString('en-US', { hour12: false })}</Text>
            </View>

            <View style={styles.crosshairCenter}>
              <View style={styles.crosshairDot} />
            </View>
            <View style={[styles.hudCorner, styles.hudTopLeft]} />
            <View style={[styles.hudCorner, styles.hudTopRight]} />
            <View style={[styles.hudCorner, styles.hudBottomLeft]} />
            <View style={[styles.hudCorner, styles.hudBottomRight]} />

            <View style={styles.hudBottomBar}>
              <View>
                <Text style={styles.hudDataText}>LENS_SYSTEM: {activeMediaType === 'video-front' ? 'FRONT_CAM_01' : 'MAIN_REAR_CAM'}</Text>
                <Text style={styles.hudDataText}>ENCRYPTION: AES-256 SECURE</Text>
              </View>
              <TouchableOpacity style={styles.closeVideoBtn} activeOpacity={0.8} onPress={handleStopListening}>
                <Ionicons name="power" size={24} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 150, paddingTop: 10 }}>

        <View style={styles.widgetGrid}>
          <TouchableOpacity 
            style={styles.widgetCard} 
            activeOpacity={0.8} 
            onPress={() => { 
              triggerHaptic('Medium'); 
              // 🚀 DEĞİŞİKLİK: Eğer bağlı hiçbir çocuk yoksa uyarı ver ve haritaya girme
              if (children.length === 0) {
                  Alert.alert('Bağlı Cihaz Yok', 'Sınır yönetimi özelliğini kullanabilmek için önce sisteme bir terminal (cihaz) eklemelisiniz.');
                  return;
              }
              navigation.navigate('GeofenceMapScreen'); 
            }}
          >
            <LinearGradient colors={['#4f46e5', '#3730a3']} style={styles.widgetGradient}>
              <View style={styles.widgetTop}>
                <Ionicons name="shield-checkmark" size={22} color="#fff" />
                <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.5)" />
              </View>
              <View>
                <Text style={styles.widgetTitle}>Sınır Yönetimi</Text>
                <Text style={styles.widgetSub}>Güvenli Bölge</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.widgetCard} activeOpacity={0.8} onPress={() => { triggerHaptic(); navigation.navigate('ParentPairing'); }}>
            <LinearGradient colors={['#10b981', '#047857']} style={styles.widgetGradient}>
              <View style={styles.widgetTop}>
                <Ionicons name="scan" size={22} color="#fff" />
                <Ionicons name="add" size={18} color="rgba(255,255,255,0.5)" />
              </View>
              <View>
                <Text style={styles.widgetTitle}>Cihaz Ekle</Text>
                <Text style={styles.widgetSub}>Yeni bağlantı</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Aktif Terminaller</Text>
          <View style={styles.badgeCount}><Text style={styles.badgeCountText}>{children.length}</Text></View>
        </View>

        {/* HARİKA TEMİZLİK: Sadece tek bir satırla Cihaz Kartları yükleniyor */}
        {children.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Ionicons name="hardware-chip-outline" size={40} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textPrimary }]}>Sisteme bağlı cihaz yok.</Text>
            <Text style={[styles.emptySubText, { color: theme.textSecondary }]}>Sağ üstteki 'Cihaz Ekle' butonundan yeni bir terminal bağlayabilirsiniz.</Text>
          </View>
        ) : (
          children.map(child => (
<DeviceCard 
          key={child.uid}
          child={child}
          theme={theme}
          isListening={isListening}
          listeningToChildId={listeningToChildId}
          activeMediaType={activeMediaType}
          onNavigate={(route, params) => navigation.navigate(route, params)}
          onEdit={openEditModal}
          onCameraSelect={openCameraSelect}
          

          
          // 👻 İŞTE BURAYA EKLİYORUZ: Ana sayfadan Hayalet Dürtme motorunu tetikleme
          onPing={(uid) => {
            triggerHaptic('Light');
            WebRTCService.pingDevice(uid);
          }}
          
onSiren={(uid) => WebRTCService.triggerSiren(uid)}
          
          // 🚀 DEĞİŞEN KISIM: Sadece sayfaya yönlendiriyoruz, WebRTC'yi başlatmıyoruz
          onToggleAudio={(uid) => {
            triggerHaptic('Light');
            navigation.navigate('AudioListeningScreen', { 
              childId: uid, 
              childName: child.displayName || child.email 
            });
          }}
          
          triggerHaptic={triggerHaptic}
        />
          ))
        )}

      </ScrollView>

      <Modal visible={editModalVisible} transparent animationType="slide">
        <BlurView intensity={isDarkMode ? 40 : 20} tint="dark" style={styles.modalOverlay}>
          <View style={[styles.editBox, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <View style={styles.modalDragIndicator} />
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Terminal Konfigürasyonu</Text>

            <View style={[styles.inputGroup, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.3)' : '#f1f5f9', borderColor: theme.surfaceBorder }]}>
              <Ionicons name="pricetag-outline" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.textPrimary }]}
                value={newName}
                onChangeText={setNewName}
                placeholder="Cihaz İsmi"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <TouchableOpacity style={styles.deleteLinkBtn} activeOpacity={0.8} onPress={() => handleDeleteChild(selectedChild)}>
              <Ionicons name="warning" size={20} color={theme.danger} />
              <Text style={[styles.deleteLinkText, { color: theme.danger }]}>Sistemden Kalıcı Olarak Sil</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.surfaceBorder }]} onPress={() => { triggerHaptic('Light'); setEditModalVisible(false); }}>
                <Text style={[styles.cancelText, { color: theme.textPrimary }]}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={handleUpdateChildName}>
                <Text style={styles.saveText}>Ayarları Güncelle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>

      {statusText && activeMediaType === 'audio' ? (
        <View style={styles.dynamicIsland}>
          <Animated.View style={[styles.audioWaveContainer, { transform: [{ scale: islandPulse }] }]}>
            <View style={styles.liveAudioDot} />
          </Animated.View>
          <Text style={styles.islandText}>{statusText}</Text>
          <TouchableOpacity onPress={handleStopListening} style={styles.islandStopBtn}>
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  absoluteBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },
  glowTopRight: { position: 'absolute', top: -50, right: -50, width: 350, height: 350, borderRadius: 175, opacity: 0.5 },
  glowTopLeft: { position: 'absolute', top: 100, left: -100, width: 300, height: 300, borderRadius: 150, opacity: 0.4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 65, paddingHorizontal: 25, paddingBottom: 25 },
  headerTextWrap: { flex: 1 },
  welcomeText: { fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  parentName: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1, elevation: 2 },
  notificationDot: { position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1.5, borderColor: '#fff', zIndex: 1 },
  profileBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginLeft: 12, elevation: 5 },
  profileImage: { width: '100%', height: '100%', borderRadius: 23, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  widgetGrid: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 25, gap: 15 },
  widgetCard: { flex: 1, height: 110, borderRadius: 24, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  widgetGradient: { flex: 1, padding: 18, justifyContent: 'space-between' },
  widgetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  widgetTitle: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  widgetSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, marginBottom: 15 },
  sectionTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  badgeCount: { backgroundColor: '#6366f1', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 10 },
  badgeCountText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  emptyBox: { marginHorizontal: 20, padding: 30, borderRadius: 30, borderWidth: 1, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  emptyText: { fontSize: 16, fontWeight: '800', marginTop: 15, marginBottom: 5 },
  emptySubText: { fontSize: 13, textAlign: 'center', lineHeight: 20, fontWeight: '500' },
  videoContainer: { flex: 1, backgroundColor: '#000' },
  fullScreenVideo: { width: '100%', height: '100%', position: 'absolute' },
  hudOverlay: { flex: 1, justifyContent: 'space-between', padding: 30 },
  videoLoading: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  videoLoadingText: { color: '#10b981', marginTop: 20, fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  hudTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  liveIndicatorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#ef4444' },
  liveRedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 6 },
  liveIndicatorText: { color: '#ef4444', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  hudTime: { color: '#10b981', fontSize: 14, fontWeight: '700', fontFamily: 'monospace' },
  crosshairCenter: { position: 'absolute', top: '50%', left: '50%', width: 40, height: 40, marginLeft: -20, marginTop: -20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  crosshairDot: { width: 4, height: 4, backgroundColor: '#10b981', borderRadius: 2 },
  hudCorner: { position: 'absolute', width: 40, height: 40, borderColor: '#10b981' },
  hudTopLeft: { top: 120, left: 30, borderTopWidth: 2, borderLeftWidth: 2 },
  hudTopRight: { top: 120, right: 30, borderTopWidth: 2, borderRightWidth: 2 },
  hudBottomLeft: { bottom: 140, left: 30, borderBottomWidth: 2, borderLeftWidth: 2 },
  hudBottomRight: { bottom: 140, right: 30, borderBottomWidth: 2, borderRightWidth: 2 },
  hudBottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  hudDataText: { color: '#10b981', fontSize: 10, fontWeight: '700', fontFamily: 'monospace', marginBottom: 4 },
  closeVideoBtn: { backgroundColor: '#10b981', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 10 },
  dynamicIsland: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: '#000', paddingLeft: 20, paddingRight: 8, paddingVertical: 8, borderRadius: 30, flexDirection: 'row', alignItems: 'center', elevation: 25, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20 },
  audioWaveContainer: { width: 12, height: 12, justifyContent: 'center', alignItems: 'center' },
  liveAudioDot: { width: 8, height: 8, backgroundColor: '#ef4444', borderRadius: 4 },
  islandText: { color: '#fff', fontWeight: '800', fontSize: 10, letterSpacing: 1, marginHorizontal: 15 },
  islandStopBtn: { backgroundColor: '#334155', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  editBox: { width: '100%', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 35, paddingBottom: 50, borderWidth: 1 },
  modalDragIndicator: { width: 40, height: 5, backgroundColor: 'rgba(148, 163, 184, 0.3)', borderRadius: 3, alignSelf: 'center', marginBottom: 25 },
  modalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 30, letterSpacing: -0.5, textAlign: 'center' },
  inputGroup: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, paddingHorizontal: 20, marginBottom: 25, borderWidth: 1 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 60, fontSize: 16, fontWeight: '800' },
  deleteLinkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, marginBottom: 30, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  deleteLinkText: { fontWeight: '900', marginLeft: 10, fontSize: 14, letterSpacing: 0.5 },
  modalButtons: { flexDirection: 'row', gap: 15 },
  cancelBtn: { flex: 1, paddingVertical: 20, borderRadius: 20, alignItems: 'center', borderWidth: 1 },
  cancelText: { fontWeight: '900', fontSize: 15 },
  saveBtn: { flex: 1.5, paddingVertical: 20, borderRadius: 20, alignItems: 'center', elevation: 8, shadowColor: '#4f46e5', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  saveText: { fontWeight: '900', fontSize: 15, color: '#fff' }
});

export default ParentHomeScreen;