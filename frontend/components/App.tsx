"use client";
/* Arc Milestone — milestone escrow payments. Layout theo ảnh 25 (task board sáng): sidebar trái +
   lưới card milestone (status pill, release/refund) + tạo milestone. Self-contained.
   ABI preserved: create(seller,desc)payable/release(id)/refund(id)/get/total. status 0=Funded 1=Released 2=Refunded. */
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSendTransaction } from "wagmi";
import { parseEther, formatEther, isAddress } from "viem";
const C = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0") as `0x${string}`;
const CHAIN = 5042002, HEX = "0x4CEF52";
const ABI = [
  { name: "create", type: "function", stateMutability: "payable", inputs: [{ name: "seller", type: "address" }, { name: "desc", type: "string" }], outputs: [{ type: "uint256" }] },
  { name: "release", type: "function", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { name: "refund", type: "function", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { name: "get", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "tuple", components: [{ name: "buyer", type: "address" }, { name: "seller", type: "address" }, { name: "desc", type: "string" }, { name: "amount", type: "uint256" }, { name: "status", type: "uint8" }, { name: "at", type: "uint256" }] }] },
  { name: "total", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const cut = (a?: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
const usd = (w?: bigint) => w === undefined ? "0.00" : Number(formatEther(w)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ST = [{ t: "In escrow", c: "#7c3aed", bg: "#ede9fe" }, { t: "Released", c: "#16a34a", bg: "#dcfce7" }, { t: "Refunded", c: "#64748b", bg: "#eef2f6" }];
async function toArc() { const e = (window as any).ethereum; if (!e) return; try { await e.request({ method: "wallet_addEthereumChain", params: [{ chainId: HEX, chainName: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: ["https://rpc.testnet.arc.network"], blockExplorerUrls: ["https://testnet.arcscan.app"] }] }); } catch { try { await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX }] }); } catch {} } }
const CSS = `
.ms{--bg:#f6f6fb;--side:#fff;--card:#fff;--bd:#e7e6f0;--bd2:#dcd9ec;--mut:#857fa3;--txt:#1a1730;--acc:#7c3aed;--acc2:#6d28d9;min-height:100vh;background:var(--bg);color:var(--txt);font-family:'Inter','Segoe UI',system-ui,sans-serif;display:flex}
.ms *{box-sizing:border-box}.ms a{color:var(--acc);text-decoration:none}
.ms .side{width:210px;flex-shrink:0;background:var(--side);border-right:1px solid var(--bd);min-height:100vh;padding:18px 14px;display:flex;flex-direction:column;gap:6px}
.ms .brand{display:flex;align-items:center;gap:9px;font-weight:800;font-size:16px;padding:4px 8px 14px}
.ms .mark{width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#a855f7);display:grid;place-items:center;font-size:15px}
.ms .nav button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:none;color:var(--mut);font:inherit;font-weight:700;font-size:13.5px;padding:11px 13px;border-radius:10px;cursor:pointer}
.ms .nav button:hover{background:#f3f0fb;color:var(--txt)}.ms .nav button.on{background:var(--acc);color:#fff}
.ms .main{flex:1;min-width:0;padding:20px 24px 50px}
.ms .top{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.ms .btn{border:0;border-radius:10px;font:inherit;font-weight:700;cursor:pointer;padding:9px 15px;transition:.15s}.ms .btn:disabled{opacity:.5;cursor:not-allowed}
.ms .pri{background:var(--acc);color:#fff}.ms .pri:hover:not(:disabled){background:var(--acc2)}.ms .gho{background:#fff;color:var(--acc);border:1px solid var(--bd2)}.ms .red{background:#dc2626;color:#fff}
.ms .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.ms .mc{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:16px;box-shadow:0 8px 22px -18px rgba(60,40,120,.4)}
.ms .pill{font-size:11px;font-weight:700;padding:4px 10px;border-radius:99px}
.ms .card{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:18px;max-width:440px}
.ms label{display:block;font-size:12px;color:var(--mut);font-weight:600;margin:8px 0 5px}
.ms input{width:100%;background:var(--bg);border:1px solid var(--bd2);border-radius:10px;padding:11px 13px;font:inherit;font-size:14px;color:var(--txt);outline:none}.ms input:focus{border-color:var(--acc)}
.ms .menu{position:absolute;right:0;top:115%;background:#fff;border:1px solid var(--bd);border-radius:11px;padding:6px;min-width:180px;z-index:30;box-shadow:0 14px 34px rgba(40,30,80,.16)}
.ms .menu button{display:block;width:100%;text-align:left;background:none;border:0;color:var(--txt);font:inherit;font-weight:600;font-size:13px;padding:8px 11px;border-radius:8px;cursor:pointer}.ms .menu button:hover{background:var(--bg)}
@media(max-width:820px){.ms{flex-direction:column}.ms .side{width:100%;min-height:auto;flex-direction:row;flex-wrap:wrap}}
`;
function MCard({ id, me, busy, write }: { id: bigint; me?: string; busy: boolean; write: (fn: string, args: any[]) => void }) {
  const { data: d } = useReadContract({ address: C, abi: ABI, functionName: "get", args: [id] });
  if (!d) return null; const x = d as any; const st = ST[x.status] || ST[0];
  const isB = me?.toLowerCase() === x.buyer.toLowerCase(); const isS = me?.toLowerCase() === x.seller.toLowerCase();
  return (
    <div className="mc">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
        <span className="pill" style={{ background: st.bg, color: st.c }}>{st.t}</span>
        <span style={{ fontSize: 11, color: "var(--mut)" }}>#{id.toString()}</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{x.desc || `Milestone #${id}`}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--acc)", margin: "6px 0" }}>${usd(x.amount)}</div>
      <div style={{ fontSize: 11.5, color: "var(--mut)", marginBottom: 10 }}>{cut(x.buyer)} → {cut(x.seller)}</div>
      {x.status === 0 && (isB || isS) && <div style={{ display: "flex", gap: 8 }}>
        {isB && <button className="btn pri" style={{ flex: 1, padding: "8px" }} disabled={busy} onClick={() => write("release", [id])}>{busy ? "…" : "Release ✓"}</button>}
        {isS && <button className="btn gho" style={{ flex: 1, padding: "8px" }} disabled={busy} onClick={() => write("refund", [id])}>{busy ? "…" : "Refund ↩"}</button>}
      </div>}
    </div>
  );
}
export default function App() {
  const { address, isConnected } = useAccount(); const net = useChainId();
  const { connectors, connect } = useConnect(); const { disconnect } = useDisconnect();
  const [pop, setPop] = useState(false); const [tab, setTab] = useState<"board" | "new" | "send">("board");
  const [form, setForm] = useState({ seller: "", desc: "", amount: "" }); const [snd, setSnd] = useState({ to: "", amount: "" });
  const tx = useWriteContract(); const rcpt = useWaitForTransactionReceipt({ hash: tx.data, query: { enabled: !!tx.data } });
  const send = useSendTransaction(); const srcpt = useWaitForTransactionReceipt({ hash: send.data, query: { enabled: !!send.data } });
  const sbusy = send.isPending || srcpt.isLoading;
  const busy = tx.isPending || rcpt.isLoading;
  const total = useReadContract({ address: C, abi: ABI, functionName: "total" });
  useEffect(() => { if (rcpt.isSuccess) { tx.reset(); setForm({ seller: "", desc: "", amount: "" }); total.refetch(); } }, [rcpt.isSuccess]); // eslint-disable-line
  useEffect(() => { if (srcpt.isSuccess) { send.reset(); setSnd({ to: "", amount: "" }); } }, [srcpt.isSuccess]); // eslint-disable-line
  const wrong = isConnected && net !== CHAIN; const n = total.data !== undefined ? Number(total.data) : 0;
  const write = (fn: string, args: any[]) => tx.writeContract({ address: C, abi: ABI, functionName: fn as any, args });
  return (
    <div className="ms">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <aside className="side">
        <div className="brand"><span className="mark">🏁</span>Arc Milestone</div>
        <div className="nav">
          <button className={tab === "board" ? "on" : ""} onClick={() => setTab("board")}>🗂️ Board</button>
          <button className={tab === "new" ? "on" : ""} onClick={() => setTab("new")}>＋ New milestone</button>
          <button className={tab === "send" ? "on" : ""} onClick={() => setTab("send")}>↗ Quick pay</button>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11.5, color: "var(--mut)", padding: "0 8px" }}>Built on <a href="https://arc.network" target="_blank" rel="noopener noreferrer">Arc Network</a></div>
      </aside>
      <main className="main">
        <div className="top">
          <div style={{ fontSize: 22, fontWeight: 800 }}>{tab === "board" ? "Milestone payments" : tab === "new" ? "New milestone" : "Quick pay"}</div>
          <span style={{ fontSize: 11, color: "var(--mut)", border: "1px solid var(--bd2)", borderRadius: 99, padding: "3px 10px" }}>{n} total</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            <button className={"btn " + (wrong ? "red" : "gho")} onClick={toArc}>{wrong ? "Switch to Arc" : "⚡ Arc network"}</button>
            <div style={{ position: "relative" }}><button className="btn pri" onClick={() => setPop(p => !p)}>{isConnected ? cut(address) : "Connect"}</button>
              {pop && <div className="menu">{isConnected ? <button onClick={() => { disconnect(); setPop(false); }} style={{ color: "#dc2626" }}>Disconnect</button> : connectors.map(c => <button key={c.uid} onClick={() => { connect({ connector: c }); setPop(false); }}>{c.name}</button>)}</div>}</div>
          </div>
        </div>
        {tab === "board" && <div className="grid">{n > 0 ? Array.from({ length: n }, (_, i) => BigInt(n - 1 - i)).map(id => <MCard key={id.toString()} id={id} me={address} busy={busy} write={write} />) : <div style={{ gridColumn: "1/-1", color: "var(--mut)", textAlign: "center", padding: "40px 0" }}>No milestones yet — create one</div>}</div>}
        {tab === "new" && <div className="card">
          <label>Worker / seller address</label><input value={form.seller} onChange={e => setForm(f => ({ ...f, seller: e.target.value }))} placeholder="0x…" style={{ fontFamily: "ui-monospace" }} />
          <label>Milestone description</label><input value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="e.g. Design phase" />
          <label>Amount (USDC)</label><input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} type="number" placeholder="0.00" style={{ fontSize: 18, fontWeight: 800 }} />
          <button className="btn pri" style={{ width: "100%", marginTop: 14 }} disabled={!isConnected || busy || !isAddress(form.seller) || !(Number(form.amount) > 0)} onClick={() => tx.writeContract({ address: C, abi: ABI, functionName: "create", args: [form.seller as `0x${string}`, form.desc], value: parseEther(form.amount || "0") })}>{busy ? "…" : "Fund milestone 🏁"}</button>
        </div>}
        {tab === "send" && <div className="card" style={{ maxWidth: 440 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Quick pay USDC</div>
          <div style={{ fontSize: 12.5, color: "var(--mut)", marginBottom: 6 }}>One-off payment to a contributor on Arc.</div>
          <label>To address</label><input value={snd.to} onChange={e => setSnd(s => ({ ...s, to: e.target.value }))} placeholder="0x…" style={{ fontFamily: "ui-monospace" }} />
          <label>Amount (USDC)</label><input value={snd.amount} onChange={e => setSnd(s => ({ ...s, amount: e.target.value }))} type="number" placeholder="0.00" style={{ fontSize: 18, fontWeight: 800 }} />
          <button className="btn pri" style={{ width: "100%", marginTop: 14 }} disabled={!isConnected || sbusy || !isAddress(snd.to) || !(Number(snd.amount) > 0)} onClick={() => send.sendTransaction({ to: snd.to as `0x${string}`, value: parseEther(snd.amount || "0") })}>{sbusy ? "Sending…" : "Quick pay ↗"}</button>
          {srcpt.isSuccess && <div style={{ fontSize: 12, color: "#16a34a", textAlign: "center", marginTop: 8 }}>✓ Sent</div>}
        </div>}
      </main>
    </div>
  );
}
