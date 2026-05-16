import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const client = createClient({ chain: studionet });
export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
