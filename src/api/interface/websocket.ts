import {losslessStringify, sleep, tryWithCustomHandler} from "../../utils/lang";
import {createTypedEvent} from "../../utils/typedEvent";

export const createWebsocketConnection = <T>(url: string | URL, {
    protocols = undefined as string | string[] | undefined,
    autoRetry = true
} = {}) => {
    let WebSocketInstance = new WebSocket(url, protocols)
    let autoRetryInternal = autoRetry
    let retryCount = 0
    const events = {
        opening: createTypedEvent<void>(),
        opened: createTypedEvent<Event>(),
        closed: createTypedEvent<CloseEvent>(),
        message: createTypedEvent<T>(),
        crash: createTypedEvent<Event>(),
        retry: createTypedEvent<{
            delayMilliseconds: number
        }>()
    }
    const addEventListener = (socket: WebSocket) => {
        const messageListener = (event) => events.message.dispatch(
            tryWithCustomHandler(
                () => JSON.parse(event.data),
                (e) => {
                    console.error(`[Websocket] The following server response cannot be parsed.`)
                    console.error(event.data)
                    throw e
                }
            ) as T
        )
        socket.addEventListener('open', events.opened.dispatch)
        socket.addEventListener('close', events.closed.dispatch)
        socket.addEventListener('message', messageListener)
        socket.addEventListener('error', events.crash.dispatch)
        return () => {
            socket.removeEventListener('open', events.opened.dispatch)
            socket.removeEventListener('close', events.closed.dispatch)
            socket.removeEventListener('message', messageListener)
            socket.removeEventListener('error', events.crash.dispatch)
        }
    }
    let removeEventListener = addEventListener(WebSocketInstance)
    events.opening.dispatch()
    events.opened.sub(() => {
        retryCount = 0
    })
    const reconnect = () => {
        WebSocketInstance = new WebSocket(url, protocols)
        removeEventListener()
        removeEventListener = addEventListener(WebSocketInstance)
        events.opening.dispatch()
    }
    events.crash.sub(async () => {
        if (autoRetryInternal) {
            await sleep()
            const delayMilliseconds = Math.min(1000 * 2 ** retryCount, 1000 * 60)
            events.retry.dispatch({delayMilliseconds})
            await sleep(delayMilliseconds)
            reconnect()
        }
    })
    return {
        send: (payload: unknown) => {
            WebSocketInstance.send(losslessStringify(payload))
        },
        // preserved method
        sendBinary: (payload: ArrayBuffer | Blob) => {
            throw new Error(`[Websocket] The method 'sendBinary' is preserved and not implemented. You should not use this method without more development.`)
            // socket.send(payload)
        },
        events,
        close: () => WebSocketInstance.close(),
        reopen: reconnect,
        get isClosed() {
            return WebSocketInstance.readyState === WebSocketInstance.CLOSED
        },
        get autoRetry() {
            return autoRetryInternal
        },
        setAutoRetry(enable: boolean) {
            autoRetryInternal = enable
        }
    }
}
