import { Router } from 'express';
import {
  getWorkflows,
  getWorkflowById,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  WorkflowConfig,
  logWeightConfiguration,
} from '../lib/firestore';
import { executor } from '../engine/executor';

const router = Router();

// Helper: Validate weight is in reasonable range
function validateWeight(weight: any): number {
  const w = Number(weight);
  if (isNaN(w) || w < 25 || w > 100) {
    console.warn(`Invalid weight ${weight}, defaulting to 50`);
    return 50;
  }
  return Math.round(w);
}

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

  // Parse data sources WITH WEIGHTS
  const dataSources = {
    whale: { 
      enabled: false, 
      minAmount: '1000000',
      weight: 50, // Default weight
    },
    sentiment: { 
      enabled: false, 
      source: 'all',
      weight: 50, // Default weight
    },
    news: { 
      enabled: false, 
      filter: 'all',
      weight: 50, // Default weight
    },
  };

  for (const node of dataNodes) {
    if (node.type === 'data.whale') {
      dataSources.whale = {
        enabled: true,
        minAmount: node.data?.minAmount || '1000000',
        weight: validateWeight(node.data?.weight || 50),
      };
    } else if (node.type === 'data.sentiment') {
      dataSources.sentiment = {
        enabled: true,
        source: node.data?.source || 'all',
        weight: validateWeight(node.data?.weight || 50),
      };
    } else if (node.type === 'data.news') {
      dataSources.news = {
        enabled: true,
        filter: node.data?.filter || 'all',
        weight: validateWeight(node.data?.weight || 50),
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

// Helper: Validate workflow config
function validateConfig(config: WorkflowConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.model) errors.push('Model is required');
  if (!['conservative', 'balanced', 'aggressive'].includes(config.strategy)) {
    errors.push('Invalid strategy');
  }
  if (!Array.isArray(config.equities) || config.equities.length === 0) {
    errors.push('At least one equity is required');
  }

  // Validate weights
  for (const [key, source] of Object.entries(config.dataSources)) {
    if (source.enabled) {
      if (source.weight < 25 || source.weight > 100) {
        errors.push(`${key} weight must be between 25 and 100`);
      }
    }
  }

  // Validate at least one data source is enabled
  const anyEnabled = Object.values(config.dataSources).some(s => s.enabled);
  if (!anyEnabled) {
    errors.push('At least one data source must be enabled');
  }

  return {
    valid: errors.length === 0,
    errors,
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
      return res.status(400).json({ error: 'Missing required fields: name, nodes, edges' });
    }

    // Parse config from nodes/edges
    const config = parseWorkflowConfig(nodes, edges);

    // Validate config
    const validation = validateConfig(config);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid workflow configuration',
        details: validation.errors,
      });
    }

    const workflowId = await createWorkflow({
      name,
      description: description || '',
      status: 'paused',
      nodes,
      edges,
      viewport: viewport || { x: 0, y: 0, zoom: 1 },
      config,
    });

    console.log(`✅ Workflow created: ${name}`);
    console.log(`   Weights → Whale: ${config.dataSources.whale.weight} | Sentiment: ${config.dataSources.sentiment.weight} | News: ${config.dataSources.news.weight}`);

    res.status(201).json({ 
      id: workflowId,
      config: {
        strategy: config.strategy,
        model: config.model,
        equities: config.equities,
        weights: {
          whale: config.dataSources.whale.weight,
          sentiment: config.dataSources.sentiment.weight,
          news: config.dataSources.news.weight,
        },
      },
    });
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
      const config = parseWorkflowConfig(nodes, edges);
      
      // Validate config
      const validation = validateConfig(config);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: 'Invalid workflow configuration',
          details: validation.errors,
        });
      }

      updateData.config = config;

      // Log weight configuration change
      const workflow = await getWorkflowById(req.params.id);
      if (workflow && JSON.stringify(workflow.config.dataSources) !== JSON.stringify(config.dataSources)) {
        console.log(`📊 Workflow weights updated: ${workflow.name}`);
        console.log(`   New Weights → Whale: ${config.dataSources.whale.weight} | Sentiment: ${config.dataSources.sentiment.weight} | News: ${config.dataSources.news.weight}`);
        
        // Optional: Log to weight history
        try {
          await logWeightConfiguration(req.params.id, config);
        } catch (e) {
          console.warn('Could not log weight configuration:', e);
        }
      }
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
    const workflow = await getWorkflowById(req.params.id);
    await deleteWorkflow(req.params.id);
    console.log(`🗑️  Workflow deleted: ${workflow?.name}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workflows/:id/start - Activate workflow
router.post('/:id/start', async (req, res) => {
  try {
    const workflow = await getWorkflowById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    await updateWorkflow(req.params.id, { status: 'active' });
    
    console.log(`▶️  Workflow activated: ${workflow.name}`);
    console.log(`   Strategy: ${workflow.config.strategy.toUpperCase()}`);
    console.log(`   Weights → Whale: ${workflow.config.dataSources.whale.weight} | Sentiment: ${workflow.config.dataSources.sentiment.weight} | News: ${workflow.config.dataSources.news.weight}`);

    res.json({ 
      success: true, 
      message: 'Workflow activated',
      config: {
        strategy: workflow.config.strategy,
        weights: {
          whale: workflow.config.dataSources.whale.weight,
          sentiment: workflow.config.dataSources.sentiment.weight,
          news: workflow.config.dataSources.news.weight,
        },
      },
    });
  } catch (error: any) {
    console.error('Error starting workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workflows/:id/stop - Pause workflow
router.post('/:id/stop', async (req, res) => {
  try {
    const workflow = await getWorkflowById(req.params.id);
    await updateWorkflow(req.params.id, { status: 'paused' });
    
    console.log(`⏸️  Workflow paused: ${workflow?.name}`);
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

    // Validate config before executing
    const validation = validateConfig(workflow.config);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid workflow configuration',
        details: validation.errors,
      });
    }

    console.log(`🔧 Manual run triggered: ${workflow.name}`);
    console.log(`   Weights → Whale: ${workflow.config.dataSources.whale.weight} | Sentiment: ${workflow.config.dataSources.sentiment.weight} | News: ${workflow.config.dataSources.news.weight}`);

    // Execute workflow immediately (async, don't wait)
    executor.executeWorkflow(workflow).catch((error) => {
      console.error(`Error executing workflow ${workflow.name}:`, error);
    });

    res.json({ 
      success: true, 
      message: 'Workflow execution started',
      config: {
        strategy: workflow.config.strategy,
        weights: {
          whale: workflow.config.dataSources.whale.weight,
          sentiment: workflow.config.dataSources.sentiment.weight,
          news: workflow.config.dataSources.news.weight,
        },
      },
    });
  } catch (error: any) {
    console.error('Error running workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/workflows/:id/validate - Validate workflow configuration
router.get('/:id/validate', async (req, res) => {
  try {
    const workflow = await getWorkflowById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const validation = validateConfig(workflow.config);

    res.json({
      valid: validation.valid,
      errors: validation.errors,
      config: {
        strategy: workflow.config.strategy,
        model: workflow.config.model,
        equities: workflow.config.equities,
        weights: {
          whale: workflow.config.dataSources.whale.weight,
          sentiment: workflow.config.dataSources.sentiment.weight,
          news: workflow.config.dataSources.news.weight,
        },
      },
    });
  } catch (error: any) {
    console.error('Error validating workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;