# 🎨 Sketchy

A Web3 drawing game where players wager crypto, compete to draw and guess, and winners take the pool — with every game saved permanently on the Arweave permaweb.

## ✨ Features

- Real-time multiplayer drawing and guessing
- Crypto wagering and automatic prize distribution
- Permanent game state storage on the Arweave permaweb
- WalletConnect integration
- Game history tracking via Arweave transactions

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Socket.io, WalletConnect
- **Backend**: Node.js, Express, Socket.io
- **Blockchain**: Arweave (via Arweave JS SDK)
- **Storage**: Arweave Permaweb

## 📦 Prerequisites

- Node.js (v18 or higher)
- npm
- MetaMask or any WalletConnect-compatible wallet
- AR tokens on Arweave testnet or mainnet

## 🚀 Installation

### 1. Clone the Frontend

```bash
git clone https://github.com/Kaustubh-404/Sketchy-Core-Frontend
cd Sketchy-Core-Frontend

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit the .env file with your Arweave and WalletConnect config

# Start frontend dev server
npm run dev
```
