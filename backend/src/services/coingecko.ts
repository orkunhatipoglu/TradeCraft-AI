import axios from 'axios';

const BASE_URL = 'https://api.coingecko.com/api/v3';

// Map trading symbols to CoinGecko IDs
const SYMBOL_TO_ID: Record<string, string> = {
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  SOLUSDT: 'solana',
  BNBUSDT: 'binancecoin',
  XRPUSDT: 'ripple',
};

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  marketCap: number;
  totalVolume: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  marketCapRank: number;
}

export interface GlobalMarketData {
  totalMarketCap: number;
  totalVolume: number;
  btcDominance: number;
  marketCapChangePercentage24h: number;
}

// Get coin data by symbol
export async function getCoinData(symbol: string): Promise<CoinData | null> {
  const coinId = SYMBOL_TO_ID[symbol];
  if (!coinId) return null;

  try {
    const response = await axios.get(`${BASE_URL}/coins/${coinId}`, {
      params: {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: false,
        developer_data: false,
      },
    });

    const data = response.data;
    const marketData = data.market_data;

    return {
      id: data.id,
      symbol: data.symbol.toUpperCase(),
      name: data.name,
      currentPrice: marketData.current_price.usd,
      marketCap: marketData.market_cap.usd,
      totalVolume: marketData.total_volume.usd,
      priceChange24h: marketData.price_change_24h,
      priceChangePercentage24h: marketData.price_change_percentage_24h,
      marketCapRank: data.market_cap_rank,
    };
  } catch (error: any) {
    console.error(`CoinGecko error for ${symbol}:`, error.message);
    return null;
  }
}

// Get global market data
export async function getGlobalMarketData(): Promise<GlobalMarketData | null> {
  try {
    const response = await axios.get(`${BASE_URL}/global`);
    const data = response.data.data;

    return {
      totalMarketCap: data.total_market_cap.usd,
      totalVolume: data.total_volume.usd,
      btcDominance: data.market_cap_percentage.btc,
      marketCapChangePercentage24h: data.market_cap_change_percentage_24h_usd,
    };
  } catch (error: any) {
    console.error('CoinGecko global data error:', error.message);
    return null;
  }
}

// Get fear & greed index (from alternative API)
export async function getFearGreedIndex(): Promise<{ value: number; classification: string } | null> {
  try {
    const response = await axios.get('https://api.alternative.me/fng/');
    const data = response.data.data[0];

    return {
      value: parseInt(data.value),
      classification: data.value_classification,
    };
  } catch (error: any) {
    console.error('Fear & Greed index error:', error.message);
    return null;
  }
}

export const coingeckoService = {
  getCoinData,
  getGlobalMarketData,
  getFearGreedIndex,
};
