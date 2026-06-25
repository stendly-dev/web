import {QueryClient} from '@tanstack/react-query'
import {ApiError} from './api'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 30,
            gcTime: 1000 * 60 * 5,
            retry: (failureCount, error) => {
                if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
                return failureCount < 3
            },
            refetchOnWindowFocus: false,
        },
    },
})
