import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, StatusBar, Dimensions } from 'react-native';
import { auth, db } from '../../utils/firebaseConfig';
import { ref, onValue } from 'firebase/database';
import { useNavigation } from '@react-navigation/native';
import WebRTCService from '../../utils/WebRTCService';
import { RTCView } from "react-native-webrtc";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur'; // 💎 Gerçek Cam Efekti
import * as Haptics from 'expo-haptics'; // 📳 Dokunsal Geri Bildirim

const { width } = Dimensions.get('window');

const ParentDashboard = () => {
  const [alerts, setAlerts] = useState([]);
  const [stream, setStream] = useState(null);
  const navigation = useNavigation();

  // 🌙 Tema Yönetimi (Dark Mode Varsayılan)
  const isDarkMode = true;
  const theme = useMemo(() => ({
    bg: isDarkMode ? '#020617' : '#f8fafc',
    surface: isDarkMode ? 'rgba(30, 41, 59, 0.45)' : 'rgba(255, 255, 255, 0.95)',
    border: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    blur: isDarkMode ? 'dark' : 'light'
  }), [isDarkMode]);

  const triggerHaptic = (style = 'Medium') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle[style]).catch(() => { });
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Bildirimleri Firebase'den dinle
    const alertsRef = ref(db, 'alerts');
    const unsubscribe = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val();
      const result = [];

      if (data) {
        for (const childId in data) {
          result.push({
            id: childId,
            ...data[childId],
          });
        }
      }
      // En yeni bildirimi en üstte göster
      setAlerts(result.reverse());
    });

    // WebRTC akışını yakala
    WebRTCService.onRemoteStreamUpdate = (remoteStream) => {
      setStream(remoteStream);
    };

    return () => {
      unsubscribe();
      WebRTCService.onRemoteStreamUpdate = null;
    };
  }, []);

  const renderItem = ({ item }) => (
    <BlurView intensity={isDarkMode ? 40 : 80} tint={theme.blur} style={[styles.glassCard, { borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        {/* 🚨 Kırmızı Parlayan İkon */}
        <View style={styles.iconOuterGlow}>
          <View style={styles.iconContainer}>
            <Ionicons name="warning" size={24} color="#ef4444" />
          </View>
        </View>

        <View style={styles.headerTextWrap}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Acil Durum Sinyali</Text>
          <Text style={styles.cardTime}>{new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</Text>
        </View>

        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>CANLI</Text>
        </View>
      </View>

      <View style={[styles.infoRow, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)' }]}>
        <Ionicons name="hardware-chip" size={16} color={theme.textSecondary} />
        <Text style={[styles.infoText, { color: theme.textPrimary }]}>Hedef Cihaz: <Text style={{ fontWeight: '800' }}>{item.id.slice(0, 8).toUpperCase()}</Text></Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.actionBtnPrimary}
          activeOpacity={0.8}
          onPress={() => {
            triggerHaptic('Heavy');
            navigation.navigate('ChildMap', { childUid: item.id });
          }}
        >
          <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.gradBtn}>
            <Ionicons name="locate" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.btnLabel}>Konumu Bul</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtnSecondary}
          activeOpacity={0.8}
          onPress={() => {
            triggerHaptic('Heavy');
            if (!auth.currentUser) return Alert.alert("Sistem Hatası", "Giriş yapılmadı.");
            try {
              WebRTCService.call(item.id);
            } catch (err) {
              Alert.alert("Bağlantı Hatası", "Güvenli bağlantı kurulamadı.");
            }
          }}
        >
          <LinearGradient colors={['#10b981', '#059669']} style={styles.gradBtn}>
            <Ionicons name="mic" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.btnLabel}>Ortam Sesi</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* 🎙 Gizli Ses Akışı */}
      {stream && (
        <RTCView streamURL={stream.toURL()} style={{ height: 0, width: 0 }} />
      )}
    </BlurView>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />

      {/* 🌌 Holografik Mesh Gradient Arka Plan */}
      <View style={styles.absoluteBackground}>
        <LinearGradient colors={isDarkMode ? ['#312e81', 'transparent'] : ['#e0e7ff', 'transparent']} style={styles.glowTopRight} />
        <LinearGradient colors={isDarkMode ? ['#064e3b', 'transparent'] : ['#d1fae5', 'transparent']} style={styles.glowTopLeft} />
      </View>

      {/* 🌟 Header Alanı */}
      <View style={styles.headerArea}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { triggerHaptic('Light'); navigation.goBack(); }}>
          <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={[styles.heading, { color: theme.textPrimary }]}>Aegis Sinyalleri</Text>
          <Text style={[styles.subHeading, { color: theme.textSecondary }]}>Sistemdeki tüm uyarılar ve acil durumlar.</Text>
        </View>
      </View>

      {/* 📋 Sinyal Listesi */}
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconGlow, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="shield-checkmark" size={64} color="#10b981" />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Sistem Temiz</Text>
            <Text style={styles.emptyText}>Şu an için her şey yolunda. Kaydedilmiş yeni bir ihlal veya panik sinyali bulunmuyor.</Text>
          </View>
        }
      />
    </View>
  );
};

export default ParentDashboard;

const styles = StyleSheet.create({
  container: { flex: 1 },

  absoluteBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },
  glowTopRight: { position: 'absolute', top: -50, right: -50, width: 350, height: 350, borderRadius: 175, opacity: 0.6 },
  glowTopLeft: { position: 'absolute', top: 100, left: -100, width: 300, height: 300, borderRadius: 150, opacity: 0.4 },

  headerArea: { flexDirection: 'row', alignItems: 'center', paddingTop: 65, paddingHorizontal: 25, paddingBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heading: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  subHeading: { fontSize: 13, marginTop: 4, fontWeight: '600', letterSpacing: 0.5 },

  listContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },

  // 🧊 Glassmorphism Alarm Kartı
  glassCard: {
    borderRadius: 30,
    padding: 22,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 15,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    overflow: 'hidden'
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },

  iconOuterGlow: { padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 20 },
  iconContainer: { width: 44, height: 44, backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.5)' },

  headerTextWrap: { flex: 1, marginLeft: 15 },
  cardTitle: { fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  cardTime: { fontSize: 12, color: '#94a3b8', fontWeight: '700', marginTop: 3, letterSpacing: 0.5 },

  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.4)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', marginRight: 5 },
  liveText: { color: '#ef4444', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, padding: 14, borderRadius: 16 },
  infoText: { fontSize: 13, marginLeft: 10, fontWeight: '600', letterSpacing: 0.5 },

  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  actionBtnPrimary: { flex: 1, borderRadius: 18, elevation: 8, shadowColor: '#4f46e5', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  actionBtnSecondary: { flex: 1, borderRadius: 18, elevation: 8, shadowColor: '#059669', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  gradBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 18 },
  btnLabel: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },

  // 🛡️ Boş Durum (Empty State)
  emptyContainer: { alignItems: 'center', marginTop: 120, paddingHorizontal: 30 },
  emptyIconGlow: { padding: 25, borderRadius: 60, marginBottom: 25 },
  emptyTitle: { fontSize: 24, fontWeight: '900', marginBottom: 10, letterSpacing: 0.5 },
  emptyText: { textAlign: 'center', color: '#64748b', fontSize: 14, fontWeight: '600', lineHeight: 22 },
});