import animusGpImage from './assets/cars/animus-gp.png'
import breakoutImage from './assets/cars/breakout.png'
import breakoutTypeSImage from './assets/cars/breakout-type-s.png'
import dingoImage from './assets/cars/dingo.png'
import dominusImage from './assets/cars/dominus.png'
import dominusGtImage from './assets/cars/dominus-gt.png'
import fennecImage from './assets/cars/fennec.png'
import gizmoImage from './assets/cars/gizmo.png'
import jager619Image from './assets/cars/jager-619.png'
import mantisImage from './assets/cars/mantis.png'
import masamuneImage from './assets/cars/masamune.png'
import mercImage from './assets/cars/merc.png'
import nimbusImage from './assets/cars/nimbus.png'
import octaneImage from './assets/cars/octane.png'
import roadHogImage from './assets/cars/road-hog.png'
import roadHogXlImage from './assets/cars/road-hog-xl.png'
import scarabImage from './assets/cars/scarab.png'
import skylineImage from './assets/cars/skyline.png'
import takumiImage from './assets/cars/takumi.png'
import twinzerImage from './assets/cars/twinzer.png'

// Compatibility fallback for PartyMode versions that imported one shared image.
export const PARTY_CAR_IMAGE_FALLBACK = octaneImage

export function getPartyCarImageUrl(car) {
  return car?.imageUrl || octaneImage
}

export function getPartyCarImageFallback(car) {
  const name = car?.name || 'Rocket League Car'
  const accent = car?.id
    ? `hsl(${[...car.id].reduce((total, letter) => total + letter.charCodeAt(0), 0) % 360} 78% 60%)`
    : '#38bdf8'
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="360" height="220" viewBox="0 0 360 220">
      <rect width="360" height="220" rx="24" fill="#071426"/>
      <path d="M62 137h22l25-48h125l48 48h25c14 0 25 11 25 25v10H35v-10c0-14 12-25 27-25Z" fill="${accent}" opacity=".88"/>
      <path d="m126 103-17 34h145l-34-34Z" fill="#dbeafe" opacity=".72"/>
      <circle cx="99" cy="171" r="25" fill="#020617" stroke="#94a3b8" stroke-width="8"/>
      <circle cx="269" cy="171" r="25" fill="#020617" stroke="#94a3b8" stroke-width="8"/>
      <text x="180" y="44" text-anchor="middle" fill="#f8fafc" font-family="Arial, sans-serif" font-size="24" font-weight="700">${name.replace(/[&<>"']/g, '')}</text>
      <text x="180" y="207" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="13">IMAGE UNAVAILABLE</text>
    </svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export const PARTY_CARS = [
  {
    id: 'octane',
    name: 'Octane',
    imageUrl: octaneImage,
    specialDie: [1, 3, 3, 3, 5, 6],
  },
  {
    id: 'fennec',
    name: 'Fennec',
    imageUrl: fennecImage,
    specialDie: [1, 1, 1, 5, 6, 7],
  },
  {
    id: 'skyline',
    name: 'Nissan Skyline GT-R',
    imageUrl: skylineImage,
    specialDie: [0, 2, 4, 4, 4, 6],
  },
  {
    id: 'dingo',
    name: 'Dingo',
    imageUrl: dingoImage,
    specialDie: [3, 3, 3, 3, 4, 4],
  },
  {
    id: 'merc',
    name: 'Merc',
    imageUrl: mercImage,
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
    imageUrl: mantisImage,
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
    imageUrl: takumiImage,
    specialDie: [0, 2, 3, 3, 5, 7],
  },
  {
    id: 'nimbus',
    name: 'Nimbus',
    imageUrl: nimbusImage,
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
    imageUrl: roadHogXlImage,
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
    imageUrl: twinzerImage,
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
    imageUrl: dominusImage,
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
    imageUrl: scarabImage,
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
    imageUrl: masamuneImage,
    specialDie: [0, 4, 4, 4, 4, 6],
  },
  {
    id: 'breakout',
    name: 'Breakout',
    imageUrl: breakoutImage,
    specialDie: [1, 1, 2, 3, 8, 10],
  },
  {
    id: 'gizmo',
    name: 'Gizmo',
    imageUrl: gizmoImage,
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
    imageUrl: dominusGtImage,
    specialDie: [0, 1, 4, 4, 8, 9],
  },
  {
    id: 'animus-gp',
    name: 'Animus GP',
    imageUrl: animusGpImage,
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
    imageUrl: roadHogImage,
    specialDie: [1, 2, 3, 3, 5, 6],
  },
  {
    id: 'breakout-type-s',
    name: 'Breakout Type-S',
    imageUrl: breakoutTypeSImage,
    specialDie: [1, 1, 1, 6, 6, 6],
  },
  {
    id: 'jager-619',
    name: 'Jäger 619',
    imageUrl: jager619Image,
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
