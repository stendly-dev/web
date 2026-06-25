'use client'

import React, {createContext, useCallback, useContext, useRef} from 'react'
import {useQuery} from '@tanstack/react-query'
import {api, ApiError, getStoredAccountId, type Transaction, type UserProfile} from '@/lib/api'
import {isAuthenticated} from '@/lib/auth'
import {queryClient} from '@/lib/queryClient'
import {queryKeys} from '@/lib/queryKeys'
import {captureProductEvent, identifyAnalyticsUser} from '@/lib/analytics';

interface ProfileContextValue {
    profile: UserProfile | null
    recentTxs: Transaction[]
    loading: boolean
    txsLoading: boolean
    error: string | null
    refetch: () => Promise<void>
    updateProfile: (data: { username?: string | null; displayName?: string | null }) => Promise<void>
    checkUsernameAvailable: (username: string) => Promise<boolean>
    refetchBalance: () => Promise<void>
    refetchTransactions: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | null>(null)
const balanceSnapshotKey = (accountId: string) => `stendly_analytics_balance_cents_${accountId}`
const walletFundedKey = (accountId: string) => `stendly_analytics_wallet_funded_${accountId}`
const returningWalletOpenedKey = (accountId: string) => `stendly_analytics_returning_wallet_opened_${accountId}`

function depositSourceGuess(transactions: Transaction[], depositAmountCents: number): string {
    const received = transactions.find(tx =>
        tx.direction === 'received' &&
        tx.status === 'completed' &&
        (tx.amountCents === depositAmountCents || depositAmountCents <= 0))
    if (!received) return 'unknown'
    if (received.type === 'top_up') return 'fiat_topup'
    if (received.counterpartyUsername || received.counterpartyDisplayName) return 'stendly_user'
    return 'external_wallet'
}

export function ProfileProvider({children}: { children: React.ReactNode }) {
    const sessionFundedAccounts = useRef<Set<string>>(new Set())
    const {
        data: accountData,
        isLoading: loading,
        error: profileError,
        refetch: refetchProfile,
    } = useQuery({
        queryKey: queryKeys.profile,
        queryFn: async () => {
            return await api.users.me()
        },
        enabled: isAuthenticated(),
        staleTime: 5000,
        refetchInterval: 15000,
    })

    const {
        data: balanceData,
    } = useQuery({
        queryKey: queryKeys.balance,
        queryFn: async () => {
            return await api.users.balance()
        },
        enabled: isAuthenticated(),
        staleTime: 30000,
        refetchInterval: 15000,
    })

    const {
        data: recentTxsData,
        isLoading: txsLoading,
    } = useQuery({
        queryKey: queryKeys.transactions(getStoredAccountId() ?? '', undefined),
        queryFn: async () => {
            const accountId = getStoredAccountId();
            if (!accountId) return {transactions: [], total: 0, skip: 0, take: 5, hasMore: false}
            return api.transactions.history(accountId, {take: 5})
        },
        enabled: isAuthenticated() && !!getStoredAccountId(),
        staleTime: 5000,
        refetchInterval: 15000,
    })

    const error = profileError
        ? profileError instanceof ApiError
            ? profileError.message
            : 'Failed to load profile'
        : null

    const refetch = useCallback(async () => {
        await refetchProfile()
        await queryClient.invalidateQueries({queryKey: queryKeys.balance})
    }, [refetchProfile])

    const refetchBalance = useCallback(async () => {
        await queryClient.invalidateQueries({queryKey: queryKeys.balance})
    }, [])

    const refetchTransactions = useCallback(async () => {
        if (!accountData?.id) return
        await queryClient.invalidateQueries({queryKey: queryKeys.transactions(accountData.id)})
    }, [accountData?.id])

    const updateProfile = useCallback(
        async (data: { username?: string | null; displayName?: string | null }) => {
            await api.users.updateProfile(data)
            await queryClient.invalidateQueries({queryKey: queryKeys.profile})
        }, [],
    )

    const checkUsernameAvailable = useCallback(async (username: string): Promise<boolean> => {
        const result = await api.users.checkUsername(username)
        return result.available
    }, [])

    const profile: UserProfile | null = accountData ? {
        id: accountData.id,
        username: accountData.userProfile?.username ?? null,
        displayName: accountData.userProfile?.displayName ?? null,
        status: accountData.status as any,
        balanceCents: balanceData?.balanceCents ?? 0,
        solanaAddress: accountData.solanaAddress,
        primaryAuthMethod: accountData.primaryAuthMethod,
        role: accountData.userProfile?.role ?? 'user'
    } : null;

    React.useEffect(() => {
        if (!accountData?.id) return;
        void identifyAnalyticsUser(accountData.id);
        captureProductEvent('wallet_home_viewed', {has_balance: (balanceData?.balanceCents ?? 0) > 0});
    }, [accountData?.id, balanceData?.balanceCents]);

    React.useEffect(() => {
        if (!accountData?.id || !balanceData) return
        const currentBalanceCents = balanceData.balanceCents
        const storedBalance = localStorage.getItem(balanceSnapshotKey(accountData.id))
        const previousBalanceCents = storedBalance == null ? null : Number(storedBalance)

        localStorage.setItem(balanceSnapshotKey(accountData.id), String(currentBalanceCents))

        if (previousBalanceCents == null || !Number.isFinite(previousBalanceCents)) {
            if (currentBalanceCents > 0 && !localStorage.getItem(returningWalletOpenedKey(accountData.id))) {
                localStorage.setItem(returningWalletOpenedKey(accountData.id), 'true')
                captureProductEvent('returning_user_wallet_opened', {
                    has_balance: true,
                    balance_cents: currentBalanceCents,
                })
            }
            return
        }

        const depositAmountCents = currentBalanceCents - previousBalanceCents
        if (depositAmountCents <= 0) return

        const sourceGuess = depositSourceGuess(recentTxsData?.transactions ?? [], depositAmountCents)
        const properties = {
            deposit_amount_cents: depositAmountCents,
            deposit_source_guess: sourceGuess,
            previous_balance_cents: previousBalanceCents,
            balance_cents: currentBalanceCents,
            has_balance: currentBalanceCents > 0,
        }
        captureProductEvent('deposit_detected', properties)

        if (
            previousBalanceCents === 0 &&
            !sessionFundedAccounts.current.has(accountData.id) &&
            !localStorage.getItem(walletFundedKey(accountData.id))
        ) {
            sessionFundedAccounts.current.add(accountData.id)
            localStorage.setItem(walletFundedKey(accountData.id), 'true')
            captureProductEvent('wallet_funded', properties)
        }
    }, [accountData?.id, balanceData, recentTxsData?.transactions])

    return (
        <ProfileContext.Provider
            value={{
                profile,
                recentTxs: recentTxsData?.transactions ?? [],
                loading,
                txsLoading,
                error,
                refetch,
                updateProfile,
                checkUsernameAvailable,
                refetchBalance,
                refetchTransactions,
            }}
        >
            {children}
        </ProfileContext.Provider>
    )
}

export function useProfile(): ProfileContextValue {
    const ctx = useContext(ProfileContext)
    if (!ctx) throw new Error('useProfile must be used inside ProfileProvider')
    return ctx
}
