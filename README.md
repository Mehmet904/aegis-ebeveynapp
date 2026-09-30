# 🛡️ Aegis Ebeveyn (Parent)

Aegis, ebeveynlerin çocuklarının dijital ve fiziksel güvenliğini sağlaması için geliştirilmiş, React Native ve Firebase tabanlı bir mobil ebeveyn takip sistemidir. Bu depo, sistemin kontrol merkezi olan **Ebeveyn** uygulamasını barındırır.

## 🚀 Öne Çıkan Özellikler
* **Canlı Konum Takibi:** Google Maps entegrasyonu ile çocuğun anlık konumunu harita üzerinden izleme.
* **Güvenli Bölge (Geofence):** Belirlenen güvenli alanların dışına çıkıldığında anında bildirim alma.
* **Ortam Dinleme:** WebRTC altyapısı sayesinde kesintisiz ve anlık ortam sesi dinleme.
* **Uygulama Kullanım İstatistikleri:** Çocuğun telefonda hangi uygulamada ne kadar vakit geçirdiğini takip etme.
* **Acil Durum Alarmları:** İhtiyaç anında çocuk telefonunda tek tuşla yüksek sesli uyarı sireni çalma.

## 🛠️ Kullanılan Teknolojiler
* **Frontend:** React Native, Expo
* **Backend & Veritabanı:** Firebase Realtime Database, Firebase Authentication
* **İletişim:** WebRTC (Gerçek zamanlı ses aktarımı için)
* **Harita:** Google Maps API

## ⚙️ Kurulum ve Çalıştırma

Projeyi kendi bilgisayarınızda çalıştırmak için aşağıdaki adımları izleyin:

1. Depoyu klonlayın:
   ```bash
   git clone [https://github.com/Mehmet212121/aegis-ebeveyn.git](https://github.com/Mehmet212121/aegis-ebeveyn.git)
Proje dizinine girin ve gerekli paketleri yükleyin:

Bash
cd aegis-ebeveyn
npm install
Ana dizinde bir .env dosyası oluşturun ve kendi Firebase/Google Maps anahtarlarınızı ekleyin:

Kod snippet'i
FIREBASE_API_KEY=senin_api_anahtarin
FIREBASE_AUTH_DOMAIN=senin_auth_domainin
FIREBASE_DATABASE_URL=senin_database_url
FIREBASE_PROJECT_ID=senin_project_id
FIREBASE_STORAGE_BUCKET=senin_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=senin_sender_id
FIREBASE_APP_ID=senin_app_id
GOOGLE_MAPS_API_KEY=senin_maps_anahtarin
SIGNALING_SERVER_URL=senin_webrtc_sunucu_url
Uygulamayı başlatın:

Bash
npx expo start 
box Expo run android
