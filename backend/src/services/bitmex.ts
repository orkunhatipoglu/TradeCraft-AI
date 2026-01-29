import axios from 'axios';
import crypto from 'crypto';

const TESTNET_BASE_URL = 'https://testnet.bitmex.com';
const MAINNET_BASE_URL = 'https://www.bitmex.com';

const API_KEY = process.env.BITMEX_API_KEY || '';
const API_SECRET = process.env.BITMEX_API_SECRET || '';
const IS_TESTNET = process.env.BITMEX_TESTNET === 'true';

const BASE_URL = IS_TESTNET ? TESTNET_BASE_URL : MAINNET_BASE_URL;

// Map common symbols to BitMEX format
const SYMBOL_MAP: Record<string, string> = {
  BTCUSDT: 'XBTUSD',
  ETHUSDT: 'ETHUSD',
  SOLUSDT: 'SOLUSD',
  XRPUSDT: 'XRPUSD',
  BNBUSDT: 'BNBUSD',
};

// Reverse map for output
const REVERSE_SYMBOL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOL_MAP).map(([k, v]) => [v, k])
);

function toBitmexSymbol(symbol: string): string {
  return SYMBOL_MAP[symbol] || symbol;
}

function fromBitmexSymbol(symbol: string): string {
  return REVERSE_SYMBOL_MAP[symbol] || symbol;
}

function generateSignature(
  method: string,
  path: string,
  expires: number,
  data: string = ''
): string {
  const message = method + path + expires + data;
  return crypto
    .createHmac('sha256', API_SECRET)
    .update(message)
    .digest('hex');
}

function getAuthHeaders(method: string, path: string, data: string = ''): Record<string, string> {
  const expires = Math.floor(Date.now() / 1000) + 60; // 60 seconds from now
  const signature = generateSignature(method, path, expires, data);

  return {
    'api-expires': expires.toString(),
    'api-key': API_KEY,
    'api-signature': signature,
    'Content-Type': 'application/json',
  };
}

export interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
}

export interface TradeResult {
  success: boolean;
  orderId?: string;
  filledPrice?: number;
  filledQuantity?: number;
  commission?: number;
  error?: string;
}

// Get current price for a symbol
export async function getPrice(symbol: string): Promise<PriceData> {
  const bitmexSymbol = toBitmexSymbol(symbol);

  try {
    const response = await axios.get(`${BASE_URL}/api/v1/instrument`, {
      params: {
        symbol: bitmexSymbol,
      },
    });

    const data = response.data[0];

    if (!data) {
      throw new Error(`No data for symbol ${bitmexSymbol}`);
    }

    return {
      symbol,
      price: data.lastPrice || 0,
      change24h: data.lastChangePcnt ? data.lastChangePcnt * 100 : 0,
      volume24h: data.volume24h || 0,
    };
  } catch (error: any) {
    console.error(`Error fetching price for ${symbol}:`, error.message);
    return {
      symbol,
      price: 0,
      change24h: 0,
      volume24h: 0,
    };
  }
}

// Get prices for multiple symbols
export async function getPrices(symbols: string[]): Promise<Record<string, PriceData>> {
  const prices: Record<string, PriceData> = {};

  await Promise.all(
    symbols.map(async (symbol) => {
      prices[symbol] = await getPrice(symbol);
    })
  );

  return prices;
}

// Execute a market trade
export async function executeTrade(params: {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
}): Promise<TradeResult> {
  const bitmexSymbol = toBitmexSymbol(params.symbol);

  try {
    const path = '/api/v1/order';
    // BitMEX orderQty must be an integer (contracts/USD value)
    const orderQty = Math.round(params.quantity);

    if (orderQty < 1) {
      return {
        success: false,
        error: `Order quantity too small: ${params.quantity} (minimum 1)`,
      };
    }

    const orderData = {
      symbol: bitmexSymbol,
      side: params.side === 'LONG' ? 'Buy' : 'Sell',
      orderQty: orderQty,
      ordType: 'Market',
    };

    const dataString = JSON.stringify(orderData);
    const headers = getAuthHeaders('POST', path, dataString);

    const response = await axios.post(`${BASE_URL}${path}`, orderData, {
      headers,
    });

    const data = response.data;

    return {
      success: true,
      orderId: data.orderID,
      filledPrice: data.avgPx || 0,
      filledQuantity: data.cumQty || 0,
      commission: data.execComm ? data.execComm / 100000000 : 0, // Convert satoshis to BTC
    };
  } catch (error: any) {
    console.error('Trade execution error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
}

// Get account balance (margin)
export async function getBalance(): Promise<Record<string, number>> {
  try {
    const path = '/api/v1/user/margin';
    const headers = getAuthHeaders('GET', path);

    const response = await axios.get(`${BASE_URL}${path}`, {
      headers,
    });

    const data = response.data;

    // BitMEX returns balance in satoshis, convert to BTC
    return {
      XBT: data.walletBalance ? data.walletBalance / 100000000 : 0,
      availableMargin: data.availableMargin ? data.availableMargin / 100000000 : 0,
      marginBalance: data.marginBalance ? data.marginBalance / 100000000 : 0,
    };
  } catch (error: any) {
    console.error('Balance fetch error:', error.message);
    return {};
  }
}

// Get account balance in USDT equivalent
export async function getBalanceInUSDT(): Promise<{
  balanceXBT: number;
  balanceUSDT: number;
  availableMarginXBT: number;
  availableMarginUSDT: number;
  btcPrice: number;
}> {
  try {
    const balance = await getBalance();
    const btcPrice = await getPrice('BTCUSDT');

    const balanceXBT = balance.XBT || 0;
    const availableMarginXBT = balance.availableMargin || 0;

    return {
      balanceXBT,
      balanceUSDT: balanceXBT * btcPrice.price,
      availableMarginXBT,
      availableMarginUSDT: availableMarginXBT * btcPrice.price,
      btcPrice: btcPrice.price,
    };
  } catch (error: any) {
    console.error('Balance in USDT fetch error:', error.message);
    return {
      balanceXBT: 0,
      balanceUSDT: 0,
      availableMarginXBT: 0,
      availableMarginUSDT: 0,
      btcPrice: 0,
    };
  }
}

// Get open positions
export async function getPositions(): Promise<any[]> {
  try {
    // Include query string in path for signature calculation
    const filter = encodeURIComponent(JSON.stringify({ isOpen: true }));
    const path = `/api/v1/position?filter=${filter}`;
    const headers = getAuthHeaders('GET', path);

    const response = await axios.get(`${BASE_URL}${path}`, { headers });

    return response.data.map((pos: any) => ({
      symbol: fromBitmexSymbol(pos.symbol),
      size: pos.currentQty,
      entryPrice: pos.avgEntryPrice,
      markPrice: pos.markPrice,
      liquidationPrice: pos.liquidationPrice,
      unrealisedPnl: pos.unrealisedPnl ? pos.unrealisedPnl / 100000000 : 0,
      leverage: pos.leverage,
    }));
  } catch (error: any) {
    console.error('Positions fetch error:', error.message);
    return [];
  }
}

// Set leverage for a symbol
export async function setLeverage(symbol: string, leverage: number): Promise<boolean> {
  const bitmexSymbol = toBitmexSymbol(symbol);

  try {
    const path = '/api/v1/position/leverage';
    const leverageData = {
      symbol: bitmexSymbol,
      leverage: Math.min(100, Math.max(0, leverage)), // BitMEX max is typically 100x, 0 = cross margin
    };

    const dataString = JSON.stringify(leverageData);
    const headers = getAuthHeaders('POST', path, dataString);

    await axios.post(`${BASE_URL}${path}`, leverageData, {
      headers,
    });

    console.log(`✅ Leverage set to ${leverage}x for ${symbol}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to set leverage for ${symbol}:`, error.response?.data || error.message);
    return false;
  }
}

// Set Take Profit and Stop Loss orders for an open position
export async function setTakeProfitStopLoss(params: {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  takeProfitPercent: number;
  stopLossPercent: number;
}): Promise<{ tpOrderId?: string; slOrderId?: string; error?: string }> {
  const bitmexSymbol = toBitmexSymbol(params.symbol);
  const { side, entryPrice, quantity, takeProfitPercent, stopLossPercent } = params;

  // Calculate TP/SL prices
  let tpPrice: number;
  let slPrice: number;
  let closeSide: string;

  if (side === 'LONG') {
    // LONG: TP above entry, SL below entry
    tpPrice = Math.round(entryPrice * (1 + takeProfitPercent / 100) * 2) / 2; // Round to 0.5
    slPrice = Math.round(entryPrice * (1 - stopLossPercent / 100) * 2) / 2;
    closeSide = 'Sell'; // Close long by selling
  } else {
    // SHORT: TP below entry, SL above entry
    tpPrice = Math.round(entryPrice * (1 - takeProfitPercent / 100) * 2) / 2;
    slPrice = Math.round(entryPrice * (1 + stopLossPercent / 100) * 2) / 2;
    closeSide = 'Buy'; // Close short by buying
  }

  console.log(`📊 Setting TP/SL for ${side} position:`);
  console.log(`   Entry: $${entryPrice} | TP: $${tpPrice} (+${takeProfitPercent}%) | SL: $${slPrice} (-${stopLossPercent}%)`);

  let tpOrderId: string | undefined;
  let slOrderId: string | undefined;
  const errors: string[] = [];

  // Create Take Profit order (Limit order to close at target price)
  try {
    const path = '/api/v1/order';
    const tpOrderData = {
      symbol: bitmexSymbol,
      side: closeSide,
      orderQty: quantity,
      ordType: 'Limit',
      price: tpPrice,
      execInst: 'ReduceOnly',
      text: 'TakeProfit',
    };

    const dataString = JSON.stringify(tpOrderData);
    const headers = getAuthHeaders('POST', path, dataString);

    const response = await axios.post(`${BASE_URL}${path}`, tpOrderData, { headers });
    tpOrderId = response.data.orderID;
    console.log(`  ✅ TP Order: ${tpOrderId} @ $${tpPrice}`);
  } catch (error: any) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.error(`  ❌ TP Order failed: ${errMsg}`);
    errors.push(`TP: ${errMsg}`);
  }

  // Create Stop Loss order (Stop Market order)
  try {
    const path = '/api/v1/order';
    const slOrderData = {
      symbol: bitmexSymbol,
      side: closeSide,
      orderQty: quantity,
      ordType: 'Stop',
      stopPx: slPrice,
      execInst: 'ReduceOnly,LastPrice',
      text: 'StopLoss',
    };

    const dataString = JSON.stringify(slOrderData);
    const headers = getAuthHeaders('POST', path, dataString);

    const response = await axios.post(`${BASE_URL}${path}`, slOrderData, { headers });
    slOrderId = response.data.orderID;
    console.log(`  ✅ SL Order: ${slOrderId} @ $${slPrice}`);
  } catch (error: any) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.error(`  ❌ SL Order failed: ${errMsg}`);
    errors.push(`SL: ${errMsg}`);
  }

  return {
    tpOrderId,
    slOrderId,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}

// Close an open position (market order)
export async function closePosition(symbol: string): Promise<TradeResult> {
  const bitmexSymbol = toBitmexSymbol(symbol);

  try {
    const path = '/api/v1/order';
    const orderData = {
      symbol: bitmexSymbol,
      execInst: 'Close',
      ordType: 'Market',
    };

    const dataString = JSON.stringify(orderData);
    const headers = getAuthHeaders('POST', path, dataString);

    const response = await axios.post(`${BASE_URL}${path}`, orderData, {
      headers,
    });

    const data = response.data;

    return {
      success: true,
      orderId: data.orderID,
      filledPrice: data.avgPx || 0,
      filledQuantity: Math.abs(data.cumQty || 0),
      commission: data.execComm ? data.execComm / 100000000 : 0,
    };
  } catch (error: any) {
    console.error('Position close error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
}

// Check API connection
export async function checkConnection(): Promise<boolean> {
  try {
    await axios.get(`${BASE_URL}/api/v1/instrument?symbol=XBTUSD&count=1`);
    return true;
  } catch {
    return false;
  }
}

export const bitmexService = {
  getPrice,
  getPrices,
  executeTrade,
  getBalance,
  getBalanceInUSDT,
  getPositions,
  setLeverage,
  setTakeProfitStopLoss,
  closePosition,
  checkConnection,
  isTestnet: IS_TESTNET,
};