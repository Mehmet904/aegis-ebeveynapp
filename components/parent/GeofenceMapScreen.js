import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Modal, TouchableOpacity, Alert, FlatList, StatusBar, Dimensions, Image, Animated } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import { ref, onValue, set, remove, push } from 'firebase/database';
import { auth, db } from '../../utils/firebaseConfig';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';

const { width } = Dimensions.get('window');
const spectrumColors = ['#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080', '#ff0000'];

// 🎯 YENİ: Etikete Göre Akıllı İkon Seçici
const getZoneIcon = (label) => {
  const l = label.toLowerCase();
  if (l.includes('ev') || l.includes('home')) return 'home';
  if (l.includes('okul') || l.includes('school') || l.includes('lise') || l.includes('kolej')) return 'school';
  if (l.includes('park') || l.includes('bahçe')) return 'leaf';
  if (l.includes('spor') || l.includes('kurs') || l.includes('gym')) return 'basketball';
  if (l.includes('avm') || l.includes('market')) return 'cart';
  if (l.includes('hastane') || l.includes('sağlık')) return 'medkit';
  return 'shield-checkmark'; // Varsayılan Kalkan İkonu
};

const GeofenceMapScreen = ({ navigation }) => {
  const mapRef = useRef(null);
  const [markers, setMarkers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newMarker, setNewMarker] = useState(null);
  const [label, setLabel] = useState('');
  const [radius, setRadius] = useState(150);
  const [color, setColor] = useState('#6366f1');
  const [region, setRegion] = useState(null);

  const [childLocations, setChildLocations] = useState([]);
  const [activeChildId, setActiveChildId] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mapType, setMapType] = useState('standard');

  const theme = useMemo(() => ({
    bg: isDarkMode ? '#020617' : '#f8fafc',
    blur: isDarkMode ? 'dark' : 'light',
    surface: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#cbd5e1' : '#64748b',
    border: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
    inputBg: isDarkMode ? 'rgba(0,0,0,0.3)' : '#f1f5f9',
    controlBg: isDarkMode ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.9)'
  }), [isDarkMode]);

  const triggerHaptic = (style = 'Light') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle[style]).catch(() => { });
  };

  const handleLongPress = (e) => {
    triggerHaptic('Heavy');
    setNewMarker(e.nativeEvent.coordinate);
    setLabel('');
    setRadius(150);
    setModalVisible(true);
  };

  useEffect(() => {
    const parent = auth.currentUser;
    if (!parent) return;

    const linkedRef = ref(db, `users/${parent.uid}/linkedChildren`);
    return onValue(linkedRef, (snap) => {
      const val = snap.val();
      if (!val) return setChildLocations([]);

      const uids = Object.keys(val);
      uids.forEach(uid => {
        onValue(ref(db, `users/${uid}`), (userSnap) => {
          const userData = userSnap.val();
          if (userData?.location) {
            setChildLocations(prev => {
              const filtered = prev.filter(l => l.uid !== uid);
              const newList = [...filtered, { uid, ...userData.location, profileImage: userData.profileImage, displayName: userData.displayName || 'Hedef' }];
              if (!activeChildId) setActiveChildId(uid);
              return newList;
            });
          }
        });
      });
    });
  }, []);

  useEffect(() => {
    const parent = auth.currentUser;
    if (!parent) return;
    return onValue(ref(db, `users/${parent.uid}/geofences`), (snap) => {
      const val = snap.val();
      setMarkers(val ? Object.entries(val).map(([key, v]) => ({ id: key, ...v })) : []);
    });
  }, []);

  const smartFocus = (specificChildId = null) => {
    triggerHaptic('Medium');
    let targetPoints = [];

    if (specificChildId) {
      const child = childLocations.find(c => c.uid === specificChildId);
      if (child) targetPoints = [{ latitude: child.latitude, longitude: child.longitude }];
    } else {
      targetPoints = [
        ...markers.map(m => ({ latitude: m.latitude, longitude: m.longitude })),
        ...childLocations.map(c => ({ latitude: c.latitude, longitude: c.longitude }))
      ];
    }

    if (targetPoints.length > 0 && mapRef.current) {
      try {
        mapRef.current.fitToCoordinates(targetPoints, {
          edgePadding: { top: 180, right: 80, bottom: 420, left: 80 },
          animated: true
        });
      } catch (err) {
        console.log("Zoom hatası engellendi:", err);
      }
    }
  };

  useEffect(() => {
    if (childLocations.length > 0 || markers.length > 0) {
      setTimeout(() => {
        smartFocus();
      }, 1000);
    }
  }, [childLocations.length, markers.length]);

  const handleColorPick = (event) => {
    const x = event.nativeEvent.locationX;
    const barWidth = width - 60;
    const percent = Math.max(0, Math.min(1, x / barWidth));
    const colorIndex = Math.floor(percent * (spectrumColors.length - 1));
    const selectedColor = spectrumColors[colorIndex];
    if (selectedColor !== color) { setColor(selectedColor); triggerHaptic('Selection'); }
  };

  const handleAddMarker = async () => {
    if (!label.trim()) return Alert.alert('Hata', 'Lütfen bölgeye bir isim verin.');
    triggerHaptic('Success');
    const markerRef = push(ref(db, `users/${auth.currentUser.uid}/geofences`));
    await set(markerRef, { latitude: newMarker.latitude, longitude: newMarker.longitude, radius, label: label.trim(), color });
    setModalVisible(false);
  };

  const handleDeleteMarker = (id) => {
    triggerHaptic('Medium');
    Alert.alert('Alanı Sil', 'Bu bölge tüm çocuklar için devre dışı bırakılacak.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          await remove(ref(db, `users/${auth.currentUser.uid}/geofences/${id}`));
        }
      }
    ]);
  };

  const mapDarkStyle = [{ "elementType": "geometry", "stylers": [{ "color": "#1d2c4d" }] }, { "elementType": "labels.text.fill", "stylers": [{ "color": "#8ec3b9" }] }, { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1a3646" }] }, { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [{ "color": "#4b6878" }] }, { "featureType": "landscape.natural", "elementType": "geometry", "stylers": [{ "color": "#023e58" }] }, { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#304a7d" }] }, { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0e1626" }] }];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        mapType={mapType}
        customMapStyle={isDarkMode && mapType === 'standard' ? mapDarkStyle : []}
        onLongPress={handleLongPress}
        showsUserLocation={false}
        showsCompass={false}
        showsMyLocationButton={false}
        initialRegion={{ latitude: 39.9334, longitude: 32.8597, latitudeDelta: 5, longitudeDelta: 5 }}
      >
        {/* Güvenli Alanlar (Yeni Tasarım) */}
        {markers.map((marker) => (
          <React.Fragment key={marker.id}>
            <Marker coordinate={{ latitude: marker.latitude, longitude: marker.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
              {/* 🎯 YENİ: Anlamlı İkon Marker'ı */}
              <View style={[styles.zoneMarkerWrap, { backgroundColor: marker.color + '30' }]}>
                <View style={[styles.zoneMarkerCore, { backgroundColor: marker.color }]}>
                  <Ionicons name={getZoneIcon(marker.label)} size={16} color="#fff" />
                </View>
              </View>
              <Callout tooltip>
                <View style={[styles.modernCallout, { backgroundColor: theme.surface, borderColor: marker.color }]}>
                  <Text style={[styles.calloutTitle, { color: marker.color }]}>{marker.label}</Text>
                  <Text style={[styles.calloutSubtitle, { color: theme.textSecondary }]}>Kayıtlı Güvenli Alan</Text>
                </View>
              </Callout>
            </Marker>
            {/* 🎯 YENİ: Kesik Çizgili (Radar) Sınır */}
            <Circle
              center={{ latitude: marker.latitude, longitude: marker.longitude }}
              radius={marker.radius}
              strokeColor={marker.color}
              strokeWidth={3}
              fillColor={marker.color + '25'}
              lineDashPattern={[6, 6]} // Sanal sınır hissi
            />
          </React.Fragment>
        ))}

        {/* Çocuk Konumları */}
        {childLocations.map((loc) => (
          <Marker key={loc.uid} coordinate={{ latitude: loc.latitude, longitude: loc.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.childMarkerWrapper}>
              <View style={[styles.childMarkerPulse, { backgroundColor: isDarkMode ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.1)' }]} />
              <View style={[styles.childMarkerCore, { borderColor: activeChildId === loc.uid ? '#6366f1' : '#fff' }]}>
                {loc.profileImage ? <Image source={{ uri: loc.profileImage }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="person" size={14} color="#fff" />}
              </View>
            </View>
            <Callout tooltip>
              <View style={[styles.childCalloutBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.calloutRow}>
                  <View style={styles.liveIndicator} />
                  <Text style={[styles.childCalloutTitle, { color: theme.textPrimary }]}>{loc.displayName}</Text>
                </View>
                <Text style={styles.childCalloutSubtitle}>Canlı Konum</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Yüzen Taktiksel Header */}
      <BlurView intensity={isDarkMode ? 70 : 90} tint={theme.blur} style={[styles.floatingHeader, { borderColor: theme.border, backgroundColor: theme.controlBg }]}>
        <TouchableOpacity style={[styles.headerBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }]} onPress={() => { triggerHaptic(); navigation.goBack(); }}>
          <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Sanal Sınırlar</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Ionicons name="finger-print" size={12} color="#6366f1" style={{ marginRight: 4 }} />
            <Text style={styles.headerSubtitle}>Haritaya basılı tutarak alan ekleyin.</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.headerBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }]} onPress={() => { triggerHaptic('Heavy'); setIsDarkMode(!isDarkMode); }}>
          <Ionicons name={isDarkMode ? "moon" : "sunny"} size={20} color={isDarkMode ? "#fff" : "#f59e0b"} />
        </TouchableOpacity>
      </BlurView>

      {/* Çoklu Çocuk Seçici */}
      {childLocations.length > 1 && (
        <View style={styles.childPickerContainer}>
          <FlatList
            data={childLocations}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setActiveChildId(item.uid); smartFocus(item.uid); }}
                style={[styles.childCircle, activeChildId === item.uid && { borderColor: '#6366f1', elevation: 8 }]}
              >
                {item.profileImage ? <Image source={{ uri: item.profileImage }} style={styles.childMiniAvatar} /> : <Ionicons name="person" size={16} color="#64748b" />}
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Sağ Panel Kontrolleri */}
      <View style={styles.rightPanel}>
        <BlurView intensity={isDarkMode ? 70 : 100} tint={theme.blur} style={[styles.sideControl, { borderColor: theme.border, backgroundColor: theme.controlBg }]}>
          <TouchableOpacity style={styles.sideBtn} onPress={() => { triggerHaptic('Medium'); setMapType(mapType === 'standard' ? 'satellite' : 'standard'); }}>
            <MaterialCommunityIcons name={mapType === 'standard' ? "layers-outline" : "map-outline"} size={22} color={theme.textPrimary} />
          </TouchableOpacity>
          <View style={[styles.sideSeparator, { backgroundColor: theme.border }]} />
          <TouchableOpacity style={styles.sideBtn} onPress={() => smartFocus()}>
            <Ionicons name="locate" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
        </BlurView>
      </View>

      {/* Alt Alan Listesi */}
      <View style={styles.bottomList}>
        <FlatList
          data={markers}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          ListEmptyComponent={
            <BlurView intensity={isDarkMode ? 80 : 100} tint={theme.blur} style={[styles.emptyHint, { borderColor: theme.border }]}>
              <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.emptyHintText, { color: theme.textSecondary }]}>Haritaya basılı tutarak güvenli alan tanımlayın.</Text>
            </BlurView>
          }
          renderItem={({ item }) => (
            <BlurView intensity={isDarkMode ? 80 : 100} tint={theme.blur} style={[styles.areaChip, { borderLeftColor: item.color, borderColor: theme.border }]}>
              {/* Listede de akıllı ikonu gösterelim */}
              <View style={[styles.chipIconWrap, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={getZoneIcon(item.label)} size={16} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.chipLabel, { color: theme.textPrimary }]}>{item.label}</Text>
                <Text style={styles.chipSub}>{item.radius} Metre Çap</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteMarker(item.id)} style={styles.chipDelete}>
                <Ionicons name="close-circle" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </BlurView>
          )}
        />
      </View>

      {/* Alan Düzenleme Modalı */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <BlurView intensity={isDarkMode ? 40 : 20} tint="dark" style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalDrag} />
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Güvenli Sınır Oluştur</Text>

            <View style={styles.inputBox}>
              <Text style={styles.inputLabel}>LOKASYON ETİKETİ</Text>
              <TextInput placeholder="Örn: Ev, Okul, Park..." placeholderTextColor={theme.textSecondary} style={[styles.input, { backgroundColor: theme.inputBg, color: theme.textPrimary, borderColor: theme.border }]} value={label} onChangeText={setLabel} />
            </View>

            <View style={styles.sliderBox}>
              <View style={styles.sliderHeader}>
                <Text style={styles.inputLabel}>KORUMA ÇAPI</Text>
                <Text style={[styles.radiusVal, { color: color }]}>{radius} m</Text>
              </View>
              <Slider style={{ width: '100%', height: 40 }} minimumValue={50} maximumValue={1000} step={25} value={radius} onValueChange={(v) => { setRadius(v); triggerHaptic(); }} minimumTrackTintColor={color} maximumTrackTintColor={theme.border} thumbTintColor={color} />
            </View>

            <View style={styles.colorSelectionContainer}>
              <Text style={styles.inputLabel}>SPEKTRAL RENK</Text>
              <TouchableOpacity activeOpacity={1} onPress={handleColorPick} onLongPress={handleColorPick} style={styles.spectrumTouch}>
                <LinearGradient colors={spectrumColors} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.spectrumBar}>
                  <View style={[styles.colorIndicator, { left: (spectrumColors.indexOf(color) / spectrumColors.length) * (width - 60) || 0, backgroundColor: color }]} />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.saveBtn} activeOpacity={0.8} onPress={handleAddMarker}>
              <LinearGradient colors={[color, color + 'CC']} style={styles.saveGradient}>
                <Text style={styles.saveText}>SİSTEME KAYDET</Text>
                <Ionicons name="shield-checkmark" size={18} color="#fff" style={{ marginLeft: 10 }} />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
              <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>İptal Et</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
};

export default GeofenceMapScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  floatingHeader: { position: 'absolute', top: 55, left: 15, right: 15, flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 25, borderWidth: 1, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  headerBtn: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  headerSubtitle: { fontSize: 10, color: '#6366f1', fontWeight: '800', marginTop: 2 },

  childPickerContainer: { position: 'absolute', top: 125, left: 15, right: 15 },
  childCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', marginRight: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent', elevation: 4 },
  childMiniAvatar: { width: 40, height: 40, borderRadius: 20 },

  rightPanel: { position: 'absolute', top: 140, right: 15 },
  sideControl: { borderRadius: 20, padding: 5, borderWidth: 1, overflow: 'hidden', elevation: 5 },
  sideBtn: { width: 46, height: 46, justifyContent: 'center', alignItems: 'center' },
  sideSeparator: { height: 1, width: '50%', alignSelf: 'center', marginVertical: 2 },

  // 🎯 YENİ: Akıllı Bölge Pin Stilleri
  zoneMarkerWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  zoneMarkerCore: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff', elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4 },

  childMarkerWrapper: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  childMarkerCore: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#fff', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', backgroundColor: '#6366f1', elevation: 8 },
  childMarkerPulse: { position: 'absolute', width: 44, height: 44, borderRadius: 22 },

  modernCallout: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, minWidth: 120, alignItems: 'center', borderWidth: 1, elevation: 10 },
  calloutTitle: { fontSize: 13, fontWeight: '900', marginBottom: 2, letterSpacing: 0.5 },
  calloutSubtitle: { fontSize: 10, fontWeight: '700' },

  childCalloutBox: { paddingHorizontal: 15, paddingVertical: 12, borderRadius: 14, minWidth: 140, alignItems: 'center', borderWidth: 1, elevation: 10 },
  calloutRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  liveIndicator: { width: 8, height: 8, backgroundColor: '#10b981', borderRadius: 4, marginRight: 6 },
  childCalloutTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  childCalloutSubtitle: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },

  bottomList: { position: 'absolute', bottom: 40, left: 0, right: 0 },
  emptyHint: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, marginHorizontal: 20, borderWidth: 1 },
  emptyHintText: { fontSize: 12, fontWeight: '700', marginLeft: 10 },
  areaChip: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 25, marginRight: 12, borderWidth: 1, minWidth: 200, overflow: 'hidden', borderLeftWidth: 6 },

  // 🎯 YENİ: Alt Liste İçin İkon Kutusu
  chipIconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  chipLabel: { fontSize: 15, fontWeight: '900' },
  chipSub: { fontSize: 11, color: '#94a3b8', fontWeight: '700', marginTop: 2 },
  chipDelete: { marginLeft: 15, padding: 5 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 30, paddingBottom: 40, borderWidth: 1 },
  modalDrag: { width: 40, height: 5, backgroundColor: 'rgba(148,163,184,0.3)', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: '900', marginBottom: 25, textAlign: 'center', letterSpacing: -0.5 },
  inputBox: { marginBottom: 25 },
  inputLabel: { fontSize: 10, fontWeight: '900', color: '#64748b', marginBottom: 10, letterSpacing: 1.5 },
  input: { borderRadius: 16, padding: 18, fontSize: 16, fontWeight: '700', borderWidth: 1 },
  sliderBox: { marginBottom: 30 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  radiusVal: { fontSize: 16, fontWeight: '900' },
  colorSelectionContainer: { marginBottom: 40 },
  spectrumTouch: { width: '100%', height: 45, justifyContent: 'center' },
  spectrumBar: { width: '100%', height: 25, borderRadius: 12.5 },
  colorIndicator: { position: 'absolute', width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: '#fff', top: -2.5, elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3 },
  saveBtn: { borderRadius: 20, overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
  saveGradient: { paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  closeBtn: { marginTop: 20, alignSelf: 'center', padding: 10 }
});