// Layout-only prototype inspired by King Bob-omb's Powderkeg Mine.
// This file is intentionally NOT wired into Party gameplay yet.

const POSITIONS = {
  d01: [620, 820],
  d02: [620, 760],
  d03: [620, 700],
  d04: [620, 640],

  // Lower-left route.
  d05: [540, 700],
  d06: [460, 700],
  d07: [380, 700],
  d08: [300, 700],
  d09: [220, 650],
  d10: [220, 590],
  d11: [220, 530],
  d12: [300, 500],
  d13: [380, 500],
  d14: [460, 500],

  // Lower-right route.
  d15: [700, 700],
  d16: [780, 700],
  d17: [860, 700],
  d18: [940, 700],
  d19: [1020, 650],
  d20: [1020, 590],
  d21: [1020, 530],
  d22: [940, 500],
  d23: [860, 500],

  // King Bob-omb's central court.
  d24: [500, 460],
  d25: [500, 390],
  d26: [540, 330],
  d27: [620, 310],
  d28: [700, 330],
  d29: [740, 390],
  d30: [740, 460],
  d31: [620, 500],

  // Climb to the upper conveyor.
  d32: [620, 250],
  d33: [620, 190],
  d34: [620, 140],
  d35: [620, 95],
  d36: [620, 52],

  // Upper-left route.
  d37: [540, 78],
  d38: [460, 78],
  d39: [380, 100],
  d40: [300, 130],
  d41: [220, 170],
  d42: [180, 230],
  d43: [180, 300],
  d44: [220, 370],
  d45: [300, 420],
  d46: [380, 460],

  // Upper-right route.
  d47: [700, 78],
  d48: [780, 78],
  d49: [860, 100],
  d50: [940, 140],
  d51: [1020, 200],
  d52: [1020, 330],
}

const NEXT = {
  d01: ['d02'], d02: ['d03'], d03: ['d04'], d04: ['d05', 'd15'],

  d05: ['d06'], d06: ['d07'], d07: ['d08'], d08: ['d09'], d09: ['d10'],
  d10: ['d11'], d11: ['d12'], d12: ['d13'], d13: ['d14'], d14: ['d24'],

  d15: ['d16'], d16: ['d17'], d17: ['d18'], d18: ['d19'], d19: ['d20'],
  d20: ['d21'], d21: ['d22'], d22: ['d23'],

  d24: ['d25'], d25: ['d26'], d26: ['d27'], d27: ['d28', 'd32'],
  d28: ['d29'], d29: ['d30'], d30: ['d31'], d31: ['d23'],

  d32: ['d33'], d33: ['d34'], d34: ['d35'], d35: ['d36'], d36: ['d37', 'd47'],

  d37: ['d38'], d38: ['d39'], d39: ['d40'], d40: ['d41'], d41: ['d42'],
  d42: ['d43'], d43: ['d44'], d44: ['d45'], d45: ['d46'], d46: ['d14'],

  d47: ['d48'], d48: ['d49'], d49: ['d50'], d50: ['d51'], d51: ['d52'], d52: ['d23'],
}

const TYPES = {
  d01: 'Start',

  // Original red spaces -> Danger Mechanic.
  d03: 'Danger Mechanic',
  d13: 'Danger Mechanic',
  d21: 'Danger Mechanic',
  d46: 'Danger Mechanic',

  // Original Item (mushroom) spaces -> purple Action Card spaces.
  d06: 'Card',
  d16: 'Card',
  d33: 'Card',
  d38: 'Card',
  d48: 'Card',
  d50: 'Card',

  // Original VS spaces -> Battle spaces.
  d11: 'Battle',
  d34: 'Battle',
  d49: 'Battle',

  // Original Event spaces stay Event spaces and are pink in this prototype.
  d08: 'Event',
  d12: 'Event',
  d19: 'Event',
  d22: 'Event',
  d25: 'Event',
  d27: 'Event',
  d29: 'Event',
  d31: 'Event',
  d35: 'Event',
  d47: 'Event',

  d07: 'Lucky',
  d18: 'Lucky',
  d44: 'Lucky',

  d09: 'Bad Luck',
  d42: 'Bad Luck',
  d51: 'Bad Luck',

  // The three original Ally spaces are deliberately converted instead of kept.
  d10: 'Mechanic',
  d20: 'Lucky',
  d40: 'Card',
}

const CONVERTED_FROM = {
  d10: 'Ally',
  d20: 'Ally',
  d40: 'Ally',
}

const SPECIAL = {
  d08: 'mine-cart-left',
  d19: 'mine-cart-right',
  d12: 'gold-mine-gamble-left',
  d22: 'gold-mine-gamble-right',
  d25: 'royal-explosion',
  d27: 'royal-explosion',
  d29: 'royal-explosion',
  d31: 'royal-explosion',
  d35: 'conveyor-reversal',
  d47: 'conveyor-reversal',
}

const TROPHY_SPOTS = ['d07', 'd17', 'd28', 'd39', 'd52']

const nodes = Object.entries(POSITIONS).map(([id, [x, y]]) => ({
  id,
  x,
  y,
  type: TYPES[id] || 'Mechanic',
  next: NEXT[id] || [],
  special: SPECIAL[id] || null,
  trophySpot: TROPHY_SPOTS.includes(id),
  convertedFrom: CONVERTED_FROM[id] || null,
}))

const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]))
for (const node of nodes) node.previous = []
for (const node of nodes) {
  for (const nextId of node.next) {
    if (nodeById[nextId]) nodeById[nextId].previous.push(node.id)
  }
}

export const DEMO_MINES = {
  id: 'demo-mines',
  name: 'Demo Mines',
  subtitle: "Layout test inspired by King Bob-omb's Powderkeg Mine.",
  prototypeOnly: true,
  sourceBoard: "King Bob-omb's Powderkeg Mine",
  playerCount: { min: 2, max: 4 },
  defaultTrophyPrice: 10,
  startId: 'd01',
  width: 1240,
  height: 900,
  nodes,
  trophySpots: TROPHY_SPOTS,
  shops: [],
  gates: [],

  // Colors only affect the temporary design viewer.
  spaceColors: {
    Start: '#22c55e',
    Mechanic: '#3b82f6',
    'Danger Mechanic': '#ef4444',
    Card: '#a855f7',
    Battle: '#f59e0b',
    Event: '#ff5f8a',
    Lucky: '#16a34a',
    'Bad Luck': '#7c3aed',
  },

  terrain: [
    { id: 'bottom-deck', points: '450,615 790,615 790,860 450,860', elevation: 1, fill: '#5d5247' },
    { id: 'left-grate', points: '110,455 465,455 465,760 110,760', elevation: 1, fill: '#6a4a37' },
    { id: 'right-grate', points: '775,455 1130,455 1130,760 775,760', elevation: 1, fill: '#6a4a37' },
    { id: 'left-terrace', points: '125,110 485,110 485,515 125,515', elevation: 2, fill: '#574b40' },
    { id: 'right-terrace', points: '755,110 1115,110 1115,515 755,515', elevation: 2, fill: '#574b40' },
    { id: 'upper-conveyor-deck', points: '350,25 890,25 890,185 350,185', elevation: 3, fill: '#49433c' },
    { id: 'king-court', points: '430,275 810,275 810,545 430,545', elevation: 4, fill: '#3f4b42' },
  ],

  landmarks: [
    { id: 'king', kind: 'king-bobomb', label: 'KING BOB-OMB', x: 620, y: 408, radius: 72, countdown: 5 },
    { id: 'conveyor', kind: 'conveyor', label: 'REVERSING CONVEYOR', x: 620, y: 58, width: 300, height: 54 },
    { id: 'left-cart', kind: 'mine-cart', label: 'MINE CART', x: 292, y: 755 },
    { id: 'right-cart', kind: 'mine-cart', label: 'MINE CART', x: 1045, y: 378 },
    { id: 'gold-vein', kind: 'gold', label: 'GOLD MINE', x: 125, y: 425 },
  ],

  transportLinks: [
    { id: 'mine-cart-link', from: [300, 700], to: [1020, 650], label: 'Mine cart transport pair' },
  ],

  boardEvents: {
    'mine-cart-left': {
      name: 'Welcome to the Mine Cart!',
      description: 'Prototype marker for the board-wide mine-cart transport gimmick.',
    },
    'mine-cart-right': {
      name: 'Welcome to the Mine Cart!',
      description: 'Prototype marker for the board-wide mine-cart transport gimmick.',
    },
    'gold-mine-gamble-left': {
      name: 'Gold-Mine Gamble',
      description: 'Prototype marker for the mining gamble event.',
    },
    'gold-mine-gamble-right': {
      name: 'Gold-Mine Gamble',
      description: 'Prototype marker for the mining gamble event.',
    },
    'royal-explosion': {
      name: 'Royal Explosion!',
      description: 'One of the four center Event spaces that lowers King Bob-omb’s countdown.',
    },
    'conveyor-reversal': {
      name: 'Conveyor Belt Reversal!',
      description: 'Prototype marker for switching which upper conveyor path is active.',
    },
  },

  designNotes: [
    '52-space prototype matching the source board’s total space count.',
    'Blue spaces become Mechanic spaces and red spaces become Danger Mechanic spaces.',
    'All 6 mushroom Item spaces become purple Action Card spaces.',
    'All 3 VS spaces become Battle spaces.',
    'Event spaces stay Event spaces and are deliberately pink on Demo Mines.',
    'The 3 Ally spaces are replaced with 1 Mechanic, 1 Lucky, and 1 Action Card space for this first pass.',
    'King Bob-omb court, mine carts, gold-mine events, and the reversing upper conveyor are layout markers only for now.',
  ],
}
