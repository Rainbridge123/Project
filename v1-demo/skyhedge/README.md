# SkyHedge

> Instant flight-delay payouts · Reverse auction pricing · On-chain collateral · NFT bearer instruments

**FT5004 Group 5** — SONG YUQIAO · SUN YINING · WANG XIAOLU

---

## What is SkyHedge?

SkyHedge is a decentralised parametric flight-delay insurance protocol.  
Passengers create coverage requests; underwriters compete via reverse auction to offer the lowest premium; the winner locks **100% of the payout as on-chain collateral**.  A trusted resolver (oracle) submits delay data and the smart contract settles automatically — no manual review, no discretionary claim approval.

Both positions are tokenised as **ERC-721 Bearer Instruments**:
- **Policy NFT** — current holder has the right to receive the payout if the flight is delayed.
- **Risk NFT** — current holder gets the collateral back if the flight is on time.

---

## MVP Feature Set

| Feature | Status |
|---|---|
| `createPolicy()` — passenger creates coverage | ✅ |
| `bidPremium()` — reverse auction bidding | ✅ |
| `finalizeAuction()` — winner locks full collateral, mints NFTs | ✅ |
| `resolvePolicy()` — oracle triggers payout or collateral release | ✅ |
| Policy NFT (ERC-721) | ✅ |
| Risk NFT (ERC-721) | ✅ |
| NFT transfer → payout routes to current holder | ✅ |
| Single-page frontend (Passenger / Underwriter / Resolver tabs) | ✅ |

**Out of scope for MVP:** NFT marketplace, Chainlink Functions, fractionalization, tiered payouts.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Smart contracts | Solidity 0.8.20 + OpenZeppelin 5 |
| Local dev / test | Hardhat + Hardhat Network |
| Public testnet | Sepolia (Alchemy RPC) |
| Frontend | React 18 + ethers.js v6 |
| Frontend deploy | Vercel |

---

## Quick Start

### Prerequisites
- Node.js v18 or v20
- MetaMask browser extension

### 1. Install dependencies

```bash
# Root (Hardhat)
npm install

# Frontend
cd frontend && npm install && cd ..
```

### 2. Compile contracts

```bash
npx hardhat compile
```

### 3. Run tests

```bash
npx hardhat test
```

All tests should pass before proceeding.

### 4. Start local node (keep this terminal open)

```bash
npx hardhat node
```

### 5. Deploy to local node (new terminal)

```bash
npx hardhat run scripts/deploy.js --network localhost
# → SkyHedge deployed to: 0xABC…
```

Copy the deployed address.

### 6. Update frontend config

Open `frontend/src/config.js` and paste the address:

```js
export const CONTRACT_ADDRESS = "0xABC…";
```

### 7. Add Hardhat local network to MetaMask

| Field | Value |
|---|---|
| Network Name | Hardhat Local |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency | ETH |

Import test accounts from the Hardhat node output using their private keys.

### 8. Start frontend

```bash
cd frontend && npm start
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Sepolia (optional, for extra credit)

1. Copy `.env.example` → `.env` and fill in your values.
2. Run:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

3. Update `frontend/src/config.js` with the Sepolia contract address.
4. Push to GitHub → Vercel auto-deploys the frontend.

---

## Demo Script (5 steps)

Prepare **3 MetaMask accounts** (A = Passenger, B = Underwriter, C = Third Party / Resolver).

| Step | Account | Action |
|---|---|---|
| 1 | A | Create policy (flight SQ123, threshold 60 min, payout 0.01 ETH, auction end in 70 s) |
| 2 | B | Place bid (premium 0.001 ETH) |
| 3 | B | Finalize auction — locks 0.01 ETH collateral, mints Policy NFT → A, Risk NFT → B |
| ⭐ 4 | A | Transfer Policy NFT to C ("passenger sold the claim") |
| 5 | C/Deployer | Resolve with 120 min delay → 0.01 ETH goes to **C** (current NFT holder, not A) |

Step 4–5 is the demo highlight: settlement routes to the **current** NFT holder.

---

## Contract Architecture

```
User (Passenger)          Frontend (React)           SkyHedgeCore.sol
     │                          │                          │
     │── createPolicy() ────────┤──── tx ─────────────────▶│ Status: BIDDING
     │                          │                          │
User (Underwriter)              │                          │
     │── bidPremium()  ─────────┤──── tx ─────────────────▶│ bestPremium updated
     │── finalizeAuction() ─────┤──── tx + ETH ───────────▶│ Status: ACTIVE
     │                          │                          │  Mint Policy NFT → Passenger
     │                          │                          │  Mint Risk NFT → Underwriter
     │                          │                          │
User (Passenger, optional)      │                          │
     │── transferFrom() ────────┤──── tx ─────────────────▶│ Policy NFT owner changes
     │                          │                          │
Resolver (Oracle)               │                          │
     │── resolvePolicy() ───────┤──── tx ─────────────────▶│ Status: PAID / EXPIRED
     │                          │                          │  ETH → current Policy/Risk NFT owner
```

---

## Security Design

| Mechanism | Purpose |
|---|---|
| `require(msg.sender == resolver)` | Only trusted oracle can trigger settlement |
| `require(msg.value == fixedPayout)` | Enforces 100% collateral at finalization |
| `ReentrancyGuard` | Prevents reentrancy on all ETH-transfer functions |
| Checks-Effects-Interactions pattern | State updated before external calls |
| `require` checks on all state transitions | Prevents invalid state changes |
