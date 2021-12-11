declare module '*.bin' {
    const url: string;
    export default url;
}

// env.js
declare var EVM_RPC: string;
declare var RELAYER_URL: string;
declare var TOKEN_ADDRESS: string;
declare var CONTRACT_ADDRESS: string;
declare var TRANSFER_PARAMS_URL: string;
declare var TREE_PARAMS_URL: string;
declare var TRANSFER_VK_URL: string;
declare var TREE_VK_URL: string;
