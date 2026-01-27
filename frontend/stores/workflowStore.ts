import { create } from 'zustand';
import { Node, Edge, Viewport, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react';
import { v4 as uuid } from 'uuid';
import { getNodeDefinition } from '@/lib/nodes/definitions';

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

interface WorkflowState {
  // Workflow metadata
  id: string | null;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'deleted';
  isTestnet: boolean;

  // React Flow state
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;

  // Selection
  selectedNodeId: string | null;

  // History for undo/redo
  history: HistoryState[];
  historyIndex: number;

  // Dirty state
  isDirty: boolean;
  lastSaved: Date | null;

  // Actions
  setWorkflow: (workflow: {
    id: string;
    name: string;
    description?: string;
    status: 'active' | 'paused' | 'deleted';
    isTestnet: boolean;
    nodes: Node[];
    edges: Edge[];
    viewport: Viewport;
  }) => void;
  setStatus: (status: 'active' | 'paused') => void;
  resetWorkflow: () => void;

  // Node operations
  addNode: (type: string, position: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Record<string, any>) => void;
  deleteNode: (nodeId: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;

  // Edge operations
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  deleteEdge: (edgeId: string) => void;

  // Viewport
  setViewport: (viewport: Viewport) => void;

  // Selection
  setSelectedNode: (nodeId: string | null) => void;

  // Metadata
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setTestnet: (isTestnet: boolean) => void;

  // History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Save state
  markSaved: () => void;
  markDirty: () => void;
}

const initialState = {
  id: null,
  name: 'Untitled Workflow',
  description: '',
  status: 'paused' as const,
  isTestnet: true,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeId: null,
  history: [],
  historyIndex: -1,
  isDirty: false,
  lastSaved: null,
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  ...initialState,

  setWorkflow: (workflow) => {
    set({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description || '',
      status: workflow.status,
      isTestnet: workflow.isTestnet,
      nodes: workflow.nodes,
      edges: workflow.edges,
      viewport: workflow.viewport,
      history: [{ nodes: workflow.nodes, edges: workflow.edges }],
      historyIndex: 0,
      isDirty: false,
      lastSaved: new Date(),
    });
  },

  resetWorkflow: () => {
    set({
      ...initialState,
      history: [{ nodes: [], edges: [] }],
      historyIndex: 0,
    });
  },

  addNode: (type, position) => {
    const definition = getNodeDefinition(type);
    if (!definition) return;

    const id = uuid();
    const newNode: Node = {
      id,
      type,
      position,
      data: {
        label: definition.label,
        ...definition.configSchema.reduce((acc, field) => {
          if (field.default !== undefined) {
            acc[field.name] = field.default;
          }
          return acc;
        }, {} as Record<string, any>),
      },
    };

    set((state) => ({
      nodes: [...state.nodes, newNode],
      isDirty: true,
    }));
    get().pushHistory();
  },

  updateNodeData: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
      isDirty: true,
    }));
  },

  deleteNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      isDirty: true,
    }));
    get().pushHistory();
  },

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      isDirty: true,
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
    }));
  },

  onConnect: (connection) => {
    // Prevent self-loop: don't allow connecting a node to itself
    if (connection.source === connection.target) {
      return;
    }

    // Get source node to check its type
    const { nodes } = get();
    const sourceNode = nodes.find(n => n.id === connection.source);
    if (!sourceNode) return;

    const sourceType = sourceNode.type || '';
    const targetHandle = connection.targetHandle || '';

    // Validate connections:
    // - Equity nodes (equity.*) can only connect to 'equities_in'
    // - Data nodes (data.*) can only connect to 'data_in'
    if (sourceType.startsWith('equity.') && targetHandle !== 'equities_in') {
      return;
    }
    if (sourceType.startsWith('data.') && targetHandle !== 'data_in') {
      return;
    }

    // Set edge color based on source type
    const edgeColor = sourceType.startsWith('equity.') ? '#f97316' : '#22d3ee';

    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          id: uuid(),
          type: 'bezier',
          style: { stroke: edgeColor, strokeWidth: 3 },
        },
        state.edges
      ),
      isDirty: true,
    }));
    get().pushHistory();
  },

  deleteEdge: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== edgeId),
      isDirty: true,
    }));
    get().pushHistory();
  },

  setViewport: (viewport) => {
    set({ viewport });
  },

  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  setName: (name) => {
    set({ name, isDirty: true });
  },

  setDescription: (description) => {
    set({ description, isDirty: true });
  },

  setTestnet: (isTestnet) => {
    set({ isTestnet, isDirty: true });
  },

  setStatus: (status) => {
    set({ status });
  },

  undo: () => {
    const { historyIndex, history } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      set({
        nodes: state.nodes,
        edges: state.edges,
        historyIndex: newIndex,
        isDirty: true,
      });
    }
  },

  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      set({
        nodes: state.nodes,
        edges: state.edges,
        historyIndex: newIndex,
        isDirty: true,
      });
    }
  },

  pushHistory: () => {
    const { nodes, edges, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: [...nodes], edges: [...edges] });

    // Keep only last 50 states
    if (newHistory.length > 50) {
      newHistory.shift();
    }

    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  markSaved: () => {
    set({ isDirty: false, lastSaved: new Date() });
  },

  markDirty: () => {
    set({ isDirty: true });
  },
}));
