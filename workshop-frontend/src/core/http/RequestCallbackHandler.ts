/**
 * Shape of a normalized HTTP response passed to callback handlers.
 */
export type ResponseInfo = { status: number; json: any; headers: Headers }

/**
 * Base callback handler for RequestEngine/RequestManager.
 * Extend and override the hooks you need.
 */
export abstract class RequestCallbackHandler {
    onSucceeded(_responseInfo: ResponseInfo): void {} // 2xx status
    onUnauthorized(_responseInfo?: ResponseInfo): void {} // 401 status
    onFailed(_statusCode: number, _response?: ResponseInfo): void {} // non-2xx statuses (except 401/409)
    on409(_responseInfo?: ResponseInfo): void {} // 409 status
    onDestroy(_statusCode: number): void {} // Success/failure. Receive the latest status code
}