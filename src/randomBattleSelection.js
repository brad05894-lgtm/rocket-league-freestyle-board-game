import { PARTY_CHALLENGES } from './partyChallengeCatalog'

const FORMATS_BY_SIZE = {
  2: ['1v1'],
  3: ['1v2', '1v1v1'],
  4: ['2v2', '1v3', '1v1v1v1'],
}

// Choose the format first so each eligible format has the same chance.
export function chooseRandomBattle(playerIds, random = Math.random) {
  const formats = FORMATS_BY_SIZE[playerIds.length]
  if (!formats || new Set(playerIds).size !== playerIds.length) {
    throw new Error('Random Battle needs 2–4 different active players.')
  }
  const available = formats.filter(format => PARTY_CHALLENGES.some(c => c.formats.includes(format)))
  if (!available.length) throw new Error('No battles are available for this party size.')
  const pick = items => items[Math.floor(random() * items.length)]
  const format = pick(available)
  const challenge = pick(PARTY_CHALLENGES.filter(c => c.formats.includes(format)))
  const participants = [...playerIds]
  for (let i = participants.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[participants[i], participants[j]] = [participants[j], participants[i]]
  }
  return { challengeId: challenge.id, format, participants }
}
