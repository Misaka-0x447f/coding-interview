import {isEqual} from "lodash-es";

export const losslessStringify = (source: unknown) => {
    const error = new Error('The following object cannot be lossless stringify: ' + source)
    let res
    try {
        res = JSON.stringify(source)
    } catch (e) {
        console.error(e)
        throw error
    }
    if (!isEqual(source, JSON.parse(res))) {
        throw error
    }
    return res
}

export const tryCatchReturn = (tryFn: () => unknown, catchFn: (e: unknown) => unknown) => {
    try {
        return tryFn()
    } catch (e) {
        return catchFn(e)
    }
}

export const tryWithCustomHandler = (tryFn: () => unknown, handler: (e: Error) => void) => {
    try {
        return tryFn()
    } catch (e) {
        return handler(e)
    }
}

export const sleep = (milliseconds = 0) => new Promise(resolve => setTimeout(resolve, milliseconds))
