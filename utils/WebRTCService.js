import { io } from "socket.io-client";

import { PermissionsAndroid, Platform, AppState, Linking } from 'react-native';

import {

  RTCPeerConnection,

  mediaDevices,

  RTCSessionDescription,

  RTCIceCandidate

} from "react-native-webrtc";
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher'; // 🚀 BUNU EKLE

const configuration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    // 🚀 DOĞRU SUNUCU IP'Sİ
    { urls: "stun:34.9.71.194:3478" },
    {
      urls: "turn:34.9.71.194:3478",
      username: "myuser",        
      credential: "mypassword123" 
    }
  ],
  iceCandidatePoolSize: 10, 
};

class WebRTCService {

  constructor() {
    this.connected = false;
    this.socket = null;
    this.peer = null;
    this.localStream = null;
    this.remoteStream = null;
    this.remoteUser = null;
    this.remoteCandidatesQueue = [];
    this.onRemoteStreamUpdate = null;
    this.onConnectionStateChange = null;
    this.shouldAutoMinimizeVideo = false;
  }

  // 🛡️ Askeri Düzey İzin Kontrolü

  async requestPermissions(needVideo = false) {

    if (Platform.OS === 'android') {

      try {

        const grantedAudio = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);

        if (grantedAudio !== PermissionsAndroid.RESULTS.GRANTED) return false;



        if (needVideo) {

          const grantedVideo = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);

          if (grantedVideo !== PermissionsAndroid.RESULTS.GRANTED) return false;

        }

      } catch (err) {

        console.error("❌ İzin Hatası:", err);

        return false;

      }

    }

    return true;

  }

  // WebRTCService.js içindeki connect fonksiyonunu bul ve şu şekilde güncelle:

  connect(uid) {
    if (this.connected) return;

    // 🚀 URL'i artık güvenli bir şekilde config'den alıyoruz
    const serverUrl = Constants.expoConfig.extra.SIGNALING_SERVER_URL;

    this.socket = io(serverUrl, {
      auth: { token: uid },
      transports: ['websocket'],
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    this.connected = true;
    this.registerSocketEvents();
  }

  // 📡 Peer Bağlantısını Oluştur

  async createPeer(isCaller = false, mediaType = 'audio') {

    if (this.peer) this.peer.close();



    this.peer = new RTCPeerConnection(configuration);


this.peer.onconnectionstatechange = () => {
    // 🚀 KRİTİK GÜVENLİK KİLİDİ: Eğer bağlantı çoktan kapatıldıysa işlem yapma!
    if (!this.peer) return; 

    if (this.onConnectionStateChange) this.onConnectionStateChange(this.peer.connectionState);

      // 🚀 SADECE KAMERA (VİDEO) İÇİN OTOMATİK KÜÇÜLTME
      if (this.peer.connectionState === 'connected' && this.shouldAutoMinimizeVideo) {
        this.shouldAutoMinimizeVideo = false; // Bir daha tetiklenmesin
        setTimeout(() => {
          if (Platform.OS === 'android') {
            IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
              category: 'android.intent.category.HOME'
            }).catch(() => { });
          }
        }, 1500); // Görüntü bağlandıktan 1.5 sn sonra simge durumuna küçült
      }
    };


    if (isCaller) {

      // EBEVEYN (ALICI MODU): Ne gelirse kabul et

      this.peer.addTransceiver('audio', { direction: 'recvonly' });

      if (mediaType.startsWith('video')) {

        this.peer.addTransceiver('video', { direction: 'recvonly' });

      }

    } else {
      // ÇOCUK (VERİCİ MODU): Donanımı ateşle
      const needVideo = mediaType.startsWith('video');
      const hasPermission = await this.requestPermissions(needVideo);
      if (!hasPermission) throw new Error("Terminal güvenlik izinleri reddedildi.");

      try {
// 🚀 PİL DOSTU YASAL ARKA PLAN SES MOTORU
        const { Audio } = require('expo-av');
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true, // EN KRİTİK NOKTA: Arka planda mikrofonu yaşatır
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        // 🚀 ORTAM DİNLEMESİ İÇİN HASSASLAŞTIRILMIŞ MİKROFON AYARLARI
        let constraints = {
          audio: {
            echoCancellation: true,     
            noiseSuppression: false,     
            autoGainControl: true,      
            googHighpassFilter: false, 
            channelCount: 1,             
            bitrate: 128000              
          },
          video: false
        };

        if (mediaType === 'video-front') {
          constraints.video = {
            facingMode: 'user',
            width: { ideal: 720 }, 
            height: { ideal: 480 },
            frameRate: { ideal: 24, max: 30 }
          };
        } else if (mediaType === 'video-back') {
          constraints.video = {
            facingMode: 'environment',
            width: { ideal: 1280 }, 
            height: { ideal: 720 },
            frameRate: { ideal: 24, max: 30 }
          };
        }


        this.localStream = await mediaDevices.getUserMedia(constraints);


        this.localStream.getTracks().forEach(track => {

          this.peer.addTrack(track, this.localStream);

        });

        this.peer.getTransceivers().forEach(transceiver => {

          if (transceiver.sender && transceiver.sender.track) {

            transceiver.direction = 'sendonly';

          }

        });

      } catch (e) {

        console.error("❌ Terminal donanımı başlatılamadı:", e);

        // Fallback: Sadece ses gönder

        if (needVideo) {

          console.warn("⚠️ Kamera açılamadı, Güvenli Ses Moduna geçiliyor.");

          try {

            this.localStream = await mediaDevices.getUserMedia({ audio: true, video: false });

            this.localStream.getTracks().forEach(track => this.peer.addTrack(track, this.localStream));

          } catch (fallbackErr) {

            throw new Error("Medya donanımına hiçbir şekilde ulaşılamadı.");

          }

        }

      }

    }


    this.peer.ontrack = (event) => {

      if (event.streams && event.streams[0]) {

        this.remoteStream = event.streams[0];

        if (this.onRemoteStreamUpdate) this.onRemoteStreamUpdate(this.remoteStream);

      }

    };


    this.peer.onicecandidate = (event) => {

      if (event.candidate && this.remoteUser) {

        this.socket.emit("ice-candidate", {

          candidate: event.candidate,

          target: this.remoteUser

        });

      }

    };

  }

  registerSocketEvents() {
    this.socket.on("offer", async (data) => {

      // 🚀 YENİ: İsteğin video (kamera) olup olmadığını anla ve bayrağı ayarla
      const isVideo = data.mediaType && data.mediaType.startsWith('video');
      this.shouldAutoMinimizeVideo = isVideo;

      // 🚀 Kilitli Telefonu Uyandır ve Uygulamayı Öne Çıkar!
      if (Platform.OS === 'android' && AppState.currentState !== 'active') {
        try {
          // 🚀 YENİ KOD: Uygulamanın şemasını otomatik bulur (aegischild veya aegisparent)
          const appScheme = Constants.expoConfig?.scheme || 'aegischild';
          await Linking.openURL(`${appScheme}://`);
        } catch (e) {
          console.log("Ekran uyandırılamadı:", e);
        }
      }

      // 🛡️ ÇELİK KAPI 2: Aynı anda iki bağlantı kurulmasını (çift kanal) engelle!
      if (this.peer && this.peer.signalingState !== 'closed') {
        console.warn("⚠️ Eski bağlantı kapatılıyor, yenisi açılıyor.");
        this.peer.close();
      }

      this.remoteUser = data.from;

      try {
        await this.createPeer(false, data.mediaType || 'audio');

        // Uzak bağlantı tanımını (SDP) ayarla
        await this.peer.setRemoteDescription(new RTCSessionDescription(data.offer));

        // Biriken ICE Candidate'leri erit
        while (this.remoteCandidatesQueue.length > 0) {
          const cand = this.remoteCandidatesQueue.shift();
          await this.peer.addIceCandidate(new RTCIceCandidate(cand));
        }

        // Cevap oluştur ve gönder
        const answer = await this.peer.createAnswer();
        await this.peer.setLocalDescription(answer);

        this.socket.emit("answer", { answer, target: this.remoteUser });
      } catch (err) {
        console.error("❌ Bağlantı isteği işlenemedi:", err);
      }
    });

    // 📨 EBEVEYN İÇİN: Çocuğun Cevabı (Answer)
    this.socket.on("answer", async (data) => {
      if (this.peer) {
        try {
          // 🛡️ ÇELİK KAPI: Eğer bağlantı zaten kurulmuşsa (stable) 
          // veya biz bir teklif (offer) oluşturmamışsak bu cevabı REDDET!
          if (this.peer.signalingState === 'have-local-offer') {
            await this.peer.setRemoteDescription(new RTCSessionDescription(data.answer));
            console.log("✅ Bağlantı Kararlı Hale Geldi (UPLINK SUCCESS)");
          } else {
            console.warn(`⚠️ Çift Cevap Engellendi. Mevcut Durum: ${this.peer.signalingState}`);
          }
        } catch (err) {
          console.error("❌ Hedef cihaz cevabı kabul edilmedi:", err);
        }
      }
    });


    // 🌐 ICE Yönlendirmeleri (Güvenlik Duvarı Delme)

    this.socket.on("ice-candidate", async (data) => {

      if (this.peer && this.peer.remoteDescription) {

        try {

          await this.peer.addIceCandidate(new RTCIceCandidate(data.candidate));

        } catch (err) { }

      } else {

        this.remoteCandidatesQueue.push(data.candidate);

      }

    });


    this.socket.on("hangup", () => {

      this.stop();

    });

    this.socket.on('disconnect', (reason) => {
      console.log("Soket bağlantısı koptu:", reason);

    });

  }
  // 📞 EBEVEYN İÇİN: Bağlantı İstemi Başlatma

  async call(targetId, mediaType = 'audio') {

    try {

      this.remoteUser = targetId;

      await this.createPeer(true, mediaType);


      const offer = await this.peer.createOffer();

      await this.peer.setLocalDescription(offer);


      this.socket.emit("offer", {

        offer: offer,

        target: targetId,

        from: this.socket.auth.token,

        mediaType: mediaType

      });

    } catch (err) {

      console.error("❌ Uplink isteği başlatılamadı:", err);

      this.stop();

    }

  }

  // 👻 HAYALET DÜRTME: Çocuğun soketini sessizce yeniler
  pingDevice(targetId) {
    if (this.socket) {
      this.socket.emit("silent-ping", { target: targetId });
      console.log("👻 Hayalet sinyal fırlatıldı! Hedef:", targetId);
    } else {
      console.log("❌ Soket bağlı değil, önce connect() olmalısın.");
    }
  }

  // 🚨 BALYOZ: Çocuğun telefonunda zorla siren çaldırır
  triggerSiren(targetId) {
    if (this.socket) {
      this.socket.emit("trigger-siren", { target: targetId });
      console.log("🚨 Balyoz sinyali fırlatıldı! Hedef:", targetId);
    }
  }

  stop() {

    if (this.socket && this.remoteUser) {

      this.socket.emit("hangup", { target: this.remoteUser });

    }

    // Mikrofon ve Kameranın ışıklarını (kırmızı/yeşil) güvenli şekilde kapat

    if (this.localStream) {

      this.localStream.getTracks().forEach(track => {

        track.stop();

        track.enabled = false;

      });

      this.localStream.release && this.localStream.release(); // Belleği boşalt

      this.localStream = null;

    }

    if (this.peer) {

      this.peer.ontrack = null;

      this.peer.onicecandidate = null;

      this.peer.onconnectionstatechange = null;

      this.peer.close();

      this.peer = null;

    }

    this.remoteStream = null;

    this.remoteUser = null;

    this.remoteCandidatesQueue = [];

  }

}

export default new WebRTCService();