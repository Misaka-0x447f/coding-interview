/**
 * An eventManager, but typed to prevent errors.
 * @example
 * type Payload = {ready: boolean}
 * const networkStateChange = createTypedEvent<Payload>()
 * const handler = (payload: Payload) => console.log(payload)
 * networkStateChange.sub(handler)
 * networkStateChange.dispatch({ready: true})
 * networkStateChange.unsub(handler)
 * @example
 * const misakaStateChange = createTypedEvent<{selfDestructionInProgress: boolean}>()
 * const unsub = createTypedEvent.sub(console.log) // returns unsub function without define handler outside.
 * unsub()
 * @example
 * export const eventBus = {
 *   alice: createTypedEvent(),
 *   bob: createTypedEvent<{isE2eEncryption: boolean}>()
 * }
 * eventBus.bob.dispatch({isE2eEncryption: true})
 *
 * @member sub      Subscribe to event. Returns an unsub method that does not require original callback.
 * @member unsub    Unsubscribe to event. Require original callback.
 * @member dispatch Simply dispatch payload to every subscriber.
 * @member once     Only subscribe once.
 */

type cb<T> = (payload: T) => void;

export const createTypedEvent = <T = void>(dispatchLastValueOnSubscribe?: boolean) => {
    const history: T[] = [];
    const cbs: Array<cb<T>> = [];
    const instance = {
        sub: (cb: cb<T>) => {
            cbs.push(cb);
            if (dispatchLastValueOnSubscribe && history.length > 0) cb(history[0]);
            return () => instance.unsub(cb);
        },
        unsub: (cb: cb<T>) => {
            const index = cbs.indexOf(cb);
            if (index === -1) return;
            cbs.splice(index, 1);
        },
        dispatch: (payload: T) => {
            cbs.map(v => v(payload));
            if (dispatchLastValueOnSubscribe) history[0] = payload;
        },
        once: (cb: cb<T>) => {
            instance.sub((arg: T) => {
                cb(arg);
                instance.unsub(cb);
            });
        }
    }
    return instance
}
