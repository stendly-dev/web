import {getAccessToken} from './api'

export function isAuthenticated(): boolean {
    return getAccessToken() !== null
}
