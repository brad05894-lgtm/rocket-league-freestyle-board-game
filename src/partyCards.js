export const PARTY_CARDS = [
  { id: 'unlimited-tries', name: 'Unlimited Tries', description: 'After your Mechanic is revealed, use before Attempt 1. Take unlimited attempts within the existing 90-second limit; the clock never resets or extends.', enabled: true, effect: 'unlimited-attempts', timing: 'before-mechanic-attempt' },
  {
    id: 'boost-canister',
    name: 'Boost Canister',
    description: 'Use before rolling. Add +3 to the movement from your roll.',
    enabled: true,
    effect: 'movement-boost',
    amount: 3,
    timing: 'before-roll',
  },
  {
    id: 'golden-boost',
    name: 'Golden Boost',
    description: 'Use before rolling. Add +5 to the movement from your roll.',
    enabled: true,
    effect: 'movement-boost',
    amount: 5,
    timing: 'before-roll',
  },
  {
    id: 'precision-dice',
    name: 'Precision Dice',
    description: 'Use before rolling. Choose a result from 1–6 instead of rolling normally.',
    enabled: true,
    effect: 'precision-die',
    timing: 'before-roll',
  },
  {
    id: 'token-tornado',
    name: 'Token Tornado',
    description: 'Use before rolling. Choose a player and steal a random 4–8 Tokens from them, limited by what they have.',
    enabled: true,
    effect: 'token-steal',
    minAmount: 4,
    maxAmount: 8,
    requiresTarget: true,
    negativeTargetEffect: true,
    timing: 'before-roll',
  },
  {
    id: 'teleport-pad',
    name: 'Teleport Pad',
    description: 'Use before rolling. Swap your board position with another player.',
    enabled: true,
    effect: 'teleport-swap',
    requiresTarget: true,
    negativeTargetEffect: true,
    timing: 'before-roll',
  },
  {
    id: 'golden-teleporter',
    name: 'Golden Teleporter',
    description: 'Use before rolling. Teleport to one space before the active Trophy, then roll normally to try to reach it.',
    enabled: true,
    effect: 'golden-teleporter',
    timing: 'before-roll',
  },
  {
    id: 'shield',
    name: 'Shield',
    description: 'Use before rolling. Block the next negative Card another player uses on you.',
    enabled: true,
    effect: 'shield',
    timing: 'before-roll',
  },
  {
    id: 'double-payout',
    name: 'Double Payout',
    description: 'Use before rolling. Your next normal Mechanic pays double if you make it; if you miss, Double Payout is lost.',
    enabled: true,
    effect: 'double-payout',
    timing: 'before-roll',
  },

  // Classic Action Cards adapted into the Party inventory.
  {
    id: 'steal-card',
    name: 'Steal',
    description: 'Use before rolling. Hidden Hands: steal a random Card. Open Hands: choose exactly which Card to steal.',
    enabled: true,
    effect: 'steal-card',
    requiresTarget: true,
    negativeTargetEffect: true,
    timing: 'before-roll',
  },
  {
    id: 'swap-hands',
    name: 'Swap Hands',
    description: 'Use before rolling. Choose another player and swap your remaining Cards with theirs.',
    enabled: true,
    effect: 'swap-hands',
    requiresTarget: true,
    negativeTargetEffect: true,
    timing: 'before-roll',
  },
  {
    id: 'lockout',
    name: 'Lockout',
    description: 'Use before rolling. Choose another player. The next Card they try to use is discarded with no effect, then Lockout ends.',
    enabled: true,
    effect: 'lockout',
    requiresTarget: true,
    negativeTargetEffect: true,
    timing: 'before-roll',
  },
  {
    id: 'clean-slate',
    name: 'Clean Slate',
    description: 'Use before rolling. Replace your entire current Card inventory with the same number of new Cards.',
    enabled: true,
    effect: 'clean-slate',
    timing: 'before-roll',
  },
  {
    id: 'mulligan',
    name: 'Mulligan',
    description: 'After missing Attempt 1 of a normal or Danger Mechanic, use before Attempt 2 to add one extra attempt. The same Danger Mechanic stays active.',
    enabled: true,
    effect: 'mulligan',
    timing: 'after-first-miss',
  },
  {
    id: 'reroll',
    name: 'Reroll',
    description: 'Before attempting your landed Mechanic, discard it and draw a new Mechanic.',
    enabled: true,
    effect: 'mechanic-reroll',
    timing: 'before-mechanic-attempt',
  },
  {
    id: 'pick-your-poison',
    name: 'Pick Your Poison',
    description: 'Before attempting your landed Mechanic, draw 2 replacements and choose 1.',
    enabled: true,
    effect: 'pick-your-poison',
    timing: 'before-mechanic-attempt',
  },
  {
    id: 'pressure',
    name: 'Pressure',
    description: 'Use before rolling. Secretly target another player. Their next Mechanic will only have 1 attempt.',
    enabled: true,
    effect: 'pressure',
    requiresTarget: true,
    negativeTargetEffect: true,
    timing: 'before-roll',
  },
  {
    id: 'zero-bounce',
    name: 'Zero Bounce',
    description: 'Use before rolling. Secretly target another player. Their next Mechanic must be completed with no bounce.',
    enabled: true,
    effect: 'zero-bounce',
    requiresTarget: true,
    negativeTargetEffect: true,
    timing: 'before-roll',
  },
  {
    id: '100-kph',
    name: '100+ KPH',
    description: 'Use before rolling. Secretly target another player. Their next Mechanic goal must be 100+ KPH.',
    enabled: true,
    effect: '100-kph',
    requiresTarget: true,
    negativeTargetEffect: true,
    timing: 'before-roll',
  },
  {
    id: 'top-corner',
    name: 'Top Corner',
    description: 'Use before rolling. Secretly target another player. Their next Mechanic goal must finish in a top corner.',
    enabled: true,
    effect: 'top-corner',
    requiresTarget: true,
    negativeTargetEffect: true,
    timing: 'before-roll',
  },


  {
    id: 'copycat',
    name: 'Copycat',
    description: 'Before attempting your landed Mechanic, replace it with the most recently completed Mechanic by another player.',
    enabled: true,
    effect: 'copycat',
    timing: 'before-mechanic-attempt',
  },
  {
    id: 'insurance',
    name: 'Insurance',
    description: 'Before attempting a normal Mechanic, insure it. Gain +3 Tokens after it resolves whether you make it or miss it.',
    enabled: true,
    effect: 'insurance',
    timing: 'before-mechanic-attempt',
  },
  {
    id: 'hot-streak',
    name: 'Hot Streak',
    description: 'Use before rolling only if you made your most recent Mechanic. Your next normal Mechanic gets 1 attempt; make it to earn 2× its Token payout. A miss adds no extra penalty.',
    enabled: true,
    effect: 'hot-streak',
    timing: 'before-roll',
  },
  {
    id: 'jackpot',
    name: 'Jackpot',
    description: 'When you land on a normal Mechanic, choose whether to use Jackpot before the challenge is revealed. Success pays 2× what it would normally pay; missing all attempts loses the amount it would normally have paid.',
    enabled: true,
    effect: 'jackpot',
    timing: 'mechanic-landing-choice',
  },
  {
    id: 'difficulty-spike',
    name: 'Difficulty Spike',
    description: 'Before attempting your landed Mechanic, replace it with a random Mechanic one difficulty tier higher.',
    enabled: true,
    effect: 'difficulty-spike',
    timing: 'before-mechanic-attempt',
  },
  {
    id: 'difficulty-drop',
    name: 'Difficulty Drop',
    description: 'Before attempting your landed Mechanic, replace it with a random Mechanic one difficulty tier lower.',
    enabled: true,
    effect: 'difficulty-drop',
    timing: 'before-mechanic-attempt',
  },

  {
    id: 'free-pass',
    name: 'Free Pass',
    description: 'After a normal Mechanic is revealed but before Attempt 1, automatically complete it and receive its payout without taking the shot. Cannot be combined with Jackpot or Double Payout.',
    enabled: true,
    effect: 'free-pass',
    timing: 'before-mechanic-attempt',
  },


  // Remaining Cards still waiting on their supporting Party systems.
  {
    id: 'challenge-glove',
    name: 'Challenge Glove',
    description: 'Before rolling, choose the Battle format. The browser then randomly locks the other participants and team/solo assignment before revealing the random game; then continue your normal turn.',
    enabled: true,
    effect: 'challenge-glove',
    requiresTarget: false,
    timing: 'before-roll',
  },
  {
    id: 'airdrop-ticket',
    name: 'Airdrop Ticket',
    description: 'Call in a useful board reward.',
    enabled: false,
    comingSoon: 'Board reward Cards are coming with Events and Shops.',
    effect: 'airdrop-ticket',
    timing: 'before-roll',
  },
  {
    id: 'hidden-crate',
    name: 'Hidden Crate',
    description: 'Open a mystery reward crate.',
    enabled: false,
    comingSoon: 'Mystery rewards are coming with Lucky/Event systems.',
    effect: 'hidden-crate',
    timing: 'before-roll',
  },
]

export const PARTY_CARD_BY_ID = Object.fromEntries(
  PARTY_CARDS.map((card) => [card.id, card])
)

export function getPartyCard(cardId) {
  return PARTY_CARD_BY_ID[cardId] || null
}

export function getEnabledPartyCards() {
  return PARTY_CARDS.filter((card) => card.enabled !== false)
}


// Action Shop pricing. Cards without a numeric shop price are intentionally
// Card-space-only (or otherwise unavailable for purchase).
export const PARTY_CARD_SHOP_PRICES = Object.freeze({
  'boost-canister': 2,
  'golden-boost': 3,
  'precision-dice': 4,
  'token-tornado': 2,
  'teleport-pad': 4,
  'golden-teleporter': 8,
  shield: 2,
  'double-payout': 2,
  'steal-card': 2,
  'swap-hands': 2,
  lockout: 2,
  'clean-slate': 1,
  mulligan: 2,
  reroll: 1,
  'pick-your-poison': 2,
  pressure: 2,
  'zero-bounce': 2,
  '100-kph': 2,
  'top-corner': 2,
  copycat: 2,
  insurance: 1,
  'unlimited-tries': 2,
  'hot-streak': 4,
  jackpot: 3,
  'difficulty-spike': 1,
  'difficulty-drop': 1,
  'free-pass': 3,
  'challenge-glove': 2,
})

export function getPartyCardShopPrice(cardId) {
  const price = PARTY_CARD_SHOP_PRICES[cardId]
  return Number.isFinite(price) ? price : null
}

export function getPartyShopCards() {
  return getEnabledPartyCards().filter((card) => getPartyCardShopPrice(card.id) !== null)
}

export function pickPartyCard() {
  const enabledCards = getEnabledPartyCards()
  const pool = enabledCards.length ? enabledCards : PARTY_CARDS
  return pool[Math.floor(Math.random() * pool.length)]
}

export function normalizePartyCards(cards) {
  if (Array.isArray(cards)) return cards.filter((cardId) => Boolean(cardId) && cardId !== 'trade-offer' && cardId !== 'reverse')
  if (!cards || typeof cards !== 'object') return []

  return Object.keys(cards)
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => cards[key])
    .filter((cardId) => Boolean(cardId) && cardId !== 'trade-offer' && cardId !== 'reverse')
}
