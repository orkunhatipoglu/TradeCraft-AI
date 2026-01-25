# 🚀 TradeCraft AI: Full-Stack İşlem Motoru

Bu proje, yüksek performanslı bir **FastAPI** backend ve modern bir **Next.js** frontend içeren bir monorepo yapısıdır. Finansal algoritmalar ve görsel veri akışı yönetimi için tasarlanmıştır.

---

## 🏗 Mimari

| Katman | Teknoloji | Port | Açıklama |
| :--- | :--- | :--- | :--- |
| **Frontend** | Next.js 15 (TS) | `3000` | React Flow tabanlı görsel arayüz |
| **Backend** | FastAPI (Python) | `8000` | İşlem mantığı ve veri işleme |

---

## ⚙️ Kurulum

### 1. Backend (Python)
Python tarafında bağımlılık çakışması yaşamamak için bir sanal ortam (`venv`) kullanılması zorunludur:

```bash
cd backend

# Sanal ortam oluştur
python -m venv venv

# Sanal ortamı aktif et (Windows)
venv\Scripts\activate

# Gerekli kütüphaneleri yükle
pip install fastapi uvicorn
```

### 2. Frontend (Node.js)
Frontend bağımlılıklarını yüklemek için Node.js yüklü olmalıdır:

```bash
cd frontend
npm install
```
## 🚀 Çalıştırma
Sistemi tam kapasite çalıştırmak için iki ayrı terminalde aşağıdaki komutları yürütün:

### Terminal 1: Backend
```bash
cd backend
uvicorn main:app --reload
```
💡 API dökümantasyonu için: http://127.0.0.1:8000/docs

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```
💡 Arayüz adresi: http://localhost:3000

## 🛠 Teknolojiler
UI: Next.js (App Router), Tailwind CSS, TypeScript.

Grafik/Akış: React Flow.

Server: FastAPI, Pydantic, Uvicorn.

Repo Yönetimi: Git (Optimize edilmiş kök .gitignore ile).

## ⚠️ Dikkat Edilmesi Gerekenler
Versiyonlar: Node.js v18+ ve Python 3.10+ kullandığınızdan emin olun.

Portlar: Eğer portlar doluysa hata alırsınız. 3000 ve 8000 portlarının boş olduğundan emin olun.
