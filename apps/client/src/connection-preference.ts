// A renderer reload or Page switch must not silently resume a user-paused link.
export function connectionPaused() { return sessionStorage.getItem('greiva-connection-paused')==='1'; }
export function setConnectionPaused(paused: boolean) { sessionStorage.setItem('greiva-connection-paused',paused ? '1' : '0'); }
