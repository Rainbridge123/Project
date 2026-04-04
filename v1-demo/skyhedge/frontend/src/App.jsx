import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI, STATUS } from "./config";

// ─────────────────────────────────────────────────────────────────────────────
// ✈️ 乘客专属 Dashboard：蓝色科技感
// ─────────────────────────────────────────────────────────────────────────────
function PassengerView({ sharedProps }) {
  return (
    <div style={{ padding: "30px", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", borderRadius: "24px", border: "1px solid #4fc3f733", minHeight: "600px" }}>
      <h2 style={{ color: "#4fc3f7", fontSize: "28px", marginBottom: "20px" }}>✈️ Passenger Portal</h2>
      <div style={{ background: "#ffffff05", padding: "20px", borderRadius: "16px" }}>
        <PassengerTab {...sharedProps} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🏦 保险商专属 Dashboard：暗黑金融风
// ─────────────────────────────────────────────────────────────────────────────
function UnderwriterView({ sharedProps, roleKey }) {
  return (
    <div style={{ padding: "30px", background: "#0d0f14", border: "2px solid #34d399", borderRadius: "12px", boxShadow: "0 0 20px #34d39922" }}>
      <h2 style={{ color: "#34d399", fontFamily: "monospace", textTransform: "uppercase" }}>🏦 Underwriter Terminal</h2>
      <p style={{ color: "#34d399", fontSize: "12px", marginBottom: "20px" }}>[SECURE CONNECTION ACTIVE]</p>
      <UnderwriterTab {...sharedProps} roleKey={roleKey} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔮 预言机专属 Dashboard：金色权威感
// ─────────────────────────────────────────────────────────────────────────────
function ResolverView({ sharedProps }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
      <div style={{ maxWidth: "600px", width: "100%", background: "#1a1a1a", border: "3px solid #f59e0b", borderRadius: "50px", padding: "40px", textAlign: "center" }}>
        <h2 style={{ color: "#f59e0b", fontSize: "32px", marginBottom: "20px" }}>🔮 Oracle Node</h2>
        <ResolverTab {...sharedProps} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers (保持原样)
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

function toBytes32(str) { return ethers.encodeBytes32String(str.slice(0, 31)); }
function fromBytes32(hex) { try { return ethers.decodeBytes32String(hex); } catch { return hex; } }
function shortAddr(addr) { return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "—"; }
function fmtEth(wei) {
  if (wei === undefined || wei === null) return "—";
  const n = parseFloat(ethers.formatEther(wei));
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

const inputStyle = { background: "#111318", border: "1px solid #2d3445", borderRadius: 6, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, fontFamily: "monospace", width: "100%", outline: "none" };
const btnStyle = (color, extra = {}) => ({ background: color + "22", border: `1px solid ${color}55`, borderRadius: 6, color, padding: "8px 18px", fontSize: 13, fontFamily: "monospace", cursor: "pointer", fontWeight: 600, ...extra });
const disabledBtnStyle = { background: "#1a1e2a", border: "1px solid #3d4455", borderRadius: 6, color: "#94a3b8", padding: "8px 18px", fontSize: 13, fontFamily: "monospace", cursor: "not-allowed", fontWeight: 600 };
const CLR = { label: "#cbd5e1", value: "#f1f5f9", dim: "#94a3b8", head: "#f1f5f9" };

function DerivedStatusBadge({ ds }) {
  const m = DERIVED_META[ds] ?? DERIVED_META.UNKNOWN;
  return <span style={{ background: m.color + "22", color: m.color, border: `1px solid ${m.color}55`, borderRadius: 4, padding: "3px 10px", fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>{m.label}</span>;
}

function AccountRoleBanner({ account, expectedRole, roleAddresses }) {
  if (!account) return null;
  const currentRole = addrToRoleKey(account, roleAddresses);
  const isCorrect = currentRole === expectedRole;
  const expected = ROLE_META[expectedRole];
  const current = currentRole ? ROLE_META[currentRole] : null;
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
      <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginBottom: 4 }}>⚠️ Wrong account in MetaMask</div>
      <div style={{ fontSize: 13, color: CLR.label }}>This tab needs <strong style={{ color: expected?.color }}>{expected?.label}</strong>, but MetaMask is <strong style={{ color: current?.color ?? "#94a3b8" }}>{current?.label ?? shortAddr(account)}</strong>.</div>
    </div>
  );
}

function Log({ msg, err }) {
  if (!msg && !err) return null;
  return <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 6, background: err ? "#7f1d1d33" : "#14532d33", border: `1px solid ${err ? "#ef4444" : "#22c55e"}55`, color: err ? "#fca5a5" : "#86efac", fontSize: 13, fontFamily: "monospace" }}>{err ? "❌ " : "✅ "}{msg || err}</div>;
}

function PolicyCard({ policy, policyId, roleAddresses }) {
  if (!policy || policy.passenger === ethers.ZeroAddress) return null;
  const ds = derivedStatus(policy);
  const dm = DERIVED_META[ds];
  const rows = [["Flight", fromBytes32(policy.flightRef)], ["Fixed Payout", fmtEth(policy.fixedPayout)], ["Threshold", `${policy.delayThreshold} min`], ["Auction Ends", tsToLocal(policy.auctionEnd)], ["Max Premium", fmtEth(policy.maxPremium)], ["Best Premium", (!policy.maxPremium || policy.bestPremium === policy.maxPremium) ? "(no bids yet)" : fmtEth(policy.bestPremium)], ["Best UW", addrDisplay(policy.bestUnderwriter, roleAddresses)], ["Policy NFT ID", policy.policyNFTId > 0n ? String(policy.policyNFTId) : "(not minted)"], ["Risk NFT ID", policy.riskNFTId > 0n ? String(policy.riskNFTId) : "(not minted)"]];
  return (
    <div style={{ background: "#1a1e2a", border: `1px solid ${dm.color}44`, borderRadius: 8, padding: "14px 18px", marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ color: CLR.head, fontSize: 13, fontFamily: "monospace", fontWeight: 600 }}>Policy #{policyId}</span>
        <DerivedStatusBadge ds={ds} />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>{rows.map(([k, v]) => (<tr key={k}><td style={{ color: CLR.label, paddingRight: 12, paddingBottom: 5, whiteSpace: "nowrap" }}>{k}</td><td style={{ color: CLR.value, fontFamily: "monospace", paddingBottom: 5 }}>{v}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

function UnderwriterPolicyList({ policies, selectedPolicyId, onSelect, roleAddresses, isLoading, onRefresh }) {
  return (
    <div style={{ marginBottom: 16, padding: "14px 16px", background: "#111318", borderRadius: 8, border: "1px solid #2d3445" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ color: "#34d399", fontSize: 13, fontWeight: 700, fontFamily: "monospace", textTransform: "uppercase" }}>Available Policies</div>
          <div style={{ color: CLR.dim, fontSize: 12 }}>Underwriter can click any policy below to load it directly.</div>
        </div>
        <button onClick={onRefresh} style={btnStyle("#34d399")} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {!policies.length ? (
        <div style={{ color: CLR.dim, fontSize: 13, padding: "10px 0" }}>
          {isLoading ? "Loading policies from chain..." : "No policies found yet."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {policies.map(({ id, policy }) => {
            const ds = derivedStatus(policy);
            const isSelected = String(selectedPolicyId) === String(id);
            const bestPremium = (!policy.maxPremium || policy.bestPremium === policy.maxPremium) ? "(no bids yet)" : fmtEth(policy.bestPremium);
            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                style={{
                  background: isSelected ? "#34d39918" : "#0d0f14",
                  border: `1px solid ${isSelected ? "#34d39988" : "#253041"}`,
                  borderRadius: 8,
                  padding: "12px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span style={{ color: "#f8fafc", fontSize: 13, fontFamily: "monospace", fontWeight: 700 }}>Policy #{id}</span>
                  <DerivedStatusBadge ds={ds} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: CLR.dim }}>Flight:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fromBytes32(policy.flightRef)}</span></div>
                  <div><span style={{ color: CLR.dim }}>Passenger:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{shortAddr(policy.passenger)}</span></div>
                  <div><span style={{ color: CLR.dim }}>Best Premium:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{bestPremium}</span></div>
                  <div><span style={{ color: CLR.dim }}>Best UW:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{addrDisplay(policy.bestUnderwriter, roleAddresses)}</span></div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Tabs (PassengerTab, UnderwriterTab, ResolverTab - 逻辑保持原样)
// ─────────────────────────────────────────────────────────────────────────────
function PassengerTab({ contract, account, addTxLog, setCurrentPolicy, setCurrentPolicyId, setNftOwners, roleAddresses, triggerBalanceRefresh }) {
  const [form, setForm] = useState({ flightRef: "SQ321", departureTime: nowPlusSeconds(3600), delayThreshold: "60", fixedPayout: "0.5", maxPremium: "0.05", auctionEnd: nowPlusSeconds(120), expiry: nowPlusSeconds(86400) });
  const [log, setLog] = useState({ msg: "", err: "" });
  const [policyId, setPolicyId] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupLog, setLookupLog] = useState({ msg: "", err: "" });
  const [tForm, setTForm] = useState({ to: "", nftId: "" });
  const [tLog, setTLog] = useState({ msg: "", err: "" });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const passengerFields = [
    { key: "flightRef", label: "Flight Ref", type: "text" },
    { key: "departureTime", label: "Departure Time", type: "datetime-local" },
    { key: "delayThreshold", label: "Delay Threshold", type: "text" },
    { key: "fixedPayout", label: "Fixed Payout", type: "text" },
    { key: "maxPremium", label: "Max Premium", type: "text" },
    { key: "auctionEnd", label: "Auction End", type: "datetime-local" },
    { key: "expiry", label: "Expiry", type: "datetime-local" },
  ];

  async function createPolicy() {
    if (!contract) { setLog({ err: "Connect wallet first." }); return; }
    const now = Math.floor(Date.now() / 1000);
    const departureTs = localToTs(form.departureTime);
    const auctionEndTs = localToTs(form.auctionEnd);
    const expiryTs = localToTs(form.expiry);
    if (!form.flightRef?.trim()) { setLog({ err: "Flight Ref is required." }); return; }
    if (![departureTs, auctionEndTs, expiryTs].every(Number.isFinite)) { setLog({ err: "Please enter valid date and time values." }); return; }
    if (auctionEndTs <= now) { setLog({ err: "Auction End must be in the future." }); return; }
    if (departureTs <= now) { setLog({ err: "Departure Time must be in the future." }); return; }
    if (expiryTs <= auctionEndTs) { setLog({ err: "Expiry must be after Auction End." }); return; }
    setLog({ msg: "Sending transaction…" });
    try {
      const tx = await contract.createPolicy(toBytes32(form.flightRef), departureTs, Number(form.delayThreshold), ethers.parseEther(form.fixedPayout), auctionEndTs, expiryTs, { value: ethers.parseEther(form.maxPremium) });
      const rcpt = await tx.wait();
      let pid = null;
      for (const l of rcpt.logs) { try { const p = contract.interface.parseLog(l); if (p.name === "PolicyCreated") { pid = p.args.policyId; break; } } catch {} }
      const p = await contract.getPolicy(pid);
      setPolicyId(pid); setPolicy(p); setCurrentPolicy(p); setCurrentPolicyId(pid); setLog({ msg: `Policy #${pid} created!` }); triggerBalanceRefresh();
    } catch (e) { setLog({ err: parseError(e) }); }
  }

  async function lookupPolicy() {
    if (!contract || !lookupId) return;
    try {
      const p = await contract.getPolicy(lookupId);
      setPolicyId(BigInt(lookupId)); setPolicy(p); setCurrentPolicy(p); setCurrentPolicyId(BigInt(lookupId));
    } catch (e) { setLookupLog({ err: parseError(e) }); }
  }

  async function transferNFT() {
    try {
      const tx = await contract.transferFrom(account, tForm.to, tForm.nftId);
      await tx.wait(); setTLog({ msg: "Transferred successfully!" }); triggerBalanceRefresh();
    } catch (e) { setTLog({ err: parseError(e) }); }
  }

  return (
    <div>
      <AccountRoleBanner account={account} expectedRole="passenger" roleAddresses={roleAddresses} />
      <div style={{ marginBottom: 20, padding: "12px 14px", background: "#1a1e2a", borderRadius: 8, border: "1px solid #2d3445" }}>
        <div style={{ display: "flex", gap: 8 }}><input type="number" placeholder="Policy ID" value={lookupId} onChange={e => setLookupId(e.target.value)} style={{ ...inputStyle, width: 120 }} /><button onClick={lookupPolicy} style={btnStyle("#94a3b8")}>Load</button></div>
      </div>
      {passengerFields.map(({ key, label, type }) => (
        <div key={key} style={{ marginBottom: 10 }}><label style={{ display: "block", color: CLR.label, fontSize: 12 }}>{label}</label><input type={type} value={form[key]} onChange={set(key)} style={inputStyle} /></div>
      ))}
      <button onClick={createPolicy} style={btnStyle("#4fc3f7")}>Create Policy</button><Log {...log} />
      <PolicyCard policy={policy} policyId={policyId ? String(policyId) : "—"} roleAddresses={roleAddresses} />
      {policy?.policyNFTId > 0n && (
        <div style={{ marginTop: 20, padding: "15px", background: "#160d2a", borderRadius: 10 }}><input placeholder="Recipient Address" value={tForm.to} onChange={e => setTForm(f => ({ ...f, to: e.target.value }))} style={inputStyle} /><input placeholder="NFT ID" value={tForm.nftId} onChange={e => setTForm(f => ({ ...f, nftId: e.target.value }))} style={{ ...inputStyle, marginTop: 10 }} /><button onClick={transferNFT} style={{ ...btnStyle("#a78bfa"), marginTop: 10 }}>Transfer NFT</button><Log {...tLog} /></div>
      )}
    </div>
  );
}

function UnderwriterTab({ contract, roleKey, addTxLog, setCurrentPolicy, setCurrentPolicyId, setNftOwners, roleAddresses, triggerBalanceRefresh, account }) {
  const [policyId, setPolicyId] = useState("");
  const [premium, setPremium] = useState("0.01");
  const [policy, setPolicy] = useState(null);
  const [policyList, setPolicyList] = useState([]);
  const [isPolicyListLoading, setIsPolicyListLoading] = useState(false);
  const [log, setLog] = useState({ msg: "", err: "" });
  const ds = derivedStatus(policy);
  const canBid = ds === "BIDDING_OPEN";
  const canFinalize = ds === "BIDDING_ENDED" && policy?.bestUnderwriter?.toLowerCase() === account?.toLowerCase();

  async function fetchPolicies() {
    if (!contract) {
      setPolicyList([]);
      return;
    }
    setIsPolicyListLoading(true);
    try {
      const count = Number(await contract.policyCount());
      const loaded = await Promise.all(
        Array.from({ length: count }, async (_, index) => {
          const id = index + 1;
          const item = await contract.getPolicy(id);
          return { id, policy: item };
        })
      );
      setPolicyList(loaded.filter(({ policy }) => policy.passenger !== ethers.ZeroAddress));
    } catch (e) {
      setLog({ err: parseError(e) });
    } finally {
      setIsPolicyListLoading(false);
    }
  }

  useEffect(() => {
    fetchPolicies();
  }, [contract]);

  async function loadPolicy(targetPolicyId = policyId) {
    if (!contract || !targetPolicyId) return;
    try {
      const normalizedId = String(targetPolicyId);
      const p = await contract.getPolicy(normalizedId);
      setPolicyId(normalizedId);
      setPolicy(p); setCurrentPolicy(p); setCurrentPolicyId(BigInt(normalizedId));
    } catch (e) { setLog({ err: parseError(e) }); }
  }
  async function placeBid() {
    try {
      const tx = await contract.bidPremium(policyId, ethers.parseEther(premium));
      await tx.wait(); setLog({ msg: "Bid placed!" }); loadPolicy(); fetchPolicies(); triggerBalanceRefresh();
    } catch (e) { setLog({ err: parseError(e) }); }
  }
  async function finalize() {
    try {
      const tx = await contract.finalizeAuction(policyId, { value: policy.fixedPayout });
      await tx.wait(); setLog({ msg: "Finalized!" }); loadPolicy(); fetchPolicies(); triggerBalanceRefresh();
    } catch (e) { setLog({ err: parseError(e) }); }
  }

  return (
    <div>
      <AccountRoleBanner account={account} expectedRole={roleKey} roleAddresses={roleAddresses} />
      <UnderwriterPolicyList
        policies={policyList}
        selectedPolicyId={policyId}
        onSelect={loadPolicy}
        roleAddresses={roleAddresses}
        isLoading={isPolicyListLoading}
        onRefresh={fetchPolicies}
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 15 }}><input type="number" placeholder="Policy ID" value={policyId} onChange={e => setPolicyId(e.target.value)} style={inputStyle} /><button onClick={loadPolicy} style={btnStyle("#94a3b8")}>Load</button></div>
      <PolicyCard policy={policy} policyId={policyId} roleAddresses={roleAddresses} />
      {policy && (
        <div style={{ marginTop: 15 }}>
          <input type="number" value={premium} onChange={e => setPremium(e.target.value)} style={inputStyle} />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={placeBid} disabled={!canBid} style={canBid ? btnStyle("#34d399") : disabledBtnStyle}>Bid</button>
            <button onClick={finalize} disabled={!canFinalize} style={canFinalize ? btnStyle("#f59e0b") : disabledBtnStyle}>Finalize</button>
          </div>
          <Log {...log} />
        </div>
      )}
    </div>
  );
}

function ResolverTab({ contract, addTxLog, setCurrentPolicy, setCurrentPolicyId, setNftOwners, roleAddresses, triggerBalanceRefresh, account }) {
  const [policyId, setPolicyId] = useState("");
  const [delayMins, setDelayMins] = useState("120");
  const [policy, setPolicy] = useState(null);
  const [log, setLog] = useState({ msg: "", err: "" });
  const canResolve = derivedStatus(policy) === "ACTIVE";

  async function loadPolicy() {
    try {
      const p = await contract.getPolicy(policyId);
      setPolicy(p); setCurrentPolicy(p); setCurrentPolicyId(BigInt(policyId));
    } catch (e) { setLog({ err: parseError(e) }); }
  }
  async function resolve() {
    try {
      const tx = await contract.resolvePolicy(policyId, Number(delayMins));
      await tx.wait(); setLog({ msg: "Resolved!" }); loadPolicy(); triggerBalanceRefresh();
    } catch (e) { setLog({ err: parseError(e) }); }
  }

  return (
    <div>
      <AccountRoleBanner account={account} expectedRole="resolver" roleAddresses={roleAddresses} />
      <div style={{ display: "flex", gap: 8, marginBottom: 15 }}><input type="number" placeholder="Policy ID" value={policyId} onChange={e => setPolicyId(e.target.value)} style={inputStyle} /><button onClick={loadPolicy} style={btnStyle("#94a3b8")}>Load</button></div>
      <PolicyCard policy={policy} policyId={policyId} roleAddresses={roleAddresses} />
      {policy && (
        <div style={{ marginTop: 15 }}>
          <input type="number" value={delayMins} onChange={e => setDelayMins(e.target.value)} style={inputStyle} />
          <button onClick={resolve} disabled={!canResolve} style={canResolve ? btnStyle("#f59e0b") : disabledBtnStyle} >Resolve</button>
          <Log {...log} />
        </div>
      )}
    </div>
  );
}

function RightPanel({ provider, roleAddresses, setRoleAddresses, currentPolicy, currentPolicyId, nftOwners, txLog, refreshBalances, balances, account }) {
  const connectedRole = addrToRoleKey(account, roleAddresses);
  return (
    <div style={{ flex: "0 0 350px", background: "#0d0f14", borderLeft: "1px solid #1e2330", height: "calc(100vh - 72px)", overflowY: "auto", padding: "16px" }}>
      <h3 style={{ fontSize: 13, color: "#fff", marginBottom: 15 }}>LIVE ACCOUNTS</h3>
      {Object.entries(ROLE_META).map(([role, meta]) => (
        <div key={role} style={{ marginBottom: 10, padding: "10px", background: "#111318", borderRadius: 8, border: `1px solid ${connectedRole === role ? meta.color : "#2d3445"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: meta.color, fontSize: 12, fontWeight: 700 }}><span>{meta.label}</span><span>{balances[role] ? fmtEth(balances[role]) : "—"}</span></div>
          <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{shortAddr(roleAddresses[role])}</div>
        </div>
      ))}
      <h3 style={{ fontSize: 13, color: "#fff", marginTop: 25, marginBottom: 15 }}>ACTIVITY LOG</h3>
      {txLog.map(entry => (
        <div key={entry.id} style={{ fontSize: 11, background: "#111318", padding: "8px", borderRadius: 4, marginBottom: 5, borderLeft: `3px solid ${ROLE_META[entry.role]?.color || "#94a3b8"}` }}>
          <div style={{ color: "#fff" }}>{entry.action}</div>
          <div style={{ color: "#94a3b8" }}>{entry.timestamp}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [connLog, setConnLog] = useState("");
  const [network, setNetwork] = useState("");
  const [roleAddresses, setRoleAddresses] = useState(HARDHAT_DEFAULTS);
  const [currentPolicy, setCurrentPolicy] = useState(null);
  const [currentPolicyId, setCurrentPolicyId] = useState(null);
  const [nftOwners, setNftOwners] = useState(null);
  const [txLog, setTxLog] = useState([]);
  const [balances, setBalances] = useState({});
  const [balanceTick, setBalanceTick] = useState(0);

  const addTxLog = entry => setTxLog(prev => [entry, ...prev].slice(0, 20));
  const triggerBalanceRefresh = () => setBalanceTick(t => t + 1);

  const refreshBalances = useCallback(async () => {
    if (!provider) return;
    const nb = {};
    for (const [role, addr] of Object.entries(roleAddresses)) { try { nb[role] = await provider.getBalance(addr); } catch {} }
    setBalances(nb);
  }, [provider, roleAddresses]);

  useEffect(() => { refreshBalances(); }, [refreshBalances, balanceTick]);
  
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = async (accounts) => {
      if (!accounts[0]) return;
      setAccount(accounts[0]);
      const prov = new ethers.BrowserProvider(window.ethereum);
      const signer = await prov.getSigner();
      setContract(new ethers.Contract(CONTRACT_ADDRESS, ABI, signer));
    };
    window.ethereum.on("accountsChanged", handler);
  }, []);

  async function connectWallet() {
    if (!window.ethereum) return;
    const prov = new ethers.BrowserProvider(window.ethereum);
    const accounts = await prov.send("eth_requestAccounts", []);
    const signer = await prov.getSigner();
    const net = await prov.getNetwork();
    setAccount(accounts[0]); setProvider(prov); setNetwork(net.name);
    setContract(new ethers.Contract(CONTRACT_ADDRESS, ABI, signer));
  }

  const connectedRoleKey = addrToRoleKey(account, roleAddresses);
  const sharedProps = { contract, addTxLog, setCurrentPolicy, setCurrentPolicyId, setNftOwners, roleAddresses, triggerBalanceRefresh, account };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0c10", color: "#e2e8f0" }}>
      <header style={{ height: 72, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e2330" }}>
        <h1>Sky<span style={{ color: "#4fc3f7" }}>Hedge</span></h1>
        <button onClick={connectWallet} style={btnStyle(account ? "#34d399" : "#4fc3f7")}>
          {account ? `Connected: ${shortAddr(account)}` : "Connect Wallet"}
        </button>
      </header>

      <div style={{ display: "flex" }}>
        <div style={{ flex: 1, padding: "20px" }}>
          {!account ? (
            <div style={{ textAlign: "center", padding: "100px 0" }}>👋 Please connect wallet to start</div>
          ) : (
            <>
              {connectedRoleKey === "passenger" && <PassengerView sharedProps={sharedProps} />}
              {(connectedRoleKey === "underwriter1" || connectedRoleKey === "underwriter2") && <UnderwriterView sharedProps={sharedProps} roleKey={connectedRoleKey} />}
              {connectedRoleKey === "resolver" && <ResolverView sharedProps={sharedProps} />}
              {!connectedRoleKey && <div style={{ color: "red" }}>⚠️ Unknown Account</div>}
            </>
          )}
        </div>
        <RightPanel provider={provider} account={account} roleAddresses={roleAddresses} setRoleAddresses={setRoleAddresses} currentPolicy={currentPolicy} currentPolicyId={currentPolicyId} nftOwners={nftOwners} txLog={txLog} refreshBalances={refreshBalances} balances={balances} />
      </div>
    </div>
  );
}
