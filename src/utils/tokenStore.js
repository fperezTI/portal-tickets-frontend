// Access token lives in module memory only — never in localStorage or cookies.
// The refresh token lives in an httpOnly cookie managed by the backend.
let _accessToken = null;

export const setAccessToken  = (token) => { _accessToken = token; };
export const getAccessToken  = () => _accessToken;
export const clearAccessToken = () => { _accessToken = null; };
