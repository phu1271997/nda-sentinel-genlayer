export function wrapProviderWithSnapsBypass(provider: any) {
    if (!provider || !provider.request) return provider;
    const originalRequest = provider.request.bind(provider);
    return {
        ...provider,
        request: async (args: any) => {
            if (args.method === "wallet_getSnaps" || 
                args.method === "wallet_requestSnaps" ||
                args.method === "wallet_invokeSnap") {
                return {};
            }
            return originalRequest(args);
        },
    };
}
