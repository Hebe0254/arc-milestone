"use client";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

// Professional cross-chain Send via Circle App Kit unified balance (spend). Includes a Top-up step.
function getProvider() { const w = window as any; let p = w.okxwallet || w.ethereum; if (w.ethereum?.providers?.length) p = w.ethereum.providers.find((x: any) => x.isMetaMask) || w.ethereum.providers[0]; return p; }
async function adapterOf(p: any) { const { createViemAdapterFromProvider } = await import("@circle-fin/adapter-viem-v2"); return await createViemAdapterFromProvider({ provider: p } as any); }
const fmtA = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const CHAINS: Record<string, string> = { Arc_Testnet: "Arc Testnet", Base_Sepolia: "Base Sepolia", Ethereum_Sepolia: "Ethereum Sepolia", Avalanche_Fuji: "Avalanche Fuji" };

export function SendPanel({ heading, color = "emerald" }: { heading: string; color?: string }) {
  const c = color;
  const { address, isConnected } = useAccount();
  const [bal, setBal] = useState<string | null>(null);
  const [amt, setAmt] = useState("");
  const [to, setTo] = useState("");
  const [chain, setChain] = useState("Arc_Testnet");
  const [dep, setDep] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [showTop, setShowTop] = useState(false);

  async function loadBal() {
    if (!address) return;
    try { const { createUnifiedBalanceKitContext, getBalances } = await import("@circle-fin/unified-balance-kit"); const ctx = createUnifiedBalanceKitContext(); const r: any = await getBalances(ctx as any, { token: "USDC", sources: { address, chains: ["Arc_Testnet"] }, includePending: true } as any); setBal(r?.totalConfirmedBalance ?? "0"); } catch { }
  }
  useEffect(() => { if (address) loadBal(); }, [address]); // eslint-disable-line

  async function topUp() {
    if (!address || !(Number(dep) > 0)) return;
    setBusy(true); setStatus("Topping up…");
    try {
      const p = getProvider(); const ad = await adapterOf(p);
      const { createUnifiedBalanceKitContext, deposit } = await import("@circle-fin/unified-balance-kit");
      const r: any = await deposit(createUnifiedBalanceKitContext() as any, { from: { adapter: ad, chain: "Arc_Testnet" }, token: "USDC", amount: dep } as any);
      setStatus("Topped up ✓ " + (r?.txHash ? fmtA(r.txHash) : "")); setDep("");
      for (let i = 0; i < 4; i++) { await new Promise(r => setTimeout(r, 5000)); await loadBal(); }
    } catch (e: any) { setStatus("Top up: " + (e?.shortMessage || e?.message || "failed").slice(0, 140)); }
    finally { setBusy(false); }
  }

  async function send() {
    if (!address || !(Number(amt) > 0) || !to.trim()) return;
    setBusy(true); setStatus("Sending…");
    try {
      const p = getProvider(); const ad = await adapterOf(p);
      const { createUnifiedBalanceKitContext, spend } = await import("@circle-fin/unified-balance-kit");
      const r: any = await spend(createUnifiedBalanceKitContext() as any, { from: { adapter: ad }, to: { adapter: ad, chain, recipientAddress: to.trim(), useForwarder: false }, token: "USDC", amount: amt } as any);
      setStatus("Sent ✓ " + (r?.txHash ? fmtA(r.txHash) : "")); setAmt(""); setTo(""); loadBal();
    } catch (e: any) { const m = (e?.shortMessage || e?.message || "failed"); setStatus(/nsufficient/.test(m) ? m + " — top up first." : m.slice(0, 150)); }
    finally { setBusy(false); }
  }

  const TokenUSDC = <span className="shrink-0 bg-gray-800 rounded-full px-3 py-1.5 text-sm font-bold flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 grid place-items-center text-[11px] text-white">$</span>USDC</span>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1"><h3 className="text-base font-bold">{heading}</h3><button onClick={() => setShowTop(s => !s)} className={`text-xs px-2.5 py-1 rounded-full bg-${c}-500/15 text-${c}-300 hover:bg-${c}-500/25`}>{bal !== null ? `Balance $${bal}` : "Top up"} ▾</button></div>

      {showTop && <div className={`bg-gradient-to-br from-${c}-500/10 to-${c}-500/5 border border-${c}-500/20 rounded-2xl p-4 space-y-2`}>
        <div className="text-xs text-gray-400">Top up your spendable balance first</div>
        <div className="flex gap-2"><div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span><input value={dep} onChange={e => setDep(e.target.value)} type="number" placeholder="0.00" className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none" /></div><button onClick={topUp} disabled={busy || !(Number(dep) > 0)} className={`px-4 py-2.5 rounded-xl text-sm font-bold bg-${c}-500 text-black hover:opacity-90 disabled:opacity-40`}>{busy ? "…" : "Deposit"}</button></div>
      </div>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
        <div><div className="text-xs text-gray-500 mb-1">Recipient</div><input value={to} onChange={e => setTo(e.target.value)} placeholder="0x… address" className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-gray-600" /></div>
        <div><div className="text-xs text-gray-500 mb-1">Amount</div><div className="flex items-center gap-3"><input value={amt} onChange={e => setAmt(e.target.value)} type="number" placeholder="0" className="w-full bg-transparent text-2xl font-bold focus:outline-none placeholder:text-gray-600" />{TokenUSDC}</div></div>
        <div><div className="text-xs text-gray-500 mb-1">Destination chain</div><select value={chain} onChange={e => setChain(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none">{Object.keys(CHAINS).map(k => <option key={k} value={k}>{CHAINS[k]}</option>)}</select></div>
      </div>

      <button onClick={send} disabled={!isConnected || busy || !(Number(amt) > 0) || !to.trim()} className={`w-full py-4 font-bold text-base rounded-2xl bg-gradient-to-r from-${c}-500 to-${c}-600 text-white hover:opacity-90 disabled:opacity-40 shadow-lg shadow-${c}-500/20`}>{!isConnected ? "Connect wallet" : busy ? "Working…" : !to.trim() ? "Enter recipient" : !(Number(amt) > 0) ? "Enter an amount" : `Send to ${CHAINS[chain]}`}</button>
      {status && <div className="text-center text-xs text-gray-400">{status}</div>}
      <p className="text-[11px] text-gray-600 text-center">Spends from your Circle unified balance — works across chains instantly.</p>
    </div>
  );
}
