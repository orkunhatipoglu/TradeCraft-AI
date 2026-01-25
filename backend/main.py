import os
import re
import time
import random
import math
import uvicorn
import networkx as nx
import yfinance as yf
from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup Gemini - Replace with your actual key or set environment variable
GENAI_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GENAI_KEY) if GENAI_KEY else None

class TradingContext:
    def __init__(self):
        self.vars = {}
        self.budget = 0.0
        self.holdings = {"BTC": 0.0, "ETH": 0.0}
        self.logs = []
        self.last_output = None  # Track output from previous node

    def log(self, tag, msg):
        formatted = f"[{tag}] {msg}"
        print(formatted)
        self.logs.append(formatted)

def replace_variables(expression: str, variables: dict) -> str:
    """Replace {varname} with actual values from variables dict"""
    def replacer(match):
        var_name = match.group(1)
        if var_name in variables:
            return str(variables[var_name])
        else:
            raise ValueError(f"Variable '{var_name}' not found")
    
    return re.sub(r'\{(\w+)\}', replacer, expression)

def evaluate_math(expression: str, variables: dict) -> float:
    """Safely evaluate math expression with variable substitution"""
    try:
        # Replace variables
        resolved = replace_variables(expression, variables)
        
        # Create safe environment with math functions
        safe_dict = {
            "pow": pow,
            "sqrt": math.sqrt,
            "log": math.log,
            "log2": math.log2,
            "log10": math.log10,
            "abs": abs,
            "min": min,
            "max": max,
        }
        
        # Evaluate the expression
        result = eval(resolved, {"__builtins__": {}}, safe_dict)
        return float(result)
    except Exception as e:
        raise ValueError(f"Math evaluation error: {str(e)}")

def evaluate_condition(condition: str, variables: dict) -> bool:
    """Safely evaluate boolean condition with variable substitution and logical operators"""
    try:
        # Replace variables first
        resolved = replace_variables(condition, variables)
        
        # Replace logical operators with Python equivalents
        # Handle negation first (to avoid conflicts with !=)
        resolved = re.sub(r'!\s*\(', ' not (', resolved)  # !(expr) -> not (expr)
        resolved = re.sub(r'!([a-zA-Z0-9_\.]+)', r' not \1', resolved)  # !var -> not var
        
        # Replace other logical operators
        resolved = resolved.replace('&&', ' and ')
        resolved = resolved.replace('||', ' or ')
        
        # Handle XOR (^^) - convert to (a and not b) or (not a and b)
        # This is a bit complex, so we'll use a different approach
        # XOR: a ^^ b becomes bool(a) != bool(b)
        xor_pattern = r'(\([^)]+\)|[a-zA-Z0-9_\.]+)\s*\^\^\s*(\([^)]+\)|[a-zA-Z0-9_\.]+)'
        while '^^' in resolved:
            resolved = re.sub(xor_pattern, r'(bool(\1) != bool(\2))', resolved, count=1)
        
        # Evaluate the condition
        result = eval(resolved, {"__builtins__": {}}, {"bool": bool})
        return bool(result)
    except Exception as e:
        raise ValueError(f"Condition evaluation error: {str(e)}")

@app.post("/run_algo")
async def run_algo(payload: dict = Body(...)):
    nodes = payload.get("nodes", [])
    edges = payload.get("edges", [])
    ctx = TradingContext()

    # Build Directed Graph
    G = nx.DiGraph()
    node_map = {n["id"]: n for n in nodes}
    for n in nodes: 
        G.add_node(n["id"])
    for e in edges: 
        G.add_edge(e["source"], e["target"], handle=e.get("sourceHandle"))

    # Custom topological sort that handles conditional branching
    def execute_from_node(node_id, visited=None):
        if visited is None:
            visited = set()
        
        if node_id in visited:
            return
        visited.add(node_id)
        
        data = node_map[node_id]["data"]
        cat = data.get("category")

        if cat == "START":
            ctx.log("START", "Engine Ignited.")
            ctx.last_output = None

        elif cat == "VARIABLE":
            # Store whatever the previous block outputted
            var_name = data.get("variableName", "").strip()
            if var_name and ctx.last_output is not None:
                ctx.vars[var_name] = ctx.last_output
                ctx.log("VARIABLE", f"Stored '{var_name}' = {ctx.last_output}")
            elif not var_name:
                ctx.log("VARIABLE", "WARNING: No variable name specified!")
            else:
                ctx.log("VARIABLE", f"WARNING: No data to store in '{var_name}'")
            ctx.last_output = None

        elif cat == "MATH":
            expression = data.get("expression", "").strip()
            if expression:
                try:
                    result = evaluate_math(expression, ctx.vars)
                    ctx.log("MATH", f"Calculated: {expression} = {result}")
                    ctx.last_output = result
                except Exception as e:
                    ctx.log("MATH", f"ERROR: {str(e)}")
                    ctx.last_output = 0
            else:
                ctx.log("MATH", "WARNING: No expression provided")
                ctx.last_output = 0

        elif cat == "CONDITION":
            condition = data.get("condition", "").strip()
            if condition:
                try:
                    result = evaluate_condition(condition, ctx.vars)
                    ctx.log("CONDITION", f"Evaluated: {condition} = {result}")
                    
                    # Find next nodes based on condition result
                    outgoing = [(e["target"], e.get("sourceHandle")) for e in edges if e["source"] == node_id]
                    
                    for target_id, handle in outgoing:
                        if result and handle == "yes":
                            execute_from_node(target_id, visited)
                        elif not result and handle == "no":
                            execute_from_node(target_id, visited)
                    
                    return  # Don't continue with normal flow
                    
                except Exception as e:
                    ctx.log("CONDITION", f"ERROR: {str(e)}")
            else:
                ctx.log("CONDITION", "WARNING: No condition provided")

        elif cat == "SET_BUDGET":
            ctx.budget = float(data.get("manualValue") or 0)
            ctx.log("WALLET", f"Budget locked at ${ctx.budget}")
            ctx.last_output = ctx.budget

        elif cat in ["SCRAPE_BTC", "SCRAPE_ETH"]:
            ticker = "BTC-USD" if "BTC" in cat else "ETH-USD"
            price = yf.Ticker(ticker).history(period="1d")['Close'].iloc[-1]
            price_val = float(price)
            ctx.log("SCRAPE", f"{ticker}: ${price_val:.2f}")
            ctx.last_output = price_val

        elif cat == "NEWS_SCRAPER":
            news = [
                "Market bullish on ETF news", 
                "Regulatory FUD spreading", 
                "Institutional whale buy detected"
            ]
            selected_news = random.choice(news)
            ctx.log("NEWS", f"Scraped: {selected_news}")
            ctx.last_output = selected_news

        elif cat == "SEND_TO_LLM":
            input_var = data.get("variableName", "")
            input_txt = ctx.vars.get(input_var, "neutral")
            
            if client:
                try:
                    res = client.models.generate_content(
                        model="gemini-2.0-flash", 
                        contents=f"Rate sentiment from -1 (very negative) to 1 (very positive) for this text. Respond ONLY with a number between -1 and 1: {input_txt}"
                    )
                    score = float(res.text.strip())
                    score = max(-1, min(1, score))
                except:
                    score = round(random.uniform(-1, 1), 2)
            else:
                score = round(random.uniform(-1, 1), 2)
            
            ctx.log("GEMINI", f"Sentiment: {score:.2f}")
            ctx.last_output = score

        elif cat == "RISK_ANALYSIS":
            risk_inputs = data.get("riskInputs", [])
            w_sum, w_total = 0, 0
            
            for item in risk_inputs:
                raw_v = item.get("value", "")
                if raw_v in ctx.vars:
                    val = float(ctx.vars[raw_v])
                else:
                    try:
                        val = float(raw_v)
                    except:
                        val = 0
                
                weight = float(item.get("weight") or 0)
                w_sum += (val * weight)
                w_total += weight
            
            final_risk = abs((w_sum / w_total)) if w_total > 0 else 0
            final_risk = min(1, final_risk)
            
            ctx.log("RISK", f"Weighted Risk Score: {final_risk:.2f}")
            ctx.last_output = final_risk

        elif cat in ["BUY", "SELL"]:
            ticker = data.get("ticker", "BTC")
            amt = float(data.get("manualValue") or 0)
            price = ctx.last_output if isinstance(ctx.last_output, (int, float)) else 0
            
            if cat == "BUY" and (amt * price) <= ctx.budget:
                ctx.budget -= (amt * price)
                ctx.holdings[ticker] += amt
                ctx.log("TRADE", f"BOUGHT {amt} {ticker} @ ${price:.2f}")
            elif cat == "SELL" and ctx.holdings[ticker] >= amt:
                ctx.budget += (amt * price)
                ctx.holdings[ticker] -= amt
                ctx.log("TRADE", f"SOLD {amt} {ticker} @ ${price:.2f}")
            else:
                ctx.log("TRADE", f"FAILED: Insufficient funds or holdings")
            
            ctx.last_output = None

        elif cat == "OUTPUT":
            var_name = data.get("variableName", "")
            value = ctx.vars.get(var_name, 'NULL')
            ctx.log("OUTPUT", f"{var_name} => {value}")
            ctx.last_output = None

        # Continue to next nodes (unless it was a condition)
        if cat != "CONDITION":
            outgoing = [e["target"] for e in edges if e["source"] == node_id]
            for target_id in outgoing:
                execute_from_node(target_id, visited)

    # Find start node and begin execution
    start_nodes = [n["id"] for n in nodes if n["data"].get("category") == "START"]
    if not start_nodes:
        raise HTTPException(status_code=400, detail="No START node found!")
    
    for start_id in start_nodes:
        execute_from_node(start_id)

    return {
        "logs": ctx.logs, 
        "final_budget": ctx.budget, 
        "final_holdings": ctx.holdings,
        "variables": ctx.vars
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)