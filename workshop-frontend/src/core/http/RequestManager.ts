import CacheAuth from '../../cache/CacheAuth'
import RequestEngine from './lib/RequestEngine'
import TokenManager from '../auth/TokenManager'
import { RequestCallbackHandler } from './RequestCallbackHandler'

type RequestStatus = 'QUEUED' | 'EXECUTING' | 'REQUEUED' | 'RETRYING'
let requestCount = 0
const execMap: { [key: number]: [() => void, RequestStatus] } = {}
const queue: [() => void, number][] = []

function nextId() {
    const id = requestCount
    requestCount += 1
    return id
}

export abstract class RequestCallbackHandlerManaged extends RequestCallbackHandler {
    override onUnauthorized(): void {
        TokenManager.setToken(null)
    }
    override onFailed(_statusCode: number): void {}
}

function push(id: number, fn: () => void) {
    const ex = execMap[id]
    if (!ex) {
        execMap[id] = [fn, 'QUEUED']
    } else if (ex[1] === 'EXECUTING') {
        execMap[id] = [fn, 'REQUEUED']
    } else {
        execMap[id] = [fn, 'QUEUED']
    }
    queue.unshift([fn, id])
}

function drain() {
    while (queue.length > 0) {
        const item = queue.pop()
        if (!item) break
        execMap[item[1]] = [item[0], 'EXECUTING']
        item[0]()
    }
}

function schedule(forceRefresh: boolean) {
    const status = TokenManager.getStatus()
    if (forceRefresh || status === 'INVALID') {
        TokenManager.requestRefresh().then(() => drain())
    } else if (status === 'ENDING') {
        TokenManager.requestRefresh().then(() => {})
        drain()
    } else {
        drain()
    }
}

export default {
    init() {
        TokenManager.loadFromStore()
    },
    queueRequest(requestId: number, forceRefresh: boolean, request: () => void) {
        push(requestId, request)
        schedule(forceRefresh)
    },
    get(url: string, handler: RequestCallbackHandlerManaged) {
        const id = nextId()
        const req = () => RequestEngine.get(url, handler, CacheAuth.getJwt() || undefined)
        this.queueRequest(id, false, req)
    },
    post(url: string, handler: RequestCallbackHandlerManaged, json?: object) {
        const id = nextId()
        const req = () => RequestEngine.post(url, handler, CacheAuth.getJwt() || undefined, json)
        this.queueRequest(id, false, req)
    },
    put(url: string, handler: RequestCallbackHandlerManaged, json?: object, formData?: FormData) {
        const id = nextId()
        const req = () => RequestEngine.put(url, handler, CacheAuth.getJwt() || undefined, json, formData)
        this.queueRequest(id, false, req)
    },
    delete(url: string, handler: RequestCallbackHandlerManaged, json?: object) {
        const id = nextId()
        const req = () => RequestEngine.delete(url, handler, CacheAuth.getJwt() || undefined, json)
        this.queueRequest(id, false, req)
    }
}