import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';

const FinancialNode = ({ data, id }: any) => {
  // Force update for dynamic fields
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

export default memo(FinancialNode);