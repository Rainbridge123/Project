// frontend/src/App.jsx
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI, STATUS } from "./config";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const HARDHAT_DEFAULTS = {
  passenger:    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  underwriter1: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  underwriter2: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  resolver:     "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  thirdParty:   "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
};
const ROLE_META = {
  passenger:    { label: "✈️ Passenger",     color: "#4fc3f7" },
  underwriter1: { label: "🏦 Underwriter 1", color: "#34d399" },
  underwriter2: { label: "🏦 Underwriter 2", color: "#a78bfa" },
  resolver:     { label: "🔮 Resolver",       color: "#f59e0b" },
  thirdParty:   { label: "👤 Third Party",    color: "#f472b6" },
};
const TABS = [
  { key: "passenger",    label: "✈️ Passenger",     expectedRole: "passenger"    },
  { key: "underwriter1", label: "🏦 UW 1",           expectedRole: "underwriter1" },
  { key: "underwriter2", label: "🏦 UW 2",           expectedRole: "underwriter2" },
  { key: "resolver",     label: "🔮 Resolver",       expectedRole: "resolver"     },
];

// ─────────────────────────────────────────────────────────────────────────────
// Address helpers
// ─────────────────────────────────────────────────────────────────────────────
function addrToRoleKey(addr, roleAddresses) {
  if (!addr) return null;
  for (const [role, a] of Object.entries(roleAddresses)) {
    if (a?.toLowerCase() === addr.toLowerCase()) return role;
  }
  return null;
}
function addrDisplay(addr, roleAddresses) {
  if (!addr || addr === ethers.ZeroAddress) return "—";
  const role = addrToRoleKey(addr, roleAddresses);
  const short = addr.slice(0, 6) + "…" + addr.slice(-4);
  return role ? `${ROLE_META[role].label} (${short})` : short;
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived status
// ─────────────────────────────────────────────────────────────────────────────
function derivedStatus(policy) {
  if (!policy || policy.passenger === ethers.ZeroAddress) return "UNKNOWN";
  const s = Number(policy.status);
  const now = Math.floor(Date.now() / 1000);
  if (s === 0) return now < Number(policy.auctionEnd) ? "BIDDING_OPEN" : "BIDDING_ENDED";
  if (s === 1) return "ACTIVE";
  if (s === 2) return "PAID";
  if (s === 3) return "EXPIRED";
  return "UNKNOWN";
}
const DERIVED_META = {
  BIDDING_OPEN:  { label: "BIDDING — OPEN",  color: "#f59e0b", desc: "Auction open. Underwriters can place bids now." },
  BIDDING_ENDED: { label: "BIDDING — ENDED", color: "#ef4444", desc: "Auction closed. Winning underwriter must finalize." },
  ACTIVE:        { label: "ACTIVE",           color: "#3b82f6", desc: "Collateral locked. Awaiting oracle resolution." },
  PAID:          { label: "PAID",             color: "#22c55e", desc: "Flight delayed. Payout sent to Policy NFT holder." },
  EXPIRED:       { label: "EXPIRED",          color: "#6b7280", desc: "No delay. Collateral returned to Risk NFT holder." },
  UNKNOWN:       { label: "UNKNOWN",          color: "#475569", desc: "" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Error parser
// ─────────────────────────────────────────────────────────────────────────────
function parseError(e) {
  const raw = JSON.stringify(e);
  const m1 = raw.match(/reverted with reason string '([^']+)'/);
  if (m1) return m1[1];
  if (e.reason) return e.reason;
  const m2 = (e.message || "").match(/execution reverted: (.+?)(?:"|$)/);
  if (m2) return m2[1];
  if (e.code === 4001 || (e.message || "").includes("rejected")) return "Transaction rejected by user.";
  return e.shortMessage || e.message || "Unknown error";
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function toBytes32(str) { return ethers.encodeBytes32String(str.slice(0, 31)); }
function fromBytes32(hex) { try { return ethers.decodeBytes32String(hex); } catch { return hex; } }
function shortAddr(addr) { return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "—"; }
function fmtEth(wei) {
  if (wei === undefined || wei === null) return "—";
  const n = parseFloat(ethers.formatEther(wei));
  if (n >= 100)  return n.toFixed(4) + " ETH";
  if (n >= 1)    return n.toFixed(4) + " ETH";
  return n.toFixed(4) + " ETH";
}
function nowPlusSeconds(s) {
  const d = new Date(Date.now() + s * 1000);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToTs(dtStr) { return Math.floor(new Date(dtStr).getTime() / 1000); }
function tsToLocal(ts) { return new Date(Number(ts) * 1000).toLocaleString(); }
function calcGas(tx, rcpt) {
  const price = tx.gasPrice ?? tx.maxFeePerGas ?? 0n;
  return fmtEth(rcpt.gasUsed * price);
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const inputStyle = {
  background: "#111318", border: "1px solid #2d3445",
  borderRadius: 6, color: "#e2e8f0", padding: "8px 12px",
  fontSize: 13, fontFamily: "monospace", width: "100%", outline: "none",
};
const btnStyle = (color, extra = {}) => ({
  background: color + "22", border: `1px solid ${color}55`,
  borderRadius: 6, color, padding: "8px 18px",
  fontSize: 13, fontFamily: "monospace", cursor: "pointer", fontWeight: 600,
  ...extra,
});
const disabledBtnStyle = {
  background: "#1a1e2a", border: "1px solid #3d4455",
  borderRadius: 6, color: "#94a3b8", padding: "8px 18px",
  fontSize: 13, fontFamily: "monospace", cursor: "not-allowed", fontWeight: 600,
};
const CLR = {
  label: "#cbd5e1",   // 原 #94a3b8 → 更亮
  value: "#f1f5f9",   // 原 #e2e8f0 → 更亮
  dim:   "#94a3b8",   // 原 #64748b → 更亮
  head:  "#f1f5f9",   // 原 #cbd5e1 → 更亮
};

// ─────────────────────────────────────────────────────────────────────────────
// DerivedStatusBadge
// ─────────────────────────────────────────────────────────────────────────────
function DerivedStatusBadge({ ds }) {
  const m = DERIVED_META[ds] ?? DERIVED_META.UNKNOWN;
  return (
    <span style={{
      background: m.color + "22", color: m.color,
      border: `1px solid ${m.color}55`, borderRadius: 4,
      padding: "3px 10px", fontSize: 11, fontFamily: "monospace", fontWeight: 700,
    }}>{m.label}</span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AccountRoleBanner  — shown at top of each tab
// ─────────────────────────────────────────────────────────────────────────────
function AccountRoleBanner({ account, expectedRole, roleAddresses }) {
  if (!account) return null;
  const currentRole = addrToRoleKey(account, roleAddresses);
  const isCorrect   = currentRole === expectedRole;
  const expected    = ROLE_META[expectedRole];
  const current     = currentRole ? ROLE_META[currentRole] : null;

  if (isCorrect) {
    return (
      <div style={{ marginBottom: 16, padding: "10px 14px", background: expected.color + "11", border: `1px solid ${expected.color}44`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16 }}>✅</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: expected.color }}>Connected as {expected.label}</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: CLR.dim }}>{shortAddr(account)}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16, padding: "12px 14px", background: "#7c1d1d22", border: "1px solid #ef444466", borderRadius: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginBottom: 4 }}>
        ⚠️ Wrong account in MetaMask
      </div>
      <div style={{ fontSize: 13, color: CLR.label, lineHeight: 1.7 }}>
        This tab needs <strong style={{ color: expected?.color }}>{expected?.label}</strong>,
        but MetaMask is connected as <strong style={{ color: current?.color ?? "#94a3b8" }}>{current?.label ?? shortAddr(account)}</strong>.
      </div>
      <div style={{ fontSize: 12, color: CLR.dim, marginTop: 6, fontFamily: "monospace" }}>
        → Switch account in MetaMask before taking any action here.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Log
// ─────────────────────────────────────────────────────────────────────────────
function Log({ msg, err }) {
  if (!msg && !err) return null;
  return (
    <div style={{
      marginTop: 10, padding: "10px 14px", borderRadius: 6,
      background: err ? "#7f1d1d33" : "#14532d33",
      border: `1px solid ${err ? "#ef4444" : "#22c55e"}55`,
      color: err ? "#fca5a5" : "#86efac",
      fontSize: 13, fontFamily: "monospace", wordBreak: "break-word",
    }}>
      {err ? "❌ " : "✅ "}{msg || err}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PolicyCard
// ─────────────────────────────────────────────────────────────────────────────
function PolicyCard({ policy, policyId, roleAddresses }) {
  if (!policy || policy.passenger === ethers.ZeroAddress) return null;
  const ds = derivedStatus(policy);
  const dm = DERIVED_META[ds];
  const rows = [
    ["Flight",        fromBytes32(policy.flightRef)],
    ["Fixed Payout",  fmtEth(policy.fixedPayout)],
    ["Threshold",     `${policy.delayThreshold} min`],
    ["Auction Ends",  tsToLocal(policy.auctionEnd)],
    ["Max Premium",   fmtEth(policy.maxPremium)],
    ["Best Premium",  (!policy.maxPremium || policy.bestPremium === policy.maxPremium) ? "(no bids yet)" : fmtEth(policy.bestPremium)],
    ["Best UW",       addrDisplay(policy.bestUnderwriter, roleAddresses)],
    ["Policy NFT ID", policy.policyNFTId > 0n ? String(policy.policyNFTId) : "(not minted)"],
    ["Risk NFT ID",   policy.riskNFTId   > 0n ? String(policy.riskNFTId)   : "(not minted)"],
  ];
  return (
    <div style={{ background: "#1a1e2a", border: `1px solid ${dm.color}44`, borderRadius: 8, padding: "14px 18px", marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ color: CLR.head, fontSize: 13, fontFamily: "monospace", fontWeight: 600 }}>Policy #{policyId}</span>
        <DerivedStatusBadge ds={ds} />
      </div>
      {dm.desc && (
        <div style={{ fontSize: 12, color: dm.color, fontFamily: "monospace", marginBottom: 10, background: dm.color + "11", padding: "6px 10px", borderRadius: 5 }}>
          {ds === "BIDDING_ENDED" ? "⏰ " : "ℹ️ "}{dm.desc}
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td style={{ color: CLR.label, paddingRight: 12, paddingBottom: 5, whiteSpace: "nowrap" }}>{k}</td>
              <td style={{ color: CLR.value, fontFamily: "monospace", paddingBottom: 5 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RIGHT PANEL
// ─────────────────────────────────────────────────────────────────────────────
function RightPanel({ provider, roleAddresses, setRoleAddresses, currentPolicy, currentPolicyId, nftOwners, txLog, refreshBalances, balances, account }) {
  const [showEdit, setShowEdit] = useState(false);

  function nftTagsFor(role) {
    const addr = roleAddresses[role];
    if (!addr || !nftOwners) return [];
    const tags = [];
    if (nftOwners.policyOwner?.toLowerCase() === addr.toLowerCase()) tags.push({ label: "🎫 Policy NFT", color: "#4fc3f7" });
    if (nftOwners.riskOwner?.toLowerCase()   === addr.toLowerCase()) tags.push({ label: "⚖️ Risk NFT",   color: "#34d399" });
    return tags;
  }

  // Highlight the currently connected wallet
  const connectedRole = addrToRoleKey(account, roleAddresses);

  const ds = derivedStatus(currentPolicy);
  const dm = DERIVED_META[ds];
  const sectionHead = { fontSize: 13, fontFamily: "monospace", letterSpacing: "0.08em", color: "#e2e8f0", fontWeight: 700, textTransform: "uppercase", marginBottom: 10 };
  return (
    <div style={{ flex: "1", background: "#0d0f14", borderLeft: "1px solid #1e2330", height: "calc(100vh - 72px)", overflowY: "auto", position: "sticky", top: 72 }}>

      {/* LIVE ACCOUNTS */}
      <div style={{ padding: "16px", borderBottom: "1px solid #1e2330" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={sectionHead}>Live Accounts</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={refreshBalances} style={{ fontSize: 10, color: CLR.dim, background: "none", border: "1px solid #2d3445", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>↻ Refresh</button>
            <button onClick={() => setShowEdit(v => !v)} style={{ fontSize: 10, color: CLR.dim, background: "none", border: "1px solid #2d3445", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>
              {showEdit ? "Done" : "Edit"}
            </button>
          </div>
        </div>

        {Object.entries(ROLE_META).map(([role, meta]) => {
          const addr      = roleAddresses[role];
          const bal       = balances[role];
          const nfts      = nftTagsFor(role);
          const isActive  = connectedRole === role; // currently connected wallet
          return (
            <div key={role} style={{ marginBottom: 8, background: "#111318", borderRadius: 8, padding: "10px 13px", border: `1px solid ${isActive ? meta.color + "99" : meta.color + "33"}`, boxShadow: isActive ? `0 0 0 1px ${meta.color}33` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                  {isActive && <span style={{ fontSize: 10, background: meta.color + "22", border: `1px solid ${meta.color}55`, borderRadius: 10, padding: "1px 6px", color: meta.color, fontFamily: "monospace" }}>connected</span>}
                </div>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: bal !== undefined ? CLR.value : CLR.dim, fontWeight: 600 }}>
                  {bal !== undefined ? fmtEth(bal) : "—"}
                </span>
              </div>
              <div style={{ fontSize: 11, fontFamily: "monospace", color: CLR.dim, marginTop: 2 }}>
                {addr ? shortAddr(addr) : <span style={{ color: "#ef4444" }}>not set</span>}
              </div>
              {nfts.length > 0 && (
                <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                  {nfts.map(t => (
                    <span key={t.label} style={{ fontSize: 11, background: t.color + "20", border: `1px solid ${t.color}55`, borderRadius: 4, padding: "2px 8px", color: t.color, fontFamily: "monospace", fontWeight: 600 }}>{t.label}</span>
                  ))}
                </div>
              )}
              {showEdit && (
                <input value={addr} onChange={e => setRoleAddresses(prev => ({ ...prev, [role]: e.target.value }))} placeholder="0x…" style={{ ...inputStyle, marginTop: 8, fontSize: 11, padding: "5px 8px" }} />
              )}
            </div>
          );
        })}

        {/* MetaMask switch reminder */}
        <div style={{ marginTop: 10, padding: "9px 12px", background: "#111318", borderRadius: 6, border: "1px solid #2d3445", fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>
          ⚡ <strong style={{ color: CLR.label }}>Remember:</strong> Switch MetaMask account when switching tabs.<br/>
          Each role needs its own wallet address.
        </div>
      </div>

      {/* POLICY STATE */}
      {currentPolicy && currentPolicy.passenger !== ethers.ZeroAddress && (
        <div style={{ padding: "16px", borderBottom: "1px solid #1e2330" }}>
          <div style={{ ...sectionHead, marginBottom: 10 }}>
            Policy #{currentPolicyId ? String(currentPolicyId) : "—"} · Live State
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: CLR.label }}>Status</span>
            <DerivedStatusBadge ds={ds} />
          </div>
          {dm.desc && (
            <div style={{ fontSize: 12, color: dm.color, marginBottom: 10, background: dm.color + "11", padding: "7px 10px", borderRadius: 5, fontFamily: "monospace" }}>
              {dm.desc}
            </div>
          )}
          {[
            ["Flight",        fromBytes32(currentPolicy.flightRef)],
            ["Payout",        fmtEth(currentPolicy.fixedPayout)],
            ["Threshold",     `${currentPolicy.delayThreshold} min`],
            ["Auction End",   tsToLocal(currentPolicy.auctionEnd)],   // ← NEW
            ["Max Premium",   fmtEth(currentPolicy.maxPremium)],
            ["Best Premium",  (!currentPolicy.maxPremium || currentPolicy.bestPremium === currentPolicy.maxPremium) ? "no bids" : fmtEth(currentPolicy.bestPremium)],
            ["Best UW",       addrDisplay(currentPolicy.bestUnderwriter, roleAddresses)],
            ["Policy NFT →",  nftOwners?.policyOwner ? addrDisplay(nftOwners.policyOwner, roleAddresses) : "—"],
            ["Risk NFT →",    nftOwners?.riskOwner   ? addrDisplay(nftOwners.riskOwner,   roleAddresses) : "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, gap: 8 }}>
              <span style={{ color: CLR.label, flexShrink: 0 }}>{k}</span>
              <span style={{ color: CLR.value, fontFamily: "monospace", textAlign: "right", wordBreak: "break-word" }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* ACTIVITY LOG */}
      <div style={{ padding: "16px" }}>
        <div style={{ ...sectionHead }}>Activity Log</div>
        {txLog.length === 0 && (
          <div style={{ fontSize: 13, color: CLR.dim, textAlign: "center", padding: "24px 0" }}>No transactions yet</div>
        )}
        {txLog.map(entry => {
          const meta = ROLE_META[entry.role] ?? { label: entry.role, color: "#94a3b8" };
          return (
            <div key={entry.id} style={{ marginBottom: 10, background: "#111318", borderRadius: 7, padding: "11px 13px", border: `1px solid ${meta.color}33` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                <span style={{ fontSize: 11, color: CLR.dim, fontFamily: "monospace" }}>{entry.timestamp}</span>
              </div>
              <div style={{ fontSize: 13, color: CLR.head, marginBottom: 6 }}>{entry.action}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {entry.valueSent && entry.valueSent !== "0.0000 ETH" && (
                  <div style={{ fontSize: 12, fontFamily: "monospace" }}>
                    <span style={{ color: CLR.label }}>sent     </span><span style={{ color: "#f87171", fontWeight: 600 }}>{entry.valueSent}</span>
                  </div>
                )}
                {entry.valueReceived && (
                  <div style={{ fontSize: 12, fontFamily: "monospace" }}>
                    <span style={{ color: CLR.label }}>received </span><span style={{ color: "#4ade80", fontWeight: 600 }}>{entry.valueReceived}</span>
                  </div>
                )}
                {entry.gasCost && (
                  <div style={{ fontSize: 12, fontFamily: "monospace" }}>
                    <span style={{ color: CLR.label }}>gas fee  </span><span style={{ color: CLR.dim }}>{entry.gasCost}</span>
                  </div>
                )}
              </div>
              {entry.result && (
                <div style={{ fontSize: 12, color: CLR.label, marginTop: 6, fontFamily: "monospace", lineHeight: 1.6, borderTop: "1px solid #1e2330", paddingTop: 6 }}>{entry.result}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSENGER TAB
// ─────────────────────────────────────────────────────────────────────────────
function PassengerTab({ contract, account, addTxLog, setCurrentPolicy, setCurrentPolicyId, setNftOwners, roleAddresses, triggerBalanceRefresh }) {
  const [form, setForm] = useState({
    flightRef:      "SQ321",
    departureTime:  nowPlusSeconds(3600),
    delayThreshold: "60",
    fixedPayout:    "0.5",          // realistic: ~$100
    maxPremium:     "0.05",         // passenger escrows max premium upfront
    auctionEnd:     nowPlusSeconds(120),
    expiry:         nowPlusSeconds(86400),
  });
  const [log,       setLog]       = useState({ msg: "", err: "" });
  const [policyId,  setPolicyId]  = useState(null);
  const [policy,    setPolicy]    = useState(null);
  const [lookupId,  setLookupId]  = useState("");
  const [lookupLog, setLookupLog] = useState({ msg: "", err: "" });
  const [tForm,     setTForm]     = useState({ to: "", nftId: "" });
  const [tLog,      setTLog]      = useState({ msg: "", err: "" });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  function resetTimes() {
    setForm(f => ({ ...f, departureTime: nowPlusSeconds(3600), auctionEnd: nowPlusSeconds(120), expiry: nowPlusSeconds(86400)}));
  }
  function validateForm() {
    const now  = Math.floor(Date.now() / 1000);
    const aEnd = localToTs(form.auctionEnd);
    const exp  = localToTs(form.expiry);
    const dep  = localToTs(form.departureTime);
    if (dep  <= now)  return "Departure Time must be in the future.";
    if (aEnd <= now)  return "Auction End must be in the future.";
    if (exp  <= aEnd) return "Policy Expiry must be later than Auction End.";
    if (Number(form.fixedPayout)    <= 0) return "Fixed Payout must be > 0.";
    if (Number(form.maxPremium)     <= 0) return "Max Premium must be > 0.";
    if (Number(form.delayThreshold) <= 0) return "Delay Threshold must be > 0.";
    return null;
  }

  async function createPolicy() {
    if (!contract) { setLog({ err: "Connect wallet first." }); return; }
    const ve = validateForm();
    if (ve) { setLog({ err: ve }); return; }
    setLog({ msg: "Sending transaction…" });
    try {
      const maxPremiumWei = ethers.parseEther(form.maxPremium);
      const tx = await contract.createPolicy(
        toBytes32(form.flightRef), localToTs(form.departureTime),
        Number(form.delayThreshold), ethers.parseEther(form.fixedPayout),
        localToTs(form.auctionEnd), localToTs(form.expiry),
        { value: maxPremiumWei }
      );
      setLog({ msg: "Waiting for confirmation…" });
      const rcpt = await tx.wait();
      let pid = null;
      for (const l of rcpt.logs) {
        try { const p = contract.interface.parseLog(l); if (p.name === "PolicyCreated") { pid = p.args.policyId; break; } } catch {}
      }
      const p = await contract.getPolicy(pid);
      setPolicyId(pid); setPolicy(p); setCurrentPolicy(p); setCurrentPolicyId(pid);
			setNftOwners(null);
      addTxLog({ id: Date.now(), timestamp: new Date().toLocaleTimeString(), role: "passenger", action: `Create Policy — payout ${form.fixedPayout} ETH`, valueSent: `${form.maxPremium} ETH (max premium escrowed)`, gasCost: calcGas(tx, rcpt), result: `Policy #${pid} created · BIDDING OPEN until ${tsToLocal(localToTs(form.auctionEnd))}` });
      setLog({ msg: `Policy #${pid} created!` });
      triggerBalanceRefresh();
    } catch (e) { setLog({ err: parseError(e) }); }
  }

  async function lookupPolicy() {
    if (!contract || !lookupId) { setLookupLog({ err: "Enter a Policy ID." }); return; }
    setLookupLog({ msg: "Loading…" });
    try {
      const p = await contract.getPolicy(lookupId);
      if (p.passenger === ethers.ZeroAddress) { setLookupLog({ err: `Policy #${lookupId} does not exist.` }); return; }
      const pid = BigInt(lookupId);
      setPolicyId(pid); setPolicy(p); setCurrentPolicy(p); setCurrentPolicyId(pid);
			setNftOwners(null); 
      if (p.policyNFTId > 0n) {
        setTForm(f => ({ ...f, nftId: String(p.policyNFTId) }));
        try { const po = await contract.ownerOf(p.policyNFTId); const ro = await contract.ownerOf(p.riskNFTId); setNftOwners({ policyOwner: po, riskOwner: ro }); } catch {}
      }
      setLookupLog({ msg: `Policy #${lookupId} loaded.` });
    } catch (e) { setLookupLog({ err: parseError(e) }); }
  }

  async function transferNFT() {
    if (!contract || !account) { setTLog({ err: "Connect wallet first." }); return; }
    if (!ethers.isAddress(tForm.to)) { setTLog({ err: "Invalid recipient address." }); return; }
    setTLog({ msg: "Sending transfer…" });
    try {
      const tx = await contract.transferFrom(account, tForm.to, tForm.nftId);
      const rcpt = await tx.wait();
      const recipientName = addrDisplay(tForm.to, roleAddresses);
      addTxLog({ id: Date.now(), timestamp: new Date().toLocaleTimeString(), role: "passenger", action: `Transfer Policy NFT #${tForm.nftId}`, gasCost: calcGas(tx, rcpt), result: `→ ${recipientName}. Payout will go to current NFT holder at settlement.` });
      setTLog({ msg: `NFT transferred to ${recipientName}` });
      if (policy) { try { const po = await contract.ownerOf(policy.policyNFTId); const ro = await contract.ownerOf(policy.riskNFTId); setNftOwners({ policyOwner: po, riskOwner: ro }); } catch {} }
      triggerBalanceRefresh();
    } catch (e) { setTLog({ err: parseError(e) }); }
  }

  return (
    <div>
      <AccountRoleBanner account={account} expectedRole="passenger" roleAddresses={roleAddresses} />
      <h3 style={{ color: "#4fc3f7", marginBottom: 16 }}>✈️ Passenger – Create Policy</h3>

      <div style={{ marginBottom: 20, padding: "12px 14px", background: "#1a1e2a", borderRadius: 8, border: "1px solid #2d3445" }}>
        <div style={{ color: CLR.label, fontSize: 13, marginBottom: 8 }}>🔍 Look up existing policy (use after page refresh)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" placeholder="Policy ID" value={lookupId} onChange={e => setLookupId(e.target.value)} style={{ ...inputStyle, width: 120 }} />
          <button onClick={lookupPolicy} style={btnStyle("#94a3b8", { padding: "8px 14px" })}>Load</button>
        </div>
        <Log {...lookupLog} />
      </div>

      <div style={{ marginBottom: 14, padding: "10px 14px", background: "#111318", borderRadius: 6, border: "1px solid #2d3445", fontSize: 12, color: CLR.label, lineHeight: 1.8 }}>
        ⏱ <strong style={{ color: CLR.head }}>Time rules:</strong>&nbsp;
        <span style={{ color: "#4fc3f7" }}>Departure</span> &gt; now &nbsp;·&nbsp;
        <span style={{ color: "#f59e0b" }}>Auction End</span> &gt; now &nbsp;·&nbsp;
        <span style={{ color: "#a78bfa" }}>Expiry</span> &gt; <span style={{ color: "#f59e0b" }}>Auction End</span>
      </div>

      {[
        ["Flight Ref",                                "flightRef",      "text",           "SQ321",  null],
        ["Departure Time",                             "departureTime",  "datetime-local", "",       "#4fc3f7"],
        ["Delay Threshold (min)",                      "delayThreshold", "number",         "60",     null],
        ["Fixed Payout (ETH)  e.g. 0.5 ETH ≈ $100", "fixedPayout",    "number",         "0.5",    null],
        ["Max Premium (ETH)  ← max you will pay e.g. 0.05", "maxPremium", "number",        "0.05",   "#4fc3f7"],
        ["Auction End  ← must be before Expiry",      "auctionEnd",     "datetime-local", "",       "#f59e0b"],
        ["Policy Expiry  ← must be after Auction End","expiry",         "datetime-local", "",       "#a78bfa"],
      ].map(([label, key, type, ph, accent]) => (
        <div key={key} style={{ marginBottom: 10 }}>
          <label style={{ display: "block", color: accent ?? CLR.label, fontSize: 12, marginBottom: 4 }}>{label}</label>
          <input type={type} placeholder={ph} value={form[key]} onChange={set(key)} style={inputStyle} />
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={createPolicy} style={btnStyle("#4fc3f7")}>Create Policy</button>
        <button onClick={resetTimes}   style={btnStyle("#94a3b8")}>🔄 Reset Times</button>
      </div>
      <Log {...log} />
      <PolicyCard policy={policy} policyId={policyId !== null ? String(policyId) : "—"} roleAddresses={roleAddresses} />

      {policy && policy.policyNFTId > 0n && (
        <div style={{ marginTop: 20, padding: "14px 16px", background: "#160d2a", borderRadius: 8, border: "1px solid #a78bfa55" }}>
          <h4 style={{ color: "#a78bfa", marginBottom: 8, fontSize: 14 }}>⭐ Transfer Policy NFT (Demo Highlight)</h4>
          <p style={{ color: CLR.label, fontSize: 13, marginBottom: 12, lineHeight: 1.6 }}>
            Transfer to <strong style={{ color: "#f472b6" }}>👤 Third Party</strong>. Payout goes to the <em>current holder</em> at settlement — not the original passenger.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input placeholder={`Third Party address: ${shortAddr(roleAddresses.thirdParty)}`} value={tForm.to} onChange={e => setTForm(f => ({ ...f, to: e.target.value }))} style={{ ...inputStyle, flex: 2 }} />
            <input placeholder="NFT ID" value={tForm.nftId} onChange={e => setTForm(f => ({ ...f, nftId: e.target.value }))} style={{ ...inputStyle, flex: 1 }} />
          </div>
          <button onClick={() => setTForm(f => ({ ...f, to: roleAddresses.thirdParty }))} style={{ ...btnStyle("#475569", { padding: "6px 12px", fontSize: 12 }), marginTop: 6 }}>
            Auto-fill Third Party address
          </button>
          <button onClick={transferNFT} style={{ ...btnStyle("#a78bfa"), marginTop: 8, marginLeft: 8 }}>Transfer Policy NFT</button>
          <Log {...tLog} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UNDERWRITER TAB
// ─────────────────────────────────────────────────────────────────────────────
function UnderwriterTab({ contract, roleKey, addTxLog, setCurrentPolicy, setCurrentPolicyId, setNftOwners, roleAddresses, triggerBalanceRefresh, account }) {
  const meta = ROLE_META[roleKey];
  // UW1 bids higher, UW2 bids lower → UW2 wins (realistic demo)
  const [policyId, setPolicyId] = useState("");
  const [premium,  setPremium]  = useState(roleKey === "underwriter1" ? "0.02" : "0.01"); // ← realistic
  const [policy,   setPolicy]   = useState(null);
  const [bidLog,   setBidLog]   = useState({ msg: "", err: "" });
  const [finalLog, setFinalLog] = useState({ msg: "", err: "" });

  const ds = derivedStatus(policy);
	const canBid = ds === "BIDDING_OPEN";

	// Only the winning underwriter (bestUnderwriter) can finalize
	const isWinner = policy?.bestUnderwriter?.toLowerCase() === account?.toLowerCase();
	const canFinalize = ds === "BIDDING_ENDED" && isWinner;
	const notWinnerMsg = ds === "BIDDING_ENDED" && !isWinner
		? `Only the winner (${addrDisplay(policy?.bestUnderwriter, roleAddresses)}) can finalize`
		: null;

  async function loadPolicy() {
    if (!contract || !policyId) return;
    try {
      const p = await contract.getPolicy(policyId);
      setPolicy(p); setCurrentPolicy(p); setCurrentPolicyId(BigInt(policyId));
			setNftOwners(null); 
    } catch (e) { setBidLog({ err: parseError(e) }); }
  }

  async function placeBid() {
    if (!contract) { setBidLog({ err: "Connect wallet first." }); return; }
    if (!canBid) { setBidLog({ err: "Auction is not open — bidding is disabled." }); return; }
    setBidLog({ msg: "Sending bid…" });
    try {
      const tx = await contract.bidPremium(policyId, ethers.parseEther(premium));
      const rcpt = await tx.wait();
      addTxLog({ id: Date.now(), timestamp: new Date().toLocaleTimeString(), role: roleKey, action: `Bid ${premium} ETH premium on Policy #${policyId}`, gasCost: calcGas(tx, rcpt), result: `Competing to be the lowest bidder` });
      setBidLog({ msg: `Bid placed: ${premium} ETH` });
      await loadPolicy();
      triggerBalanceRefresh();
    } catch (e) { setBidLog({ err: parseError(e) }); }
  }

  async function finalize() {
    if (!contract || !policy) { setFinalLog({ err: "Load policy first." }); return; }
    if (!canFinalize) { setFinalLog({ err: ds === "BIDDING_OPEN" ? "Auction still open — wait until Auction End time passes." : "Policy is not in a finalizable state." }); return; }
    setFinalLog({ msg: "Locking collateral…" });
    try {
      const tx = await contract.finalizeAuction(policyId, { value: policy.fixedPayout });
      const rcpt = await tx.wait();
      const collateral = fmtEth(policy.fixedPayout);
      // Parse premium earned and refund from AuctionFinalized event
      let premiumEarned = policy.bestPremium;
      let refundAmt = policy.maxPremium - policy.bestPremium;
      for (const l of rcpt.logs) {
        try { const ev = contract.interface.parseLog(l); if (ev.name === "AuctionFinalized") { premiumEarned = ev.args.premiumPaid; refundAmt = ev.args.refundToPassenger; } } catch {}
      }
      addTxLog({ id: Date.now(), timestamp: new Date().toLocaleTimeString(), role: roleKey, action: `Finalize Auction — lock collateral`, valueSent: collateral, valueReceived: `${fmtEth(premiumEarned)} premium earned`, gasCost: calcGas(tx, rcpt), result: `Policy → ACTIVE · Passenger refunded ${fmtEth(refundAmt)} · Policy NFT → Passenger · Risk NFT → ${meta.label}` });
      setFinalLog({ msg: `Finalized! ${collateral} locked. You earned ${fmtEth(premiumEarned)} premium. Passenger refunded ${fmtEth(refundAmt)}.` });
      await loadPolicy();
      const p2 = await contract.getPolicy(policyId);
      if (p2.policyNFTId > 0n) {
        const po = await contract.ownerOf(p2.policyNFTId);
        const ro = await contract.ownerOf(p2.riskNFTId);
        setNftOwners({ policyOwner: po, riskOwner: ro });
      }
      triggerBalanceRefresh();
    } catch (e) { setFinalLog({ err: parseError(e) }); }
  }

  const currentBest = policy && policy.bestPremium !== ethers.MaxUint256 ? fmtEth(policy.bestPremium) : "no bids yet";

  return (
    <div>
      <AccountRoleBanner account={account} expectedRole={roleKey} roleAddresses={roleAddresses} />
      <h3 style={{ color: meta.color, marginBottom: 4 }}>{meta.label} – Bid & Lock Collateral</h3>
      <p style={{ color: CLR.label, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
        {roleKey === "underwriter1"
          ? "Place a premium bid. Underwriter 2 will outbid you with a lower offer."
          : "Outbid Underwriter 1 with a lower premium to win the policy."}
      </p>

      <div style={{ marginBottom: 16, padding: "10px 14px", background: "#111318", borderRadius: 6, border: "1px solid #2d3445", fontSize: 12, color: CLR.label, lineHeight: 1.7 }}>
        📋 <strong style={{ color: CLR.head }}>Workflow:</strong><br/>
        <span style={{ color: "#f59e0b" }}>① Bid</span> while auction is OPEN &nbsp;·&nbsp;
        <span style={{ color: "#34d399" }}>② Finalize</span> after Auction End time passes<br/>
        Only the <strong style={{ color: CLR.value }}>winning bidder</strong> (lowest premium) can finalize.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input type="number" placeholder="Policy ID" value={policyId} onChange={e => setPolicyId(e.target.value)} style={{ ...inputStyle, width: 120 }} />
        <button onClick={loadPolicy} style={btnStyle("#94a3b8", { padding: "8px 14px" })}>Load</button>
      </div>

      <PolicyCard policy={policy} policyId={policyId} roleAddresses={roleAddresses} />

      {policy && (
        <>
          <div style={{ marginTop: 16 }}>
            <label style={{ display: "block", color: CLR.label, fontSize: 13, marginBottom: 6 }}>
              Your Premium Bid (ETH) — current best: <strong style={{ color: CLR.value }}>{currentBest}</strong>
            </label>
            <input type="number" step="0.001" value={premium} onChange={e => setPremium(e.target.value)} disabled={!canBid} style={{ ...inputStyle, width: 180, opacity: canBid ? 1 : 0.4 }} />
            <p style={{ fontSize: 12, color: CLR.label, marginTop: 5, lineHeight: 1.6 }}>
              Must be lower than current best to win.<br/>
              If you win, you lock <strong style={{ color: CLR.value }}>{fmtEth(policy.fixedPayout)}</strong> as collateral.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {canBid
              ? <button onClick={placeBid} style={btnStyle(meta.color)}>Place Bid</button>
              : <button disabled style={disabledBtnStyle}>Bid — {ds === "BIDDING_ENDED" ? "Auction ended" : "N/A"}</button>
            }
						{canFinalize
							? <button onClick={finalize} style={btnStyle("#f59e0b")}>Finalize Auction (lock {fmtEth(policy.fixedPayout)})</button>
							: <button disabled style={disabledBtnStyle}>
									{notWinnerMsg ?? (ds === "BIDDING_OPEN" ? "Finalize — Wait for auction end" : "Finalize — N/A")}
								</button>
						}
          </div>
          <Log {...bidLog} />
          <Log {...finalLog} />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVER TAB
// ─────────────────────────────────────────────────────────────────────────────
function ResolverTab({ contract, addTxLog, setCurrentPolicy, setCurrentPolicyId, setNftOwners, roleAddresses, triggerBalanceRefresh, account }) {
  const [policyId,  setPolicyId]  = useState("");
  const [delayMins, setDelayMins] = useState("120");
  const [policy,    setPolicy]    = useState(null);
  const [log,       setLog]       = useState({ msg: "", err: "" });

  const ds = derivedStatus(policy);
  const canResolve = ds === "ACTIVE";

  async function loadPolicy() {
    if (!contract || !policyId) return;
    try {
      const p = await contract.getPolicy(policyId);
      setPolicy(p); setCurrentPolicy(p); setCurrentPolicyId(BigInt(policyId));
			setNftOwners(null);
    } catch (e) { setLog({ err: parseError(e) }); }
  }

  async function resolve() {
    if (!contract) { setLog({ err: "Connect wallet first." }); return; }
    if (!canResolve) { setLog({ err: `Cannot resolve — status is ${ds}. Policy must be ACTIVE.` }); return; }
    setLog({ msg: "Submitting delay data…" });
    try {
      const tx = await contract.resolvePolicy(policyId, Number(delayMins));
      const rcpt = await tx.wait();
      const delayed = Number(delayMins) >= Number(policy?.delayThreshold ?? 0);
      const payout  = fmtEth(policy?.fixedPayout ?? 0n);
      const outcome = delayed
        ? `PAID — ${payout} sent to Policy NFT holder`
        : `EXPIRED — ${payout} returned to Risk NFT holder`;
      addTxLog({
        id: Date.now(), timestamp: new Date().toLocaleTimeString(),
        role: "resolver", action: `Resolve Policy #${policyId} (delay: ${delayMins} min)`,
        valueReceived: delayed ? `${payout} → Policy NFT holder` : `${payout} → Risk NFT holder`,
        gasCost: calcGas(tx, rcpt), result: outcome,
      });
      setLog({ msg: outcome });
      await loadPolicy();
      if (policy) { try { const po = await contract.ownerOf(policy.policyNFTId); const ro = await contract.ownerOf(policy.riskNFTId); setNftOwners({ policyOwner: po, riskOwner: ro }); } catch {} }
      triggerBalanceRefresh();
    } catch (e) { setLog({ err: parseError(e) }); }
  }

  return (
    <div>
      <AccountRoleBanner account={account} expectedRole="resolver" roleAddresses={roleAddresses} />
      <h3 style={{ color: "#f59e0b", marginBottom: 8 }}>🔮 Resolver – Submit Delay Data</h3>
      <p style={{ color: CLR.label, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
        Only the <code style={{ color: "#94a3b8" }}>resolver</code> address (the deployer wallet) can call this.
        Policy must be <strong style={{ color: "#3b82f6" }}>ACTIVE</strong>.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input type="number" placeholder="Policy ID" value={policyId} onChange={e => setPolicyId(e.target.value)} style={{ ...inputStyle, width: 120 }} />
        <button onClick={loadPolicy} style={btnStyle("#94a3b8", { padding: "8px 14px" })}>Load</button>
      </div>
      <PolicyCard policy={policy} policyId={policyId} roleAddresses={roleAddresses} />
      {policy && (
        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block", color: CLR.label, fontSize: 13, marginBottom: 6 }}>
            Actual Delay (minutes) — threshold: <strong style={{ color: CLR.value }}>{String(policy.delayThreshold)} min</strong>
          </label>
          <input type="number" value={delayMins} onChange={e => setDelayMins(e.target.value)} disabled={!canResolve} style={{ ...inputStyle, width: 180, opacity: canResolve ? 1 : 0.4 }} />
          <div style={{ marginTop: 6, fontSize: 12, color: CLR.label }}>
            ≥ {String(policy.delayThreshold)} min → <span style={{ color: "#22c55e", fontWeight: 700 }}>PAID</span> &nbsp;|&nbsp;
            &lt; {String(policy.delayThreshold)} min → <span style={{ color: "#6b7280", fontWeight: 700 }}>EXPIRED</span>
          </div>
          <div style={{ marginTop: 12 }}>
            {canResolve
              ? <button onClick={resolve} style={btnStyle("#f59e0b")}>Resolve Policy</button>
              : <button disabled style={disabledBtnStyle}>Resolve — Policy must be ACTIVE</button>
            }
          </div>
          <Log {...log} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,      setTab]      = useState("passenger");
  const [account,  setAccount]  = useState(null);
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [connLog,  setConnLog]  = useState("");
  const [network,  setNetwork]  = useState("");

  const [roleAddresses,   setRoleAddresses]   = useState(HARDHAT_DEFAULTS);
  const [currentPolicy,   setCurrentPolicy]   = useState(null);
  const [currentPolicyId, setCurrentPolicyId] = useState(null);
  const [nftOwners,       setNftOwners]       = useState(null);
  const [txLog,           setTxLog]           = useState([]);
  const [balances,        setBalances]        = useState({});
  const [balanceTick,     setBalanceTick]     = useState(0);

  function addTxLog(entry) { setTxLog(prev => [entry, ...prev].slice(0, 40)); }
  function triggerBalanceRefresh() { setBalanceTick(t => t + 1); }

  const refreshBalances = useCallback(async () => {
    if (!provider) return;
    const nb = {};
    for (const [role, addr] of Object.entries(roleAddresses)) {
      if (addr && ethers.isAddress(addr)) {
        try { nb[role] = await provider.getBalance(addr); } catch {}
      }
    }
    setBalances(nb);
  }, [provider, roleAddresses]);

  useEffect(() => { refreshBalances(); }, [refreshBalances, balanceTick]);
  useEffect(() => {
    const id = setInterval(refreshBalances, 6000);
    return () => clearInterval(id);
  }, [refreshBalances]);

// listing MetaMask account switch
	useEffect(() => {
		if (!window.ethereum) return;
		const handler = async (accounts) => {
			if (!accounts[0]) { setAccount(null); setContract(null); return; }
			setAccount(accounts[0]);
			try {
				const prov2  = new ethers.BrowserProvider(window.ethereum);
				const signer = await prov2.getSigner();
				setContract(new ethers.Contract(CONTRACT_ADDRESS, ABI, signer));
				setBalanceTick(t => t + 1);
			} catch {}
		};
		window.ethereum.on("accountsChanged", handler);
		return () => window.ethereum.removeListener("accountsChanged", handler);
	}, []);

  useEffect(() => {
    if (!contract || !currentPolicyId) return;
    const refresh = async () => {
      try {
        const p = await contract.getPolicy(currentPolicyId);
        setCurrentPolicy(p);
        if (p.policyNFTId > 0n) {
          const po = await contract.ownerOf(p.policyNFTId);
          const ro = await contract.ownerOf(p.riskNFTId);
          setNftOwners({ policyOwner: po, riskOwner: ro });
        }
      } catch {}
    };
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [contract, currentPolicyId]);

  async function connectWallet() {
    if (!window.ethereum) { setConnLog("MetaMask not found – please install it."); return; }
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      try {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a69" }] });
      } catch (se) {
        if (se.code === 4902) {
          await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x7a69", chainName: "Hardhat Local", rpcUrls: ["http://127.0.0.1:8545"], nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 } }] });
        }
      }
      const prov   = new ethers.BrowserProvider(window.ethereum);
      const net    = await prov.getNetwork();
      const signer = await prov.getSigner();
      const addr   = await signer.getAddress();
      const code   = await prov.getCode(CONTRACT_ADDRESS);
      if (code === "0x") { setConnLog("⚠️  Contract not found at configured address. Did you deploy and update config.js?"); return; }
      const ctr = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      setAccount(addr); setContract(ctr); setProvider(prov);
      setNetwork(net.name + " (" + net.chainId + ")");
      setConnLog("");
	  window.ethereum.on("accountsChanged", async (accounts) => {
		if (!accounts[0]) { setAccount(null); setContract(null); return; }
		setAccount(accounts[0]);
		try {
		  const newSigner = await prov.getSigner();
		  setContract(new ethers.Contract(CONTRACT_ADDRESS, ABI, newSigner));
		} catch {}
	  });
    } catch (e) { setConnLog(parseError(e)); }
  }

  // Current role label for header
  const connectedRoleKey = addrToRoleKey(account, roleAddresses);
  const connectedMeta    = connectedRoleKey ? ROLE_META[connectedRoleKey] : null;

  const sharedProps = { contract, addTxLog, setCurrentPolicy, setCurrentPolicyId, setNftOwners, roleAddresses, triggerBalanceRefresh, account };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0c10", color: "#e2e8f0", fontFamily: "'Segoe UI', sans-serif" }}>

      {/* HEADER */}
      <div style={{ borderBottom: "1px solid #1e2330", padding: "0 24px", height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#0a0c10", zIndex: 100 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: -1, margin: 0 }}>
            Sky<span style={{ color: "#4fc3f7" }}>Hedge</span>
          </h1>
          <p style={{ fontSize: 11, color: CLR.dim, margin: 0, fontFamily: "monospace" }}>Parametric Flight-Delay Insurance · FT5004 Group 5</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {network && <span style={{ fontSize: 11, color: "#34d399", fontFamily: "monospace", background: "#14532d22", border: "1px solid #22c55e44", borderRadius: 4, padding: "3px 8px" }}>{network}</span>}
          {/* Show current role */}
          {connectedMeta && (
            <span style={{ fontSize: 12, fontFamily: "monospace", background: connectedMeta.color + "22", border: `1px solid ${connectedMeta.color}55`, borderRadius: 4, padding: "4px 10px", color: connectedMeta.color, fontWeight: 600 }}>
              {connectedMeta.label}
            </span>
          )}
          <button onClick={connectWallet} style={btnStyle(account ? "#34d399" : "#4fc3f7", { padding: "8px 20px" })}>
            {account ? `🔌 Switch Account (${shortAddr(account)})` : "Connect Wallet"}
          </button>
        </div>
      </div>

      {connLog && <div style={{ margin: "10px 24px 0", padding: "10px 14px", background: "#7c2d1222", border: "1px solid #ef444444", borderRadius: 6, color: "#fca5a5", fontSize: 13, fontFamily: "monospace" }}>⚠️ {connLog}</div>}

      {/* BODY */}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {/* LEFT */}
        <div style={{ flex: "1", minWidth: 0 }}>
          <div style={{ display: "flex", gap: 2, padding: "0 16px", borderBottom: "1px solid #1e2330" }}>
            {TABS.map(t => {
              const color  = ROLE_META[t.key]?.color ?? "#94a3b8";
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  background: active ? color + "22" : "transparent",
                  border: active ? `1px solid ${color}55` : "1px solid transparent",
                  borderBottom: active ? `2px solid ${color}` : "2px solid transparent",
                  borderRadius: "6px 6px 0 0", color: active ? color : CLR.dim,
                  padding: "10px 14px", fontSize: 13, cursor: "pointer", fontWeight: active ? 700 : 400,
                }}>{t.label}</button>
              );
            })}
          </div>
          <div style={{ padding: "20px 16px" }}>
            {!account && <div style={{ textAlign: "center", color: CLR.dim, padding: "80px 0", fontSize: 14 }}>👆 Connect your wallet to get started</div>}
            {account && tab === "passenger"    && <PassengerTab   {...sharedProps} />}
            {account && tab === "underwriter1" && <UnderwriterTab {...sharedProps} roleKey="underwriter1" />}
            {account && tab === "underwriter2" && <UnderwriterTab {...sharedProps} roleKey="underwriter2" />}
            {account && tab === "resolver"     && <ResolverTab    {...sharedProps} />}
          </div>
        </div>

        {/* RIGHT */}
        <RightPanel
          provider={provider} account={account}
          roleAddresses={roleAddresses} setRoleAddresses={setRoleAddresses}
          currentPolicy={currentPolicy} currentPolicyId={currentPolicyId}
          nftOwners={nftOwners} txLog={txLog}
          refreshBalances={refreshBalances} balances={balances}
        />
      </div>
    </div>
  );
}
