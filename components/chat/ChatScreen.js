import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, StyleSheet, StatusBar, Alert, Image, Animated, ActivityIndicator, Linking, Modal, Keyboard, Platform, ImageBackground, PanResponder } from 'react-native';
// 🔥 DÜZELTME BURADA: 'set' komutu import edildi!
import { ref as dbRef, push, onValue, serverTimestamp, remove, update, get, query, orderByChild, limitToLast, onDisconnect, set } from 'firebase/database';
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage'; 
import { auth, db } from '../../utils/firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio, Video, ResizeMode } from 'expo-av'; 
import * as ImagePicker from 'expo-image-picker'; 
import * as DocumentPicker from 'expo-document-picker'; 
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import Slider from '@react-native-community/slider';

// 🎵 PERFORMANS İYİLEŞTİRİLMİŞ SES ÇALAR
const AudioBubble = React.memo(({ audioUri, duration, isMe, timestamp, id, isEdited, isRead, isDelivered, currentlyPlayingId, setCurrentlyPlayingId }) => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration * 1000 || 0);

  useEffect(() => {
    if (currentlyPlayingId !== id && isPlaying && sound) {
      sound.pauseAsync();
      setIsPlaying(false);
    }
  }, [currentlyPlayingId, id, isPlaying, sound]);

  useEffect(() => {
    return () => { 
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  const onPlaybackStatusUpdate = useCallback((status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setAudioDuration(status.durationMillis || duration * 1000);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        setCurrentlyPlayingId(null);
      }
    }
  }, [duration, setCurrentlyPlayingId]);

  const togglePlay = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) {
      if (sound) await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      try {
        await Audio.setAudioModeAsync({ staysActiveInBackground: false, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        if (!sound) {
          const { sound: newSound } = await Audio.Sound.createAsync({ uri: audioUri }, { shouldPlay: true }, onPlaybackStatusUpdate);
          setSound(newSound);
        } else {
          if (position >= audioDuration) await sound.setPositionAsync(0);
          await sound.playAsync();
        }
        setIsPlaying(true);
        setCurrentlyPlayingId(id);
      } catch (error) {
        Alert.alert("Oynatma Hatası", "Ses dosyası oynatılamadı.");
      }
    }
  };

  const handleSeek = async (value) => {
    if (sound) { 
      await sound.setPositionAsync(value); 
      setPosition(value); 
    }
  };

  const formatTime = (millis) => {
    if (isNaN(millis)) return "00:00";
    const totalSeconds = Math.floor(millis / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const tickIconName = isRead ? "checkmark-done" : (isDelivered ? "checkmark-done" : "checkmark");
  const tickIconColor = isRead ? "#38bdf8" : "rgba(255,255,255,0.7)";

return (
    <View style={[styles.audioBubbleContainer, isMe ? styles.myBubbleWrap : styles.otherBubbleWrap]}>
      {/* 🔥 DÜZELTME: paddingBottom artırıldı, mutlak pozisyon kaldırıldı */}
      <LinearGradient colors={isMe ? ['#059669', '#047857'] : ['#ffffff', '#ffffff']} style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble, styles.audioBubble, { paddingBottom: 12 }]}>
        <TouchableOpacity onPress={togglePlay} style={[styles.playBtn, !isMe && {backgroundColor: 'rgba(99, 102, 241, 0.08)'}]}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={20} color={isMe ? "#fff" : "#1D4ED8"} style={{marginLeft: isPlaying ? 0 : 3}} />
        </TouchableOpacity>
        
        <View style={styles.audioWaveWrap}>
          <Slider 
            style={{ width: '100%', height: 30 }} 
            minimumValue={0} 
            maximumValue={audioDuration || 1} 
            value={position} 
            onSlidingComplete={handleSeek} 
            minimumTrackTintColor={isMe ? '#ffffff' : '#1D4ED8'} 
            maximumTrackTintColor={isMe ? 'rgba(255,255,255,0.3)' : '#cbd5e1'} 
            thumbTintColor={isMe ? '#ffffff' : '#1D4ED8'} 
          />
          
          {/* 🔥 DÜZELTME: Süre solda, Saat ve Tik sağda! */}
          <View style={[styles.audioTimeRow, { alignItems: 'center' }]}>
            <Text style={[styles.audioDurationText, isMe ? {color: '#fff'} : {color: '#64748b'}]}>
              {formatTime(position)} / {formatTime(audioDuration)}
            </Text>
            
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
               <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.otherTimeText]}>
                 {timestamp && typeof timestamp === 'number' ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
               </Text>
               {isMe && <Ionicons name={tickIconName} size={15} color={tickIconColor} style={{marginLeft: 3}} />}
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
});

// 🔥 UI DONMASINI ENGELLEYEN MESAJ KARŞILAŞTIRICI (Avatar Korumalı)
const messagePropsAreEqual = (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.isRead === nextProps.item.isRead &&
    prevProps.item.isDelivered === nextProps.item.isDelivered &&
    prevProps.item.isEdited === nextProps.item.isEdited &&
    prevProps.item.text === nextProps.item.text &&
    prevProps.currentlyPlayingId === nextProps.currentlyPlayingId &&
    prevProps.avatarUri === nextProps.avatarUri
  );
};

const MessageItem = React.memo(({ item, isMe, avatarUri, setMediaViewer, setMessageOptions, currentlyPlayingId, setCurrentlyPlayingId, setReplyingTo, partnerName }) => {
  if (!item) return null;

  // Kaydırma animasyonları için
  const pan = useRef(new Animated.ValueXY()).current;
  const swipeThreshold = 50;

  const tickIconName = item.isRead ? "checkmark-done" : (item.isDelivered ? "checkmark-done" : "checkmark");
  const tickIconColor = item.isRead ? "#38bdf8" : "#94a3b8";

  return (
    <Animated.View 
      style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow, { transform: [{ translateX: pan.x }] }]}
      {...PanResponder.create({
          onMoveShouldSetPanResponderCapture: (e, gs) => gs.dx > 15 && Math.abs(gs.dy) < 15,
          onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
          onPanResponderRelease: (e, gs) => {
            if (gs.dx > swipeThreshold) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setReplyingTo(item);
            }
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: false }).start();
          }
      }).panHandlers}
    >
      {/* Sola ok ikonu (Kaydırdıkça belirginleşir) */}
      <Animated.View style={{
        position: 'absolute', left: -40, top: '50%', marginTop: -12,
        opacity: pan.x.interpolate({ inputRange: [0, 50], outputRange: [0, 1], extrapolate: 'clamp' }),
        transform: [{ scale: pan.x.interpolate({ inputRange: [0, 50], outputRange: [0.5, 1], extrapolate: 'clamp' }) }]
      }}>
        <View style={{backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 15, padding: 4}}>
         <Ionicons name="arrow-undo" size={20} color="#1D4ED8" />
        </View>
      </Animated.View>

      {!isMe && (
        <View style={styles.avatarWrapLeft}>
          {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.chatAvatar} /> : <View style={[styles.chatAvatar, { backgroundColor: '#cbd5e1' }]}><Ionicons name="person" size={12} color="#64748b" /></View>}
        </View>
      )}

      <View style={[styles.msgContainer, isMe ? styles.myMsgContainer : styles.otherMsgContainer]}>
        <TouchableOpacity activeOpacity={0.8} onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setMessageOptions({ visible: true, message: item }); }}>
          
          {item.type === 'audio' ? (
            <View>
              {/* ALINTI KUTUSU (Ses için) */}
              {item.replyTo && (
                <View style={[styles.quotedBubble, isMe ? styles.myQuotedBubble : styles.otherQuotedBubble]}>
                  <Text style={styles.quotedName}>{item.replyTo.senderId === item.senderId ? 'Kendisi' : (isMe ? partnerName : 'Sen')}</Text>
                  <Text style={styles.quotedText} numberOfLines={1}>{item.replyTo.text}</Text>
                </View>
              )}
              <AudioBubble 
                audioUri={item.mediaUrl || item.audioUri} 
                duration={item.duration} 
                isMe={isMe} 
                timestamp={item.timestamp} 
                id={item.id}
                isEdited={item.isEdited}
                isRead={item.isRead} 
                isDelivered={item.isDelivered}
                currentlyPlayingId={currentlyPlayingId}
                setCurrentlyPlayingId={setCurrentlyPlayingId}
              />
           </View>
          ) : (
            <View style={[isMe ? styles.myBubbleWrap : styles.otherBubbleWrap]}>
              <LinearGradient colors={isMe ? ['#059669', '#047857'] : ['#ffffff', '#ffffff']} style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
                
                {/* ALINTI KUTUSU (Normal mesajlar için) */}
                {item.replyTo && (
                  <View style={[styles.quotedBubble, isMe ? styles.myQuotedBubble : styles.otherQuotedBubble]}>
                    <Text style={styles.quotedName}>{item.replyTo.senderId === item.senderId ? 'Kendisi' : (isMe ? partnerName : 'Sen')}</Text>
                    <Text style={styles.quotedText} numberOfLines={1}>{item.replyTo.text}</Text>
                  </View>
                )}

                {/* EKSİK OLAN KISIMLAR BURAYA EKLENDİ */}
                {item.type === 'text' && <Text style={[styles.msgText, isMe ? styles.myMsgText : styles.otherMsgText]}>{item.text}</Text>}
                
                {item.type === 'image' && (
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setMediaViewer({ visible: true, url: item.mediaUrl, type: 'image' })}>
                    <Image source={{ uri: item.mediaUrl }} style={styles.mediaImage} resizeMode="cover" />
                  </TouchableOpacity>
                )}

                {item.type === 'video' && (
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setMediaViewer({ visible: true, url: item.mediaUrl, type: 'video' })}>
                    <View style={styles.videoThumbnailBox}>
                      <Video source={{ uri: item.mediaUrl }} style={styles.mediaImage} resizeMode={ResizeMode.COVER} shouldPlay={false} />
                      <View style={styles.playIconOverlay}><Ionicons name="play" size={26} color="#fff" /></View>
                    </View>
                  </TouchableOpacity>
                )}

                {item.type === 'document' && (
                  <TouchableOpacity style={styles.documentBox} onPress={() => Linking.openURL(item.mediaUrl)}>
                    <View style={styles.docIconWrap}>
                      <Ionicons name="document-text" size={22} color={isMe ? "##1D4ED8" : "#fff"} />
                    </View>
                    <Text style={[styles.documentText, { color: isMe ? "#fff" : "#334155" }]} numberOfLines={1}>{item.fileName}</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.timeRow}>
                  {item.isEdited && <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.otherTimeText, {fontStyle: 'italic', marginRight: 4}]}>düzenlendi</Text>}
                  <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.otherTimeText]}>
                    {item.timestamp && typeof item.timestamp === 'number' ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                  {isMe && <Ionicons name={tickIconName} size={15} color={isMe ? (item.isRead ? "#38bdf8" : "rgba(255,255,255,0.8)") : tickIconColor} style={{marginLeft: 3, marginTop: -1}} />}
                </View>

              </LinearGradient>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}, messagePropsAreEqual);

const ChatScreen = ({ route, navigation }) => {
  const { chatRoomId, chatName } = route.params; 
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [editingMsg, setEditingMsg] = useState(null); 
  const [isLoading, setIsLoading] = useState(true);
  
  const [isSending, setIsSending] = useState(false);
  const [childAvatar, setChildAvatar] = useState(null);
  const [parentAvatar, setParentAvatar] = useState(null);
  const [partnerName, setPartnerName] = useState(chatName || 'Sohbet');
  const [partnerAvatarUri, setPartnerAvatarUri] = useState(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false); 
  
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState(null); 
  
  const [isAttachMenuVisible, setIsAttachMenuVisible] = useState(false);
  const [mediaViewer, setMediaViewer] = useState({ visible: false, url: null, type: null });
  const [messageOptions, setMessageOptions] = useState({ visible: false, message: null });
  const [isDownloading, setIsDownloading] = useState(false);

  const recordAnim = useRef(new Animated.Value(1)).current;
  const attachAnim = useRef(new Animated.Value(0)).current; 
  const currentUserId = auth.currentUser?.uid;
  const isCurrentUserChild = currentUserId === chatRoomId; 
  
  const typingDebounceTimeout = useRef(null);
  const partnerTypingTimeout = useRef(null);
  const okunduBeklemeSuresi = useRef(null); 

const [messageLimit, setMessageLimit] = useState(40); // Pagination için
const [chatWallpaper, setChatWallpaper] = useState(null); // Duvar kağıdı için
const [audioPreviewUri, setAudioPreviewUri] = useState(null); // Ses önizleme için
const [isPlayingPreview, setIsPlayingPreview] = useState(false);
const [replyingTo, setReplyingTo] = useState(null); // Hangi mesaja yanıt verdiğimizi tutacak

  const getSafeTimestamp = (ts) => {
    if (typeof ts === 'number' && !isNaN(ts)) return ts;
    return Date.now();
  };

  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      if (typingDebounceTimeout.current) clearTimeout(typingDebounceTimeout.current);
      remove(dbRef(db, `chats/${chatRoomId}/typing/${currentUserId}`)).catch(()=>{});
    });
    return () => keyboardDidHideListener.remove();
  }, [chatRoomId, currentUserId]);

  useEffect(() => {
    if (!chatRoomId || !currentUserId) return; 

    get(dbRef(db, `chats/${chatRoomId}/typing`)).then((snap) => {
      if(snap.exists()){
        snap.forEach(child => {
           if(child.val() === true || typeof child.val() !== 'number') {
             remove(dbRef(db, `chats/${chatRoomId}/typing/${child.key}`)).catch(()=>{});
           }
        });
      }
    });

    const myTypingRef = dbRef(db, `chats/${chatRoomId}/typing/${currentUserId}`);
    remove(myTypingRef).catch(()=>{}); 
    onDisconnect(myTypingRef).remove(); 

    const chatRef = dbRef(db, `chats/${chatRoomId}`);
  
const recentMessagesQuery = query(chatRef, orderByChild('timestamp'), limitToLast(messageLimit));

    const unsubChats = onValue(recentMessagesQuery, (snapshot) => {
      setIsLoading(false);
      if (snapshot.exists()) {
        try {
          const data = snapshot.val();
          const updates = {};
          const msgArray = [];
          
          Object.keys(data).forEach(key => {
            const msg = data[key];
        if (msg.senderId !== currentUserId) {
              if (!msg.isRead) {
                 updates[`${key}/isRead`] = true;
                 updates[`${key}/isDelivered`] = true; // Okunduysa iletilmiştir, garanti olsun.
              }
            }
            msgArray.push({ id: key, ...msg });
          });

          const filteredMessages = msgArray
            .filter(msg => msg && msg.type) 
            .filter(msg => !(msg.deletedBy && msg.deletedBy[currentUserId])) 
            .filter(msg => !(msg.type === 'text' && (!msg.text || msg.text.trim() === '')))
            .sort((a, b) => getSafeTimestamp(b.timestamp) - getSafeTimestamp(a.timestamp));
            
          setMessages(filteredMessages);

          if (Object.keys(updates).length > 0) {
            if (okunduBeklemeSuresi.current) clearTimeout(okunduBeklemeSuresi.current);
            okunduBeklemeSuresi.current = setTimeout(() => {
              update(dbRef(db, `chats/${chatRoomId}`), updates).catch(() => {});
            }, 1500); 
          }
        } catch (error) {
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    });

    get(dbRef(db, `users/${chatRoomId}`)).then((snap) => {
      if(snap.exists()){
        const cData = snap.val();
        setChildAvatar(cData.profileImage || null);
        if (!isCurrentUserChild) {
          setPartnerName(cData.displayName || chatName || 'Çocuğum');
          setPartnerAvatarUri(cData.profileImage || null);
        }
        if (cData.linkedParent) {
          get(dbRef(db, `users/${cData.linkedParent}`)).then((pSnap) => {
            if(pSnap.exists()){
              const pData = pSnap.val();
              setParentAvatar(pData?.profileImage || null);
              if (isCurrentUserChild) {
                setPartnerName(pData?.displayName || 'Ebeveyn');
                setPartnerAvatarUri(pData?.profileImage || null);
              }
            }
          });
        }
      }
    });

    const typingRef = dbRef(db, `chats/${chatRoomId}/typing`);
    const unsubTyping = onValue(typingRef, (snapshot) => {
      let someoneTyping = false;
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          if (child.key !== currentUserId) {
            const val = child.val();
            if (typeof val === 'number') {
              someoneTyping = true;
            }
          }
        });
      }
      
      setIsPartnerTyping(someoneTyping);
      
      if (partnerTypingTimeout.current) clearTimeout(partnerTypingTimeout.current);
      if (someoneTyping) {
        partnerTypingTimeout.current = setTimeout(() => {
            setIsPartnerTyping(false);
        }, 2000);
      }
    });

    return () => { 
      unsubChats(); 
      unsubTyping(); 
      if (typingDebounceTimeout.current) clearTimeout(typingDebounceTimeout.current);
      if (partnerTypingTimeout.current) clearTimeout(partnerTypingTimeout.current);
      if (okunduBeklemeSuresi.current) clearTimeout(okunduBeklemeSuresi.current);
      remove(myTypingRef).catch(()=>{}); 
    };
  }, [chatRoomId, currentUserId]);

  const handleInputChange = (text) => {
    setInputText(text);
    const myTypingRef = dbRef(db, `chats/${chatRoomId}/typing/${currentUserId}`);

    if (text.trim().length === 0) {
      if (typingDebounceTimeout.current) clearTimeout(typingDebounceTimeout.current);
      remove(myTypingRef).catch(()=>{});
      return;
    }

    if (typingDebounceTimeout.current) clearTimeout(typingDebounceTimeout.current);

    typingDebounceTimeout.current = setTimeout(() => {
        update(dbRef(db, `chats/${chatRoomId}/typing`), { [currentUserId]: Date.now() }).catch(()=>{});
        
        setTimeout(() => {
           remove(myTypingRef).catch(()=>{});
        }, 2000);
    }, 300); 
  };

  const sendPushNotification = async (bodyText, msgId) => {
    try {
      let partnerIdToPush = isCurrentUserChild ? (await get(dbRef(db, `users/${chatRoomId}`))).val()?.linkedParent : chatRoomId;
      if (partnerIdToPush) {
        const partnerToken = (await get(dbRef(db, `users/${partnerIdToPush}`))).val()?.pushToken;
        const myName = (await get(dbRef(db, `users/${currentUserId}`))).val()?.displayName || 'Aegis Sistemi';

        if (partnerToken) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: partnerToken,
              title: `💬 ${myName}`,
              body: bodyText,
              sound: 'default',
              priority: 'high',
              channelId: 'default',
              data: { action: 'NEW_MESSAGE', chatRoomId: chatRoomId, msgId: msgId }
            }),
          });
        }
      }
    } catch (pushErr) {}
  };

  const toggleAttachMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss(); 
    if (isAttachMenuVisible) {
      Animated.timing(attachAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setIsAttachMenuVisible(false));
    } else {
      setIsAttachMenuVisible(true);
      Animated.spring(attachAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    }
  };

  const handleMessageDelete = async (type) => {
    const msg = messageOptions.message;
    if (!msg) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMessageOptions({ visible: false, message: null });

    if (type === 'everyone') {
      await remove(dbRef(db, `chats/${chatRoomId}/${msg.id}`));
    } else if (type === 'me') {
      await update(dbRef(db, `chats/${chatRoomId}/${msg.id}`), {
        [`deletedBy/${currentUserId}`]: true
      });
    }
  };

  const handleDeleteAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert("Sohbeti Temizle", "Sohbet geçmişini sadece kendi cihazınızdan silmek istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Benim İçin Temizle", style: "destructive", onPress: async () => {
          if (messages.length === 0) return;
          const updates = {};
          messages.forEach(msg => {
            updates[`${msg.id}/deletedBy/${currentUserId}`] = true;
          });
          await update(dbRef(db, `chats/${chatRoomId}`), updates);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    ]);
  };

  const saveMediaToDevice = async () => {
    if (isDownloading || !mediaViewer.url) return;
    setIsDownloading(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        setIsDownloading(false);
        return Alert.alert('İzin Gerekli', 'Galeriye kaydetmek için izin vermelisiniz.');
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const ext = mediaViewer.type === 'video' ? '.mp4' : '.jpg';
      const fileUri = FileSystem.documentDirectory + `Aegis_Media_${Date.now()}${ext}`;
      const downloadRes = await FileSystem.downloadAsync(mediaViewer.url, fileUri);
      await MediaLibrary.saveToLibraryAsync(downloadRes.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Başarılı", "Medya cihazınızın galerisine kaydedildi.");
    } catch (err) {
      Alert.alert("Hata", "Kaydedilirken bir sorun oluştu.");
    } finally {
      setIsDownloading(false);
    }
  };

  const pickMedia = async (mode) => {
    toggleAttachMenu();
    let result;
    if (mode === 'photo') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') return Alert.alert("Hata", "Kamera izni gerekli.");
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5 });
    } else if (mode === 'video') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        const audioPerm = await Audio.requestPermissionsAsync();
        if (perm.status !== 'granted' || audioPerm.status !== 'granted') return Alert.alert("Hata", "Kamera ve Mikrofon izni gerekli.");
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, videoMaxDuration: 60, quality: 0.5 });
    } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') return Alert.alert("Hata", "Galeri izni gerekli.");
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.5 });
    }

    if (!result.canceled) {
        const uri = result.assets[0].uri;
        const type = result.assets[0].type === 'video' || mode === 'video' ? 'video' : 'image';
        uploadFileToFirebase(uri, type); 
    }
  };

  const pickDocument = async () => {
    toggleAttachMenu();
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (!result.canceled && result.assets.length > 0) {
        uploadFileToFirebase(result.assets[0].uri, 'document', result.assets[0].name);
    }
  };

  const uploadFileToFirebase = async (uri, type, fileName = null) => {
    setIsUploading(true);
    try {
        const response = await fetch(uri);
        const blob = await response.blob();
        let ext = 'file';
        if (type === 'image') ext = 'jpg';
        else if (type === 'video') ext = 'mp4';
        else if (type === 'audio') ext = 'm4a';
        else if (fileName && fileName.includes('.')) ext = fileName.split('.').pop();

        const fName = fileName || `Aegis_Media_${Date.now()}.${ext}`;
        const storage = getStorage();
        const fileRef = sRef(storage, `chat_media/${chatRoomId}/${fName}`);
        await uploadBytes(fileRef, blob);
        const downloadUrl = await getDownloadURL(fileRef);

        const newMsgRef = push(dbRef(db, `chats/${chatRoomId}`));
        await set(newMsgRef, {
            type: type, 
            mediaUrl: downloadUrl,
            fileName: fName,
            senderId: currentUserId,
            isRead: false,
            isDelivered: false,
            timestamp: serverTimestamp()
        });
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        let notifText = type === 'image' ? "📷 Fotoğraf gönderdi" : type === 'video' ? "📹 Video gönderdi" : type === 'document' ? "📄 Belge gönderdi" : "🎤 Sesli mesaj gönderdi";
        
        await sendPushNotification(notifText, newMsgRef.key);

    } catch (err) {
        Alert.alert("Hata", "Dosya yüklenemedi.");
    } finally {
        setIsUploading(false);
    }
  };

const startRecording = async () => { 
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') return Alert.alert('Hata', 'Mikrofon izni gerekli!');
      
      // 🔥 DÜZELTME: Eğer o an çalan bir ses varsa mikrofon çakışmasın diye onu durduruyoruz!
      if (currentlyPlayingId) setCurrentlyPlayingId(null); 

      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: true, 
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true
      });
      
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
      setRecordDuration(0);

      Animated.loop(
        Animated.sequence([
          Animated.timing(recordAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
          Animated.timing(recordAnim, { toValue: 1, duration: 600, useNativeDriver: true })
        ])
      ).start();
    } catch (err) { 
      // Hatayı console'a yazdırarak asıl sorunun ne olduğunu görebiliriz
      console.log("Ses Kayıt Hatası: ", err);
      Alert.alert('Hata', 'Kayıt başlatılamadı. Mikrofon başka bir uygulama tarafından kullanılıyor olabilir.'); 
    }
  };

  useEffect(() => {
    let interval;
    if (isRecording) interval = setInterval(() => setRecordDuration(prev => prev + 1), 1000);
    else clearInterval(interval);
    return () => clearInterval(interval);
  }, [isRecording]);

  const cancelRecording = async () => {
    setIsRecording(false);
    recordAnim.stopAnimation();
    if (recording) await recording.stopAndUnloadAsync();
    setRecording(null);
  };

// Sesi kaydetmeyi bitirip önizlemeye alan fonksiyon
const stopRecordingForPreview = async () => {
  setIsRecording(false);
  recordAnim.stopAnimation();
  if (!recording) return;
  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    if (recordDuration > 1) {
      setAudioPreviewUri(uri); // Direkt gönderme, state'e at!
    }
  } catch (err) {}
};

// Önizlemedeki sesi silme
const cancelAudioPreview = () => {
  setAudioPreviewUri(null);
  setRecordDuration(0);
};

// Önizlemedeki sesi onaylayıp gönderme
const sendPreviewedAudio = () => {
  if (audioPreviewUri) {
    uploadFileToFirebase(audioPreviewUri, 'audio');
    setAudioPreviewUri(null);
    setRecordDuration(0);
  }
};

  const sendMessage = async () => {
    if (inputText.trim() === '' || isSending) return;
    setIsSending(true); 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const messageToSend = inputText.trim();
    setInputText(''); 
    
    const myTypingRef = dbRef(db, `chats/${chatRoomId}/typing/${currentUserId}`);
    remove(myTypingRef).catch(()=>{});
    if (typingDebounceTimeout.current) clearTimeout(typingDebounceTimeout.current);

    try {
      if (editingMsg) {
        await update(dbRef(db, `chats/${chatRoomId}/${editingMsg.id}`), { text: messageToSend, isEdited: true });
        setEditingMsg(null);
      } else {
const newMsgRef = push(dbRef(db, `chats/${chatRoomId}`));
        await set(newMsgRef, {
          type: 'text',
          text: messageToSend,
          senderId: currentUserId,
          isRead: false, 
          isDelivered: false,
          timestamp: serverTimestamp(),
          // 🔥 YENİ EKLENEN KISIM: Alıntı verisi
          replyTo: replyingTo ? {
            id: replyingTo.id,
            text: replyingTo.type === 'text' ? replyingTo.text : (replyingTo.type === 'image' ? '📷 Fotoğraf' : replyingTo.type === 'video' ? '📹 Video' : replyingTo.type === 'audio' ? '🎤 Sesli Mesaj' : '📄 Belge'),
            senderId: replyingTo.senderId
          } : null
        });
        
        setReplyingTo(null); // Mesaj gidince alıntıyı temizle
        
        await sendPushNotification(messageToSend, newMsgRef.key);
      }
    } catch (error) { 
      Alert.alert("Hata", "Bağlantınızda sorun var, mesaj iletilemedi."); 
    } finally {
      setIsSending(false);
    }
  };

  const formatTimeUI = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

const renderMessage = useCallback(({ item, index }) => {
  const isMe = item.senderId === currentUserId;
  const isSenderChild = item.senderId === chatRoomId; 
  const avatarUri = isSenderChild ? childAvatar : parentAvatar;

  let showDateHeader = false;
  let dateText = "";
  
  if (index === messages.length - 1) {
    showDateHeader = true; 
  } else {
    const currentMsgDate = new Date(getSafeTimestamp(item.timestamp)).setHours(0,0,0,0);
    const prevMsgDate = new Date(getSafeTimestamp(messages[index + 1]?.timestamp)).setHours(0,0,0,0);
    
    if (currentMsgDate !== prevMsgDate) {
      showDateHeader = true;
    }
  }

  if (showDateHeader) {
    const today = new Date().setHours(0,0,0,0);
    const msgDate = new Date(getSafeTimestamp(item.timestamp));
    const msgDateMidnight = new Date(msgDate).setHours(0,0,0,0);
    
    if (msgDateMidnight === today) dateText = "Bugün";
    else if (msgDateMidnight === today - 86400000) dateText = "Dün";
    else dateText = msgDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  }

  return (
    <View>
      {showDateHeader && (
        
        <View style={{alignItems: 'center', marginVertical: 15}}>
          <View style={{backgroundColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12}}>
            <Text style={{fontSize: 12, color: '#475569', fontWeight: '600'}}>{dateText}</Text>
          </View>
        </View>
      )}
      <MessageItem 
        item={item}
        isMe={isMe}
        avatarUri={avatarUri}
        setMediaViewer={setMediaViewer}
        setMessageOptions={setMessageOptions}
        currentlyPlayingId={currentlyPlayingId}
        setCurrentlyPlayingId={setCurrentlyPlayingId}
        setReplyingTo={setReplyingTo} 
        partnerName={partnerName}
      />
    </View>
  );
}, [currentUserId, chatRoomId, childAvatar, parentAvatar, currentlyPlayingId, messages]);
 
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerProfileInfo}>
          {partnerAvatarUri ? (
            <Image source={{ uri: partnerAvatarUri }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, { backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={20} color="#94a3b8" />
            </View>
          )}
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>{partnerName}</Text>
            <Text style={[styles.onlineStatus, isPartnerTyping && {color: '#38bdf8', fontStyle: 'italic'}]}>
              {isPartnerTyping ? 'Yazıyor...' : 'Şifreli Aile Ağı'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.headerIconBtn} onPress={handleDeleteAll}>
          <Ionicons name="trash-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      </LinearGradient>

      {!isLoading && messages.length === 0 && (
        <View style={styles.absoluteEmptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="chatbubbles-outline" size={54} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>Sohbete Başlayın</Text>
          <Text style={styles.emptySub}>Aegis kalkanı ile mesajlarınız korunmaktadır.</Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ImageBackground 
          source={chatWallpaper ? {uri: chatWallpaper} : require('../../assets/default-chat-bg.png')} 
          style={{flex: 1}}
          resizeMode="cover"
        >
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            inverted={true} 
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={false} 
            onEndReached={() => setMessageLimit(prev => prev + 30)}
            onEndReachedThreshold={0.5}
          />

          <View style={styles.inputOuterWrapper}>
            
            {isAttachMenuVisible && (
              <Animated.View style={[styles.attachMenu, { 
                opacity: attachAnim, 
                transform: [{ translateY: attachAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] 
              }]}>
                <TouchableOpacity style={styles.attachItem} onPress={() => pickMedia('photo')}>
                  <LinearGradient colors={['#ec4899', '#be185d']} style={styles.attachIconBox}>
                    <Ionicons name="camera" size={24} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.attachText}>Fotoğraf</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.attachItem} onPress={() => pickMedia('video')}>
                  <LinearGradient colors={['#ef4444', '#b91c1c']} style={styles.attachIconBox}>
                    <Ionicons name="videocam" size={24} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.attachText}>Video</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.attachItem} onPress={() => pickMedia('gallery')}>
                  <LinearGradient colors={['#8b5cf6', '#6d28d9']} style={styles.attachIconBox}>
                    <Ionicons name="image" size={24} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.attachText}>Galeri</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.attachItem} onPress={pickDocument}>
                  <LinearGradient colors={['#3b82f6', '#2563eb']} style={styles.attachIconBox}>
                    <Ionicons name="document" size={24} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.attachText}>Belge</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

{replyingTo && (
              <View style={styles.replyBox}>
                <View style={styles.replyBoxLeftBar} />
                <View style={{flex: 1}}>
                  <Text style={styles.replyBoxName}>
                    {replyingTo.senderId === currentUserId ? 'Kendinize yanıtlıyorsunuz' : partnerName}
                  </Text>
                  <Text style={styles.replyBoxText} numberOfLines={1}>
                    {replyingTo.type === 'text' ? replyingTo.text : (replyingTo.type === 'image' ? '📷 Fotoğraf' : replyingTo.type === 'video' ? '📹 Video' : replyingTo.type === 'audio' ? '🎤 Sesli Mesaj' : '📄 Belge')}
                  </Text>
                </View>
                <TouchableOpacity style={{padding: 5}} onPress={() => setReplyingTo(null)}>
                  <Ionicons name="close-circle" size={24} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            )}

<View style={styles.inputContainer}>
              
              {audioPreviewUri ? (
                <View style={[styles.recordingUI, { paddingLeft: 10 }]}>
                  <TouchableOpacity onPress={cancelAudioPreview} style={styles.recActionBtn}>
                    <Ionicons name="trash" size={24} color="#ef4444" />
                  </TouchableOpacity>
                  
                  <View style={{flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center'}}>
                     <Ionicons name="headset" size={20} color="#64748b" style={{marginRight: 6}} />
                     <Text style={{color: '#334155', fontWeight: '600'}}>Önizleme ({formatTimeUI(recordDuration)})</Text>
                  </View>

                  <TouchableOpacity onPress={sendPreviewedAudio} style={styles.recSendBtn}>
                    <Ionicons name="send" size={18} color="#fff" style={{marginLeft: 3, marginTop: 2}} />
                  </TouchableOpacity>
                </View>
              ) : 
              
              /* 2. DURUM: KAYIT YAPILIYOR (Gönder yerine STOP butonu var) */
              isRecording ? (
                <View style={styles.recordingUI}>
                  <Animated.View style={[styles.recDot, { opacity: recordAnim }]} />
                  <Text style={styles.recordingText}>{formatTimeUI(recordDuration)}</Text>
                  
                  <TouchableOpacity onPress={cancelRecording} style={styles.recActionBtn}>
                    <Ionicons name="trash" size={22} color="#ef4444" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity onPress={stopRecordingForPreview} style={[styles.recSendBtn, {backgroundColor: '#ef4444'}]}>
                    <Ionicons name="stop" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
              
              /* 3. DURUM: NORMAL YAZI / DOSYA GÖNDERME EKRANI */
                <>
                  <TouchableOpacity style={styles.attachBtn} onPress={toggleAttachMenu}>
                    <Ionicons name={isAttachMenuVisible ? "close" : "add"} size={28} color={isAttachMenuVisible ? "#ef4444" : "#94a3b8"} />
                  </TouchableOpacity>
                  
                  <TextInput
                    style={styles.input}
                    placeholder="Mesaj yazın..."
                    placeholderTextColor="#94a3b8"
                    value={inputText}
                    onChangeText={handleInputChange} 
                    multiline
                    maxLength={500}
                    onFocus={() => setIsAttachMenuVisible(false)} 
                  />
                </>
              )}
              
              {!isRecording && !audioPreviewUri && (
                isUploading ? (
                  <View style={styles.uploadingBox}>
                    <ActivityIndicator size="small" color="##1D4ED8" />
                  </View>
                ) : inputText.trim().length > 0 ? (
                  <TouchableOpacity onPress={sendMessage} activeOpacity={0.8} disabled={isSending}>
                    <LinearGradient colors={['#1E40AF', '#1D4ED8']} style={[styles.sendBtn, isSending && { opacity: 0.7 }]}>
                      {isSending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name={editingMsg ? "checkmark" : "send"} size={18} color="#fff" style={!editingMsg && { marginLeft: 3, marginTop: 2 }} />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.micBtn} onPress={() => { setIsAttachMenuVisible(false); startRecording(); }}>
                    <Ionicons name="mic" size={22} color="##1D4ED8" />
                  </TouchableOpacity>
                )
              )}
              
            </View>
          </View>
        </ImageBackground>
      </KeyboardAvoidingView>

      <Modal visible={mediaViewer.visible} transparent={true} animationType="fade" onRequestClose={() => setMediaViewer({ visible: false, url: null, type: null })}>
        <View style={styles.mediaViewerContainer}>
          
          <View style={styles.mediaViewerHeader}>
            <TouchableOpacity style={styles.mediaViewerBtn} onPress={() => setMediaViewer({ visible: false, url: null, type: null })}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.mediaViewerBtn} onPress={saveMediaToDevice}>
              {isDownloading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="download-outline" size={28} color="#fff" />}
            </TouchableOpacity>
          </View>

          {mediaViewer.type === 'image' && (
            <Image source={{ uri: mediaViewer.url }} style={styles.fullScreenMedia} resizeMode="contain" />
          )}
          {mediaViewer.type === 'video' && (
            <Video source={{ uri: mediaViewer.url }} style={styles.fullScreenMedia} useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay />
          )}
        </View>
      </Modal>

      <Modal visible={messageOptions.visible} transparent={true} animationType="slide" onRequestClose={() => setMessageOptions({ visible: false, message: null })}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMessageOptions({ visible: false, message: null })}>
          <View style={styles.optionsSheet}>
            <View style={styles.sheetIndicator} />
            <Text style={styles.sheetTitle}>Mesaj Seçenekleri</Text>
            
            {messageOptions.message?.type === 'text' && messageOptions.message?.senderId === currentUserId && (
              <TouchableOpacity style={styles.optionBtn} onPress={() => { 
                setEditingMsg(messageOptions.message); 
                setInputText(messageOptions.message.text); 
                setMessageOptions({ visible: false, message: null }); 
              }}>
                <Ionicons name="pencil" size={22} color="#475569" style={styles.optionIcon} />
                <Text style={styles.optionText}>Düzenle</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.optionBtn} onPress={() => handleMessageDelete('me')}>
              <Ionicons name="trash-outline" size={22} color="#475569" style={styles.optionIcon} />
              <Text style={styles.optionText}>Benden Sil</Text>
            </TouchableOpacity>

            {messageOptions.message?.senderId === currentUserId && (
              <TouchableOpacity style={[styles.optionBtn, { borderBottomWidth: 0 }]} onPress={() => handleMessageDelete('everyone')}>
                <Ionicons name="trash" size={22} color="#ef4444" style={styles.optionIcon} />
                <Text style={[styles.optionText, { color: '#ef4444' }]}>Herkesten Sil</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({

  // --- YANITLAMA KUTUSU STİLLERİ ---
  replyBox: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 10, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, overflow: 'hidden', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  replyBoxLeftBar: { width: 5, height: '100%', backgroundColor: '#1D4ED8', marginRight: 10 },
  replyBoxName: { fontSize: 13, fontWeight: '700', color: '#1D4ED8', marginTop: 8 },
  replyBoxText: { fontSize: 13, color: '#475569', marginBottom: 8, marginTop: 2 },
  
  // --- MESAJIN İÇİNDEKİ ALINTI BALONCUĞU STİLLERİ ---
  quotedBubble: { backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: 6, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: '#94a3b8' },
  myQuotedBubble: { backgroundColor: 'rgba(255,255,255,0.15)', borderLeftColor: '#e2e8f0' },
  otherQuotedBubble: { backgroundColor: 'rgba(0,0,0,0.03)', borderLeftColor: '#1D4ED8' },
  quotedName: { fontSize: 12, fontWeight: '700', color: '#1D4ED8', marginBottom: 2 },
  quotedText: { fontSize: 12, color: '#334155' },

  container: { flex: 1, backgroundColor: '#F3F4F6' }, // Daha yumuşak nötr bir gri (göz yormaz)
  
  // Header koyu lacivert ve arduvaz (slate) tonlarında tutuldu (Güven ve stabilite hissi)
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, elevation: 4, shadowColor: '#0f172a', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, zIndex: 10 },
  backBtn: { padding: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, marginRight: 15 },
  headerProfileInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#64748b' },
  headerTextWrap: { marginLeft: 12, flex: 1, justifyContent: 'center' },
  headerTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
  onlineStatus: { color: '#34d399', fontSize: 12, fontWeight: '600', marginTop: 2 }, // Daha pastel bir online yeşili
  headerIconBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  
  absoluteEmptyContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: -1 },
  emptyIconWrap: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 40 },

  listContent: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 20 },
  messageRow: { flexDirection: 'row', marginVertical: 4, alignItems: 'flex-end' },
  myMessageRow: { justifyContent: 'flex-end' },
  otherMessageRow: { justifyContent: 'flex-start' },
  avatarWrapLeft: { marginRight: 8, marginBottom: 2 },
  chatAvatar: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', elevation: 1 },
  msgContainer: { maxWidth: '80%' }, // Okunabilirliği artırmak için %78'den %80'e çektik
  myMsgContainer: { alignItems: 'flex-end' },
  otherMsgContainer: { alignItems: 'flex-start' },
  
  myBubbleWrap: { borderRadius: 16, borderBottomRightRadius: 4, elevation: 1, shadowColor: '#1e3a8a', shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  otherBubbleWrap: { borderRadius: 16, borderTopLeftRadius: 4, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, backgroundColor: '#fff' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  myBubble: { borderBottomRightRadius: 4, backgroundColor: '#059669',},
  otherBubble: { borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#f1f5f9', backgroundColor: '#fff' },
  
  msgText: { fontSize: 15, lineHeight: 22, letterSpacing: 0.2 },
  myMsgText: { color: '#ffffff', fontWeight: '500', fontSize: 15 }, // Göz yoran saf beyaz yerine kırık beyaz
  otherMsgText: { color: '#1e293b', fontWeight: '400', fontSize: 15, lineHeight: 22 },
  mediaImage: { width: 230, height: 230, borderRadius: 10, marginBottom: 4 },
  videoThumbnailBox: { width: 230, height: 230, justifyContent: 'center', alignItems: 'center' },
  playIconOverlay: { position: 'absolute', width: 50, height: 50, backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  documentBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)', padding: 10, borderRadius: 10, marginBottom: 4, width: 220 },
  docIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  documentText: { fontSize: 14, fontWeight: '500', marginLeft: 8, flexShrink: 1 },
  
  timeRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 },
  timeText: { fontSize: 11, fontWeight: '500' },
myTimeText: { 
  color: 'rgba(255, 255, 255, 0.9)', 
  fontSize: 11 
},

  otherTimeText: { color: '#64748b' },
  
  audioBubbleContainer: { borderRadius: 16, elevation: 1 },
  audioBubble: { flexDirection: 'row', alignItems: 'center', width: 250, paddingVertical: 8, paddingHorizontal: 10 },
  playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  audioWaveWrap: { flex: 1, justifyContent: 'center', marginTop: -5 },
  audioTimeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8, paddingHorizontal: 5 },
  audioDurationText: { fontSize: 11, fontWeight: '500' },
  timeRowAbsolute: { position: 'absolute', bottom: 6, right: 10, flexDirection: 'row', alignItems: 'center' },
  
  inputOuterWrapper: { paddingHorizontal: 10, paddingBottom: Platform.OS === 'ios' ? 20 : 15, paddingTop: 5, backgroundColor: 'transparent' },
  inputContainer: { flexDirection: 'row', backgroundColor: '#fff', alignItems: 'center', borderRadius: 24, paddingHorizontal: 6, paddingVertical: 6, borderWidth: 1, borderColor: '#e2e8f0', zIndex: 2 },
  
  attachMenu: { position: 'absolute', bottom: 70, left: 15, right: 15, backgroundColor: '#fff', borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', elevation: 8, shadowColor: '#0f172a', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, zIndex: 1, borderWidth: 1, borderColor: '#f1f5f9' },
  attachItem: { alignItems: 'center' },
  attachIconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  attachText: { fontSize: 12, color: '#475569', fontWeight: '500' },
  attachBtn: { padding: 8, marginLeft: 2 },

  input: { flex: 1, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 8, fontSize: 16, maxHeight: 100, color: '#1e293b', fontWeight: '400' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  micBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 2 },
  uploadingBox: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  recordingUI: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 15, justifyContent: 'space-between' },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginRight: 8 },
  recordingText: { flex: 1, color: '#ef4444', fontWeight: '600', fontSize: 15, letterSpacing: 1 },
  recActionBtn: { padding: 10, marginRight: 5 },
  recSendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1D4ED8', justifyContent: 'center', alignItems: 'center' },

  mediaViewerContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  mediaViewerHeader: { position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 10 },
  mediaViewerBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  fullScreenMedia: { width: '100%', height: '100%' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  optionsSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 25, paddingBottom: 35 },
  sheetIndicator: { width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 25 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 20, textAlign: 'center' },
  optionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  optionIcon: { marginRight: 15 },
  optionText: { fontSize: 16, fontWeight: '500', color: '#334155' }
});                                            