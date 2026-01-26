# TradeCraft AI

Yapay zeka destekli otonom kripto trading platformu. Unreal engine blueprint benzeri visual workflow builder ile akıllı trading stratejileri oluşturun.

## Özellikler

- **Visual Workflow Builder**: Sürükle-bırak arayüzü ile trading stratejileri tasarlayın
- **AI Destekli Analiz**: Gemini ile sentiment analizi ve strateji önerileri
- **Gerçek Zamanlı Haberler**: CryptoCompare API entegrasyonu
- **BitMex Entegrasyonu**: Testnet ve Production desteği ile trade execution
- **Workflow Execution Engine**: Otomatik çalıştırma ve loglama

## Teknoloji Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React Flow (@xyflow/react)
- Zustand (State Management)
- TanStack Query

### Backend
- Node.js + Express
- TypeScript
- Firebase
- Socket.io

## Kurulum

### Gereksinimler
- Node.js 18+

### Backend Kurulumu

```bash
cd backend
npm install

# Environment dosyasını kopyala
cp .env.example .env
# .env dosyasını düzenle:

# Development sunucusunu başlat
npm run dev
```

### Frontend Kurulumu

```bash
cd frontend
npm install

# Development sunucusunu başlat
npm run dev
```

Uygulamaya `http://localhost:3000` adresinden erişebilirsiniz.

## Güvenlik Mimarisi

```
Frontend (Tarayıcı)          Backend (Sunucu)
     │                           │
     │  workflow data            │  API Keys (şifreli)
     │  node configs             │  - BITMEX_API_KEY
     │  ─────────────────────►   │  - BITMEX_SECRET
     │                           │  - GEMINI_API_KEY
     │  ◄─────────────────────   │  - CRYPTOCOMPARE_KEY
     │  sadece sonuçlar          │
     │  (key'ler ASLA)           │  Tüm external API çağrıları
                                 │  backend'den yapılır
```

- API key'ler `.env` dosyasında (sadece backend)
- AES-256 ile veritabanında şifrelenir
- Frontend sadece sonuçları görür, key'lere ASLA erişemez

## Proje Yapısı

```
/TradeCraft-AI
├── /frontend (Next.js)
│   ├── /app
│   │   ├── page.tsx (Dashboard)
│   │   ├── trades/page.tsx (Trade Geçmişi)
│   │   └── builder/[id]/page.tsx (Workflow Builder)
│   ├── /components
│   │   ├── /ui (Button, Input, Select, Modal)
│   │   └── /builder (Canvas, Sidebar, Nodes)
│   ├── /lib (API client, utilities)
│   └── /stores
│
└── /backend (Express)
    ├── /src
    │   ├── /routes (API endpoints)
    │   ├── /services (BitMex, Gemini, CryptoCompare)
    │   ├── /workers
    │   └── index.ts
    └── /prisma/schema.prisma
```

## API Endpoints

| Endpoint | Açıklama |
|----------|----------|
| `GET /api/workflows` | Tüm workflow'ları listele |
| `POST /api/workflows` | Yeni workflow oluştur |
| `PUT /api/workflows/:id` | Workflow güncelle |
| `POST /api/workflows/:id/execute` | Workflow çalıştır |
| `GET /api/news` | Kripto haberlerini getir |
| `POST /api/ai/sentiment` | Sentiment analizi yap |
| `POST /api/trades` | Trade oluştur |
| `GET /api/trades` | Trade geçmişini getir |