import { createConfig, http } from "wagmi";
import { defineChain } from "viem";

/**
 * Anvil local chain (Foundry). Used exclusively for development.
 * RPC defaults to http://127.0.0.1:8545.
 */
export const anvil = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
});

/**
 * Wagmi config: Anvil (31337) only. No mainnet or other chains.
 */
export const config = createConfig({
  chains: [anvil],
  transports: {
    [anvil.id]: http(),
  },
});
