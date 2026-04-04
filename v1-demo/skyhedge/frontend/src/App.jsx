import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI, STATUS } from "./config";

// ─────────────────────────────────────────────────────────────────────────────
// ✈️ 乘客专属 Dashboard：蓝色科技感
// ─────────────────────────────────────────────────────────────────────────────
function PassengerView({ sharedProps }) {
  return (
    <div style={{ height: "100%", padding: "24px", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", borderRadius: "24px", border: "1px solid #4fc3f733", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <h2 style={{ color: "#4fc3f7", fontSize: "28px", marginBottom: "20px" }}>✈️ Passenger Portal</h2>
      <div style={{ background: "#ffffff05", padding: "20px", borderRadius: "16px", flex: 1, minHeight: 0, overflowY: "auto" }}>
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
    <div style={{ height: "100%", padding: "24px", background: "#0d0f14", border: "2px solid #34d399", borderRadius: "12px", boxShadow: "0 0 20px #34d39922", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <h2 style={{ color: "#34d399", fontFamily: "monospace", textTransform: "uppercase" }}>🏦 Underwriter Terminal</h2>
      <p style={{ color: "#34d399", fontSize: "12px", marginBottom: "20px" }}>[SECURE CONNECTION ACTIVE]</p>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <UnderwriterTab {...sharedProps} roleKey={roleKey} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔮 预言机专属 Dashboard：金色权威感
// ─────────────────────────────────────────────────────────────────────────────
function ResolverView({ sharedProps }) {
  return (
    <div style={{ height: "100%", display: "flex", justifyContent: "center", padding: "16px" }}>
      <div style={{ width: "100%", background: "#1a1a1a", border: "3px solid #f59e0b", borderRadius: "40px", padding: "28px", textAlign: "center", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <h2 style={{ color: "#f59e0b", fontSize: "32px", marginBottom: "20px" }}>🔮 Oracle Node</h2>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <ResolverTab {...sharedProps} />
        </div>
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
  underwriter:  { label: "🏦 Underwriter",   color: "#34d399" },
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
  if ((e.message || "").includes("reading 'then'")) return "Frontend could not read the created policy ID. Check that MetaMask is on the correct network and frontend/src/config.js matches the deployed contract address and ABI.";
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
function buildTxLog(role, action) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    action,
    timestamp: new Date().toLocaleString(),
  };
}

const inputStyle = { background: "#111318", border: "1px solid #2d3445", borderRadius: 6, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, fontFamily: "monospace", width: "100%", outline: "none" };
const btnStyle = (color, extra = {}) => ({ background: color + "22", border: `1px solid ${color}55`, borderRadius: 6, color, padding: "8px 18px", fontSize: 13, fontFamily: "monospace", cursor: "pointer", fontWeight: 600, ...extra });
const disabledBtnStyle = { background: "#1a1e2a", border: "1px solid #3d4455", borderRadius: 6, color: "#94a3b8", padding: "8px 18px", fontSize: 13, fontFamily: "monospace", cursor: "not-allowed", fontWeight: 600 };
const CLR = { label: "#cbd5e1", value: "#f1f5f9", dim: "#94a3b8", head: "#f1f5f9" };
const STATUS_PRIORITY = { ACTIVE: 0, BIDDING_OPEN: 1, BIDDING_ENDED: 2, PAID: 3, EXPIRED: 4, UNKNOWN: 5 };

function DerivedStatusBadge({ ds }) {
  const m = DERIVED_META[ds] ?? DERIVED_META.UNKNOWN;
  return <span style={{ background: m.color + "22", color: m.color, border: `1px solid ${m.color}55`, borderRadius: 4, padding: "3px 10px", fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>{m.label}</span>;
}

function AccountRoleBanner({ account, mode, resolverAccount }) {
  if (!account) return null;
  const meta = ROLE_META[mode] ?? ROLE_META.passenger;
  if (mode !== "resolver" || resolverAccount) {
    return (
      <div style={{ marginBottom: 16, padding: "10px 14px", background: meta.color + "11", border: `1px solid ${meta.color}44`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16 }}>✅</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>Using {meta.label} Mode</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: CLR.dim }}>{shortAddr(account)}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 16, padding: "12px 14px", background: "#7c1d1d22", border: "1px solid #ef444466", borderRadius: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginBottom: 4 }}>⚠️ Resolver access required</div>
      <div style={{ fontSize: 13, color: CLR.label }}>This mode requires the wallet configured as the resolver in the contract.</div>
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

function sortPolicyEntries(entries) {
  return [...entries].sort((a, b) => {
    const statusGap = (STATUS_PRIORITY[a.ds] ?? 99) - (STATUS_PRIORITY[b.ds] ?? 99);
    if (statusGap !== 0) return statusGap;
    return Number(b.id) - Number(a.id);
  });
}

function PolicySelectionList({
  policies,
  selectedPolicyId,
  onSelect,
  roleAddresses,
  isLoading,
  onRefresh,
  accentColor = "#34d399",
  title = "Available Policies",
  subtitle = "Click any policy below to load it directly.",
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const visiblePolicies = policies.filter(({ id }) => String(id).includes(searchTerm.trim()));

  return (
    <div style={{ marginBottom: 16, padding: "14px 16px", background: "#111318", borderRadius: 8, border: "1px solid #2d3445" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ color: accentColor, fontSize: 13, fontWeight: 700, fontFamily: "monospace", textTransform: "uppercase" }}>{title}</div>
          <div style={{ color: CLR.dim, fontSize: 12 }}>{subtitle}</div>
        </div>
        <button onClick={onRefresh} style={btnStyle(accentColor)} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <div style={{ marginBottom: 12 }}>
        <input
          type="number"
          placeholder="Search Policy ID"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={inputStyle}
        />
      </div>
      {!visiblePolicies.length ? (
        <div style={{ color: CLR.dim, fontSize: 13, padding: "10px 0" }}>
          {isLoading ? "Loading policies from chain..." : policies.length ? "No matching policy ID found." : "No policies found yet."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10, maxHeight: "34vh", overflowY: "auto", paddingRight: 4 }}>
          {visiblePolicies.map(({ id, policy }) => {
            const ds = derivedStatus(policy);
            const isSelected = String(selectedPolicyId) === String(id);
            const bestPremium = (!policy.maxPremium || policy.bestPremium === policy.maxPremium) ? "(no bids yet)" : fmtEth(policy.bestPremium);
            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                style={{
                  background: isSelected ? accentColor + "18" : "#0d0f14",
                  border: `1px solid ${isSelected ? accentColor + "88" : "#253041"}`,
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
      if (pid === null) {
        throw new Error("PolicyCreated event not found in transaction receipt. Check that the connected network and configured contract address match the deployed SkyHedgeCore contract.");
      }
      const p = await contract.getPolicy(pid);
      addTxLog(buildTxLog("passenger", `Created Policy #${pid} for flight ${form.flightRef}`));
      setPolicyId(pid); setPolicy(p); setCurrentPolicy(p); setCurrentPolicyId(pid); setLog({ msg: `Policy #${pid} created!` }); triggerBalanceRefresh();
    } catch (e) { setLog({ err: parseError(e) }); }
  }

  async function transferNFT() {
    try {
      const tx = await contract.transferFrom(account, tForm.to, tForm.nftId);
      await tx.wait();
      addTxLog(buildTxLog("passenger", `Transferred NFT #${tForm.nftId} to ${shortAddr(tForm.to)}`));
      setTLog({ msg: "Transferred successfully!" }); triggerBalanceRefresh();
    } catch (e) { setTLog({ err: parseError(e) }); }
  }

  return (
    <div>
      <AccountRoleBanner account={account} mode="passenger" />
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
  const [finalizeList, setFinalizeList] = useState([]);
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
      const normalizedAccount = account?.toLowerCase();
      setPolicyList(
        loaded.filter(({ policy }) => policy.passenger !== ethers.ZeroAddress && derivedStatus(policy) === "BIDDING_OPEN")
      );
      setFinalizeList(
        loaded.filter(({ policy }) =>
          policy.passenger !== ethers.ZeroAddress &&
          derivedStatus(policy) === "BIDDING_ENDED" &&
          policy.bestUnderwriter?.toLowerCase() === normalizedAccount
        )
      );
    } catch (e) {
      setLog({ err: parseError(e) });
    } finally {
      setIsPolicyListLoading(false);
    }
  }

  useEffect(() => {
    fetchPolicies();
  }, [contract, account]);

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
      await tx.wait();
      addTxLog(buildTxLog(roleKey, `Placed bid of ${premium} ETH on Policy #${policyId}`));
      setLog({ msg: "Bid placed!" }); loadPolicy(); fetchPolicies(); triggerBalanceRefresh();
    } catch (e) { setLog({ err: parseError(e) }); }
  }
  async function finalize() {
    try {
      const tx = await contract.finalizeAuction(policyId, { value: policy.fixedPayout });
      await tx.wait();
      addTxLog(buildTxLog(roleKey, `Finalized Policy #${policyId} and locked ${fmtEth(policy.fixedPayout)} collateral`));
      setLog({ msg: "Finalized!" }); loadPolicy(); fetchPolicies(); triggerBalanceRefresh();
    } catch (e) { setLog({ err: parseError(e) }); }
  }

  return (
    <div>
      <AccountRoleBanner account={account} mode="underwriter" />
      <PolicySelectionList
        policies={policyList}
        selectedPolicyId={policyId}
        onSelect={loadPolicy}
        roleAddresses={roleAddresses}
        isLoading={isPolicyListLoading}
        onRefresh={fetchPolicies}
        accentColor="#34d399"
        title="Available Policies"
        subtitle="Underwriter can click any policy below to load it directly."
      />
      <PolicySelectionList
        policies={finalizeList}
        selectedPolicyId={policyId}
        onSelect={loadPolicy}
        roleAddresses={roleAddresses}
        isLoading={isPolicyListLoading}
        onRefresh={fetchPolicies}
        accentColor="#f59e0b"
        title="Awaiting Your Finalization"
        subtitle="These are policies where your bid won and auction has ended."
      />
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
  const [policyList, setPolicyList] = useState([]);
  const [isPolicyListLoading, setIsPolicyListLoading] = useState(false);
  const [log, setLog] = useState({ msg: "", err: "" });
  const canResolve = derivedStatus(policy) === "ACTIVE";

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
  async function resolve() {
    try {
      const tx = await contract.resolvePolicy(policyId, Number(delayMins));
      await tx.wait();
      addTxLog(buildTxLog("resolver", `Resolved Policy #${policyId} with reported delay ${delayMins} minutes`));
      setLog({ msg: "Resolved!" }); loadPolicy(); fetchPolicies(); triggerBalanceRefresh();
    } catch (e) { setLog({ err: parseError(e) }); }
  }

  const resolverAccount = roleAddresses.resolver?.toLowerCase() === account?.toLowerCase();

  return (
    <div>
      <AccountRoleBanner account={account} mode="resolver" resolverAccount={resolverAccount} />
      <PolicySelectionList
        policies={policyList}
        selectedPolicyId={policyId}
        onSelect={loadPolicy}
        roleAddresses={roleAddresses}
        isLoading={isPolicyListLoading}
        onRefresh={fetchPolicies}
        accentColor="#f59e0b"
        title="Policies Awaiting Review"
        subtitle="Resolver can browse all policies and open one directly for settlement."
      />
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

function RightPanel({ contract, roleAddresses, currentPolicyId, txLog, account, refreshTick, activeMode }) {
  const [relatedPolicies, setRelatedPolicies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [expandedPolicyId, setExpandedPolicyId] = useState(null);

  useEffect(() => {
    async function fetchRelevantPolicies() {
      if (!contract || !account) {
        setRelatedPolicies([]);
        setPanelError("");
        return;
      }

      setIsLoading(true);
      setPanelError("");
      try {
        const normalizedAccount = account.toLowerCase();
        let entries = [];

        if (activeMode === "passenger" || activeMode === "resolver") {
          const count = Number(await contract.policyCount());
          const loaded = await Promise.all(
            Array.from({ length: count }, async (_, index) => {
              const id = index + 1;
              const policy = await contract.getPolicy(id);
              return { id, policy, ds: derivedStatus(policy) };
            })
          );

          if (activeMode === "passenger") {
            entries = loaded
              .filter(({ policy }) => policy.passenger?.toLowerCase() === normalizedAccount)
              .map(entry => ({ ...entry, relation: "Created by you" }));
          } else {
            entries = loaded
              .filter(({ policy }) => policy.passenger !== ethers.ZeroAddress)
              .map(entry => ({
                ...entry,
                relation: entry.ds === "ACTIVE" ? "Ready to resolve" : "Waiting for finalization or already settled",
              }));
          }
        } else if (activeMode === "underwriter") {
          const bidEvents = await contract.queryFilter(contract.filters.BidPlaced(null, account));
          const uniqueIds = [...new Set(bidEvents.map(event => Number(event.args?.policyId)).filter(Boolean))];
          const loaded = await Promise.all(
            uniqueIds.map(async (id) => {
              const policy = await contract.getPolicy(id);
              const ds = derivedStatus(policy);
              const isLeading = policy.bestUnderwriter?.toLowerCase() === normalizedAccount;
              const relation = isLeading
                ? (ds === "ACTIVE" ? "Underwritten by you" : "You are currently winning")
                : "You placed a bid";
              return { id, policy, ds, relation };
            })
          );
          entries = loaded;
        }

        setRelatedPolicies(sortPolicyEntries(entries));
      } catch (e) {
        setPanelError(parseError(e));
      } finally {
        setIsLoading(false);
      }
    }

    fetchRelevantPolicies();
  }, [contract, account, activeMode, refreshTick]);

  const panelMeta = {
    passenger: { title: "YOUR POLICIES", accent: "#4fc3f7", empty: "You haven't created any policies yet." },
    underwriter: { title: "YOUR BIDDED POLICIES", accent: "#34d399", empty: "You haven't placed any bids yet." },
    resolver: { title: "RESOLUTION QUEUE", accent: "#f59e0b", empty: "No policies are available to review right now." },
    default: { title: "RELATED POLICIES", accent: "#94a3b8", empty: "No related policies found." },
  }[activeMode] ?? { title: "RELATED POLICIES", accent: "#94a3b8", empty: "No related policies found." };

  return (
    <div style={{ flex: 2, background: "#0d0f14", borderLeft: "1px solid #1e2330", overflowY: "auto", padding: "16px", minWidth: 0, minHeight: 0 }}>
      <h3 style={{ fontSize: 13, color: panelMeta.accent, marginBottom: 15 }}>{panelMeta.title}</h3>
      {panelError && <div style={{ marginBottom: 12, padding: "10px 12px", background: "#7c2d1222", border: "1px solid #ef444444", borderRadius: 6, color: "#fca5a5", fontSize: 12, fontFamily: "monospace" }}>{panelError}</div>}
      {isLoading ? (
        <div style={{ color: CLR.dim, fontSize: 13, marginBottom: 16 }}>Loading related policies...</div>
      ) : !relatedPolicies.length ? (
        <div style={{ color: CLR.dim, fontSize: 13, marginBottom: 16 }}>{panelMeta.empty}</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {relatedPolicies.map(({ id, policy, ds, relation }) => {
            const isActiveSelection = String(currentPolicyId) === String(id);
            const isExpanded = String(expandedPolicyId) === String(id);
            const bestPremium = (!policy.maxPremium || policy.bestPremium === policy.maxPremium) ? "(no bids yet)" : fmtEth(policy.bestPremium);
            const shouldShowRelation = relation && relation !== "Created by you";
            return (
              <button
                key={id}
                onClick={() => setExpandedPolicyId(prev => String(prev) === String(id) ? null : id)}
                style={{ padding: "12px", background: "#111318", borderRadius: 8, border: `1px solid ${isActiveSelection || isExpanded ? panelMeta.accent + "88" : "#2d3445"}`, width: "100%", textAlign: "left", cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: "#fff", fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>Policy #{id}</span>
                  <DerivedStatusBadge ds={ds} />
                </div>
                {shouldShowRelation && <div style={{ color: panelMeta.accent, fontSize: 12, marginBottom: 8 }}>{relation}</div>}
                <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                  <div><span style={{ color: CLR.dim }}>Flight:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fromBytes32(policy.flightRef)}</span></div>
                  <div><span style={{ color: CLR.dim }}>Passenger:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{shortAddr(policy.passenger)}</span></div>
                  <div><span style={{ color: CLR.dim }}>Best Premium:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{bestPremium}</span></div>
                  <div><span style={{ color: CLR.dim }}>Best UW:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{addrDisplay(policy.bestUnderwriter, roleAddresses)}</span></div>
                </div>
                {isExpanded && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #253041", display: "grid", gap: 4, fontSize: 12 }}>
                    <div><span style={{ color: CLR.dim }}>Fixed Payout:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fmtEth(policy.fixedPayout)}</span></div>
                    <div><span style={{ color: CLR.dim }}>Delay Threshold:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{String(policy.delayThreshold)} min</span></div>
                    <div><span style={{ color: CLR.dim }}>Auction Ends:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{tsToLocal(policy.auctionEnd)}</span></div>
                    <div><span style={{ color: CLR.dim }}>Expiry:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{tsToLocal(policy.expiry)}</span></div>
                    <div><span style={{ color: CLR.dim }}>Max Premium:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fmtEth(policy.maxPremium)}</span></div>
                    <div><span style={{ color: CLR.dim }}>Policy NFT:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{policy.policyNFTId > 0n ? `#${policy.policyNFTId}` : "(not minted)"}</span></div>
                    <div><span style={{ color: CLR.dim }}>Risk NFT:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{policy.riskNFTId > 0n ? `#${policy.riskNFTId}` : "(not minted)"}</span></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
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
  const [connLog, setConnLog] = useState("");
  const [network, setNetwork] = useState("");
  const [roleAddresses, setRoleAddresses] = useState(HARDHAT_DEFAULTS);
  const [activeMode, setActiveMode] = useState("passenger");
  const [currentPolicy, setCurrentPolicy] = useState(null);
  const [currentPolicyId, setCurrentPolicyId] = useState(null);
  const [nftOwners, setNftOwners] = useState(null);
  const [txLog, setTxLog] = useState([]);
  const [refreshTick, setRefreshTick] = useState(0);

  const addTxLog = entry => setTxLog(prev => [entry, ...prev].slice(0, 20));
  const triggerBalanceRefresh = () => setRefreshTick(t => t + 1);
  
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = async (accounts) => {
      if (!accounts[0]) {
        setAccount(null);
        setContract(null);
        return;
      }
      setAccount(accounts[0]);
      const prov = new ethers.BrowserProvider(window.ethereum);
      const signer = await prov.getSigner();
      const nextContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      setContract(nextContract);
      try {
        const resolver = await nextContract.resolver();
        setRoleAddresses(prev => ({ ...prev, resolver }));
        setActiveMode(resolver.toLowerCase() === accounts[0].toLowerCase() ? "resolver" : "passenger");
      } catch {}
    };
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum.removeListener("accountsChanged", handler);
  }, []);

  async function connectWallet() {
    if (!window.ethereum) { setConnLog("MetaMask not found."); return; }
    try {
      const prov = new ethers.BrowserProvider(window.ethereum);
      const accounts = await prov.send("eth_requestAccounts", []);
      const signer = await prov.getSigner();
      const net = await prov.getNetwork();
      const code = await prov.getCode(CONTRACT_ADDRESS);
      setAccount(accounts[0]);
      setNetwork(`${net.name} (${net.chainId})`);
      if (code === "0x") {
        setContract(null);
        setConnLog(`No contract code found at ${CONTRACT_ADDRESS}. Redeploy SkyHedgeCore and update frontend/src/config.js.`);
        return;
      }
      setConnLog("");
      const nextContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      setContract(nextContract);
      try {
        const resolver = await nextContract.resolver();
        setRoleAddresses(prev => ({ ...prev, resolver }));
        setActiveMode(resolver.toLowerCase() === accounts[0].toLowerCase() ? "resolver" : "passenger");
      } catch {}
    } catch (e) {
      setConnLog(parseError(e));
    }
  }

  const isResolverAccount = roleAddresses.resolver?.toLowerCase() === account?.toLowerCase();
  const availableModes = account ? [
    { key: "passenger", label: "Passenger", color: ROLE_META.passenger.color },
    { key: "underwriter", label: "Underwriter", color: ROLE_META.underwriter.color },
    ...(isResolverAccount ? [{ key: "resolver", label: "Resolver", color: ROLE_META.resolver.color }] : []),
  ] : [];
  const sharedProps = { contract, addTxLog, setCurrentPolicy, setCurrentPolicyId, setNftOwners, roleAddresses, triggerBalanceRefresh, account };

  return (
    <div style={{ height: "100vh", background: "#0a0c10", color: "#e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header style={{ height: 72, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e2330" }}>
        <h1>Sky<span style={{ color: "#4fc3f7" }}>Hedge</span></h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {account && (
            <div style={{ display: "flex", gap: 8, padding: "6px", background: "#111318", border: "1px solid #2d3445", borderRadius: 10 }}>
              {availableModes.map(mode => (
                <button
                  key={mode.key}
                  onClick={() => setActiveMode(mode.key)}
                  style={activeMode === mode.key ? btnStyle(mode.color, { padding: "8px 14px" }) : { ...btnStyle("#94a3b8", { padding: "8px 14px" }), color: "#94a3b8", border: "1px solid #3d4455", background: "#1a1e2a" }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          )}
          <button onClick={connectWallet} style={btnStyle(account ? "#34d399" : "#4fc3f7")}>
            {account ? `Connected: ${shortAddr(account)}` : "Connect Wallet"}
          </button>
        </div>
      </header>
      {connLog && <div style={{ margin: "12px 20px 0", padding: "10px 14px", background: "#7c2d1222", border: "1px solid #ef444444", borderRadius: 6, color: "#fca5a5", fontSize: 13, fontFamily: "monospace" }}>⚠️ {connLog}</div>}

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ flex: 3, padding: "20px", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          {!account ? (
            <div style={{ textAlign: "center", padding: "100px 0" }}>👋 Please connect wallet to start</div>
          ) : (
            <>
              {activeMode === "passenger" && <PassengerView sharedProps={sharedProps} />}
              {activeMode === "underwriter" && <UnderwriterView sharedProps={sharedProps} roleKey="underwriter" />}
              {activeMode === "resolver" && <ResolverView sharedProps={sharedProps} />}
            </>
          )}
        </div>
        <RightPanel contract={contract} account={account} roleAddresses={roleAddresses} currentPolicyId={currentPolicyId} txLog={txLog} refreshTick={refreshTick} activeMode={activeMode} />
      </div>
    </div>
  );
}
