import axios from 'axios';

// ---------------------------------------------------------
// 1. Config & Interfaces
// ---------------------------------------------------------

const WHALE_ALERT_API_KEY = process.env.WHALE_ALERT_API_KEY || '';
const WHALE_ALERT_BASE_URL = 'https://api.whale-alert.io/v1';
const MAX_RETRIES = 1;

export interface WhaleTransaction {
  hash: string;
  blockchain: string;
  symbol: string;
  amount: number;
  amountUsd: number;
  from: string;
  fromType: string;
  to: string;
  toType: string;
  timestamp: number;
  transactionType: 'exchange_inflow' | 'exchange_outflow' | 'transfer';
}

export interface WhaleActivitySummary {
  totalTransactions: number;
  totalVolumeUsd: number;
  netFlow: 'inflow' | 'outflow' | 'neutral';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  largestTransaction: WhaleTransaction | null;
  recentTransactions: WhaleTransaction[];
}

// ---------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function generateMockHash(): string {
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    hash += Math.floor(Math.random() * 16).toString(16);
  }
  return hash;
}

function determineTransactionType(fromType: string, toType: string): 'exchange_inflow' | 'exchange_outflow' | 'transfer' {
  if (toType === 'exchange' && fromType !== 'exchange') return 'exchange_inflow';
  if (fromType === 'exchange' && toType !== 'exchange') return 'exchange_outflow';
  return 'transfer';
}

function summarizeTransactions(transactions: WhaleTransaction[]): WhaleActivitySummary {
  if (transactions.length === 0) {
    return {
      totalTransactions: 0, totalVolumeUsd: 0, netFlow: 'neutral',
      sentiment: 'neutral', largestTransaction: null, recentTransactions: []
    };
  }

  const inflowVol = transactions.filter(t => t.transactionType === 'exchange_inflow').reduce((s, t) => s + t.amountUsd, 0);
  const outflowVol = transactions.filter(t => t.transactionType === 'exchange_outflow').reduce((s, t) => s + t.amountUsd, 0);

  const netFlow = inflowVol > outflowVol * 1.1 ? 'inflow' : outflowVol > inflowVol * 1.1 ? 'outflow' : 'neutral';
  const sentiment = netFlow === 'inflow' ? 'bearish' : netFlow === 'outflow' ? 'bullish' : 'neutral';

  const sorted = [...transactions].sort((a, b) => b.amountUsd - a.amountUsd);

  return {
    totalTransactions: transactions.length,
    totalVolumeUsd: transactions.reduce((s, t) => s + t.amountUsd, 0),
    netFlow,
    sentiment,
    largestTransaction: sorted[0] || null,
    recentTransactions: sorted.slice(0, 10),
  };
}

// ---------------------------------------------------------
// 3. The Core Service
// ---------------------------------------------------------

function generateMockWhaleData(minAmount: number): WhaleActivitySummary {
  console.warn('⚠️ API unavailable or limited. Falling back to mock data.');
  const mockTransactions: WhaleTransaction[] = Array.from({ length: 5 }).map(() => {
    const isInflow = Math.random() > 0.5;
    const amountUsd = Math.floor(Math.random() * 2000000) + minAmount;
    return {
      hash: generateMockHash(),
      blockchain: 'ethereum',
      symbol: 'ETH',
      amount: amountUsd / 2800,
      amountUsd,
      from: isInflow ? 'Unknown' : 'Binance',
      fromType: isInflow ? 'unknown' : 'exchange',
      to: isInflow ? 'Binance' : 'Unknown',
      toType: isInflow ? 'exchange' : 'unknown',
      timestamp: Math.floor(Date.now() / 1000),
      transactionType: isInflow ? 'exchange_inflow' : 'exchange_outflow',
    };
  });
  return summarizeTransactions(mockTransactions);
}

export async function getWhaleActivity(minAmountUsd: number = 500000): Promise<WhaleActivitySummary> {
  if (!WHALE_ALERT_API_KEY) return generateMockWhaleData(minAmountUsd);

  const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
  let attempts = 0;

  while (attempts <= MAX_RETRIES) {
    try {
      const response = await axios.get(`${WHALE_ALERT_BASE_URL}/transactions`, {
        params: { api_key: WHALE_ALERT_API_KEY, min_value: minAmountUsd, start: oneHourAgo },
        timeout: 6000 + (attempts * 2000),
      });

      if (response.status === 200 && Array.isArray(response.data?.transactions)) {
        const cleanTransactions: WhaleTransaction[] = response.data.transactions.map((t: any) => {
          const fromType = t.from?.owner_type || 'unknown';
          const toType = t.to?.owner_type || 'unknown';
          return {
            hash: t.hash,
            blockchain: t.blockchain,
            symbol: (t.symbol || 'UNK').toUpperCase(),
            amount: t.amount,
            amountUsd: t.amount_usd,
            from: t.from?.owner || (t.from?.address ? `${t.from.address.slice(0, 8)}...` : 'Unknown'),
            fromType,
            to: t.to?.owner || (t.to?.address ? `${t.to.address.slice(0, 8)}...` : 'Unknown'),
            toType,
            timestamp: t.timestamp,
            transactionType: determineTransactionType(fromType, toType),
          };
        });
        return summarizeTransactions(cleanTransactions);
      }
      throw new Error('Malformed API Response');

    } catch (error: any) {
      attempts++;
      const status = error.response?.status;
      const errorMsg = error.response?.data?.message || error.message || 'Unknown Error';

      // Circuit Breaker for server failure
      if (status >= 500) {
        console.error(`❌ Server Error (${status}). Circuit broken.`);
        break;
      }

      // Rate Limit Handling (Whale Alert uses 403 or 429/420 for limits)
      if (status === 429 || status === 420 || status === 403) {
        if (attempts > MAX_RETRIES) {
          console.error('❌ Still rate limited after retry. Giving up.');
          break;
        }
        console.warn(`⚠️ Rate limited (${status}). Backing off for 30s...`);
        await sleep(30000);
        continue; // Retry logic
      }

      console.error(`❌ Attempt ${attempts} failed: ${errorMsg}`);
      if (attempts > MAX_RETRIES) break;
      await sleep(2000);
    }
  }

  return generateMockWhaleData(minAmountUsd);
}

export const whaleService = { getWhaleActivity };