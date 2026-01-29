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
  weight: number; // The influence of this data node
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

function summarizeTransactions(transactions: WhaleTransaction[], weight: number): WhaleActivitySummary {
  if (transactions.length === 0) {
    return {
      totalTransactions: 0, 
      totalVolumeUsd: 0, 
      netFlow: 'neutral',
      sentiment: 'neutral', 
      largestTransaction: null, 
      recentTransactions: [], 
      weight
    };
  }

  const inflowVol = transactions.filter(t => t.transactionType === 'exchange_inflow').reduce((s, t) => s + t.amountUsd, 0);
  const outflowVol = transactions.filter(t => t.transactionType === 'exchange_outflow').reduce((s, t) => s + t.amountUsd, 0);

  // WEIGHT-AWARE: Adjust sensitivity based on weight importance
  // Low weight (25) = require 1.3x difference to signal, High weight (75) = only 1.05x needed
  const weightMultiplier = weight / 50;
  const sensitivityThreshold = 1.3 / weightMultiplier; // Inverted: higher weight = lower threshold

  const netFlow = inflowVol > outflowVol * sensitivityThreshold 
    ? 'inflow' 
    : outflowVol > inflowVol * sensitivityThreshold 
    ? 'outflow' 
    : 'neutral';

  const sentiment = netFlow === 'inflow' ? 'bearish' : netFlow === 'outflow' ? 'bullish' : 'neutral';

  const sorted = [...transactions].sort((a, b) => b.amountUsd - a.amountUsd);

  // WEIGHT-AWARE: Filter transactions based on weight significance
  // Low weight = only show top 5, High weight = show top 20
  const transactionCount = Math.ceil((weight / 100) * 20);

  return {
    totalTransactions: transactions.length,
    totalVolumeUsd: transactions.reduce((s, t) => s + t.amountUsd, 0),
    netFlow,
    sentiment,
    largestTransaction: sorted[0] || null,
    recentTransactions: sorted.slice(0, Math.max(5, transactionCount)),
    weight,
  };
}

// ---------------------------------------------------------
// 3. The Core Service
// ---------------------------------------------------------

function generateMockWhaleData(minAmount: number, weight: number): WhaleActivitySummary {
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
  return summarizeTransactions(mockTransactions, weight);
}

export async function getWhaleActivity(minAmountUsd: number = 500000, weight: number = 1): Promise<WhaleActivitySummary> {
  if (!WHALE_ALERT_API_KEY) return generateMockWhaleData(minAmountUsd, weight);

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
        
        // WEIGHT-AWARE: Filter transactions based on weight
        // Higher weight = include smaller transactions, Lower weight = only major ones
        const weightMultiplier = weight / 50;
        const filteredTransactions = cleanTransactions.filter(t => {
          // Adjust minAmount based on weight: Low weight requires larger amounts
          const adjustedMin = minAmountUsd / weightMultiplier;
          return t.amountUsd >= adjustedMin;
        });

        return summarizeTransactions(filteredTransactions, weight);
      }
      throw new Error('Malformed API Response');

    } catch (error: any) {
      attempts++;
      const status = error.response?.status;
      const errorMsg = error.response?.data?.message || error.message || 'Unknown Error';

      if (status >= 500) {
        console.error(`❌ Server Error (${status}). Circuit broken.`);
        break;
      }

      if (status === 429 || status === 420 || status === 403) {
        if (attempts > MAX_RETRIES) {
          console.error('❌ Still rate limited after retry. Giving up.');
          break;
        }
        console.warn(`⚠️ Rate limited (${status}). Backing off for 30s...`);
        await sleep(30000);
        continue;
      }

      console.error(`❌ Attempt ${attempts} failed: ${errorMsg}`);
      if (attempts > MAX_RETRIES) break;
      await sleep(2000);
    }
  }

  return generateMockWhaleData(minAmountUsd, weight);
}
export const whaleService = { getWhaleActivity };