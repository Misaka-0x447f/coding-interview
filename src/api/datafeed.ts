import {createWebsocketConnection} from "./interface/websocket";
import {isNull} from 'lodash-es'

export type DataPoint = Record<'time' | 'open' | 'high' | 'low' | 'close' | 'volume', number>

export type DatafeedWSInstance = ReturnType<typeof createWebsocketConnection<DataPoint>>

export let datafeed: null | DatafeedWSInstance = null

export const connectIfNot = () => {
    if (!isNull(datafeed) && !datafeed.isClosed) return
    if (!datafeed) {
        datafeed = createWebsocketConnection('wss://trading-server-staging.azurewebsites.net/datafeed/subscribe/kline')
    } else {
        datafeed.reopen()
    }
    return new Promise<typeof datafeed>((resolve, reject) => {
        datafeed.events.opened.once(() => {
            resolve(datafeed)
            datafeed.send({"exchange": "binance", "market": "future", "symbol": "BTC/USDT", "resolution": "1m"})
        })
        datafeed.events.closed.once(reject)
    })
}

