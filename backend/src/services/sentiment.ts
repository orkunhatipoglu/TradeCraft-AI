import Parser from 'rss-parser';
import Sentiment from 'sentiment';
import { coingeckoService } from './coingecko';

// --- Configuration & Setup ---
const parser = new Parser();
const sentimentAnalyzer = new Sentiment();

// .env'den URL'leri al, yoksa boş dizi dön
const RSS_FEEDS = process.env.RSS_FEED_URLS 
  ? process.env.RSS_FEED_URLS.split(',') 
  : [];

export interface SentimentData {
  score: number; // 0-100
  trend: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  sources: {
    fearGreed: number | null;
    socialVolume: number | null; // RSS'de bulunan ilgili haber sayısı
    marketMomentum: number | null;
    rssSentimentScore: number | null; // RSS'den gelen ham skor (0-100)
  };
}

/**
 * RSS Feedlerinden gerçek veri çeker ve analiz eder.
 * @param symbols - Aranacak semboller veya kelimeler (örn: ['BTC', 'Bitcoin'])
 */
export async function getRSSSentiment(symbols: string[]): Promise<{ score: number; mentions: number } | null> {
  if (RSS_FEEDS.length === 0) {
    console.warn("Uyarı: .env dosyasında RSS_FEED_URLS tanımlı değil.");
    return null;
  }

  let totalSentimentScore = 0;
  let relevantItemCount = 0;

  try {
    // Tüm RSS feedlerini paralel olarak çek
    const feedPromises = RSS_FEEDS.map(url => parser.parseURL(url.trim()).catch(err => {
      console.error(`RSS Çekme Hatası (${url}):`, err.message);
      return null;
    }));

    const feeds = await Promise.all(feedPromises);

    // Her bir feed içindeki her bir haberi gez
    feeds.forEach(feed => {
      if (!feed || !feed.items) return;

      feed.items.forEach(item => {
        const textToAnalyze = `${item.title} ${item.contentSnippet || ''}`;
        
        // Bu haber bizim coin ile ilgili mi? (Case-insensitive check)
        const isRelevant = symbols.some(symbol => 
          textToAnalyze.toLowerCase().includes(symbol.toLowerCase())
        );

        if (isRelevant) {
          // Sentiment analizi yap (kütüphane -5 ile +5 arası puan verir genelde)
          const result = sentimentAnalyzer.analyze(textToAnalyze);
          
          // Skoru biriktir (Comparative score kullanıyoruz, daha dengeli)
          // result.comparative genelde -1 ile 1 arasındadır.
          totalSentimentScore += result.comparative;
          relevantItemCount++;
        }
      });
    });

    if (relevantItemCount === 0) {
      return { score: 50, mentions: 0 }; // Veri yoksa nötr dön
    }

    // Ortalama skoru hesapla (-1 ile 1 arasında)
    const averageSentiment = totalSentimentScore / relevantItemCount;

    // Skoru 0-100 arasına normalize et
    // -1 -> 0 (Aşırı Negatif)
    // 0 -> 50 (Nötr)
    // 1 -> 100 (Aşırı Pozitif)
    // Formül: ((x + 1) / 2) * 100
    let normalizedScore = ((averageSentiment + 1) / 2) * 100;
    
    // Sınırları zorlama (0-100 arası kelepçele)
    normalizedScore = Math.min(100, Math.max(0, normalizedScore));

    return {
      score: Math.round(normalizedScore),
      mentions: relevantItemCount
    };

  } catch (error) {
    console.error("Genel RSS Hatası:", error);
    return null;
  }
}

// --- Main Analysis Logic ---

export async function analyzeSentiment(symbols: string[]): Promise<SentimentData> {
  // Paralel olarak tüm kaynaklara saldır
  const [fearGreed, globalData, rssData] = await Promise.all([
    coingeckoService.getFearGreedIndex(),
    coingeckoService.getGlobalMarketData(),
    getRSSSentiment(symbols) // Artık gerçek fonksiyonu çağırıyoruz
  ]);

  // Ağırlıklı Ortalama Hesabı
  // Fear&Greed: %40, Market Momentum: %30, RSS/Social: %30
  let weightedScore = 0;
  let totalWeight = 0;
  let factors: string[] = [];

  // 1. Fear & Greed Index (0-100)
  if (fearGreed) {
    weightedScore += fearGreed.value * 0.4;
    totalWeight += 0.4;
    factors.push(`Fear & Greed: ${fearGreed.value} (${fearGreed.classification})`);
  }

  // 2. Market Momentum (24h Change)
  if (globalData) {
    const momentum = globalData.marketCapChangePercentage24h;
    // Momentum'u 0-100 skalasına oturt (50 nötr, her %1 değişim +/- 5 puan)
    const momentumScore = Math.min(100, Math.max(0, 50 + (momentum * 5)));
    
    weightedScore += momentumScore * 0.3;
    totalWeight += 0.3;
    factors.push(`Market Mom: ${momentum.toFixed(2)}%`);
  }

  // 3. RSS / Social Sentiment
  if (rssData) {
    weightedScore += rssData.score * 0.3;
    totalWeight += 0.3;
    factors.push(`News Sentiment: ${rssData.score}/100 based on ${rssData.mentions} articles`);
  }

  // Eğer hiçbir veri gelmediyse varsayılan 50 dön
  let finalScore = totalWeight > 0 ? weightedScore / totalWeight : 50;

  // Trend Belirleme
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (finalScore >= 60) trend = 'bullish';
  else if (finalScore <= 40) trend = 'bearish';

  // Özet Oluştur
  const summary = generateSummary(trend, factors);

  return {
    score: Math.round(finalScore),
    trend,
    summary,
    sources: {
      fearGreed: fearGreed?.value || null,
      socialVolume: rssData?.mentions || 0,
      marketMomentum: globalData?.marketCapChangePercentage24h || null,
      rssSentimentScore: rssData?.score || null
    },
  };
}

function generateSummary(trend: string, factors: string[]): string {
  const trendDescriptions: Record<string, string> = {
    bullish: 'Market sentiment is decidedly OPTIMISTIC.',
    bearish: 'Market sentiment is currently PESSIMISTIC.',
    neutral: 'Market sentiment is UNDECIDED and sideways.',
  };

  return `${trendDescriptions[trend]} Key drivers: ${factors.join(' | ')}`;
}

export const sentimentService = {
  analyzeSentiment,
  getRSSSentiment, // Dışarıdan sadece RSS testi yapmak istersen diye export edildi
};