import {losslessStringify, sleep, tryWithCustomHandler} from "../../utils/lang";
import {createTypedEvent} from "../../utils/typedEvent";

export type RetryStatus = 'sleep' | 'connected' | 'connecting' | 'enabled' | 'disabled'

export const createWebsocketConnection = <T>(url: string | URL, {
    protocols = undefined as string | string[] | undefined,
    autoRetry = true
} = {}) => {
    let WebSocketInstance = new WebSocket(url, protocols)
    let autoRetryInternal = autoRetry
    let retryCount = 0
    let sleeping = 0
    const retryNowEvent = createTypedEvent<void>()
    const events = {
        opening: createTypedEvent<void>(),
        opened: createTypedEvent<Event>(),
        closed: createTypedEvent<CloseEvent>(),
        message: createTypedEvent<T>(),
        crash: createTypedEvent<Event>(),
        retry: createTypedEvent<{
            retryStatus: RetryStatus
            countdownMilliseconds?: number
        }>()
    }
    const addEventListener = (socket: WebSocket, isAuto = false) => {
        const openListener = (event) => {
            events.opened.dispatch(event)
            isAuto && events.retry.dispatch({retryStatus: 'connected'})
        }
        const closeListener = (event) => {
            if (event.code === 1000) {
                events.closed.dispatch(event)
            } else {
                events.crash.dispatch(event)
            }
        }
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
        socket.addEventListener('open', openListener)
        socket.addEventListener('close', closeListener)
        socket.addEventListener('message', messageListener)
        socket.addEventListener('error', events.crash.dispatch)
        events.opening.dispatch()
        return () => {
            socket.removeEventListener('open', openListener)
            socket.removeEventListener('close', closeListener)
            socket.removeEventListener('message', messageListener)
            socket.removeEventListener('error', events.crash.dispatch)
        }
    }
    let removeEventListener = addEventListener(WebSocketInstance)
    events.opened.sub(() => {
        retryCount = 0
    })
    const reconnect = (isAuto = false) => {
        if (!isAuto) retryNowEvent.dispatch()
        events.opening.dispatch()
        WebSocketInstance = new WebSocket(url, protocols)
        removeEventListener()
        removeEventListener = addEventListener(WebSocketInstance, isAuto)
    }
    // TODO: Not all browser follow the specification. Consider add heartbeat.
    events.crash.sub(async () => {
        if (autoRetryInternal && sleeping === 0) {
            retryCount++
            sleeping++
            await sleep()
            let delayUntil = new Date().getTime() + Math.min(1000 * 2 ** retryCount - 10, 1000 * 60 - 10)
            const getRestCountdown = () => delayUntil - new Date().getTime()
            const unsub = retryNowEvent.sub(() => {
                delayUntil = new Date().getTime()
            })
            events.retry.dispatch({retryStatus: 'sleep', countdownMilliseconds: getRestCountdown()})
            const interval = setInterval(() => {
                const rest = getRestCountdown()
                if (rest <= 0) {
                    clearInterval(interval)
                    unsub()
                    events.retry.dispatch({retryStatus: 'connecting'})
                    reconnect(true)
                    sleeping--
                    return
                }
                events.retry.dispatch({retryStatus: 'sleep', countdownMilliseconds: rest})
            }, 100)
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
            events.retry.dispatch({retryStatus: enable ? 'enabled' : 'disabled'})
        }
    }
}
