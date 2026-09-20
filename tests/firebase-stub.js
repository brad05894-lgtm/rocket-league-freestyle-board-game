export let db
export const auth = { currentUser: null }
export function useTestPlayer(database, uid) { db = database; auth.currentUser = { uid } }
