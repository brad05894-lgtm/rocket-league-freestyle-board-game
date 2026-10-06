// Secrets are encrypted for the intended browsers; room listeners receive ciphertext only.
// The participating coordinator is not a trusted server. This prevents accidental UI/room-state
// disclosure, not cheating by a player modifying their own client.
const enc=new TextEncoder(),dec=new TextDecoder();
const to64=b=>btoa(String.fromCharCode(...new Uint8Array(b)))
const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0))
const keyRequests=new Map();
export function identityKey(uid){
 if(keyRequests.has(uid))return keyRequests.get(uid);
 const create=async()=>{const key='rl-battle-key-v1-'+uid;let saved=localStorage.getItem(key);if(!saved){const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);const generated=JSON.stringify({privateKey:await crypto.subtle.exportKey('jwk',pair.privateKey),publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)});saved=localStorage.getItem(key)||generated;localStorage.setItem(key,saved)}return JSON.parse(saved)};
 const pending=(globalThis.navigator?.locks?globalThis.navigator.locks.request('rl-battle-key-'+uid,create):create()).catch(e=>{keyRequests.delete(uid);throw e});keyRequests.set(uid,pending);return pending;
}
export async function seal(publicKey,value){const receiver=await crypto.subtle.importKey('jwk',publicKey,{name:'ECDH',namedCurve:'P-256'},false,[]);const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey']);const key=await crypto.subtle.deriveKey({name:'ECDH',public:receiver},pair.privateKey,{name:'AES-GCM',length:256},false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));return {key:await crypto.subtle.exportKey('jwk',pair.publicKey),iv:to64(iv),body:to64(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(value))))}}
export async function unseal(uid,packet){if(!packet)return null;const own=await identityKey(uid);const sk=await crypto.subtle.importKey('jwk',own.privateKey,{name:'ECDH',namedCurve:'P-256'},false,['deriveKey']);const pk=await crypto.subtle.importKey('jwk',packet.key,{name:'ECDH',namedCurve:'P-256'},false,[]);const key=await crypto.subtle.deriveKey({name:'ECDH',public:pk},sk,{name:'AES-GCM',length:256},false,['decrypt']);return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(packet.iv)},key,from64(packet.body))))}
export async function hashSecret(value,salt){return to64(await crypto.subtle.digest('SHA-256',enc.encode(JSON.stringify([value,salt]))))}
export async function commitment(uid,value,publicKey){const salt=to64(crypto.getRandomValues(new Uint8Array(24)));return {hash:await hashSecret(value,salt),packet:await seal(publicKey,{value,salt})}}
