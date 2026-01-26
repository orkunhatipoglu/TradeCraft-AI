import { Router } from 'express';
import {
  getWorkflows,
  getWorkflowById,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  WorkflowConfig,
} from '../lib/firestore';
import { executor } from '../engine/executor';

const router = Router();

// Helper: Parse workflow config from nodes/edges
function parseWorkflowConfig(nodes: any[], edges: any[]): WorkflowConfig {
  // Find AI node
  const aiNode = nodes.find((n) => n.type === 'ai.trader');

  // Get model and strategy from AI node
  const model = aiNode?.data?.model || 'gpt-4-turbo';
  const strategy = aiNode?.data?.strategy || 'balanced';

  // Find connected data nodes
  const dataNodeIds = edges
    .filter((e) => e.targetHandle === 'data_in')
    .map((e) => e.source);

  const dataNodes = nodes.filter((n) => dataNodeIds.includes(n.id));

  // Find connected equity nodes
  const equityNodeIds = edges
    .filter((e) => e.targetHandle === 'equities_in')
    .map((e) => e.source);

  const equityNodes = nodes.filter((n) => equityNodeIds.includes(n.id));

  // Parse data sources
  const dataSources = {
    whale: { enabled: false, minAmount: '1000000' },
    sentiment: { enabled: false, source: 'all' },
    news: { enabled: false, filter: 'all' },
  };

  for (const node of dataNodes) {
    if (node.type === 'data.whale') {
      dataSources.whale = {
        enabled: true,
        minAmount: node.data?.minAmount || '1000000',
      };
    } else if (node.type === 'data.sentiment') {
      dataSources.sentiment = {
        enabled: true,
        source: node.data?.source || 'all',
      };
    } else if (node.type === 'data.news') {
      dataSources.news = {
        enabled: true,
        filter: node.data?.filter || 'all',
      };
    }
  }

  // Parse equities
  const equityMap: Record<string, string> = {
    'equity.btc': 'BTCUSDT',
    'equity.eth': 'ETHUSDT',
    'equity.sol': 'SOLUSDT',
    'equity.bnb': 'BNBUSDT',
    'equity.xrp': 'XRPUSDT',
  };

  const equities = equityNodes
    .map((n) => equityMap[n.type])
    .filter(Boolean);

  return {
    model,
    strategy,
    dataSources,
    equities: equities.length > 0 ? equities : ['BTCUSDT'],
  };
}

// GET /api/workflows - List all workflows
router.get('/', async (req, res) => {
  try {
    const workflows = await getWorkflows();
    res.json(workflows);
  } catch (error: any) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/workflows/:id - Get single workflow
router.get('/:id', async (req, res) => {
  try {
    const workflow = await getWorkflowById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json(workflow);
  } catch (error: any) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workflows - Create workflow
router.post('/', async (req, res) => {
  try {
    const { name, description, nodes, edges, viewport } = req.body;

    if (!name || !nodes || !edges) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Parse config from nodes/edges
    const config = parseWorkflowConfig(nodes, edges);

    const workflowId = await createWorkflow({
      name,
      description: description || '',
      status: 'paused',
      nodes,
      edges,
      viewport: viewport || { x: 0, y: 0, zoom: 1 },
      config,
    });

    res.status(201).json({ id: workflowId });
  } catch (error: any) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/workflows/:id - Update workflow
router.put('/:id', async (req, res) => {
  try {
    const { name, description, nodes, edges, viewport } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (nodes) updateData.nodes = nodes;
    if (edges) updateData.edges = edges;
    if (viewport) updateData.viewport = viewport;

    // Re-parse config if nodes/edges updated
    if (nodes && edges) {
      updateData.config = parseWorkflowConfig(nodes, edges);
    }

    await updateWorkflow(req.params.id, updateData);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/workflows/:id - Soft delete workflow
router.delete('/:id', async (req, res) => {
  try {
    await deleteWorkflow(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workflows/:id/start - Activate workflow
router.post('/:id/start', async (req, res) => {
  try {
    await updateWorkflow(req.params.id, { status: 'active' });
    res.json({ success: true, message: 'Workflow activated' });
  } catch (error: any) {
    console.error('Error starting workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workflows/:id/stop - Pause workflow
router.post('/:id/stop', async (req, res) => {
  try {
    await updateWorkflow(req.params.id, { status: 'paused' });
    res.json({ success: true, message: 'Workflow paused' });
  } catch (error: any) {
    console.error('Error stopping workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workflows/:id/run - Manual run (for testing)
router.post('/:id/run', async (req, res) => {
  try {
    const workflow = await getWorkflowById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    // Execute workflow immediately
    await executor.executeWorkflow(workflow);

    res.json({ success: true, message: 'Workflow executed' });
  } catch (error: any) {
    console.error('Error running workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
