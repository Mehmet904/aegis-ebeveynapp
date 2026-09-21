import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, useColorScheme } from 'react-native';
import { ref, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { db } from '../../utils/firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
// ÇİFT IMPORT HATASI DÜZELTİLDİ (İkisi tek satırda birleştirildi)
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const CallHistoryScreen = ({ route, navigation }) => {
  const { childUid, childName } = route.params || {};
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);


// 🚀 Tema (Artık dinamik!)
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
  const theme = useMemo(() => ({
    bg: isDarkMode ? '#020617' : '#f8fafc',
    surface: isDarkMode ? 'rgba(30, 41, 59, 0.45)' : '#ffffff', // Light modda saydamlık bazen kötü durur, tam beyaz daha temiz
    border: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    textPrimary: isDarkMode ? '#f8fafc' : '#0f172a',
    textSecondary: isDarkMode ? '#94a3b8' : '#64748b',
    blur: isDarkMode ? 'dark' : 'light'
  }), [isDarkMode]);

  useEffect(() => {
    if (!childUid) return; // Güvenlik kilidi: Parametre gelmezse çökmesin

// 🚀 Sadece son 100 aramayı çekerek cihazın belleğini (RAM) ve Firebase kotasını koruyoruz.
    const callsRef = ref(db, `users/${childUid}/callHistory`);
    const callsQuery = query(callsRef, orderByChild('timestamp'), limitToLast(100));

    const unsub = onValue(callsQuery, (snapshot) => {
      if (snapshot.exists()) {
        const callsArray = [];
        // Firebase orderByChild ile sıralı gelse de, onValue objeye çevirdiği için 
        // forEach ile gezip diziye atmak sırayı korumanın en güvenli yoludur.
        snapshot.forEach((childSnap) => {
           callsArray.push({ id: childSnap.key, ...childSnap.val() });
        });
        
        // En yeni en üstte olsun diye ters çeviriyoruz
        setCalls(callsArray.reverse());
      } else {
        setCalls([]);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [childUid]);

const formatDuration = (seconds) => {
    // Veri bozuk gelirse veya süre yoksa patlamayı önle
    if (!seconds || isNaN(seconds) || seconds === 0) return 'Çaldırdı/Açılmadı';
    
    const parsedSeconds = parseInt(seconds, 10);
    const m = Math.floor(parsedSeconds / 60);
    const s = parsedSeconds % 60;
    
    if (m > 0) return `${m} dk ${s} sn`;
    return `${s} sn`;
  };

  const getCallIcon = (type) => {
    switch (type) {
      case 'INCOMING': return { name: 'phone-incoming', color: '#10b981', label: 'Gelen Çağrı' };
      case 'OUTGOING': return { name: 'phone-outgoing', color: '#38bdf8', label: 'Giden Çağrı' };
      case 'MISSED': return { name: 'phone-missed', color: '#ef4444', label: 'Cevapsız Çağrı' };
      case 'REJECTED': return { name: 'phone-cancel', color: '#ef4444', label: 'Reddedilen Çağrı' };
      default: return { name: 'phone', color: '#94a3b8', label: 'Bilinmeyen' };
    }
  };

  const renderCallItem = ({ item }) => {
    const iconData = getCallIcon(item.type);
const safeTimestamp = parseInt(item.timestamp) || Date.now();
    const date = new Date(safeTimestamp);
    
    // 🚀 React Native Android'de toLocaleDateString patlama/çirkin gözükme riskine karşı güvenli manuel format:
    const aylar = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    const gunler = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
    
    const dateStr = `${date.getDate()} ${aylar[date.getMonth()]} ${gunler[date.getDay()]}`;
    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    return (
      <View style={[styles.callCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.iconBox, { backgroundColor: iconData.color + '20' }]}>
          <MaterialCommunityIcons name={iconData.name} size={22} color={iconData.color} />
        </View>

        <View style={styles.callInfo}>
          <Text style={[styles.callerName, { color: theme.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.phoneNumber}>{item.phoneNumber}</Text>

          <View style={styles.detailsRow}>
            <Text style={[styles.callType, { color: iconData.color }]}>{iconData.label}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
          </View>
        </View>

<View style={styles.timeBox}>
          <Text style={[styles.timeText, { color: theme.textPrimary }]}>{timeStr}</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
     <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

<View style={styles.absoluteBackground}>
        <LinearGradient 
          colors={isDarkMode ? ['#0f172a', '#020617'] : ['#f8fafc', '#e2e8f0']} 
          style={{ flex: 1 }} 
        />
        <LinearGradient colors={isDarkMode ? ['#ec4899', 'transparent'] : ['#f472b6', 'transparent']} style={styles.glowTopRight} />
      </View>

      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.headerArea}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.7} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.goBack(); }}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Arama Geçmişi</Text>
          <Text style={styles.headerSub}>{childName} • Son 7 Gün</Text>
        </View>
        <View style={{ width: 44 }} />
      </LinearGradient>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#ec4899" />
          <Text style={styles.loadingText}>Kayıtlar Çekiliyor...</Text>
        </View>
      ) : (
<FlatList
          data={calls}
          keyExtractor={(item) => item.id}
          renderItem={renderCallItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15} // İlk açılışta sadece ekranda görünen kadarını (15) çiz (Hızı artırır)
          maxToRenderPerBatch={10} // Kaydırırken 10'ar 10'ar çiz
          windowSize={5} // Bellek tasarrufu için ekranda görünmeyen çok üstteki/alttaki öğeleri sil
          removeClippedSubviews={true} // Tamamen görünmez olanları native seviyede bellekten uçur
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="call-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textPrimary }]}>Arama Kaydı Bulunamadı</Text>
              <Text style={styles.emptySubText}>Son 7 güne ait herhangi bir telefon görüşmesi yapılmamış.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

export default CallHistoryScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  absoluteBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 },
  glowTopRight: { position: 'absolute', top: -50, right: -50, width: 350, height: 350, borderRadius: 175, opacity: 0.15 },
  headerArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 25, paddingHorizontal: 20, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, elevation: 20 },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  headerSub: { color: '#ec4899', fontSize: 11, fontWeight: '800', marginTop: 4, letterSpacing: 1 },
  listContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 50 },
  callCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24, marginBottom: 12, borderWidth: 1 },
  iconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  callInfo: { flex: 1 },
  callerName: { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  phoneNumber: { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginBottom: 6 },
  detailsRow: { flexDirection: 'row', alignItems: 'center' },
  callType: { fontSize: 11, fontWeight: '800' },
  dot: { color: '#64748b', marginHorizontal: 6 },
  duration: { fontSize: 11, color: '#94a3b8', fontWeight: '700' },
  timeBox: { alignItems: 'flex-end', marginLeft: 10 },
 timeText: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  dateText: { fontSize: 10, color: '#64748b', fontWeight: '700' },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, color: '#ec4899', fontWeight: '800' },
  emptyBox: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontWeight: '900', marginTop: 15 },
  emptySubText: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 8, paddingHorizontal: 20 }
});