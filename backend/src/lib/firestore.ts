import { db } from '../config/firebase';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// --- Configuration Interfaces ---

export interface WhaleSource {
  enabled: boolean;
  minAmount: string; // e.g., "1000000"
  weight: number;    // 25-75+ range, influences whale activity sensitivity & filtering
}

export interface SentimentSource {
  enabled: boolean;
  source?: string;   // Keeping for backwards compatibility
  weight: number;    // 25-75+ range, influences sentiment component weighting in analysis
}

export interface NewsSource {
  enabled: boolean;
  filter: string;
  weight: number;    // 25-75+ range, influences news article count & breaking news impact
}

export interface WorkflowConfig {
  model: string; // Dynamic to support 'grok-4', 'gpt-4o', etc.
  strategy: 'conservative' | 'balanced' | 'aggressive';
  equities: string[];
  dataSources: {
    whale: WhaleSource;
    sentiment: SentimentSource;
    news: NewsSource;
  };
}

// --- Entity Interfaces ---

export interface Workflow {
  id?: string;
  name: string;
  description?: string;
  userId?: string;
  status: 'active' | 'paused' | 'deleted';
  nodes?: any[];      // For ReactFlow / UI visualization
  edges?: any[];      // For ReactFlow / UI visualization
  viewport?: { x: number; y: number; zoom: number };
  config: WorkflowConfig;
  isActive?: boolean; // Legacy flag, mapping to status === 'active'
  lastRunAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Trade {
  id?: string;
  workflowId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  orderId: string | null;
  status: 'pending' | 'filled' | 'failed';
  filledPrice: number | null;
  filledQuantity: number | null;
  commission: number | null;
  aiSignal: 'LONG' | 'SHORT' | 'HOLD';
  aiConfidence: number;
  aiReasoning: string;
  leverage: number;
  takeProfit: number;
  stopLoss: number;
  tpOrderId: string | null;
  slOrderId: string | null;
  positionStatus: 'open' | 'closed' | 'liquidated';
  closedAt: Timestamp | null;
  closePrice: number | null;
  pnl: number | null;
  createdAt?: Timestamp;
}

export interface Signal {
  id?: string;
  workflowId: string;
  signal: 'LONG' | 'SHORT' | 'HOLD' | 'PORTFOLIO';
  symbol: string;
  confidence: number;
  reasoning: string;
  marketData: {
    prices?: Array<{ symbol: string; price: number; change24h: number }>;
    sentiment?: {
      score: number;
      trend: 'bullish' | 'bearish' | 'neutral';
      weight: number;
    } | null;
    whale?: {
      netFlow: 'inflow' | 'outflow' | 'neutral';
      sentiment: 'bullish' | 'bearish' | 'neutral';
      weight: number;
    } | null;
    hasBreakingNews?: boolean;
  };
  // NEW: Track which data sources influenced this signal
  dataSourceWeights?: {
    whale?: number;
    sentiment?: number;
    news?: number;
  };
  tradeId: string | null;
  createdAt?: Timestamp;
}

// --- Collections ---

const workflowsCollection = db.collection('workflows');
const tradesCollection = db.collection('trades');
const signalsCollection = db.collection('signals');

// --- Workflow Operations ---

export async function getWorkflows() {
  const snapshot = await workflowsCollection
    .where('status', '!=', 'deleted')
    .orderBy('status')
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workflow));
}

export async function getActiveWorkflows() {
  const snapshot = await workflowsCollection
    .where('status', '==', 'active')
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workflow));
}

export async function getWorkflowById(id: string) {
  const doc = await workflowsCollection.doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Workflow;
}

export async function createWorkflow(data: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>) {
  const docRef = await workflowsCollection.add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastRunAt: null,
  });
  return docRef.id;
}

export async function updateWorkflow(id: string, data: Partial<Workflow>) {
  await workflowsCollection.doc(id).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function updateWorkflowLastRun(id: string) {
  await workflowsCollection.doc(id).update({
    lastRunAt: FieldValue.serverTimestamp(),
  });
}

export async function deleteWorkflow(id: string) {
  await workflowsCollection.doc(id).update({
    status: 'deleted',
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// --- Trade Operations ---

export async function getTrades(workflowId?: string) {
  let query: FirebaseFirestore.Query = tradesCollection.orderBy('createdAt', 'desc');

  if (workflowId) {
    query = tradesCollection
      .where('workflowId', '==', workflowId)
      .orderBy('createdAt', 'desc');
  }

  const snapshot = await query.limit(100).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
}

export async function createTrade(data: Omit<Trade, 'id' | 'createdAt'>) {
  const docRef = await tradesCollection.add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

export async function updateTrade(id: string, data: Partial<Trade>) {
  await tradesCollection.doc(id).update(data);
}

export async function getOpenTrades(): Promise<Trade[]> {
  const snapshot = await tradesCollection
    .where('positionStatus', '==', 'open')
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
}

// --- Signal Operations ---

export async function getSignals(workflowId?: string) {
  let query: FirebaseFirestore.Query = signalsCollection.orderBy('createdAt', 'desc');

  if (workflowId) {
    query = signalsCollection
      .where('workflowId', '==', workflowId)
      .orderBy('createdAt', 'desc');
  }

  const snapshot = await query.limit(100).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Signal));
}

export async function createSignal(data: Omit<Signal, 'id' | 'createdAt'>) {
  const docRef = await signalsCollection.add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  });
  return docRef.id;
}

// --- Weight History / Audit Trail ---
// Optional: Track weight configuration changes over time for analysis

export async function logWeightConfiguration(workflowId: string, config: WorkflowConfig) {
  const weightHistoryCollection = db.collection('weight_history');
  
  await weightHistoryCollection.add({
    workflowId,
    weights: {
      whale: config.dataSources.whale.weight,
      sentiment: config.dataSources.sentiment.weight,
      news: config.dataSources.news.weight,
    },
    strategy: config.strategy,
    timestamp: FieldValue.serverTimestamp(),
  });
}

// Optional: Get weight configuration history for a workflow
export async function getWeightHistory(workflowId: string, limit: number = 50) {
  const snapshot = await db
    .collection('weight_history')
    .where('workflowId', '==', workflowId)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}