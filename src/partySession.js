const KEY = 'rl-party-session-v2'
export function readPartySession() {
 try { const s=JSON.parse(localStorage.getItem(KEY)||'null'); return s&&/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(s.roomCode)&&s.uid?s:null } catch {return null}
}
export function savePartySession(roomCode,uid) {try {localStorage.setItem(KEY,JSON.stringify({roomCode,uid}))} catch {}}
export function clearPartySession() {try {localStorage.removeItem(KEY)} catch {}}
