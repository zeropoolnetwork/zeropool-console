declare module '*.bin' {
    const url: string;
    export default url;
}

// env.js
declare var EVM_RPC: string;
declare var RELAYER_URL: string;
declare var TOKEN_ADDRESS: string;
declare var CONTRACT_ADDRESS: string;
