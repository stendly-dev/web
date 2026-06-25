export const queryKeys = {
    profile: ['profile'] as const,
    balance: ['balance'] as const,
    transactions: (accountId: string, direction?: string) =>
        ['transactions', 'single', accountId, direction ?? 'all'] as const,
    transactionsInfinite: (accountId: string, direction?: string) =>
        ['transactions', 'infinite', accountId, direction ?? 'all'] as const,
}
