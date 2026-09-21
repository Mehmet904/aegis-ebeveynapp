import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, StatusBar, Dimensions, Image, Animated } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { ref, onValue } from 'firebase/database';
import { db } from '../../utils/firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

// 🕒 Eski formatta net süre gösterimi (Eksi saniye korumalı)
function timeAgo(ts) {
  if (!ts) return 'Bağlantı Yok';
  // Math.max(0, ...) ile eksi saniye çıkmasını engelliyoruz (Saat senkronizasyon farkları için)
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return `${sec} sn önce`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const saat = Math.floor(min / 60);
  return `${saat} saat önce`;
}

const ChildMapScreen = ({ route, navigation }) => {
  const { childUid } = route.params;
  const mapRef = useRef(null);

  const [location, setLocation] = useState(null);
  const [childName, setChildName] = useState('Veri Yükleniyor...');
  const [childAvatar, setChildAvatar] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [iconLoaded, setIconLoaded] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mapType, setMapType] = useState('standard');
  const [isFirstFocus, setIsFirstFocus] = useState(true); // 🚀 Üste alındı (Hook kuralı)

  const theme = useMemo(() => ({
    bg: isDarkMode ? '#020617' : '#f8fafc',
    blur: isDarkMode ? 'dark' : 'light',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#cbd5e1' : '#64748b',
    border: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
    iconActive: isDarkMode ? '#38bdf8' : '#6366f1',
    iconUnactive: isDarkMode ? '#94a3b8' : '#64748b',
    headerBg: isDarkMode ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
    btnBg: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f1f5f9'
  }), [isDarkMode]);

  const triggerHaptic = (style = 'Light') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle[style]).catch(() => {});
  };

  useEffect(() => {
    const locRef = ref(db, `users/${childUid}/location`);
    const unsubLoc = onValue(locRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.latitude && data?.longitude) {
        setLocation({ latitude: data.latitude, longitude: data.longitude });
        setLastUpdate(data.timestamp || null);
        setSpeed(data.speed || 0);
      }
      setLoading(false);
    });

    const infoRef = ref(db, `users/${childUid}`);
    const unsubInfo = onValue(infoRef, (snap) => {
      const val = snap.val();
      setChildName(val?.displayName || 'Terminal');
      setChildAvatar(val?.profileImage || null);
    });

    return () => { unsubLoc(); unsubInfo(); };
  }, [childUid]);

  // 🚀 HARİTA İLK AÇILDIĞINDA OTOMATİK ODAKLANMA (Kamera Uçuşu)
  useEffect(() => {
    if (location && isFirstFocus && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 1500); 
      setIsFirstFocus(false); 
    }
  }, [location, isFirstFocus]); // Bağımlılıklar güncellendi

  // 🚀 ÇÖZÜM: isOld (useMemo) hook'u return bloğunun üstüne alındı!
  const isOld = useMemo(() => {
    return !lastUpdate || (Date.now() - lastUpdate > 5 * 60 * 1000);
  }, [lastUpdate]);

  // 🎯 İdeal Odaklanma - GÜVENLİ VERSİYON
  const recenterMap = () => {
    triggerHaptic('Medium');
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 1000);
    }
  };

  // 🌍 Özel Google Maps Taktiksel Gece Teması (JSON)
  const mapDarkStyle = [
    { "elementType": "geometry", "stylers": [{ "color": "#1d2c4d" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#8ec3b9" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1a3646" }] },
    { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [{ "color": "#4b6878" }] },
    { "featureType": "landscape.natural", "elementType": "geometry", "stylers": [{ "color": "#023e58" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#304a7d" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0e1626" }] }
  ];

  // ⚠️ ERKEN RETURN BLOĞU BURAYA ALINDI (Tüm Hook'lardan sonra!)
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Canlı Bağlantı Kuruluyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        mapType={mapType}
        customMapStyle={isDarkMode && mapType === 'standard' ? mapDarkStyle : []}
        showsUserLocation={false}
        showsCompass={false}
        showsMyLocationButton={false}
        initialRegion={location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        } : null}
      >
        {location && (
          <Marker 
            coordinate={location} 
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={childAvatar ? !iconLoaded : false} 
          >
            <View style={styles.markerContainer}>
              <View style={[styles.markerRadar2, { backgroundColor: isOld ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)' }]} />
              <View style={[styles.markerRadar1, { backgroundColor: isOld ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)' }]} />
              <View style={[styles.markerCore, { backgroundColor: isOld ? '#ef4444' : '#10b981', borderColor: '#fff' }]}>
                {childAvatar ? (
                  <Image 
                    source={{ uri: childAvatar }} 
                    style={styles.markerImage} 
                    onLoad={() => setIconLoaded(true)} 
                    onError={() => setIconLoaded(true)} 
                  />
                ) : (
                  <Ionicons 
                    name={speed > 5 ? "car" : "person"} 
                    size={16} 
                    color="#fff" 
                    onLayout={() => setIconLoaded(true)} 
                  />
                )}
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {!location && !loading && (
        <View style={{ position: 'absolute', top: '50%', alignSelf: 'center', backgroundColor: isDarkMode ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.9)', padding: 15, borderRadius: 20, alignItems: 'center' }}>
          <Ionicons name="satellite-outline" size={32} color={theme.textSecondary} />
          <Text style={{ marginTop: 10, color: theme.textPrimary, fontWeight: '700' }}>Konum Aranıyor...</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 5 }}>Çocuğun cihazından ilk GPS{'\n'}sinyali bekleniyor.</Text>
        </View>
      )}

      <BlurView intensity={isDarkMode ? 70 : 90} tint={theme.blur} style={[styles.floatingHeader, { backgroundColor: theme.headerBg, borderColor: theme.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.btnBg, elevation: isDarkMode ? 0 : 2 }]} activeOpacity={0.7} onPress={() => { triggerHaptic('Light'); navigation.goBack(); }}>
          <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.childNameText, { color: theme.textPrimary }]}>{childName}</Text>
            <View style={[styles.speedBadge, { backgroundColor: speed > 20 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
              <Ionicons name="speedometer" size={10} color={speed > 20 ? "#ef4444" : "#10b981"} style={{marginRight: 4}} />
              <Text style={[styles.speedText, { color: speed > 20 ? "#ef4444" : "#10b981" }]}>{speed} km/s</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: isOld ? '#ef4444' : '#10b981' }]} />
            <Text style={[styles.statusText, { color: theme.textSecondary }]}>{timeAgo(lastUpdate)}</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.themeToggle, { backgroundColor: theme.btnBg, elevation: isDarkMode ? 0 : 2 }]} onPress={() => { triggerHaptic('Heavy'); setIsDarkMode(!isDarkMode); }}>
          <Ionicons name={isDarkMode ? "moon" : "sunny"} size={18} color={isDarkMode ? "#fff" : "#f59e0b"} />
        </TouchableOpacity>
      </BlurView>

      <View style={styles.rightControls}>
        <BlurView intensity={isDarkMode ? 70 : 90} tint={theme.blur} style={[styles.controlBox, { borderColor: theme.border, backgroundColor: isDarkMode ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.9)' }]}>
          <TouchableOpacity style={styles.typeBtn} onPress={() => { triggerHaptic('Medium'); setMapType(mapType === 'standard' ? 'satellite' : 'standard'); }}>
            <MaterialCommunityIcons name={mapType === 'standard' ? "layers-outline" : "map-outline"} size={22} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={[styles.controlSeparator, { backgroundColor: theme.border }]} />
          <TouchableOpacity style={styles.typeBtn} onPress={recenterMap}>
            <Ionicons name="locate" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
        </BlurView>
      </View>

      {isOld && location && (
        <BlurView intensity={80} tint={theme.blur} style={[styles.warningFloating, { borderColor: theme.border, backgroundColor: isDarkMode ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.95)' }]}>
          <View style={styles.warningIconWrap}>
            <Ionicons name="warning" size={18} color="#ef4444" />
          </View>
          <Text style={[styles.warningText, { color: isDarkMode ? '#fca5a5' : '#dc2626' }]}>Bağlantı zayıf. Cihazın interneti kapalı veya cihaz çevrimdışı olabilir.</Text>
        </BlurView>
      )}

      <View style={styles.actionColumn}>
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.8}
          onPress={() => { triggerHaptic('Heavy'); navigation.navigate('ChildLocationHistoryScreen', { childUid }); }}
        >
          <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.btnGradient}>
            <Ionicons name="time" size={24} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChildMapScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  floatingHeader: { position: 'absolute', top: 55, left: 15, right: 15, flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 25, borderWidth: 1, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 15 },
  childNameText: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  speedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginLeft: 10 },
  speedText: { fontSize: 10, fontWeight: '900' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  themeToggle: { width: 44, height: 44, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  markerContainer: { alignItems: 'center', justifyContent: 'center', width: 80, height: 80 },
  markerRadar2: { position: 'absolute', width: 80, height: 80, borderRadius: 40 },
  markerRadar1: { position: 'absolute', width: 50, height: 50, borderRadius: 25 },
  markerCore: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, overflow: 'hidden' },
  markerImage: { width: '100%', height: '100%' },
  rightControls: { position: 'absolute', top: 140, right: 15, alignItems: 'center' },
  controlBox: { borderRadius: 20, padding: 5, borderWidth: 1, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  typeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  controlSeparator: { height: 1, width: '60%', alignSelf: 'center', marginVertical: 3 },
  warningFloating: { position: 'absolute', bottom: 40, left: 15, right: 90, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 20, borderWidth: 1, overflow: 'hidden', elevation: 5 },
  warningIconWrap: { backgroundColor: 'rgba(239, 68, 68, 0.15)', padding: 8, borderRadius: 14, marginRight: 12 },
  warningText: { flex: 1, fontWeight: '700', fontSize: 11, lineHeight: 16, letterSpacing: 0.5 },
  actionColumn: { position: 'absolute', bottom: 40, right: 15 },
  actionBtn: { width: 60, height: 60, borderRadius: 30, elevation: 15, shadowColor: '#4f46e5', shadowOpacity: 0.4, shadowRadius: 15, shadowOffset: { width: 0, height: 8 } },
  btnGradient: { flex: 1, borderRadius: 30, justifyContent: 'center', alignItems: 'center' }
});