# 🛡️ Albion Discord Bot

Discord sunucunuz için gelişmiş parti kurma ve yönetim botu.

## 📁 Proje Yapısı

```
dcalbionbot/
├── src/
│   ├── index.js                    # Ana giriş noktası
│   ├── config/
│   │   └── config.js              # Konfigürasyon yönetimi
│   ├── constants/
│   │   └── constants.js           # Sabitler
│   ├── commands/
│   │   └── commands.js            # Slash komut tanımları
│   ├── handlers/
│   │   ├── commandHandler.js      # Komut işleyicileri
│   │   ├── partikurHandler.js     # Parti kurma işleyicileri
│   │   ├── buttonHandler.js       # Buton etkileşim işleyicileri
│   │   └── modalHandler.js        # Modal işleyicileri
│   ├── services/
│   │   ├── guildConfig.js         # Sunucu ayarları yönetimi
│   │   ├── db.js                  # Veritabanı servisi
│   │   └── commandRegistration.js # Komut kayıt servisi

│   ├── builders/
│   │   ├── embedBuilder.js        # Embed oluşturucular
│   │   ├── componentBuilder.js    # Component oluşturucular
│   │   └── payloadBuilder.js      # Payload oluşturucular
│   └── utils/
│       └── interactionUtils.js    # Etkileşim yardımcıları
├── .env                            # Ortam değişkenleri (Git'e eklenmez)
├── .env.example                    # Ortam değişkenleri şablonu
├── .env.local                      # Yerel ortam değişkenleri (Git'e eklenmez)
├── .gitignore
├── package.json
└── README.md
```

## 🚀 Kurulum

Bot artık **"Public" (Herkese Açık)** moddadır. Tek bir bot örneği üzerinden sınırsız sunucuya hizmet verebilir.

### 1. Ortam Değişkenlerini Ayarlayın

`.env` dosyası oluşturun ve sadece temel Discord bilgilerini girin:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
OWNER_ID=your_discord_id
REGISTER_GLOBAL=true # Komutların tüm sunucularda görünmesi için true yapın
```

### 2. Botu Başlatın
```bash
npm install
npm start
```

### 3. Sunucu Ayarlarını Yapın (ÖNEMLİ)

Botu bir sunucuya ekledikten sonra, o sunucunun yetkilisi şu komutu çalıştırmalıdır:

```
/ayar lonca-ismi: [Lonca Adı] lonca-id: [Albion-Guild-ID]
```

Bu komut çalıştırılmadan `/uyeler` veya parti kurma komutları o sunucu için varsayılan (örnek) değerlerle çalışır.

## 🎯 Özellikler

- **Dinamik Sunucu Yönetimi**: Her sunucu kendi lonca ismini ve Albion ID'sini `/ayar` komutuyla belirleyebilir.
- **Paylaşımlı Veritabanı**: Veriler sunucu bazlı (`guild_id`) olarak SQLite üzerinde güvenle tutulur.
- **Evrensel Komutlar**: Tek bir bot kurulumu ile tüm Discord ekosistemine hizmet verebilirsiniz.

## 🛠️ Geliştirici

Hakkı

## 📄 Lisans

MIT

