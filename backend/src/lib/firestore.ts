import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

// Types
export interface Workflow {
  id?: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'deleted';
  nodes: any[];
  edges: any[];
  viewport: { x: number; y: number; zoom: number };
  config: WorkflowConfig;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
  lastRunAt?: FirebaseFirestore.Timestamp | null;
}

export interface WorkflowConfig {
  model: 'gpt-4-turbo' | 'gpt-4o' | 'claude-3-opus' | 'claude-3-sonnet';
  strategy: 'conservative' | 'balanced' | 'aggressive';
  dataSources: {
    whale: { enabled: boolean; minAmount: string };
    sentiment: { enabled: boolean; source: string };
    news: { enabled: boolean; filter: string };
  };
  equities: string[];
}

export interface Trade {
  id?: string;
  workflowId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET';
  quantity: number;
  orderId: string | null;
  status: 'pending' | 'filled' | 'failed';
  filledPrice: number | null;
  filledQuantity: number | null;
  commission: number | null;
  aiSignal: 'BUY' | 'SELL' | 'HOLD';
  aiConfidence: number;
  aiReasoning: string;
  createdAt?: FirebaseFirestore.Timestamp;
  // Yeni alanlar - Kaldıraç ve Pozisyon Süresi
  leverage: number;                    // Kullanılan kaldıraç
  holdDuration: number;                // Dakika cinsinden tutma süresi
  closeAt: FirebaseFirestore.Timestamp | null;  // Planlanan kapanış zamanı
  positionStatus: 'open' | 'closed' | 'liquidated';  // Pozisyon durumu
  closedAt: FirebaseFirestore.Timestamp | null;  // Gerçek kapanış zamanı
  closePrice: number | null;           // Kapanış fiyatı
  pnl: number | null;                  // Kar/Zarar (BTC cinsinden)
}

export interface Signal {
  id?: string;
  workflowId: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  symbol: string;
  confidence: number;
  reasoning: string;
  marketData: any;
  tradeId: string | null;
  createdAt?: FirebaseFirestore.Timestamp;
}

// Collections
const workflowsCollection = db.collection('workflows');
const tradesCollection = db.collection('trades');
const signalsCollection = db.collection('signals');

// Workflow operations
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

// Trade operations
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

// Get trades with expired hold duration that need to be closed
export async function getExpiredOpenTrades(): Promise<Trade[]> {
  const now = new Date();

  const snapshot = await tradesCollection
    .where('positionStatus', '==', 'open')
    .where('closeAt', '<=', now)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
}

// Get all open trades (for position manager)
export async function getOpenTrades(): Promise<Trade[]> {
  const snapshot = await tradesCollection
    .where('positionStatus', '==', 'open')
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trade));
}

// Signal operations
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
