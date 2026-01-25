"use client";
import React, { useCallback, useState, useMemo, useRef } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  Connection, 
  Node, 
  Panel,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// FinancialNode Component
const FinancialNode = ({ data, id }: any) => {
  const [_, setTick] = useState(0);
  const [localVarName, setLocalVarName] = useState(data.variableName || '');

  const addRiskField = () => {
    if (!data.riskInputs) data.riskInputs = [];
    data.riskInputs.push({ id: Date.now(), value: '', weight: '' });
    setTick(t => t + 1);
  };

  const updateRiskField = (index: number, field: string, val: string) => {
    data.riskInputs[index][field] = val;
  };

  const handleVariableNameBlur = () => {
    if (localVarName.trim() && localVarName !== data.variableName) {
      data.variableName = localVarName.trim();
      if (data.onRegister) data.onRegister(localVarName.trim());
    }
  };

  const handleVariableNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.currentTarget as HTMLElement).blur();
    }
  };

  const handleStyle = "w-3 h-3 !bg-slate-400 border-2 border-white";

  return (
    <div className={`rounded-lg bg-white border-2 shadow-md min-w-[240px] overflow-hidden ${
      data.category === 'START' ? 'border-green-500' : 
      data.category === 'STOP' ? 'border-red-500' : 
      data.category === 'VARIABLE' ? 'border-indigo-500' :
      data.category === 'MATH' ? 'border-cyan-500' :
      data.category === 'CONDITION' ? 'border-yellow-500' :
      'border-slate-300'
    }`}>
      
      {/* Header */}
      <div className={`p-2 text-white font-bold text-[10px] uppercase flex justify-between ${data.color || 'bg-slate-600'}`}>
        <span>{data.label || data.category.replace('_', ' ')}</span>
      </div>

      <div className="p-3 bg-white relative">
        
        {/* INPUT HANDLE (Left) - Not for Start Node */}
        {data.category !== 'START' && (
          <Handle type="target" position={Position.Left} className={handleStyle} />
        )}

        {/* --- UI SWITCHER --- */}
        
        {/* 1. START / STOP */}
        {(data.category === 'START' || data.category === 'STOP') && (
           <div className="text-xs text-slate-500 italic text-center py-2">
             {data.category === 'START' ? "Entry Point" : "Terminate Algo"}
           </div>
        )}

        {/* 2. VARIABLE BLOCK */}
        {data.category === 'VARIABLE' && (
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-slate-400 block">Variable Name</label>
            <input 
              type="text" 
              className="nodrag w-full text-sm p-2 border-2 border-indigo-200 rounded font-mono bg-indigo-50 focus:border-indigo-400 focus:outline-none" 
              placeholder="e.g. my_data"
              value={localVarName}
              onChange={(e) => setLocalVarName(e.target.value)}
              onBlur={handleVariableNameBlur}
              onKeyDown={handleVariableNameKeyDown}
            />
            <div className="text-[8px] text-slate-400 italic">
              Stores output from previous block (Press Enter)
            </div>
          </div>
        )}

        {/* 3. MATH BLOCK - NEW! */}
        {data.category === 'MATH' && (
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-slate-400 block">Math Expression</label>
            <input 
              type="text" 
              className="nodrag w-full text-sm p-2 border-2 border-cyan-200 rounded font-mono bg-cyan-50 focus:border-cyan-400 focus:outline-none" 
              placeholder="e.g. log2({var1}*{var2})"
              onChange={(e) => data.expression = e.target.value}
            />
            <div className="text-[8px] text-slate-400 italic">
              Use {'{'}varname{'}'} for variables<br/>
              Operators: +, -, *, /, pow(), sqrt(), log(), log2(), log10()
            </div>
            <div className="mt-1 p-2 bg-cyan-50 rounded text-[9px] font-mono text-cyan-700">
              → Returns: Number
            </div>
          </div>
        )}

        {/* 4. CONDITION BLOCK - NEW! */}
        {data.category === 'CONDITION' && (
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-slate-400 block">Condition</label>
            <input 
              type="text" 
              className="nodrag w-full text-sm p-2 border-2 border-yellow-200 rounded font-mono bg-yellow-50 focus:border-yellow-400 focus:outline-none" 
              placeholder="e.g. {var1} >= {var2} && {var3} > 0"
              onChange={(e) => data.condition = e.target.value}
            />
            <div className="text-[8px] text-slate-400 italic">
              Use {'{'}varname{'}'} for variables<br/>
              Comparison: ==, !=, &gt;, &lt;, &gt;=, &lt;=<br/>
              Logical: &&, ||, ^^, !
            </div>
          </div>
        )}

        {/* 5. SET BUDGET */}
        {data.category === 'SET_BUDGET' && (
          <div>
            <label className="text-[9px] font-bold text-slate-400">Initial Capital ($)</label>
            <input type="number" className="nodrag w-full text-sm p-1 border rounded" 
              placeholder="10000" onChange={(e) => data.manualValue = e.target.value} />
          </div>
        )}

        {/* 6. SCRAPERS (BTC/ETH/NEWS) */}
        {(data.category.startsWith('SCRAPE') || data.category === 'NEWS_SCRAPER') && (
           <div className="text-xs text-slate-600">
             Fetching live data for <b>{data.category.includes('BTC') ? 'BTC' : data.category.includes('ETH') ? 'ETH' : 'NEWS'}</b>
             <div className="mt-2 p-2 bg-slate-50 rounded text-[9px] font-mono text-slate-500">
               → Returns: {data.category === 'NEWS_SCRAPER' ? 'String' : 'Number'}
             </div>
           </div>
        )}

        {/* 7. SEND TO LLM */}
        {data.category === 'SEND_TO_LLM' && (
           <div className="flex flex-col gap-2">
             <select 
               className="nodrag w-full text-[10px] p-1 border rounded"
               onChange={(e) => data.variableName = e.target.value}
             >
               <option value="">Select input variable...</option>
               {(data.registeredVars || []).map((v: string) => (
                 <option key={v} value={v}>{v}</option>
               ))}
             </select>
             <div className="mt-1 p-2 bg-pink-50 rounded text-[9px] font-mono text-pink-700">
               → Returns: Sentiment [-1, 1]
             </div>
           </div>
        )}

        {/* 8. RISK ANALYSIS (Dynamic) */}
        {data.category === 'RISK_ANALYSIS' && (
          <div>
             <div className="flex justify-between items-center mb-2">
               <span className="text-[10px] font-bold">Weighted Factors</span>
               <button onClick={addRiskField} className="nodrag bg-indigo-100 text-indigo-600 text-[9px] px-2 py-0.5 rounded hover:bg-indigo-200">+ Add</button>
             </div>
             <div className="flex flex-col gap-1 max-h-[100px] overflow-y-auto">
               {(data.riskInputs || []).map((field: any, idx: number) => (
                 <div key={field.id} className="flex gap-1">
                   <select 
                     className="nodrag w-1/2 text-[9px] p-1 border rounded"
                     onChange={(e) => updateRiskField(idx, 'value', e.target.value)}
                   >
                     <option value="">Select var...</option>
                     {(data.registeredVars || []).map((v: string) => (
                       <option key={v} value={v}>{v}</option>
                     ))}
                   </select>
                   <input type="number" placeholder="Weight" className="nodrag w-1/3 text-[9px] p-1 border rounded"
                     onChange={(e) => updateRiskField(idx, 'weight', e.target.value)} />
                 </div>
               ))}
             </div>
             <div className="mt-2 p-2 bg-amber-50 rounded text-[9px] font-mono text-amber-700">
               → Returns: Risk Score [0, 1]
             </div>
          </div>
        )}

        {/* 9. BUY / SELL */}
        {(data.category === 'BUY' || data.category === 'SELL') && (
           <div className="flex flex-col gap-2">
             <select className="nodrag w-full text-[10px] p-1 border rounded" onChange={(e) => data.ticker = e.target.value}>
               <option value="BTC">Bitcoin (BTC)</option>
               <option value="ETH">Ethereum (ETH)</option>
             </select>
             <input type="number" className="nodrag w-full text-sm p-1 border rounded" 
               placeholder="Amount (e.g. 0.5)" onChange={(e) => data.manualValue = e.target.value} />
           </div>
        )}

        {/* 10. OUTPUT */}
        {data.category === 'OUTPUT' && (
           <select 
             className="nodrag w-full text-sm p-1 border rounded font-mono"
             onChange={(e) => data.variableName = e.target.value}
           >
             <option value="">Select variable to display...</option>
             {(data.registeredVars || []).map((v: string) => (
               <option key={v} value={v}>{v}</option>
             ))}
           </select>
        )}

        {/* OUTPUT HANDLES */}
        {/* Condition block has TWO output handles (YES/NO) */}
        {data.category === 'CONDITION' && (
          <>
            <Handle 
              type="source" 
              position={Position.Right} 
              id="yes"
              className="w-3 h-3 !bg-green-600 border-2 border-white" 
              style={{ top: '30%' }}
            />
            <div className="absolute right-1 text-[8px] font-bold text-green-600" style={{ top: '25%' }}>YES</div>
            
            <Handle 
              type="source" 
              position={Position.Right} 
              id="no"
              className="w-3 h-3 !bg-red-600 border-2 border-white" 
              style={{ top: '70%' }}
            />
            <div className="absolute right-1 text-[8px] font-bold text-red-600" style={{ top: '65%' }}>NO</div>
          </>
        )}

        {/* Regular output handle for other blocks */}
        {data.category !== 'STOP' && data.category !== 'OUTPUT' && data.category !== 'CONDITION' && (
          <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-slate-600 border-2 border-white" />
        )}
      </div>
    </div>
  );
};

// Main App Component
export default function App() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [portfolio, setPortfolio] = useState<any>(null);

  // Global registry of variables
  const [registeredVars, setRegisteredVars] = useState<string[]>([]);

  const nodeTypes = useMemo(() => ({ finNode: FinancialNode }), []);

  const registerVariable = (name: string) => {
    if (!name || name.trim() === '') return;
    const cleaned = name.trim();
    setRegisteredVars(prev => prev.includes(cleaned) ? prev : [...prev, cleaned]);
  };

  const addNode = (category: string, label: string, color: string) => {
    const id = `node_${Date.now()}`;
    setNodes((nds) => nds.concat({
      id,
      type: 'finNode',
      position: { x: Math.random() * 300 + 100, y: Math.random() * 200 + 100 },
      data: { 
        category, 
        label, 
        color, 
        registeredVars,
        onRegister: registerVariable,
        variableName: '',
        outputVar: '',
        riskInputs: [],
        expression: '',
        condition: ''
      },
    }));
  };

  // Update all nodes when registeredVars changes
  useMemo(() => {
    setNodes((nds) => nds.map(node => ({
      ...node,
      data: { ...node.data, registeredVars }
    })));
  }, [registeredVars, setNodes]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  // Drag and drop for variable pills
  const onDragStart = (event: React.DragEvent, varName: string) => {
    event.dataTransfer.setData('application/reactflow', 'VARIABLE_REF');
    event.dataTransfer.setData('varName', varName);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const runAlgo = async () => {
    setLogs(["[SYSTEM] Serializing graph...", "[SYSTEM] Executing algorithm..."]);
    try {
      const response = await fetch('http://localhost:8000/run_algo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });
      const result = await response.json();
      setLogs(result.logs || ["Execution complete."]);
      setPortfolio({ budget: result.final_budget, holdings: result.final_holdings });
    } catch (e) {
      setLogs(["[FATAL] Backend offline. Start server with 'python main.py'"]);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden">
      <aside className="w-72 bg-white border-r p-5 flex flex-col gap-4 shadow-lg z-20 overflow-y-auto">
        <h1 className="text-xl font-black text-slate-800 tracking-tight">ALGO-TRADER</h1>
        
        <button onClick={runAlgo} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-black shadow-lg active:scale-95 transition-all">
          ▶ RUN ALGO
        </button>

        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Control Flow</p>
            <div className="space-y-2">
              <button onClick={() => addNode('START', 'Start', 'bg-emerald-500')} className="btn-node bg-emerald-500">Start</button>
              <button onClick={() => addNode('VARIABLE', 'Variable', 'bg-indigo-500')} className="btn-node bg-indigo-500">💾 Store Variable</button>
              <button onClick={() => addNode('CONDITION', 'If/Else', 'bg-yellow-500')} className="btn-node bg-yellow-500">🔀 Condition</button>
              <button onClick={() => addNode('OUTPUT', 'Display', 'bg-slate-500')} className="btn-node bg-slate-500">Output</button>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Data Sources</p>
            <div className="space-y-2">
              <button onClick={() => addNode('NEWS_SCRAPER', 'News', 'bg-blue-500')} className="btn-node bg-blue-500">News Scraper</button>
              <button onClick={() => addNode('SCRAPE_BTC', 'BTC Price', 'bg-orange-500')} className="btn-node bg-orange-500">BTC Price</button>
              <button onClick={() => addNode('SCRAPE_ETH', 'ETH Price', 'bg-purple-600')} className="btn-node bg-purple-600">ETH Price</button>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Analysis</p>
            <div className="space-y-2">
              <button onClick={() => addNode('SEND_TO_LLM', 'AI', 'bg-pink-500')} className="btn-node bg-pink-500">LLM Sentiment</button>
              <button onClick={() => addNode('RISK_ANALYSIS', 'Risk', 'bg-amber-600')} className="btn-node bg-amber-600">Risk Analysis</button>
              <button onClick={() => addNode('MATH', 'Math', 'bg-cyan-600')} className="btn-node bg-cyan-600">🧮 Math Operation</button>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Trading</p>
            <div className="space-y-2">
              <button onClick={() => addNode('BUY', 'Buy', 'bg-green-600')} className="btn-node bg-green-600">Buy Order</button>
              <button onClick={() => addNode('SELL', 'Sell', 'bg-red-600')} className="btn-node bg-red-600">Sell Order</button>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Active Variables (Drag to use)</p>
          <div className="flex flex-wrap gap-1">
            {registeredVars.length === 0 ? (
              <span className="text-[10px] text-slate-400 italic">No variables yet</span>
            ) : (
              registeredVars.map(v => (
                <span 
                  key={v} 
                  draggable
                  onDragStart={(e) => onDragStart(e, v)}
                  className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold border border-indigo-200 cursor-grab active:cursor-grabbing hover:bg-indigo-200 transition-colors"
                >
                  {v}
                </span>
              ))
            )}
          </div>
        </div>
      </aside>

      <main className="flex-grow relative bg-slate-100" ref={reactFlowWrapper}>
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          onNodesChange={onNodesChange} 
          onEdgesChange={onEdgesChange} 
          onConnect={onConnect} 
          nodeTypes={nodeTypes} 
          fitView
        >
          <Background color="#cbd5e1" gap={20} />
          <Controls />
          
          <Panel position="bottom-right" className="m-4">
            <div className="w-80 bg-slate-900/95 rounded-xl border border-slate-700 p-4 font-mono text-[11px] text-green-400 max-h-60 overflow-y-auto shadow-2xl">
              <div className="border-b border-slate-700 pb-2 mb-2 font-bold text-white uppercase">Console</div>
              {logs.map((log, i) => <div key={i} className="mb-1">{`> ${log}`}</div>)}
              {portfolio && (
                <div className="mt-3 pt-3 border-t border-slate-700 text-white flex justify-between">
                  <span>Balance: ${portfolio.budget?.toFixed(2)}</span>
                  <span className="text-indigo-400">BTC: {portfolio.holdings?.BTC?.toFixed(4)}</span>
                </div>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </main>

      <style jsx>{`
        .btn-node { 
          @apply w-full p-2.5 text-white rounded-lg text-[11px] font-bold text-left hover:brightness-110 active:scale-95 transition-all shadow-sm; 
        }
      `}</style>
    </div>
  );
}