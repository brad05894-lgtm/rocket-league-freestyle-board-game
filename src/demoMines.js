// DEMO MINES V4 — approved visual layout and route graph, still prototype only. Deliberately NOT wired into Party gameplay.
// 51 playable spaces in this exact left-side route revision (one redundant Card removed). Spawn deck, four forks and four services do not cost a die step.
// Geometry is mirrored about x=620. Types/routes need not be mirrored: they follow
// the actual clockwise center loop and distinct left/right quadrants.
const playable = []
const stops = []
const at = (x, y) => [x, y]
const add = (id, type, [x, y], level, name, extras = {}) => {
  playable.push({ id, type, x, y, level, name, next: [], ...extras })
  return id
}
const stop = (id, kind, [x, y], level, name, extras = {}) => {
  stops.push({ id, kind, type: kind, x, y, level, name, nonSpace: true, next: [], ...extras })
  return id
}
const M = (id, p, level, name, extras) => add(id, 'Mechanic', p, level, name, extras)
const D = (id, p, level, name) => add(id, 'Danger Mechanic', p, level, name)
const C = (id, p, level, name, extras) => add(id, 'Card', p, level, name, extras)
const E = (id, p, level, name, special) => add(id, 'Event', p, level, name, { special })
const L = (id, p, level, name, extras) => add(id, 'Lucky', p, level, name, extras)
const B = (id, p, level, name) => add(id, 'Battle', p, level, name)
const U = (id, p, level, name) => add(id, 'Bad Luck', p, level, name)

// Start is a LARGE deck, not a green playable space. First playable space is d01.
M('d01', at(620, 812), 0, 'First blue — entry funnel')
D('d02', at(620, 720), 0, 'Mine staircase: Danger')
M('d03', at(620, 600), 2, 'Enter raised bomb courtyard')
// Center 5×5 perimeter, clockwise viewed from the foot of the map (visual CCW
// around the bomb when approached from the south). 16 equally spaced positions
// including TWO black, zero-cost junctions.
E('d04', at(705, 600), 2, 'Royal event — lower right', 'royal-explosion')
C('d05', at(790, 600), 2, 'Former Ally: Card', { convertedFrom: 'Ally' })
E('d06', at(790, 525), 2, 'Royal event — right', 'royal-explosion')
stop('j-northeast', 'Junction', at(790, 450), 2, 'Center fork: continue or exit east')
C('d07', at(790, 375), 2, 'Royal court: Card')
L('d08', at(790, 300), 2, 'Royal court: Lucky')
M('d09', at(705, 300), 2, 'Royal court: top right')
M('d10', at(620, 300), 2, 'Royal court: top center')
D('d11', at(535, 300), 2, 'Royal court: Danger')
E('d12', at(450, 300), 2, 'Royal event — upper left', 'royal-explosion')
C('d13', at(450, 375), 2, 'Royal court: Card')
M('d14', at(450, 450), 2, 'Royal court: left middle')
E('d15', at(450, 525), 2, 'Royal event — lower left', 'royal-explosion')
stop('j-southwest', 'Junction', at(450, 600), 2, 'Center fork: keep looping or exit west')
M('d16', at(535, 600), 2, 'Return to center entry')

// East edge, with a mirror of the west outer wall at x=205.
M('d17', at(882, 450), 2, 'Right branch: blue approach')
stop('j-east', 'Junction', at(1035, 450), 2, 'Right fork: up or down')
M('d18', at(1035, 514), 2, 'Right lower: blue 1')
M('d19', at(1035, 586), 2, 'Right lower: blue 2')
D('d20', at(1035, 658), 2, 'Right lower: Danger')
C('d21', at(1035, 720), 0, 'Right lower staircase: Card')
U('d22', at(1035, 812), 1, 'Right lower: Bad Luck')
M('d23', at(932, 812), 1, 'Right lower: back left')
C('d24', at(850, 812), 0, 'Right descent: Card')
L('d25', at(756, 812), 0, 'Former Ally: Lucky', { convertedFrom: 'Ally' })

// East climb, mirrored by west-side descent on the opposite half of the board.
C('d26', at(1035, 334), 2, 'Right climb: Card 1')
C('d27', at(1035, 268), 2, 'Right climb: Card 2')
stop('shop-east', 'Shop', at(1035, 225), 2, 'East Action Shop — optional, no die step')
M('d28', at(1035, 182), 3, 'Right terrace: blue')
E('d29', at(1035, 145), 3, 'Right terrace event', 'ore-lift')
M('d30', at(950, 145), 3, 'Right upper bridge: blue')
E('d31', at(865, 145), 4, 'Right switch event', 'conveyor-reversal')

// Highest-level upper rectangle. Only ONE direction is active per switch state.
L('d32', at(785, 209), 4, 'Lower conveyor: Lucky east')
L('d33', at(455, 209), 4, 'Lower conveyor: Lucky west')
M('d34', at(785, 82), 4, 'Upper conveyor: blue east')
stop('mini-bomb', 'Egg', at(620, 82), 4, 'Orange Rocket League egg nuisance — forced stop')
B('d35', at(455, 82), 4, 'Upper conveyor: VS west')
E('d36', at(375, 145), 4, 'Left switch event', 'conveyor-reversal')

// Left descent — the upper-left platform mirrors the right-hand climb.
M('d38', at(300, 145), 3, 'Upper west: blue, turn toward terrace')
M('d39', at(205, 145), 3, 'Upper west: blue, begin descent')
U('d40', at(205, 245), 3, 'Upper west: Bad Luck')
stop('steal-west', 'Steal', at(205, 290), 3, 'Steal stop — optional, no die step')
M('d41', at(205, 335), 1, 'West middle blue — join return / inward VS')
B('d42', at(320, 335), 1, 'Inward VS leading to court Event')

// West-middle split off the lower-left side of the royal court.
U('d43', at(345, 575), 1, 'Center lower-left to west fork: Bad Luck')
stop('j-west', 'Junction', at(205, 575), 1, 'Left fork: up or down')
E('d44', at(205, 515), 1, 'Left middle: Event', 'mine-cart-left')
M('d45', at(205, 455), 1, 'Left middle: blue')
E('d46', at(205, 395), 1, 'Left middle: Event', 'gold-mine-gamble-left')
// West lower path, in the same footprint as the east lower path.
D('d47', at(205, 645), 1, 'Left lower: Danger')
M('d48', at(205, 720), 0, 'Left staircase: blue')
stop('shop-west', 'Shop', at(205, 770), 0, 'West Action Shop — optional, no die step')
E('d49', at(205, 812), 0, 'Left mine Event', 'mine-cart-left')
C('d50', at(300, 812), 0, 'Former Ally: Card', { convertedFrom: 'Ally' })
M('d51', at(390, 812), 0, 'Left lower: blue')
B('d52', at(484, 812), 0, 'Left lower: VS')

const all = [...playable, ...stops]
const byId = Object.fromEntries(all.map(n => [n.id, n]))
const edges = []
const connect = (from, to, options = {}) => {
  if (!byId[from] || !byId[to]) throw Error(`Demo Mines broken link ${from} -> ${to}`)
  byId[from].next.push(to)
  edges.push({ id: `${from}->${to}`, from, to, ...options })
}
const chain = (...ids) => ids.slice(0, -1).forEach((id, i) => connect(id, ids[i+1]))
chain('d01','d02','d03','d04','d05','d06','j-northeast')
chain('j-northeast','d07','d08','d09','d10','d11','d12','d13','d14','d15','j-southwest')
chain('j-southwest','d16','d03')
chain('j-northeast','d17','j-east')
chain('j-east','d18','d19','d20','d21','d22','d23','d24','d25','d01')
chain('j-east','d26','d27','shop-east','d28','d29','d30','d31')
connect('d31','d32',{ lane: 'lower' })
connect('d32','d33',{ lane: 'lower' })
connect('d33','d36',{ lane: 'lower' })
connect('d31','d34',{ lane: 'upper' })
connect('d34','mini-bomb',{ lane: 'upper' })
connect('mini-bomb','d35',{ lane: 'upper' })
connect('d35','d36',{ lane: 'upper' })
chain('d36','d38','d39','d40','steal-west','d41','d42','d12')
chain('j-southwest','d43','j-west')
chain('j-west','d44','d45','d46','d41')
chain('j-west','d47','d48','shop-west','d49','d50','d51','d52','d01')
// The first blue is a forward-only funnel; incoming left/right routes end here.

for (const node of all) node.previous = []
for (const { from, to } of edges) byId[to].previous.push(from)
const deck = { id:'mine-entrance', x:620, y:925, width:385, height:110, level:0, label:'MINE ENTRANCE · ALL PLAYERS START' }
const terrain = [
  {id:'starting-deck', points:'412,860 828,860 828,996 412,996', elevation:0, fill:'#767267'},
  {id:'bottom-left', points:'160,607 554,607 554,850 160,850', elevation:0, fill:'#635447'},
  {id:'bottom-right', points:'686,607 1080,607 1080,850 686,850', elevation:0, fill:'#635447'},
  // One uninterrupted steel-floored starting lane; no burgundy gaps beside the first blue.
  {id:'bottom-continuous-deck', points:'160,779 1080,779 1080,850 160,850', elevation:0, fill:'#635447'},
  {id:'west-middle', points:'153,312 419,312 419,674 153,674', elevation:1, fill:'#665f51'},
  {id:'west-high', points:'153,120 419,120 419,297 153,297', elevation:3, fill:'#837a68'},
  {id:'east-middle', points:'821,248 1087,248 1087,674 821,674', elevation:1, fill:'#665f51'},
  {id:'east-high', points:'821,120 1087,120 1087,206 821,206', elevation:3, fill:'#837a68'},
  {id:'highest-conveyor', points:'342,37 898,37 898,244 342,244', elevation:4, fill:'#444b48'},
  {id:'royal-court', points:'415,265 825,265 825,634 415,634', elevation:2, fill:'#425447'},
]
const trophySpots = ['d09','d18','d25','d38','d51']
for (const node of playable) node.trophySpot = trophySpots.includes(node.id)
export const DEMO_MINES = {
  id:'demo-mines', name:'Demo Mines', subtitle:'Approved browser preview · corrected right Card landing, west VS connection and steel-floored start',
  prototypeOnly:true, sourceBoard:"King Bob-omb's Powderkeg Mine",
  playerCount:{min:2,max:4}, defaultTrophyPrice:10,
  width:1240, height:1020, symmetryAxisX:620,
  startDeck:deck, startId:'d01', entryId:'d01',
  nodes:playable, stops, edges, terrain, trophySpots,
  shops:stops.filter(n=>n.kind==='Shop'), gates:[],
  switchEvents:['d31','d36'], conveyorLanes:{lower:['d32','d33'],upper:['d34','mini-bomb','d35']}, defaultConveyorLane:'lower',
  spaceColors:{Mechanic:'#3489f5','Danger Mechanic':'#ef4444',Card:'#ae5bef',Battle:'#f9a725',Event:'#fb6192',Lucky:'#16a34a','Bad Luck':'#8251e9'},
  landmarks:[
    {id:'bomb',kind:'soccer-ball-bomb',x:620,y:440,radius:78,label:'KING BOOM',countdown:5},
    {id:'egg',kind:'orange-egg',x:620,y:27,radius:15,label:'ORANGE EGG'},
    {id:'conveyor',kind:'conveyor',x:620,y:141,width:520,height:185,label:'REVERSING CONVEYOR'},
  ],
  boardEvents:{
    'royal-explosion':{name:'Royal Soccer Bomb',description:'Center-loop event placeholder: advances the giant bomb countdown.'},
    'conveyor-reversal':{name:'Switch the Conveyor',description:'Landing here flips the active upper route; the preview toggle simulates it.'},
    'mine-cart-left':{name:'Mine Cart',description:'Left mine-cart event placeholder.'},
    'gold-mine-gamble-left':{name:'Gold Mine',description:'Gold mine event placeholder.'},
    'ore-lift':{name:'Ore Lift',description:'Upper-right mine machinery event placeholder.'},
  },
  designNotes:[
    '51 playable spaces retained from V3; 8 non-space stops; spawn deck never counts as a playable space.',
    'Approved map art is shown exactly in the browser. Source graph remains editable for the future 3D board.',
    'Right Card pair is on the lower terrace with the shop stop at its transition to the high terrace; bottom entry lane has continuous steel flooring.',
    'West VS reaches the upper-left center court Event through a square corner; 4 junctions, 2 shops, 1 Steal stop and 1 orange egg are non-space stops.',
    'Upper conveyor has two routes; a switch Event makes only one selectable. Toggle it in the preview.',
    'Former Ally spaces: d05 → Card, d25 → Lucky, d50 → Card.',
    'Purple = Card, orange VS = Battle, pink = Event, blue = Mechanic, red = Danger.',
    'Elevations are indicated on the prototype; they are NOT yet a 3D game board.',
    'Live Booststone Ruins and Party Mode remain unchanged.',
  ],
}
