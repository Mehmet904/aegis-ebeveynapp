import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DeviceCard = ({
  child,
  theme,
  isListening,
  listeningToChildId,
  activeMediaType,
  onNavigate,
  onEdit,
  onCameraSelect,
  onToggleAudio,
  triggerHaptic,
  onPing,
  onSiren
}) => {

  // 🚀 ZAMAN DAMGASI VE ÇEVRİMİÇİ KONTROLÜ
  const lastUpdate = child.location?.timestamp || 0;
  const diffMin = Math.floor((Date.now() - lastUpdate) / 60000);

  // Eğer son 10 dakika içinde sinyal alınamadıysa, sistem 'Bağlantı Var' dese bile cihaz çevrimdışı kabul edilir.
  const isOnline = child.connectionType && child.connectionType !== 'Bağlantı Yok' && diffMin <= 10;

  const batteryLevel = child.batteryLevel || 0;
  const isCharging = child.isCharging;
  const isBatteryLow = batteryLevel <= 20;

  // 🚀 DURUM METİNLERİ
  let lastSeenText = "--";
  if (lastUpdate > 0) {
    if (diffMin < 1) lastSeenText = "Şimdi";
    else if (diffMin < 60) lastSeenText = `${diffMin} dk önce`;
    else {
      const diffHour = Math.floor(diffMin / 60);
      lastSeenText = `${diffHour} sa önce`;
    }
  }

  // İnternet gerçek anlamda var VE son sinyal 5 dakikadan yeniyse konum tam aktiftir
  const isLocationActive = isOnline && (diffMin <= 5);

  return (
    <View style={[styles.deviceCard, { backgroundColor: theme.cardBg, borderColor: theme.surfaceBorder }]}>

      {/* 🟢 Üst Kısım: Profil ve Durum */}
      <View style={styles.deviceHeader}>
        <View style={styles.avatarWrap}>
          {child.profileImage ? (
            <Image source={{ uri: child.profileImage }} style={styles.childAvatarImg} />
          ) : (
            <View style={[styles.childAvatarImg, { backgroundColor: theme.accent }]}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>
                {(child.displayName || child.email).charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={[styles.onlineStatus, { backgroundColor: isOnline ? theme.success : theme.danger, borderColor: theme.cardBg }]} />
        </View>

        <View style={styles.deviceInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.deviceName, { color: theme.textPrimary }]} numberOfLines={1}>
              {child.displayName || child.email}
            </Text>

            {/* 🔔 CANLI SES MODU ROZETİ VE YAZISI */}
            <View style={{
              marginLeft: 10,
              backgroundColor: child.ringerMode === 'silent' ? 'rgba(239, 68, 68, 0.15)' :
                child.ringerMode === 'vibrate' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: child.ringerMode === 'silent' ? 'rgba(239, 68, 68, 0.3)' :
                child.ringerMode === 'vibrate' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'
            }}>
              <Ionicons
                name={child.ringerMode === 'silent' ? "volume-mute" :
                  child.ringerMode === 'vibrate' ? "phone-portrait-outline" : "volume-high"}
                size={12}
                color={child.ringerMode === 'silent' ? theme.danger :
                  child.ringerMode === 'vibrate' ? theme.warning : theme.success}
              />
              <Text style={{
                fontSize: 9,
                fontWeight: '900',
                marginLeft: 5,
                letterSpacing: 0.5,
                color: child.ringerMode === 'silent' ? theme.danger :
                  child.ringerMode === 'vibrate' ? theme.warning : theme.success
              }}>
                {child.ringerMode === 'silent' ? "SESSİZ" :
                  child.ringerMode === 'vibrate' ? "TİTREŞİM" : "SESLİ"}
              </Text>
            </View>
          </View>

          <Text style={[styles.deviceSubInfo, { color: isOnline ? theme.success : theme.danger }]}>
            {isOnline ? '📍 Çocuk Konumu Aktif' : '🚫 Çocuk Konumu Kapalı'}
          </Text>
        </View>

<TouchableOpacity style={[styles.editIconBtn, { backgroundColor: theme.surface }]} onPress={() => onEdit(child)}>
          <Ionicons name="options" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* 📊 Orta Kısım: Sensör Verileri */}
      <View style={styles.microStatsRow}>

        {/* PİL DURUMU */}
        <View style={[styles.microStat, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={styles.microStatTop}>
            {/* 🚀 DEĞİŞTİRİLDİ: Şarjdayken şimşek, 20 altı kırmızı pil, normalde yarım pil */}
            <Ionicons
              name={isCharging ? "flash" : (isBatteryLow ? "battery-dead" : "battery-half")}
              size={14}
              color={isBatteryLow ? theme.danger : theme.success}
            />
            <Text style={[styles.microStatText, { color: theme.textPrimary }]}>%{batteryLevel}</Text>
          </View>
          <View style={styles.batteryTrack}>
            <View style={[styles.batteryFill, { width: `${batteryLevel}%`, backgroundColor: isBatteryLow ? theme.danger : theme.success }]} />
          </View>
        </View>

        {/* AĞ DURUMU */}
        <View style={[styles.microStat, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={styles.microStatTop}>
            <Ionicons
              name={child.isWifi ? "wifi" : (isOnline ? "cellular" : "cloud-offline")}
              size={14}
              color={isOnline ? theme.accent : theme.danger}
            />
            {/* 🚀 DEĞİŞTİRİLDİ: Bağlı değilse açıkça belirtir */}
            <Text style={[styles.microStatText, { color: theme.textPrimary, fontSize: 10, flexShrink: 1 }]} numberOfLines={1}>
              {isOnline ? child.connectionType : 'Bağlı Değil'}
            </Text>
          </View>
          <Text style={styles.microStatSub}>Ağ Tipi</Text>
        </View>

        {/* SON SİNYAL (Hız Yerine Geldi) */}
        <View style={[styles.microStat, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <View style={styles.microStatTop}>
            <Ionicons name="time" size={14} color={theme.accent} />
            <Text style={[styles.microStatText, { color: theme.textPrimary, fontSize: 11 }]}>{lastSeenText}</Text>
          </View>
          <Text style={styles.microStatSub}>Son Sinyal</Text>
        </View>
      </View>

      {/* 🎛️ Alt Kısım: Taktiksel Operasyon Butonları */}
      <View style={styles.operationGrid}>
        <TouchableOpacity style={[styles.opBtn, { backgroundColor: 'rgba(99,102,241,0.1)', borderColor: theme.accent }]} activeOpacity={0.7} onPress={() => { triggerHaptic(); onNavigate('ChildMapScreen', { childUid: child.uid }); }}>
          <Ionicons name="locate" size={20} color={theme.accent} />
          <Text style={[styles.opBtnText, { color: theme.accent }]}>Radar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.opBtn, { backgroundColor: theme.success, borderColor: theme.success }]} activeOpacity={0.8} onPress={() => onCameraSelect(child.uid)}>
          <Ionicons name="videocam" size={20} color="#fff" />
          <Text style={[styles.opBtnText, { color: '#fff' }]}>Lens</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.opBtn, { backgroundColor: (isListening && listeningToChildId === child.uid && activeMediaType === 'audio') ? theme.danger : theme.textPrimary, borderColor: 'transparent' }]}
          activeOpacity={0.8}
          onPress={() => onToggleAudio(child.uid)}
        >
          <Ionicons name={(isListening && listeningToChildId === child.uid && activeMediaType === 'audio') ? "close" : "mic"} size={20} color={theme.bg} />
          <Text style={[styles.opBtnText, { color: theme.bg }]}>Ses</Text>
        </TouchableOpacity>
      </View>

{/* 🚨 BALYOZ (ACİL DURUM SİRENİ) BUTONU */}
      <TouchableOpacity
        style={[styles.sirenBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: theme.danger }]}
        activeOpacity={0.7}
        onPress={() => {
          triggerHaptic('Heavy');
          import('react-native').then(({ Alert }) => {
            Alert.alert(
              "🚨 UZAKTAN BALYOZ",
              "Çocuğun telefonu sessiz modda olsa bile maksimum ses seviyesinde alarm çalacak ve titreyecektir. Onaylıyor musunuz?",
              [
                { text: "İptal", style: "cancel" },
                { text: "SİRENİ ÇAL", style: "destructive", onPress: () => onSiren(child.uid) }
              ]
            );
          });
        }}
      >
        <Ionicons name="warning" size={20} color={theme.danger} />
        <Text style={[styles.sirenBtnText, { color: theme.danger }]}>Acil Durum Sireni</Text>
      </TouchableOpacity>

<View style={[styles.divider, { backgroundColor: theme.surfaceBorder }]} />

      {/* 🛠️ En Alt: Yönlendirme Araçları (Hepsi Bir Row İçinde) */}
      <View style={styles.footerToolsRow}>
        <TouchableOpacity style={[styles.pillBtn, { backgroundColor: theme.surface }]} onPress={() => { triggerHaptic('Light'); onNavigate('ChatScreen', { chatRoomId: child.uid, chatName: child.displayName || child.email }); }}>
          <Ionicons name="chatbubbles" size={16} color={theme.accent} />
          <Text style={[styles.pillBtnText, { color: theme.textPrimary }]}>Sohbet</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.pillBtn, { backgroundColor: theme.surface }]} onPress={() => { triggerHaptic('Light'); onNavigate('AppUsageScreen', { childUid: child.uid, childName: child.displayName || child.email }); }}>
          <Ionicons name="pie-chart" size={16} color={theme.warning} />
          <Text style={[styles.pillBtnText, { color: theme.textPrimary }]}>Kullanım</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.footerToolsRow, { marginTop: 10 }]}>
        <TouchableOpacity style={[styles.pillBtn, { backgroundColor: theme.surface }]} onPress={() => { triggerHaptic('Light'); onNavigate('ChildLocationHistoryScreen', { childUid: child.uid }); }}>
          <Ionicons name="time" size={16} color={theme.success} />
          <Text style={[styles.pillBtnText, { color: theme.textPrimary }]}>Geçmiş</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.pillBtn, { backgroundColor: theme.surface }]} onPress={() => { triggerHaptic('Light'); onNavigate('CallHistoryScreen', { childUid: child.uid, childName: child.displayName || child.email }); }}>
          <Ionicons name="call" size={16} color="#ec4899" />
          <Text style={[styles.pillBtnText, { color: theme.textPrimary }]}>Aramalar</Text>
        </TouchableOpacity>
      </View>

      {/* 👻 BAĞLANTI YENİLE BUTONU */}
      <TouchableOpacity style={[styles.sirenBtn, { marginTop: 10, backgroundColor: 'rgba(99,102,241,0.1)', borderWidth: 1, borderColor: theme.accent }]} onPress={() => { triggerHaptic('Light'); onPing(child.uid); }}>
        <Ionicons name="refresh" size={16} color={theme.accent} />
        <Text style={[styles.sirenBtnText, { color: theme.accent }]}>Bağlantıyı Yenile</Text>
      </TouchableOpacity>
    </View> 
  );
};

const styles = StyleSheet.create({
  deviceCard: { marginHorizontal: 20, borderRadius: 30, padding: 22, marginBottom: 20, borderWidth: 1, elevation: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15 },
  deviceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarWrap: { position: 'relative', marginRight: 16 },
  childAvatarImg: { width: 56, height: 56, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  onlineStatus: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  deviceSubInfo: { fontSize: 11, fontWeight: '800', marginTop: 4 },
  editIconBtn: { padding: 10, borderRadius: 16 },
  microStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  microStat: { flex: 1, padding: 12, borderRadius: 18, borderWidth: 1 },
  microStatTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  microStatText: { fontSize: 13, fontWeight: '900', marginLeft: 6 },
  microStatSub: { fontSize: 10, fontWeight: '800' },
  batteryTrack: { width: '100%', height: 5, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 2.5, overflow: 'hidden' },
  batteryFill: { height: '100%', borderRadius: 2.5 },
  operationGrid: { flexDirection: 'row', gap: 10 },
  opBtn: { flex: 1, height: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  opBtnText: { fontWeight: '900', fontSize: 12, marginLeft: 6, letterSpacing: 0.5 },
  divider: { height: 1, width: '100%', marginVertical: 20 },
  footerToolsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  pillBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14 },
  pillBtnText: { fontSize: 12, fontWeight: '800', marginLeft: 6 },
  sirenBtn: { marginTop: 10, height: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  sirenBtnText: { fontWeight: '900', fontSize: 13, marginLeft: 8, letterSpacing: 1 },
});

export default DeviceCard;