const TYPE_BY_ID = {
  n11: 'Shop',
  n02: 'Danger Mechanic',
  n09: 'Lucky',

  // LOCKED lower-right loop board-specific Events.
  n04: 'Event',
  n06: 'Event',

  // LOCKED top-right loop.
  n55: 'Card',
  n58: 'Event',
  n15: 'Lucky',
  n17: 'Paratroopa',
  n19: 'Event',
  n20: 'Bad Luck',

  // LOCKED Boost Boulder lane.
  n21: 'Card',
  n22: 'Mechanic',
  n23: 'Card',
  n24: 'Mechanic',
  n25: 'Event',
  n26: 'Junction',
  n27: 'Event',
  n28: 'Mechanic',

  // TOP-LEFT OUTER ROUTE.
  n29: 'Mechanic',
  n31: 'Mechanic',
  n32: 'Lakitu',
  n33: 'Mechanic',
  n34: 'Bad Luck',
  n35: 'Card',
  n36: 'Event',
  n37: 'Junction',
  n41: 'Battle',
  n42: 'Junction',

  // TOP-LEFT INNER RECTANGLE from the Boulder-lane junction.
  n30: 'Danger Mechanic',
  n38: 'Mechanic',
  n39: 'Battle',
  n40: 'Lucky',

  // Counterclockwise Garage-Gate loop from n37.
  n43: 'Event',
  n44: 'Card',
  n45: 'Mechanic',
  n46: 'Mechanic',
  n47: 'Bad Luck',
  n48: 'Bad Luck',

  // NEW bottom-left split loop from n42.
  n50: 'Mechanic',
  n51: 'Shop',
  n52: 'Lucky',
  n59: 'Lucky',
  n60: 'Mechanic',
  n61: 'Mechanic',
  n62: 'Mechanic',
  n63: 'Danger Mechanic',
  n64: 'Mechanic',
  n65: 'Mechanic',
  n66: 'Card',
  n67: 'Bad Luck',
}


const NODE_POSITIONS = {
  // LOWER-RIGHT LOOP — LOCKED. Do not change until explicitly requested.
  n01: [1048, 700],
  n02: [1048, 636],
  n03: [1048, 572],
  n04: [1048, 508],
  n05: [1048, 444],
  n06: [984, 444],
  n07: [856, 444],
  n08: [856, 508],
  n09: [856, 572],
  n10: [856, 700],
  n11: [920, 700],
  n12: [984, 700],

  // TOP-RIGHT LOOP — LOCKED.
  n53: [1048, 380],
  n54: [1048, 316],
  n55: [1048, 252],
  n56: [1048, 188],
  n57: [1048, 124],
  n58: [1048, 60],
  n13: [984, 60],
  n14: [920, 60],
  n15: [856, 60],
  n16: [984, 316],
  n17: [920, 316],
  n18: [856, 316],
  n19: [856, 230],
  n20: [856, 145],

  // BOOST BOULDER LANE — LOCKED straight horizontal lane, right-to-left.
  n21: [792, 60],
  n22: [728, 60],
  n23: [664, 60],
  n24: [600, 60],
  n25: [536, 60],
  n26: [472, 60],
  n27: [408, 60],
  n28: [344, 60],

  // TOP-LEFT OUTER vertical route. The extra blue is restored between the lane-end blue and Lakitu.
  // Spacing is slightly normalized while preserving the exact vertical alignment.
  n29: [344, 116],
  n31: [344, 172],
  n32: [344, 228],
  n33: [344, 284],
  n34: [344, 340],
  n35: [344, 396],
  n36: [344, 452],
  n37: [344, 508],
  n41: [344, 572],
  n42: [344, 636],

  // TOP-LEFT INNER rectangle. VS n39 is directly above Lucky n40;
  // Lucky is the lower-right corner and runs straight left to shared Action Card n35.
  n30: [472, 124],
  n38: [472, 220],
  n39: [472, 316],
  n40: [472, 396],

  // Counterclockwise Garage-Gate rectangle. n46 is the top-right blue corner,
  // directly to the right of the Bad Luck row.
  n43: [408, 508],
  n44: [536, 508],
  n45: [664, 508],
  n46: [664, 396],
  n47: [600, 396],
  n48: [536, 396],

  // Bottom-left split loop from n42. Lower lane is pulled upward for a tighter rectangular footprint.
  // DOWN branch: Blue -> Shop stop -> Lucky -> right -> Lucky -> Blue -> Blue -> up.
  n50: [344, 700],
  n51: [344, 748],
  n52: [344, 796],
  n59: [472, 796],
  n60: [600, 796],
  n61: [728, 796],

  // Both branches converge here (replacement for the old Ally space = normal Mechanic).
  n62: [728, 700],

  // RIGHT branch: Red -> Blue -> Blue -> Action -> down to n62.
  n63: [472, 636],
  n64: [536, 636],
  n65: [600, 636],
  n66: [728, 636],

  // Forced right after convergence, then up into the blue immediately left of the first-loop shop.
  n67: [792, 700],
}


const MAIN_NEXT = {
  // Locked lower-right loop.
  n01: ['n02'],
  n02: ['n03'],
  n03: ['n04'],
  n04: ['n05'],
  n05: ['n06', 'n53'],
  n06: ['n07'],
  n07: ['n08'],
  n08: ['n09'],
  n09: ['n10'],
  n10: ['n11'],
  n11: ['n12'],
  n12: ['n01'],

  // Locked top-right loop.
  n53: ['n54'],
  n54: ['n55', 'n16'],
  n55: ['n56'],
  n56: ['n57'],
  n57: ['n58'],
  n58: ['n13'],
  n13: ['n14'],
  n14: ['n15'],
  n16: ['n17'],
  n17: ['n18'],
  n18: ['n19'],
  n19: ['n20'],
  n20: ['n15'],

  // Locked Boost Boulder lane.
  n15: ['n21'],
  n21: ['n22'],
  n22: ['n23'],
  n23: ['n24'],
  n24: ['n25'],
  n25: ['n26'],
  n26: ['n27', 'n30'],
  n27: ['n28'],

  // Top-left outer route.
  n28: ['n29'],
  n29: ['n31'],
  n31: ['n32'],
  n32: ['n33'],
  n33: ['n34'],
  n34: ['n35'],
  n35: ['n36'],
  n36: ['n37'],

  // At n37: straight/down continues to Battle; right enters the one-way Garage-Gate loop.
  n37: ['n41', 'n43'],
  n41: ['n42'],

  // n42 is the bottom-left split: keep going DOWN or turn RIGHT.
  n42: ['n50', 'n63'],

  // Inner top-left rectangle: Lucky n40 is the corner, then straight left to shared Action n35.
  n30: ['n38'],
  n38: ['n39'],
  n39: ['n40'],
  n40: ['n35'],

  // Counterclockwise-only Garage-Gate loop. n40 never points backward into Bad Luck.
  n43: ['n44'],
  n44: ['n45'],
  n45: ['n46'],
  n46: ['n47'],
  n47: ['n48'],
  n48: ['n40'],

  // Bottom-left DOWN branch.
  n50: ['n51'],
  n51: ['n52'],
  n52: ['n59'],
  n59: ['n60'],
  n60: ['n61'],
  n61: ['n62'],

  // Bottom-left RIGHT branch.
  n63: ['n64'],
  n64: ['n65'],
  n65: ['n66'],
  n66: ['n62'],

  // Shared convergence -> Bad Luck -> blue space left of the first Action Shop.
  n62: ['n67'],
  n67: ['n10'],
}


const SPECIAL_BY_ID = {
  // Locked first-loop board Events.
  n04: 'gate-switch-bridge-east',
  n06: 'gate-switch-bridge-west',

  // Top-right loop board Events.
  n58: 'reactor-trigger-c',
  n19: 'supply-crates',

  // Every Event on the horizontal Boost Boulder lane triggers the same boulder.
  n25: 'reactor-trigger-c',
  n27: 'reactor-trigger-c',

  // Top-left Whomp / Garage Gate Events.
  n36: 'gate-switch-top-left',
  n43: 'gate-switch-top-left',
}

const TROPHY_SPOTS = ['n35', 'n47', 'n52', 'n55']
const CHOICE_JUNCTIONS = new Set(['n05', 'n54', 'n26', 'n37', 'n42'])
const VISUAL_MODE_BY_ID = {
  n05: 'junction',
  n11: 'shop-dot',
  n54: 'junction',
  n26: 'junction',
  n17: 'paratroopa-dot',
  n32: 'lakitu-dot',
  n37: 'junction',
  n42: 'junction',
  n51: 'shop-dot',
}


const nodes = Object.entries(NODE_POSITIONS).map(([id, [x, y]]) => ({
  id,
  x,
  y,
  type: TYPE_BY_ID[id] || 'Mechanic',
  next: MAIN_NEXT[id] || [],
  special: SPECIAL_BY_ID[id] || null,
  trophySpot: TROPHY_SPOTS.includes(id),
  choiceJunction: CHOICE_JUNCTIONS.has(id),
  visualMode: VISUAL_MODE_BY_ID[id] || 'space',
}))

const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]))
for (const node of nodes) node.previous = []
for (const node of nodes) {
  for (const nextId of node.next) {
    if (nodeById[nextId]) nodeById[nextId].previous.push(node.id)
  }
}

export const BOOSTSTONE_RUINS = {
  id: 'booststone-ruins',
  name: 'Booststone Ruins',
  subtitle: 'Overgrown arena ruins with shifting Garage Gates, the Boost Boulder Chain, and hidden supply crates.',
  playerCount: { min: 2, max: 4 },
  defaultTrophyPrice: 10,
  startId: 'n01',
  width: 1240,
  height: 920,
  viewBox: { x: 100, y: 0, width: 1100, height: 920 },
  grid: { step: 64, offsetX: 24, offsetY: 60 },
  nodes,
  trophySpots: TROPHY_SPOTS,

  // Long vertical deck directly below the first blue space.
  startZone: {
    id: 'turn-order-platform',
    x: 1048,
    y: 826,
    width: 86,
    height: 150,
    label: 'Turn Order Platform',
    note: 'Before round 1, everyone rolls here to determine turn order.',
    bridgeTo: [1048, 700],
  },

  // Square-ish board footprint. Raised rectangular courts mimic the source board.
  terrain: [
    { id: 'lower-court', points: '72,430 790,430 790,774 72,774', elevation: 1 },
    { id: 'upper-left-court', points: '104,104 814,104 814,430 104,430', elevation: 2 },
    { id: 'boulder-lane-rise', points: '312,20 1100,20 1100,104 312,104', elevation: 4 },
    { id: 'upper-right-court', points: '816,28 1096,28 1096,410 816,410', elevation: 3 },
    { id: 'first-loop', points: '816,410 1172,410 1172,742 816,742', elevation: 3 },
    { id: 'shop-mound', points: '876,650 964,650 984,684 964,722 876,722 856,684', elevation: 4 },
    { id: 'start-deck-base', points: '996,742 1124,742 1124,910 996,910', elevation: 2 },
    { id: 'center-rise', points: '366,350 778,350 778,674 366,674', elevation: 2 },
    // Stepped top-left terraces derived from the isometric reference.
    { id: 'top-left-upper-step', points: '306,84 382,84 382,348 306,348', elevation: 3 },
    { id: 'top-left-lower-step', points: '306,348 382,348 382,680 306,680', elevation: 2 },
    { id: 'top-left-inner-loop', points: '396,96 510,96 510,396 396,396', elevation: 3 },
    { id: 'top-left-gate-loop', points: '390,350 632,350 632,534 390,534', elevation: 2 },
    { id: 'bottom-left-loop', points: '120,606 886,606 886,840 120,840', elevation: 1 },
  ],

  foliage: [
    [92, 130, 24], [172, 138, 20], [286, 132, 22], [430, 132, 18], [596, 128, 22],
    [704, 116, 20], [842, 120, 22], [1002, 126, 24], [1110, 188, 22],
    [1120, 342, 24], [1114, 526, 22], [1108, 716, 26], [1008, 742, 20], [918, 760, 20],
    [770, 790, 24], [612, 786, 22], [448, 792, 24], [286, 790, 22], [132, 784, 24],
    [70, 686, 20], [64, 548, 22], [68, 374, 22], [72, 226, 20],
    [832, 412, 18], [896, 406, 16], [972, 410, 16], [836, 708, 18], [952, 716, 18],
    [292, 150, 16], [292, 286, 18], [300, 420, 18], [446, 214, 16], [624, 132, 18], [816, 208, 18],
  ],

  shops: [
    { id: 'shop-first-loop', label: 'Action Shop', nodeId: 'n11', x: 920, y: 778, elevated: true },
    { id: 'shop-bottom-left', label: 'Action Shop', nodeId: 'n51', x: 252, y: 748, elevated: true, linkDirection: 'left' },
  ],

  gates: [
    { id: 'garage-gate-bridge-east', label: 'Garage Gate', between: ['n04', 'n05'], x: 1090, y: 476, toll: 3, group: 'ruins-gates' },
    { id: 'garage-gate-bridge-west', label: 'Garage Gate', between: ['n06', 'n07'], x: 920, y: 408, toll: 3, group: 'ruins-gates' },
    { id: 'garage-gate-west', label: 'Garage Gate', between: ['n20', 'n21'], x: 440, y: 540, toll: 3, group: 'ruins-gates' },
    { id: 'garage-gate-center', label: 'Garage Gate', between: ['n49', 'n50'], x: 504, y: 664, toll: 3, group: 'ruins-gates' },
  ],

  landmarks: [
    {
      id: 'crate-zone',
      kind: 'crates',
      label: 'Supply Crates',
      x: 670,
      y: 222,
      width: 280,
      height: 126,
      entranceNodeId: 'n19',
    },
    { id: 'lakitu', kind: 'lakitu', label: 'Lakitu', x: 280, y: 420, note: 'Steal Tokens / Trophy (rules next pass)' },
    { id: 'boulder-chain', kind: 'reactor', label: 'Boost Boulder Chain', x: 258, y: 60 },
  ],

  // Decorative raised blocks / broken ruin walls. Purely visual; they do not affect movement.
  ruinBlocks: [
    [332, 18, 68, 20, 12], [420, 18, 68, 20, 16], [508, 18, 68, 20, 10],
    [596, 18, 68, 20, 15], [684, 18, 68, 20, 12], [772, 18, 68, 20, 16],
    [860, 18, 68, 20, 12], [948, 18, 68, 20, 15],
    [110, 108, 22, 88, 14], [1080, 108, 22, 88, 14],
    [112, 390, 86, 22, 12], [704, 390, 86, 22, 14],
    [818, 408, 22, 96, 14], [1072, 408, 22, 96, 14],
  ],

  // No visual-only lane exits: every visible route here is now a real movement edge.
  laneExitHints: [],

  // Visual-only Manhattan routing. Movement still follows MAIN_NEXT.
  edgeRoutes: {
    // Locked lower-right loop.
    'n12->n01': [[984, 700]],

    // Locked top-right branch merge.
    'n20->n15': [[856, 124]],

    // Bottom-left return: Bad Luck is the corner, then path rises vertically into n10.
    'n67->n10': [[856, 700]],
  },

  boardEvents: {
    'reactor-trigger-a': {
      name: 'Boost Reactor Chain',
      oneUse: true,
      affectedNodes: ['n38', 'n39', 'n40', 'n41'],
      resetTo: 'n17',
      description: 'Triggers the west reactor lane and knocks affected players back to its entrance.',
    },
    'reactor-trigger-b': {
      name: 'Boost Reactor Chain',
      oneUse: true,
      affectedNodes: ['n42', 'n43', 'n44', 'n45'],
      resetTo: 'n38',
      description: 'Triggers the upper reactor lane and knocks affected players back to its entrance.',
    },
    'reactor-trigger-c': {
      name: 'Boost Boulder Chain',
      oneUse: false,
      affectedNodes: ['n58', 'n13', 'n14', 'n15', 'n21', 'n22', 'n23', 'n24', 'n25', 'n26', 'n27', 'n28'],
      resetTo: 'n57',
      description: 'Launches the Boost Boulder down the full horizontal lane. Any player caught on its lane is knocked back toward the safe blue space below the right-side trigger.',
    },
    'supply-crates': {
      name: '3 Supply Crates',
      description: 'Choose one of three mystery crates for a random reward.',
    },
    'ancient-boost-cache': {
      name: 'Ancient Boost Cache',
      description: 'Recover 3 Tokens from an old boost cache hidden in the ruins.',
    },
    'gate-switch-bridge-east': {
      name: 'Garage Gate Switch',
      description: 'Changes which route the Garage Gates are blocking.',
    },
    'gate-switch-bridge-west': {
      name: 'Garage Gate Switch',
      description: 'Changes which route the Garage Gates are blocking.',
    },
    'gate-switch-top-left': {
      name: 'Garage Gate Switch',
      description: 'Changes which route the Garage Gates are blocking.',
    },
    'gate-switch-west': {
      name: 'Garage Gate Switch',
      description: 'Changes which route the Garage Gates are blocking.',
    },
    'gate-switch-east': {
      name: 'Garage Gate Switch',
      description: 'Changes which route the Garage Gates are blocking.',
    },
    'gate-switch-center': {
      name: 'Garage Gate Switch',
      description: 'Changes which route the Garage Gates are blocking.',
    },
  },
}

export const BOARD_MAPS = [BOOSTSTONE_RUINS]
export function getBoardMap(mapId) {
  return BOARD_MAPS.find((map) => map.id === mapId) || BOOSTSTONE_RUINS
}
