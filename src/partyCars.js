export const PARTY_CARS = [
  {
    id: 'octane',
    name: 'Octane',
    specialDie: [1, 3, 3, 3, 5, 6],
  },
  {
    id: 'fennec',
    name: 'Fennec',
    specialDie: [1, 1, 1, 5, 6, 7],
  },
  {
    id: 'skyline',
    name: 'Nissan Skyline GT-R',
    specialDie: [0, 2, 4, 4, 4, 6],
  },
  {
    id: 'dingo',
    name: 'Dingo',
    specialDie: [3, 3, 3, 3, 4, 4],
  },
  {
    id: 'merc',
    name: 'Merc',
    specialDie: [
      { type: 'tokens', value: -2 },
      { type: 'tokens', value: -2 },
      6,
      6,
      6,
      6,
    ],
  },
  {
    id: 'mantis',
    name: 'Mantis',
    specialDie: [
      { type: 'tokens', value: -3 },
      { type: 'tokens', value: -3 },
      5,
      5,
      7,
      7,
    ],
  },
  {
    id: 'takumi',
    name: 'Takumi',
    specialDie: [0, 2, 3, 3, 5, 7],
  },
  {
    id: 'nimbus',
    name: 'Nimbus',
    specialDie: [
      { type: 'tokens', value: 2 },
      2,
      3,
      4,
      7,
      8,
    ],
  },
  {
    id: 'road-hog-xl',
    name: 'Road Hog XL',
    specialDie: [
      { type: 'tokens', value: 5 },
      0,
      0,
      0,
      10,
      10,
    ],
  },
  {
    id: 'twinzer',
    name: 'Twinzer',
    specialDie: [
      { type: 'tokens', value: 2 },
      0,
      0,
      7,
      7,
      7,
    ],
  },
  {
    id: 'dominus',
    name: 'Dominus',
    specialDie: [
      { type: 'tokens', value: -3 },
      { type: 'tokens', value: -3 },
      1,
      8,
      9,
      10,
    ],
  },
  {
    id: 'scarab',
    name: 'Scarab',
    specialDie: [
      { type: 'tokens', value: -2 },
      { type: 'tokens', value: -2 },
      2,
      5,
      6,
      7,
    ],
  },
  {
    id: 'masamune',
    name: 'Masamune',
    specialDie: [0, 4, 4, 4, 4, 6],
  },
  {
    id: 'breakout',
    name: 'Breakout',
    specialDie: [1, 1, 2, 3, 8, 10],
  },
  {
    id: 'gizmo',
    name: 'Gizmo',
    specialDie: [
      { type: 'tokens', value: -1 },
      3,
      3,
      3,
      5,
      6,
    ],
  },
  {
    id: 'dominus-gt',
    name: 'Dominus GT',
    specialDie: [0, 1, 4, 4, 8, 9],
  },
  {
    id: 'animus-gp',
    name: 'Animus GP',
    specialDie: [
      { type: 'tokens', value: -2 },
      { type: 'tokens', value: -2 },
      5,
      5,
      7,
      7,
    ],
  },
  {
    id: 'road-hog',
    name: 'Road Hog',
    specialDie: [1, 2, 3, 3, 5, 6],
  },
  {
    id: 'breakout-type-s',
    name: 'Breakout Type-S',
    specialDie: [1, 1, 1, 6, 6, 6],
  },
  {
    id: 'jager-619',
    name: 'Jäger 619',
    specialDie: [0, 3, 3, 3, 3, 8],
  },
]

export const PARTY_CAR_BY_ID = Object.fromEntries(
  PARTY_CARS.map((car) => [car.id, car])
)

export function formatPartyDieFace(face) {
  if (typeof face === 'number') return String(face)
  if (face?.type !== 'tokens') return '?'

  const sign = face.value > 0 ? '+' : ''
  return `${sign}${face.value} Token${Math.abs(face.value) === 1 ? '' : 's'}`
}

export function getPartyCar(carId) {
  return PARTY_CAR_BY_ID[carId] || null
}
