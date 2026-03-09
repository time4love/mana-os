import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

const chainIdRaw = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "31337");
const chainId = Number.isNaN(chainIdRaw) || chainIdRaw <= 0 ? 31337 : chainIdRaw;
const rpcUrl =
  typeof process.env.NEXT_PUBLIC_RPC_URL === "string" && process.env.NEXT_PUBLIC_RPC_URL
    ? process.env.NEXT_PUBLIC_RPC_URL
    : "http://127.0.0.1:8545";

/**
 * Local dev chain (Foundry Anvil or Hardhat). Chain ID and RPC are configurable via env
 * so the app matches your local node (e.g. anvil-hardhat). Default: 31337, http://127.0.0.1:8545.
 */
export const anvil = defineChain({
  id: chainId,
  name: "Anvil Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
});

/**
 * Wagmi config: single local chain. Wallet must be on this chain (same chain ID) for contract reads.
 */
export const config = createConfig({
  chains: [anvil],
  connectors: [injected()],
  transports: {
    [anvil.id]: http(rpcUrl),
  },
});
