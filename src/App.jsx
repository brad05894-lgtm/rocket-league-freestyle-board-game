import { useEffect, useRef, useState } from 'react'
import './App.css'
import OnlineLobby from './OnlineLobby'
import { endRoom, getClientId, leaveRoom, listenToGame, listenToRoom, saveGameState } from './multiplayer'
import { generateBoard } from './boardGenerator'
import GameBoard from './GameBoard'

const BOARD_LENGTH = 75
const FINISH_WAITING_BONUS_CAP = 3
const LANDING_REVEAL_MS = 1600
const ONLINE_SESSION_STORAGE_KEY = 'rl-freestyle-online-session-v1'
const LOCAL_GAME_STORAGE_KEY = 'rl-freestyle-local-game-v1'
const SOUND_STORAGE_KEY = 'rl-freestyle-sound-enabled-v1'
const PLAYER_ACCENTS = ['#38bdf8', '#f472b6', '#a3e635', '#fb923c']
let sharedAudioContext = null
let nextPlayerId = 1

function getSharedAudioContext() {
  if (typeof window === 'undefined') return null

  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    sharedAudioContext = new AudioContextClass()
  }

  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {})
  }

  return sharedAudioContext
}

function playTone(context, { frequency, duration = 0.08, delay = 0, volume = 0.025, type = 'sine' }) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const now = context.currentTime + delay

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, now)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + duration + 0.02)
}

function playGameSound(kind, enabled = true) {
  if (!enabled) return
  const context = getSharedAudioContext()
  if (!context) return

  const sequences = {
    spin: [
      { frequency: 240, duration: 0.055, delay: 0, type: 'triangle' },
      { frequency: 330, duration: 0.055, delay: 0.055, type: 'triangle' },
      { frequency: 440, duration: 0.075, delay: 0.11, type: 'triangle' },
    ],
    land: [
      { frequency: 520, duration: 0.11, volume: 0.028 },
      { frequency: 660, duration: 0.12, delay: 0.07, volume: 0.018 },
    ],
    turn: [
      { frequency: 392, duration: 0.08, volume: 0.018 },
      { frequency: 523, duration: 0.1, delay: 0.065, volume: 0.022 },
    ],
    success: [
      { frequency: 523, duration: 0.09, volume: 0.022 },
      { frequency: 659, duration: 0.1, delay: 0.07, volume: 0.025 },
      { frequency: 784, duration: 0.12, delay: 0.14, volume: 0.026 },
    ],
    fail: [
      { frequency: 280, duration: 0.11, volume: 0.02, type: 'triangle' },
      { frequency: 190, duration: 0.16, delay: 0.09, volume: 0.018, type: 'triangle' },
    ],
    win: [
      { frequency: 523, duration: 0.12, volume: 0.024 },
      { frequency: 659, duration: 0.12, delay: 0.1, volume: 0.025 },
      { frequency: 784, duration: 0.14, delay: 0.2, volume: 0.027 },
      { frequency: 1047, duration: 0.18, delay: 0.3, volume: 0.022 },
    ],
  }

  ;(sequences[kind] || sequences.land).forEach((tone) => playTone(context, tone))
}

const mechanicCards = [
  { name: 'Wall Air Dribble', difficulty: 'Easy', points: 1 },
  { name: 'Ground-to-Air Dribble', difficulty: 'Easy', points: 1 },
  { name: 'Ceiling Shot', difficulty: 'Easy', points: 1 },
  { name: 'Double Tap', difficulty: 'Easy', points: 1 },
  { name: 'Backboard Read', difficulty: 'Easy', points: 1 },
  { name: '45° Flick', difficulty: 'Easy', points: 1 },
  { name: 'Musty Flick', difficulty: 'Easy', points: 1 },
  { name: 'Breezi Flick', difficulty: 'Medium', points: 2 },
  { name: 'Kuxir Pinch', difficulty: 'Medium', points: 2 },
  { name: 'Ground Pinch 100+', difficulty: 'Medium', points: 2 },
  { name: 'Ceiling Pinch', difficulty: 'Medium', points: 2 },
  { name: 'Sidewall Redirect', difficulty: 'Medium', points: 2 },
  { name: 'Ground Pinch 120+', difficulty: 'Hard', points: 3 },
  { name: 'Flip Reset', difficulty: 'Medium', points: 2 },
  { name: 'Ground-to-Flip Reset', difficulty: 'Medium', points: 2 },
  { name: 'Wall-to-Flip Reset', difficulty: 'Medium', points: 2 },
  { name: 'Wavedash Reset', difficulty: 'Hard', points: 3 },
  { name: 'Ceiling-to-Flip Reset', difficulty: 'Medium', points: 2 },
  { name: 'Cross Map Air Dribble', difficulty: 'Medium', points: 2 },
  { name: 'Cross Map Flip Reset', difficulty: 'Hard', points: 3 },
  { name: 'Double Flip Reset', difficulty: 'Hard', points: 3 },
  { name: 'Triple Flip Reset', difficulty: 'Hard', points: 3 },
  { name: 'Stall Reset', difficulty: 'Hard', points: 3 },
  { name: 'Heli Reset', difficulty: 'Hard', points: 3 },
  { name: 'Pancake Reset', difficulty: 'Hard', points: 3 },
  { name: 'Pogo', difficulty: 'Medium', points: 2 },
  { name: 'Pogo Double Tap', difficulty: 'Hard', points: 3 },
  { name: 'Reset Pogo', difficulty: 'Hard', points: 3 },
  { name: 'Psycho', difficulty: 'Extreme', points: 4 },
  { name: 'Kuxir No Bounce', difficulty: 'Hard', points: 3 },
  { name: 'Ceiling Musty', difficulty: 'Medium', points: 2 },
  { name: 'Flip Reset Musty', difficulty: 'Hard', points: 3 },
  { name: 'Double Reset Musty', difficulty: 'Hard', points: 3 },
  { name: 'Musty Double Tap', difficulty: 'Hard', points: 3 },
  { name: 'Ceiling Double Tap', difficulty: 'Medium', points: 2 },
  { name: 'Flip Reset Double Tap', difficulty: 'Hard', points: 3 },
  { name: 'Air Dribble Double Tap', difficulty: 'Medium', points: 2 },
  { name: 'Glued Air Dribble', difficulty: 'Medium', points: 2 },
  { name: 'Aztral Pinch', difficulty: 'Hard', points: 3 },
  { name: 'Ceiling Pinch — No Bounce', difficulty: 'Hard', points: 3 },
  { name: 'Zen Shot', difficulty: 'Hard', points: 3 },
  { name: 'Mawkzy Flick', difficulty: 'Medium', points: 2 },
  { name: 'Sting Pop', difficulty: 'Hard', points: 3 },
  { name: 'Maktuf Reset', difficulty: 'Hard', points: 3 },
  { name: 'Plan B', difficulty: 'Medium', points: 2 },
  { name: 'Classy Flick', difficulty: 'Medium', points: 2 },
  { name: '180 Flick', difficulty: 'Medium', points: 2 },
  { name: 'Top Corner', difficulty: 'Medium', points: 2 },
  { name: 'Corner Read', difficulty: 'Medium', points: 2 },
  { name: 'BBL Pinch', difficulty: 'Hard', points: 3 },
  { name: 'Doomsee Dish', difficulty: 'Medium', points: 2 },
]

const actionCards = [
  {
  name: 'Mulligan',
  description:
    'After missing both normal mechanic attempts, gain 1 extra attempt.',
},
  {
  name: 'Shield',
  description:
    'Activate to block the next negative Action Card another player uses on you.',
},
  {
  name: 'Double Points',
  description:
    'Use before your first mechanic attempt. If you score, earn double points.',
},
 {
  name: 'Easy Route',
  description:
    'Before your first Mechanic attempt, skip the Mechanic and move forward 5 spaces. The new space does not activate.',
},
  {
  name: 'Reroll',
  description:
    'Use before your first mechanic attempt to discard it and draw a new Mechanic Card.',
},
  {
  name: 'Pick Your Poison',
  description:
    'Use before your first mechanic attempt. Draw 2 new Mechanic Cards and choose 1.',
},
  {
  name: 'Second Chance',
  description:
    'Use before spinning. Spin twice, then choose which result to use.',
},
  {
  name: 'Steal',
  description:
    'Choose another player and randomly steal 1 Action Card from their hand.',
},
  {
  name: 'Swap Hands',
  description:
    'Choose another player and swap your remaining Action Cards with theirs.',
},
  {
  name: 'Sabotage',
  description:
    'Choose another player and move them back 5 spaces. The space they land on does not activate.',
},
 {
  name: 'Pressure',
  description:
    'Secretly target another player. Their next Mechanic will only have 1 attempt.',
},
  {
  name: 'Point Tax',
  description:
    'Choose another player. They lose a random 1 to 3 points, minimum 0.',
},
  {
  name: 'Lockout',
  description:
    'Choose another player. They cannot use any Action Cards on their next turn.',
},
  {
  name: 'Reverse',
  description:
    'Reverse the turn order. The new order stays reversed until another Reverse is used.',
},
{
  name: 'Copycat',
  description:
    'Before your first Mechanic attempt, replace it with the most recently scored Mechanic by another player. You get 2 attempts for its normal points.',
},
  {
  name: 'Insurance',
  description:
    'Use before your first mechanic attempt. If you miss both attempts, still earn 1 point.',
},
  {
  name: 'Hot Streak',
  description:
    'Use after scoring a mechanic. Your next mechanic has only 1 attempt. Score it for +2 bonus points.',
},
{
  name: 'Jackpot',
  description:
    'Use before revealing a Mechanic Card. Score it for +3 bonus points. Miss both attempts and lose 3 points.',
},
  {
  name: 'Difficulty Spike',
  description:
    'Use before your first attempt to replace your mechanic with one difficulty tier higher. Cannot be used on Extreme.',
},
  {
  name: 'Difficulty Drop',
  description:
    'Use before your first attempt to replace your mechanic with one difficulty tier lower. Cannot be used on Easy.',
},
  {
  name: 'Trade Offer',
  description:
    'Choose another player. You each choose 1 Action Card to exchange, then both players confirm the trade.',
},
  {
  name: 'Snatch',
  description:
    'Choose another player and steal 1 point from them. They lose 1 point and you gain 1 point.',
},
  {
  name: 'Clean Slate',
  description:
    'Replace your entire Action Card hand with the same number of new Action Cards.',
},
  {
  name: 'Bank It',
  description:
    'Cash in this Action Card to gain 2 points.',
},
{
  name: 'Zero Bounce',
  description:
    'Choose another player. Their next Mechanic must be completed with no bounce. If the Mechanic already requires no bounce, this adds no extra shot requirement.',
},
{
  name: '100+ KPH',
  description:
    'Choose another player. Their next Mechanic must be scored at 100+ KPH. If the Mechanic already requires 100+ or 120+, this adds no extra shot requirement.',
},
{
  name: 'Top Corner',
  description:
    'Choose another player. Their next Mechanic must be scored in the top corner. If the Mechanic already requires a top-corner shot, this adds no extra shot requirement.',
},
]

const battleCards = [
  {
    number: 1,
    id: 'one-minute-1v1',
    name: '1-Minute 1v1',
    rules: [
      'The app randomly chooses one opponent.',
      'Play a normal 1v1 for 60 seconds, starting with a normal midfield kickoff.',
      'Both players may score however they want.',
      'After 60 seconds, the player with more goals wins.',
      'If tied, play sudden death. Next goal wins.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 2,
    id: 'beat-the-defender',
    name: 'Beat the Defender',
    rules: [
      'The app randomly chooses one opponent.',
      'Take turns as attacker and defender.',
      'Each player gets 3 attacking attempts from around midfield while the other player defends the net.',
      'Each attacking goal is 1 mini-point. A save or miss is 0.',
      'After 3 attacks each, the player with more goals wins.',
      'If tied, play sudden-death rounds. Each player gets 1 attack in the same round; if one scores and the other does not, the scorer wins. Otherwise repeat.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 3,
    id: 'freestyle-shootout',
    name: 'Freestyle Shootout',
    rules: [
      'The app randomly chooses one opponent.',
      'Each player gets 3 freestyle attempts total. Any freestyle move is allowed.',
      'Only successful goals are eligible for judging.',
      'After all attempts, compare each player\'s best successful freestyle shot. The players judge which shot was better.',
      'If one player misses all 3 and the other makes at least 1, the player who scored wins automatically.',
      'If both miss all 3, go to sudden death: 1 freestyle attempt each per round.',
      'In sudden death: one make and one miss means the scorer wins; both miss means repeat; both score means judge those two shots and the better shot wins.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 4,
    id: 'goalie-challenge',
    name: 'Goalie Challenge',
    rules: [
      'The app randomly chooses one opponent.',
      'Each player gets 3 shots to defend as goalie.',
      'Player A shoots 3 while Player B is goalie, then Player B shoots 3 while Player A is goalie.',
      'The goalie earns 1 mini-point for each save.',
      'After both players have defended 3 shots, the player with more saves wins.',
      'If tied, play sudden-death rounds. Each player faces 1 shot as goalie; if one saves and the other concedes, the saver wins. If both save or both concede, repeat.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 5,
    id: 'crossbar-contest',
    name: 'Crossbar Contest',
    rules: [
      'The app randomly chooses one opponent.',
      'Each player gets 3 attempts to hit the crossbar.',
      'Every attempt must start with the ball on the exact center kickoff spot and the shot taken from center.',
      'No wall setup, dribble setup, ceiling setup, or moving the ball elsewhere before the attempt.',
      'A crossbar hit counts as 1 mini-point. More hits after 3 attempts each wins.',
      'If tied, play sudden-death center-kickoff attempts: 1 attempt each per round. One hit and one miss means the hitter wins; both hit or both miss means repeat.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 6,
    id: 'same-mechanic-duel',
    name: 'Same Mechanic Duel',
    needsBattleMechanic: true,
    allowMutualConcede: true,
    rules: [
      'The app randomly chooses one opponent.',
      'Use the Battle-only mechanic draw on this screen. Both players must attempt the exact same drawn mechanic.',
      'Each player gets 3 attempts. Every successful completion is 1 mini-point.',
      'After 3 attempts each, more completions wins.',
      'If tied, play sudden-death rounds on the same mechanic: 1 attempt each. One make and one miss means the maker wins; both make or both miss means repeat.',
      'If the mechanic is too difficult or unreasonable, both players may mutually concede. Both must agree; then nobody earns board points.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 9,
    id: 'one-letter-horse',
    name: 'One-Letter HORSE',
    rules: [
      'The app randomly chooses one opponent.',
      'Randomly decide who sets first outside the app.',
      'The Setter must clearly call the freestyle shot before attempting it and gets exactly 1 attempt.',
      'If the Setter misses, roles switch and no challenge is set.',
      'If the Setter makes it, the Copier gets exactly 1 attempt to copy the called shot.',
      'If the Copier makes it, roles switch and the Copier becomes the new Setter.',
      'If the Copier misses, the Copier immediately loses. Only one failed copy is needed to lose.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 12,
    id: 'copycat-chain',
    name: 'Copycat Chain',
    rules: [
      'The app randomly chooses one opponent.',
      'One player starts by setting and making a freestyle shot.',
      'The other player gets exactly 1 attempt to copy it. Failing a copy is an immediate loss.',
      'If the Copier succeeds, that player gets exactly 1 attempt to upgrade the shot by adding something or making it harder.',
      'Failing an upgrade does NOT lose the Battle. The chain simply ends and the original Setter begins a brand-new chain.',
      'If the upgrade succeeds, the other player gets 1 attempt to copy the upgraded shot. Continue the chain the same way.',
      'A player only loses by failing to copy a successfully made shot, never by failing to create or land an upgrade.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 14,
    id: 'accuracy-horse',
    name: 'Accuracy HORSE',
    rules: [
      'The app randomly chooses one opponent.',
      'Randomly decide who sets first outside the app.',
      'The Setter calls the target before shooting, such as top left, top right, bottom left, bottom right, crossbar in, or post in.',
      'Every attempt must be a legitimate flick from a fair/reasonable distance from goal. Slow placements, dribbling the ball in, and point-blank tap-ins do not count.',
      'The Setter gets exactly 1 attempt. If the called target is missed, roles switch.',
      'If the Setter hits the called target, the Copier gets exactly 1 attempt to reproduce it with a valid flick.',
      'If the Copier misses, the Copier immediately loses. If the Copier makes it, roles switch.',
      'Crossbar in must hit the crossbar and go in. Post in must hit the post and go in.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 15,
    id: 'speed-challenge',
    name: 'Speed Challenge',
    rules: [
      'The app randomly chooses one opponent.',
      'Each player gets exactly 3 attempts to score the fastest shot possible. Pinches are allowed and will probably be the best option.',
      'Record the KPH of every successful goal. A miss counts as 0 KPH.',
      'Add all 3 attempt speeds together for each player.',
      'The player with the higher total KPH wins.',
      'If the totals are exactly tied, play sudden death: each player gets 1 shot and the faster successful shot wins. If both miss or tie exactly, repeat.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 18,
    id: 'kuxir-pinch-battle',
    name: 'Kuxir Pinch Battle',
    rules: [
      'The app randomly chooses one opponent.',
      'Play repeated rounds. Each player gets exactly 1 Kuxir pinch attempt per round.',
      'If exactly one player scores the Kuxir pinch, that player wins immediately.',
      'If both miss, repeat another round.',
      'If both score in the same round, compare shot speed. The faster Kuxir pinch wins.',
      'If the speeds are exactly tied, repeat another round.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 19,
    id: 'reset-ladder',
    name: 'Reset Ladder',
    allowMutualConcede: true,
    rules: [
      'The app randomly chooses one opponent.',
      'Start at 1 reset. Both players get exactly 1 attempt at the same required reset count.',
      'If one player scores and the other misses, the player who scored wins immediately.',
      'If both miss, repeat the same reset level.',
      'If both score, add 1 reset for the next round: single to double to triple to quadruple, and so on.',
      'Keep climbing until one player makes it and the other misses in the same round.',
      'If the required reset count becomes too difficult, both players may mutually concede. Both must agree; then nobody earns board points.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 20,
    id: 'kickoff-battle',
    name: 'Kickoff Battle',
    rules: [
      'The app randomly chooses one opponent.',
      'Play a best-of-3 series of normal 1v1 kickoffs.',
      'If the ball clearly ends up on the opponent\'s side of the field, you win that kickoff and earn 1 mini-point.',
      'First player to 2 mini-points wins the Battle.',
      'If a kickoff is too close or ambiguous to judge, redo that kickoff. Nobody earns a mini-point for the redo.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 21,
    id: 'training-pack-race',
    name: 'Training Pack Race',
    rules: [
      'The app randomly chooses one opponent.',
      'Pick a random training pack yourselves. The app does not choose the pack.',
      'The training pack must contain at least 10 shots.',
      'Both players start at Shot 1 and race through Shots 1-10 in order.',
      'Retry a shot as many times as needed until it is scored, then move to the next shot.',
      'The first player to successfully complete Shot 10 wins.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 22,
    id: 'lucky-spin',
    name: 'Lucky Spin',
    allPlayers: true,
    rules: [
      'Every active player participates.',
      'Each player gets exactly 1 special Battle spin from 1-10.',
      'These Battle spins do not move anyone on the board.',
      'The highest number wins.',
      'If multiple players tie for the highest number, the app randomly chooses one of those tied players as the winner.',
      'Winner earns +2 board points.',
      'Every other participating player loses 1 board point.',
    ],
  },
  {
    number: 23,
    id: 'reverse-one-minute-1v1',
    name: 'Reverse 1v1',
    rules: [
      'The app randomly chooses one opponent.',
      'Play the same 60-second 1v1 as the normal 1-Minute 1v1.',
      'Both players must drive in reverse for the entire Battle, including from the opening kickoff.',
      'No normal forward driving is allowed. If a player clearly drives forward to make a play, that play does not count.',
      'After 60 seconds, the player with more goals wins.',
      'If tied, play sudden death under the same reverse-only rule. Next valid goal wins.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 24,
    id: 'random-car-one-minute-1v1',
    name: 'Random Car 1v1',
    rules: [
      'The app randomly chooses one opponent.',
      'Before starting, each player must choose a random car and use that car for the entire Battle.',
      'Play a normal 1v1 for 60 seconds, starting with a normal midfield kickoff.',
      'Both players may score however they want, but neither player may switch cars during the Battle.',
      'After 60 seconds, the player with more goals wins.',
      'If tied, play sudden death with the same random cars. Next goal wins.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 25,
    id: 'random-mutators-one-minute-1v1',
    name: 'Random Mutators 1v1',
    rules: [
      'The app randomly chooses one opponent.',
      'Before starting, set random Rocket League mutators for the private match. Both players use the exact same mutator settings.',
      'Play a 60-second 1v1 with those mutators, starting from kickoff.',
      'Both players may score however the active mutators allow.',
      'After 60 seconds, the player with more goals wins.',
      'If tied, keep the same mutators and play sudden death. Next goal wins.',
      'Winner earns +2 board points. Loser loses 1 board point.',
    ],
  },
  {
    number: 26,
    id: 'demo-last-standing',
    name: 'Demo Last Standing',
    allPlayers: true,
    rules: [
      'Every active player participates.',
      'The goal is to demo the other players. Once a player gets demoed, that player is eliminated and must stop participating after they respawn.',
      'Keep playing until only one player has not been demoed.',
      'The last player standing wins.',
      'If the final two players are effectively demoed at the same time, only those two replay a sudden-death round.',
      'Winner earns +2 board points.',
      'Every other participating player loses 1 board point.',
    ],
  },
]

const eventCards = [
  {
    number: 1,
    id: 'everyone-advances',
    name: 'Everyone Advances',
    description: 'Every unfinished player moves forward 5 spaces. Finished players stay at Finish. Landed spaces do not activate.',
  },
  {
    number: 2,
    id: 'everyone-retreats',
    name: 'Everyone Retreats',
    description: 'Every unfinished player moves back 5 spaces. Finished players stay at Finish. Landed spaces do not activate.',
  },
  {
    number: 3,
    id: 'catch-up-boost',
    name: 'Catch-Up Boost',
    description: 'The unfinished player furthest back on the board moves forward 5 spaces. If tied, one of the tied players is chosen randomly.',
  },
  {
    number: 4,
    id: 'leader-tax',
    name: 'Leader Tax',
    description: 'The unfinished player furthest ahead on the board moves back 5 spaces. Finished players stay at Finish. If tied, one of the tied players is chosen randomly.',
  },
  {
    number: 5,
    id: 'position-swap',
    name: 'Position Swap',
    description: 'Two random unfinished players swap board positions. Finished players stay at Finish. The swapped-to spaces do not activate.',
  },
  {
    number: 8,
    id: 'rich-get-richer',
    name: 'Rich Get Richer?',
    description: 'The player with the fewest points gains 2 points. If tied, one of the tied players is chosen randomly.',
  },
  {
    number: 9,
    id: 'action-giveaway',
    name: 'Action Giveaway',
    description: 'Every unfinished player with fewer than 3 Action Cards draws 1 Action Card, if a card is available.',
  },
  {
    number: 10,
    id: 'action-purge',
    name: 'Action Purge',
    description: 'Every unfinished player holding at least 1 Action Card randomly discards 1.',
  },
  {
    number: 12,
    id: 'shuffle-up',
    name: 'Shuffle Up',
    description: 'Randomly rearrange the future player turn order. The current player stays the current player for this turn.',
  },
  {
    number: 13,
    id: 'point-leader-tax',
    name: 'Point Leader Tax',
    description: 'The player with the most points loses 2 points, minimum 0. If tied, one of the tied players is chosen randomly.',
  },
]


const boardSpaces = [
  'Start',
  'Mechanic',
  'Action',
  'Mechanic',
  'Mechanic',
  'Event',
  'Mechanic',
  'Battle',
  'Mechanic',
  'Mechanic',
  'Action',
  'Mechanic',
  'Action Shop',
  'Mechanic',
  'Mechanic',
  'Event',
  'Mechanic',
  'Action',
  'Mechanic',
  'Mechanic',
  'Battle',
  'Mechanic',
  'Gamble',
  'Mechanic',
  'Mechanic',
  'Action',
  'Mechanic',
  'Event',
  'Mechanic',
  'Mechanic',
  'Choose Difficulty',
  'Mechanic',
  'Battle',
  'Mechanic',
  'Mechanic',
  'Action',
  'Mechanic',
  'Action Shop',
  'Mechanic',
  'Mechanic',
  'Action',
  'Mechanic',
  'Event',
  'Mechanic',
  'Mechanic',
  'Battle',
  'Mechanic',
  'Action Shop',
  'Mechanic',
  'Mechanic',
  'Action',
  'Mechanic',
  'Event',
  'Mechanic',
  'Mechanic',
  'Action Shop',
  'Mechanic',
  'Battle',
  'Mechanic',
  'Mechanic',
  'Action',
  'Mechanic',
  'Shortcut Gate',
  'Mechanic',
  'Mechanic',
  'Action',
  'Mechanic',
  'Event',
  'Mechanic',
  'Mechanic',
  'Battle',
  'Mechanic',
  'Action',
  'Mechanic',
  'Mechanic',
  'Finish',
]

// The longer 75-space board keeps the Shortcut Gate late in the race.
// A successful shortcut skips 6 spaces and rejoins at Space 69, leaving
// Spaces 70-75 as a shared final stretch.
const SHORTCUT_GATE_POSITION = boardSpaces.indexOf('Shortcut Gate')
const SHORTCUT_EXIT_POSITION = 69

function shuffleDeck(cards) {
  const shuffled = [...cards]

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))

    ;[shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i],
    ]
  }

  return shuffled
}

function movePlayerAndHandleFinish(player, newPosition, actionCardsAtFinish = null) {
  // Once a player reaches Finish, they stay finished even if later board
  // effects would normally move a player backward.
  if (player.finished) {
    return {
      ...player,
      position: BOARD_LENGTH,
    }
  }

  const safePosition = Math.max(0, Math.min(BOARD_LENGTH, newPosition))

  if (safePosition < BOARD_LENGTH) {
    return {
      ...player,
      position: safePosition,
    }
  }

  const finishHand = actionCardsAtFinish ?? (player.actionCards || [])
  const cashoutBonus = finishHand.length === 3 ? 1 : 0

  return {
    ...player,
    position: BOARD_LENGTH,
    points: player.points + cashoutBonus,
    finished: true,
    finishWaitingBonus: 0,
    finishCashoutBonus: cashoutBonus,
    actionCards: [],
    hotStreakActive: false,
    pressureActive: false,
    shieldActive: false,
    lockoutActive: false,
    noBounceActive: false,
    kph100Active: false,
    topCornerActive: false,
    shortcutGateResolved: true,
  }
}

function App() {
  const [screen, setScreen] = useState('home')
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [leaveGameError, setLeaveGameError] = useState('')
  const [gameEndedNotice, setGameEndedNotice] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const saved = window.localStorage.getItem(SOUND_STORAGE_KEY)
      return saved === null ? true : saved === 'true'
    } catch {
      return true
    }
  })
  const soundEnabledRef = useRef(soundEnabled)
  const previousSpinRef = useRef(null)
  const previousTurnRef = useRef(null)
  const previousMechanicMessageRef = useRef('')
  const previousLandingUntilRef = useRef(null)
  const previousScreenRef = useRef('home')
  const [playerName, setPlayerName] = useState('')
  const [players, setPlayers] = useState([])

  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [spinResult, setSpinResult] = useState(null)
  const [hasSpun, setHasSpun] = useState(false)
  const [landedSpace, setLandedSpace] = useState(null)

  const [mechanicCard, setMechanicCard] = useState(null)
  const [lastScoredMechanic, setLastScoredMechanic] = useState(null)
  const [mechanicDeck, setMechanicDeck] = useState([])
  const [mechanicChoices, setMechanicChoices] = useState([])
  const [actionDeck, setActionDeck] = useState([])
  const [actionDiscardPile, setActionDiscardPile] = useState([])
  const [actionResolved, setActionResolved] = useState(true)
  const [actionMessage, setActionMessage] = useState('')
  const [attemptsLeft, setAttemptsLeft] = useState(0)
  const [mechanicResolved, setMechanicResolved] = useState(true)
  const [mechanicMessage, setMechanicMessage] = useState('')
  // Public, non-sensitive result for spectators. Never put Action Card names/effects here.
  const [publicMechanicOutcome, setPublicMechanicOutcome] = useState('')
  const [mechanicFailed, setMechanicFailed] = useState(false)
  const [doublePointsActive, setDoublePointsActive] = useState(false)
  const [insuranceActive, setInsuranceActive] = useState(false)
  const [mechanicActionUsed, setMechanicActionUsed] = useState(false)
  const [noBounceRequired, setNoBounceRequired] = useState(false)
  const [kph100Required, setKph100Required] = useState(false)
  const [topCornerRequired, setTopCornerRequired] = useState(false)
  const [secondChanceActive, setSecondChanceActive] = useState(false)
  const [secondChanceRolls, setSecondChanceRolls] = useState([])
  const [tradeOfferState, setTradeOfferState] = useState(null)
  const [actionCardUsedThisTurn, setActionCardUsedThisTurn] = useState(false)
  const [turnDirection, setTurnDirection] = useState(1)
  const [jackpotActive, setJackpotActive] = useState(false)
  const [awaitingMechanicDraw, setAwaitingMechanicDraw] = useState(false)

  const [battleDeck, setBattleDeck] = useState([])
  const [battleState, setBattleState] = useState(null)
  const [battleResolved, setBattleResolved] = useState(true)
  const [eventDeck, setEventDeck] = useState([])
  const [eventState, setEventState] = useState(null)
  const [eventResolved, setEventResolved] = useState(true)
  const [specialState, setSpecialState] = useState(null)
  const [specialResolved, setSpecialResolved] = useState(true)
  const [generatedBoard, setGeneratedBoard] = useState(null)
  const [landingAnnouncement, setLandingAnnouncement] = useState(null)
  const [landingAnnouncementClock, setLandingAnnouncementClock] = useState(() => Date.now())


  // Online multiplayer session. The actual game logic stays in this component;
  // Firebase simply mirrors the complete turn state between browsers.
  const [onlineSession, setOnlineSession] = useState(() => {
    try {
      const saved = window.localStorage.getItem(ONLINE_SESSION_STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const onlineSyncTimerRef = useRef(null)
  const hasHydratedOnlineStateRef = useRef(false)
  const lastAppliedRemoteStateKeyRef = useRef(null)

  useEffect(() => {
    if (!onlineSession?.roomCode) return

    try {
      window.localStorage.setItem(
        ONLINE_SESSION_STORAGE_KEY,
        JSON.stringify(onlineSession)
      )
    } catch (error) {
      console.warn('Could not save multiplayer recovery session:', error)
    }
  }, [onlineSession])

  useEffect(() => {
    if (!landingAnnouncement?.until) return

    const remaining = Math.max(0, landingAnnouncement.until - Date.now())
    const timer = window.setTimeout(
      () => setLandingAnnouncementClock(Date.now()),
      remaining + 30
    )

    return () => window.clearTimeout(timer)
  }, [landingAnnouncement])

  const landingAnnouncementActive = Boolean(
    landingAnnouncement?.until &&
      landingAnnouncementClock < landingAnnouncement.until
  )

  useEffect(() => {
    soundEnabledRef.current = soundEnabled
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, String(soundEnabled))
    } catch {
      // Sound preference is optional; the game still works without storage.
    }
  }, [soundEnabled])

  useEffect(() => {
    const unlock = () => {
      if (soundEnabledRef.current) getSharedAudioContext()
    }

    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    if (spinResult !== null && spinResult !== previousSpinRef.current) {
      playGameSound('spin', soundEnabledRef.current)
    }
    previousSpinRef.current = spinResult
  }, [spinResult])

  useEffect(() => {
    if (screen === 'game') {
      if (previousTurnRef.current !== null && previousTurnRef.current !== currentPlayerIndex) {
        playGameSound('turn', soundEnabledRef.current)
      }
      previousTurnRef.current = currentPlayerIndex
    }
  }, [currentPlayerIndex, screen])

  useEffect(() => {
    if (
      landingAnnouncement?.until &&
      landingAnnouncement.until !== previousLandingUntilRef.current
    ) {
      playGameSound('land', soundEnabledRef.current)
    }
    previousLandingUntilRef.current = landingAnnouncement?.until ?? null
  }, [landingAnnouncement])

  useEffect(() => {
    if (mechanicMessage && mechanicMessage !== previousMechanicMessageRef.current) {
      const normalized = mechanicMessage.toLowerCase()
      if (normalized.includes('scored!') || normalized.includes('finished!')) {
        playGameSound('success', soundEnabledRef.current)
      } else if (normalized.includes('failed!') || normalized.includes('missed both')) {
        playGameSound('fail', soundEnabledRef.current)
      }
    }
    previousMechanicMessageRef.current = mechanicMessage
  }, [mechanicMessage])

  useEffect(() => {
    if (screen === 'results' && previousScreenRef.current !== 'results') {
      playGameSound('win', soundEnabledRef.current)
    } else if (screen === 'game' && previousScreenRef.current !== 'game') {
      playGameSound('turn', soundEnabledRef.current)
    }
    previousScreenRef.current = screen
  }, [screen])

  const isOnlineGame = Boolean(onlineSession)
  const localClientId = onlineSession?.clientId || null
  const onlineHostId = onlineSession?.hostId || null
  const isOnlineHost = isOnlineGame && localClientId === onlineHostId
  const currentOnlinePlayerId = players[currentPlayerIndex]?.id ?? null
  const isMyOnlineTurn =
    !isOnlineGame || currentOnlinePlayerId === localClientId

  const localOnlinePlayerIndex = isOnlineGame
    ? players.findIndex((player) => player.id === localClientId)
    : currentPlayerIndex

  const localOnlinePlayer =
    players[localOnlinePlayerIndex] || players[currentPlayerIndex] || null

  const tradeInitiatorId = tradeOfferState
    ? players[tradeOfferState.initiatorIndex]?.id ?? null
    : null

  const tradeTargetId =
    tradeOfferState && tradeOfferState.targetIndex !== null
      ? players[tradeOfferState.targetIndex]?.id ?? null
      : null

  let onlineControlOwnerId = currentOnlinePlayerId

  if (isOnlineGame && tradeOfferState) {
    const targetStages = new Set([
      'target-choose',
      'handoff-initiator-review',
      'target-review',
    ])

    onlineControlOwnerId = targetStages.has(tradeOfferState.stage)
      ? tradeTargetId
      : tradeInitiatorId
  }

  const canUseOnlineControls =
    !isOnlineGame || onlineControlOwnerId === localClientId

  function buildOnlinePlayer(roomPlayer) {
    return {
      id: roomPlayer.id,
      name: roomPlayer.name,
      points: 0,
      position: 0,
      boardNodeId: null,
      routeHistory: [],
      hotStreakActive: false,
      pressureActive: false,
      shieldActive: false,
      lockoutActive: false,
      noBounceActive: false,
      kph100Active: false,
      topCornerActive: false,
      shortcutGateResolved: false,
      finished: false,
      leftGame: false,
      finishWaitingBonus: 0,
      finishCashoutBonus: 0,
      actionCards: [],
    }
  }

  function enterOnlineGame({ roomCode, room, clientId }) {
    const roomPlayers = room?.players
      ? Object.values(room.players).sort(
          (a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)
        )
      : []

    setOnlineSession({
      roomCode,
      clientId: clientId || getClientId(),
      hostId: room?.hostId || null,
    })

    setPlayers(roomPlayers.map(buildOnlinePlayer))
    setCurrentPlayerIndex(0)
    setScreen('rules')
  }

  const onlineStateSnapshot = {
    screen,
    players,
    currentPlayerIndex,
    spinResult,
    hasSpun,
    landedSpace,
    mechanicCard,
    lastScoredMechanic,
    mechanicDeck,
    mechanicChoices,
    actionDeck,
    actionDiscardPile,
    actionResolved,
    actionMessage,
    attemptsLeft,
    mechanicResolved,
    mechanicMessage,
    publicMechanicOutcome,
    mechanicFailed,
    doublePointsActive,
    insuranceActive,
    mechanicActionUsed,
    noBounceRequired,
    kph100Required,
    topCornerRequired,
    secondChanceActive,
    secondChanceRolls,
    tradeOfferState,
    actionCardUsedThisTurn,
    turnDirection,
    jackpotActive,
    awaitingMechanicDraw,
    battleDeck,
    battleState,
    battleResolved,
    eventDeck,
    eventState,
    eventResolved,
    specialState,
    specialResolved,
    generatedBoard,
    landingAnnouncement,
  }

  const onlineStateKey = JSON.stringify(onlineStateSnapshot)

  function applyRecoveredGameState(state) {
    if (!state) return

    if (state.screen !== undefined) setScreen(state.screen)
    if (state.players !== undefined) setPlayers(state.players)
    if (state.currentPlayerIndex !== undefined) setCurrentPlayerIndex(state.currentPlayerIndex)
    if (state.spinResult !== undefined) setSpinResult(state.spinResult)
    if (state.hasSpun !== undefined) setHasSpun(state.hasSpun)
    if (state.landedSpace !== undefined) setLandedSpace(state.landedSpace)
    if (state.mechanicCard !== undefined) setMechanicCard(state.mechanicCard)
    if (state.lastScoredMechanic !== undefined) setLastScoredMechanic(state.lastScoredMechanic)
    if (state.mechanicDeck !== undefined) setMechanicDeck(state.mechanicDeck)
    if (state.mechanicChoices !== undefined) setMechanicChoices(state.mechanicChoices)
    if (state.actionDeck !== undefined) setActionDeck(state.actionDeck)
    if (state.actionDiscardPile !== undefined) setActionDiscardPile(state.actionDiscardPile)
    if (state.actionResolved !== undefined) setActionResolved(state.actionResolved)
    if (state.actionMessage !== undefined) setActionMessage(state.actionMessage)
    if (state.attemptsLeft !== undefined) setAttemptsLeft(state.attemptsLeft)
    if (state.mechanicResolved !== undefined) setMechanicResolved(state.mechanicResolved)
    if (state.mechanicMessage !== undefined) setMechanicMessage(state.mechanicMessage)
    if (state.publicMechanicOutcome !== undefined) setPublicMechanicOutcome(state.publicMechanicOutcome)
    if (state.mechanicFailed !== undefined) setMechanicFailed(state.mechanicFailed)
    if (state.doublePointsActive !== undefined) setDoublePointsActive(state.doublePointsActive)
    if (state.insuranceActive !== undefined) setInsuranceActive(state.insuranceActive)
    if (state.mechanicActionUsed !== undefined) setMechanicActionUsed(state.mechanicActionUsed)
    if (state.noBounceRequired !== undefined) setNoBounceRequired(state.noBounceRequired)
    if (state.kph100Required !== undefined) setKph100Required(state.kph100Required)
    if (state.topCornerRequired !== undefined) setTopCornerRequired(state.topCornerRequired)
    if (state.secondChanceActive !== undefined) setSecondChanceActive(state.secondChanceActive)
    if (state.secondChanceRolls !== undefined) setSecondChanceRolls(state.secondChanceRolls)
    if (state.tradeOfferState !== undefined) setTradeOfferState(state.tradeOfferState)
    if (state.actionCardUsedThisTurn !== undefined) setActionCardUsedThisTurn(state.actionCardUsedThisTurn)
    if (state.turnDirection !== undefined) setTurnDirection(state.turnDirection)
    if (state.jackpotActive !== undefined) setJackpotActive(state.jackpotActive)
    if (state.awaitingMechanicDraw !== undefined) setAwaitingMechanicDraw(state.awaitingMechanicDraw)
    if (state.battleDeck !== undefined) setBattleDeck(state.battleDeck)
    if (state.battleState !== undefined) setBattleState(state.battleState)
    if (state.battleResolved !== undefined) setBattleResolved(state.battleResolved)
    if (state.eventDeck !== undefined) setEventDeck(state.eventDeck)
    if (state.eventState !== undefined) setEventState(state.eventState)
    if (state.eventResolved !== undefined) setEventResolved(state.eventResolved)
    if (state.specialState !== undefined) setSpecialState(state.specialState)
    if (state.specialResolved !== undefined) setSpecialResolved(state.specialResolved)
    if (state.generatedBoard !== undefined) setGeneratedBoard(state.generatedBoard)
    if (state.landingAnnouncement !== undefined) {
      setLandingAnnouncement(state.landingAnnouncement)
      setLandingAnnouncementClock(Date.now())
    }
  }

  // Restore a local/pass-and-play match after an accidental refresh.
  useEffect(() => {
    if (onlineSession?.roomCode) return

    try {
      const saved = JSON.parse(
        window.localStorage.getItem(LOCAL_GAME_STORAGE_KEY) || 'null'
      )

      if (saved?.state) {
        applyRecoveredGameState(saved.state)
      }
    } catch (error) {
      console.warn('Could not restore local game:', error)
    }
    // This intentionally runs only once on page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Watch the room itself as well as the shared game snapshot. This lets the
  // host close the room for everybody, even if another player's browser is idle
  // or it is not their turn.
  useEffect(() => {
    if (!onlineSession?.roomCode) return

    return listenToRoom(onlineSession.roomCode, (room) => {
      if (room && room.status !== 'ended') {
        // Keep host identity fresh in case room ownership ever changes.
        if (room.hostId && room.hostId !== onlineSession.hostId) {
          setOnlineSession((current) =>
            current ? { ...current, hostId: room.hostId } : current
          )
        }

        // During a live match, the host is the authority for player departures.
        // A player that leaves stays in the board/score history, but is marked
        // inactive forever so future turns and Battles never select them again.
        if (
          room.status === 'playing' &&
          room.hostId === onlineSession.clientId
        ) {
          const activeRoomIds = new Set(Object.keys(room.players || {}))

          setPlayers((currentPlayers) => {
            let changed = false
            const nextPlayers = currentPlayers.map((player) => {
              const leftGame = Boolean(
                player.leftGame || !activeRoomIds.has(String(player.id))
              )

              if (leftGame === Boolean(player.leftGame)) return player
              changed = true
              return { ...player, leftGame }
            })

            return changed ? nextPlayers : currentPlayers
          })
        }
        return
      }

      try {
        window.localStorage.removeItem(ONLINE_SESSION_STORAGE_KEY)
      } catch (error) {
        console.warn('Could not clear ended-room recovery data:', error)
      }

      setGameEndedNotice(
        room?.endedBy === onlineSession.clientId
          ? 'You ended the online game for everyone.'
          : 'The host ended the online game.'
      )
      setLeaveConfirmOpen(false)
      setOnlineSession(null)
      setScreen('game-ended')
    })
  }, [
    onlineSession?.roomCode,
    onlineSession?.clientId,
    onlineSession?.hostId,
  ])

  // Listen for game-state changes made by the other player's browser. The first
  // Firebase snapshot is always accepted, even if this same browser wrote it
  // before a refresh. That is what makes accidental-refresh recovery work.
  useEffect(() => {
    if (!onlineSession?.roomCode) return

    hasHydratedOnlineStateRef.current = false

    return listenToGame(onlineSession.roomCode, (payload) => {
      if (!payload?.state) return

      const isOwnEcho = payload.updatedBy === onlineSession.clientId
      if (isOwnEcho && hasHydratedOnlineStateRef.current) return

      hasHydratedOnlineStateRef.current = true
      // Remember the exact remote snapshot we just applied. The sync effect
      // below skips only that exact snapshot. This avoids a stale "skip next"
      // flag accidentally swallowing the host's Start Game update.
      lastAppliedRemoteStateKeyRef.current = JSON.stringify(payload.state)
      applyRecoveredGameState(payload.state)
    })
  }, [onlineSession?.roomCode, onlineSession?.clientId])

  // Broadcast local game changes. A short debounce lets React batch all the
  // state updates caused by one button press into one Firebase write.
  useEffect(() => {
    if (!onlineSession?.roomCode) return
    if (!['rules', 'game', 'results'].includes(screen)) return

    // Before the actual game starts, only the host owns the Rules snapshot.
    if (screen === 'rules' && !isOnlineHost) return

    if (lastAppliedRemoteStateKeyRef.current !== null) {
      if (lastAppliedRemoteStateKeyRef.current === onlineStateKey) {
        lastAppliedRemoteStateKeyRef.current = null
        return
      }
      // A real local change happened after the remote snapshot (for example,
      // the host pressed Start Game). Do not let an old remote key suppress it.
      lastAppliedRemoteStateKeyRef.current = null
    }

    if (onlineSyncTimerRef.current) {
      clearTimeout(onlineSyncTimerRef.current)
    }

    onlineSyncTimerRef.current = setTimeout(() => {
      saveGameState(
        onlineSession.roomCode,
        JSON.parse(onlineStateKey),
        onlineSession.clientId
      ).catch((error) => {
        console.error('Could not sync multiplayer game:', error)
      })
    }, 35)

    return () => {
      if (onlineSyncTimerRef.current) {
        clearTimeout(onlineSyncTimerRef.current)
      }
    }
  }, [
    onlineSession?.roomCode,
    onlineSession?.clientId,
    isOnlineHost,
    screen,
    onlineStateKey,
  ])

  // Keep a browser-local backup for pass-and-play games too. Online games use
  // Firebase as the source of truth, so they do not write this backup.
  useEffect(() => {
    if (isOnlineGame) return
    if (!['rules', 'game', 'results'].includes(screen)) return
    if (players.length === 0) return

    try {
      window.localStorage.setItem(
        LOCAL_GAME_STORAGE_KEY,
        JSON.stringify({ savedAt: Date.now(), state: onlineStateSnapshot })
      )
    } catch (error) {
      console.warn('Could not save local game recovery snapshot:', error)
    }
  }, [isOnlineGame, screen, players.length, onlineStateKey])

  function goHomeAndClearRecovery() {
    try {
      window.localStorage.removeItem(ONLINE_SESSION_STORAGE_KEY)
      window.localStorage.removeItem(LOCAL_GAME_STORAGE_KEY)
    } catch (error) {
      console.warn('Could not clear saved game recovery data:', error)
    }

    setOnlineSession(null)
    setScreen('home')
  }

  function openLeaveGameConfirmation() {
    setLeaveGameError('')
    setLeaveConfirmOpen(true)
  }

  function cancelLeaveGame() {
    setLeaveGameError('')
    setLeaveConfirmOpen(false)
  }

  async function confirmLeaveGame() {
    // The host owns the room. If the host leaves, close the room for everybody
    // so the match can never be left orphaned. Non-host players simply leave
    // this browser's session without affecting the room.
    if (isOnlineHost && onlineSession?.roomCode && onlineSession?.clientId) {
      try {
        setLeaveGameError('')
        await endRoom(onlineSession.roomCode, onlineSession.clientId)
        goHomeAndClearRecovery()
      } catch (error) {
        setLeaveGameError(error.message || 'Could not end the game.')
      }
      return
    }

    if (isOnlineGame && onlineSession?.roomCode && onlineSession?.clientId) {
      try {
        setLeaveGameError('')
        await leaveRoom(onlineSession.roomCode, onlineSession.clientId)
      } catch (error) {
        setLeaveGameError(error.message || 'Could not leave the room.')
        return
      }
    }

    setLeaveConfirmOpen(false)
    goHomeAndClearRecovery()
  }

  function backToLocalLobby() {
    try {
      window.localStorage.removeItem(LOCAL_GAME_STORAGE_KEY)
    } catch (error) {
      console.warn('Could not clear local recovery data:', error)
    }
    setScreen('lobby')
  }

  // Permanent emergency controls for online games. These live directly on
  // document.body so they remain clickable even when this browser is waiting
  // on another player's turn or the app is showing a Battle/Event/Special
  // sub-screen. Nothing inside the game layout can cover them.
  useEffect(() => {
    const overlayId = 'rl-persistent-online-controls'
    document.getElementById(overlayId)?.remove()

    if (
      !isOnlineGame ||
      screen === 'home' ||
      screen === 'game-ended' ||
      leaveConfirmOpen
    ) {
      return
    }

    const overlay = document.createElement('div')
    overlay.id = overlayId
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '12px',
      right: '12px',
      zIndex: '2147483647',
      display: 'flex',
      flexDirection: 'column',
      gap: '7px',
      alignItems: 'stretch',
      pointerEvents: 'auto',
      maxWidth: '210px',
    })

    const makeButton = (label, onClick, danger = false) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = label
      button.dataset.onlineAllowed = 'true'
      Object.assign(button.style, {
        padding: '9px 12px',
        borderRadius: '10px',
        border: danger
          ? '1px solid rgba(248,113,113,.9)'
          : '1px solid rgba(255,255,255,.28)',
        background: danger
          ? 'rgba(127,29,29,.96)'
          : 'rgba(15,23,42,.96)',
        color: '#fff',
        fontWeight: '800',
        fontSize: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,.35)',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
      })
      button.addEventListener('click', onClick)
      overlay.appendChild(button)
      return button
    }

    // Non-hosts can leave without affecting the room. For the host, this same
    // Leave Game button ends the room for everybody after confirmation.
    const leaveButton = makeButton(
      'Leave Game',
      openLeaveGameConfirmation,
      isOnlineHost
    )

    document.body.appendChild(overlay)

    return () => {
      leaveButton.removeEventListener('click', openLeaveGameConfirmation)
      overlay.remove()
    }
  }, [
    isOnlineGame,
    isOnlineHost,
    screen,
    leaveConfirmOpen,
  ])

  // Friendly-client prototype security: while a game is running, only the
  // browser belonging to the current player can operate game controls.
  // When this browser is waiting, controls it cannot use are also hidden so
  // the spectator view stays clean. Buttons that are intentionally usable
  // off-turn are marked with data-online-allowed="true" and remain visible.
  useEffect(() => {
    const spectatorLocked =
      isOnlineGame &&
      screen === 'game' &&
      !leaveConfirmOpen &&
      !canUseOnlineControls

    document.body.classList.toggle(
      'rl-online-spectator',
      spectatorLocked
    )

    if (!isOnlineGame || screen !== 'game' || leaveConfirmOpen) {
      return () => {
        document.body.classList.remove('rl-online-spectator')
      }
    }

    function blockSpectatorControls(event) {
      if (canUseOnlineControls) return

      const interactive = event.target?.closest?.(
        'button, input, select, textarea'
      )

      if (!interactive) return

      // A few multiplayer interactions intentionally belong to someone other
      // than the current turn owner (for example, the second Battle player
      // casting or cancelling their own concede vote).
      if (interactive.dataset?.onlineAllowed === 'true') return

      event.preventDefault()
      event.stopPropagation()
    }

    document.addEventListener('click', blockSpectatorControls, true)

    return () => {
      document.body.classList.remove('rl-online-spectator')
      document.removeEventListener('click', blockSpectatorControls, true)
    }
  }, [
    isOnlineGame,
    canUseOnlineControls,
    screen,
    leaveConfirmOpen,
  ])

  // If somebody leaves during the match, the host immediately advances past
  // that abandoned turn. endTurn() also ignores leftGame players permanently.
  useEffect(() => {
    if (!isOnlineGame || !isOnlineHost || screen !== 'game') return

    const currentPlayer = players[currentPlayerIndex]
    if (!currentPlayer?.leftGame) return

    endTurn()
  }, [
    isOnlineGame,
    isOnlineHost,
    screen,
    players,
    currentPlayerIndex,
  ])

  function addPlayer() {
    const name = playerName.trim()

    if (name === '') return
    if (players.length >= 4) return

    setPlayers([
      ...players,
      {
        id: nextPlayerId++,
        name,
        points: 0,
        position: 0,
        boardNodeId: null,
        routeHistory: [],
        hotStreakActive: false,
        pressureActive: false,
        shieldActive: false,
        lockoutActive: false,
        noBounceActive: false,
        kph100Active: false,
        topCornerActive: false,
        shortcutGateResolved: false,
        finished: false,
        leftGame: false,
        finishWaitingBonus: 0,
        finishCashoutBonus: 0,
        actionCards: [],
      },
    ])

    setPlayerName('')
  }

  function removePlayer(index) {
    setPlayers(players.filter((_, i) => i !== index))
  }

  function startGame() {
    const newBoard = generateBoard(
      `${Date.now()}-${Math.floor(Math.random() * 1000000)}`
    )

    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => ({
        ...player,
        points: 0,
        position: 0,
        boardNodeId: newBoard.startId,
        routeHistory: [newBoard.startId],
        hotStreakActive: false,
        pressureActive: false,
        shieldActive: false,
        lockoutActive: false,
        noBounceActive: false,
        kph100Active: false,
        topCornerActive: false,
        shortcutGateResolved: false,
        finished: false,
        leftGame: Boolean(player.leftGame),
        finishWaitingBonus: 0,
        finishCashoutBonus: 0,
        actionCards: [],
      }))
    )
    setCurrentPlayerIndex(0)
    setSpinResult(null)
    setHasSpun(false)
    setLandedSpace(null)

    setMechanicDeck(shuffleDeck(mechanicCards))
    setActionDeck(shuffleDeck(actionCards))
    setBattleDeck(shuffleDeck(battleCards))
    setEventDeck(shuffleDeck(eventCards))
    setActionDiscardPile([])
    setActionResolved(true)
    setActionMessage('')
    setMechanicCard(null)
    setMechanicChoices([])
    setMechanicResolved(true)
    setMechanicMessage('')
    setPublicMechanicOutcome('')
    setMechanicFailed(false)
    setDoublePointsActive(false)
    setInsuranceActive(false)
    setJackpotActive(false)
    setMechanicActionUsed(false)
    setAwaitingMechanicDraw(false)
    setActionCardUsedThisTurn(false)
    setTurnDirection(1)
    setLastScoredMechanic(null)
    setSecondChanceActive(false)
    setSecondChanceRolls([])
    setTradeOfferState(null)
    setNoBounceRequired(false)
    setKph100Required(false)
    setTopCornerRequired(false)
    setBattleState(null)
    setBattleResolved(true)
    setEventState(null)
    setEventResolved(true)
    setSpecialState(null)
    setSpecialResolved(true)
    setLandingAnnouncement(null)
    setLandingAnnouncementClock(Date.now())
    setGeneratedBoard(newBoard)

    setScreen('game')
  }

  function drawActionCard() {
  const currentPlayer = players[currentPlayerIndex]
  const hand = currentPlayer.actionCards || []

 if (hand.length >= 3) {
  setActionMessage(
    'Your hand is full. Choose a card to replace or skip the draw.'
  )
  return
}

  let deck = actionDeck

if (deck.length === 0) {
  deck = shuffleDeck(actionDiscardPile)
  setActionDiscardPile([])
}

  const drawnCard = deck[0]
  const remainingDeck = deck.slice(1)

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        actionCards: [
          ...(player.actionCards || []),
          drawnCard,
        ],
      }
    })
  )

  setActionDeck(remainingDeck)
  setActionResolved(true)
  setActionMessage('An Action Card was drawn.')
}

function replaceActionCard(cardIndex) {
  const currentPlayer = players[currentPlayerIndex]
  const replacedCard = currentPlayer.actionCards[cardIndex]
  let deck = actionDeck

 if (deck.length === 0) {
  deck = shuffleDeck(actionDiscardPile)
  setActionDiscardPile([])
}

  const drawnCard = deck[0]
  const remainingDeck = deck.slice(1)

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      const newHand = [...(player.actionCards || [])]

      newHand[cardIndex] = drawnCard

      return {
        ...player,
        actionCards: newHand,
      }
    })
  )

  setActionDeck(remainingDeck)
  setActionDiscardPile((currentPile) => [
  ...currentPile,
  replacedCard,
])
  setActionResolved(true)
  setActionMessage(
    'An Action Card was replaced with a new card.'
  )
}

function useMulligan() {
  const currentPlayer = players[currentPlayerIndex]

  const mulliganIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Mulligan'
  )

  if (mulliganIndex === -1) {
    return
  }

  if (!mechanicCard || !mechanicFailed || mechanicActionUsed || actionCardUsedThisTurn) {
    return
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        actionCards: (player.actionCards || []).filter(
          (_, cardIndex) => cardIndex !== mulliganIndex
        ),
      }
    })
  )
setActionDiscardPile((currentPile) => [
  ...currentPile,
  currentPlayer.actionCards[mulliganIndex],
])
  setAttemptsLeft(1)
  setMechanicResolved(false)
  setMechanicFailed(false)
  setPublicMechanicOutcome('')
  setMechanicActionUsed(true)
  setActionCardUsedThisTurn(true)
  setMechanicMessage(
    'Mulligan used! You have 1 extra attempt.'
  )
}

function useDoublePoints() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Double Points'
  )

  if (cardIndex === -1) {
    return
  }

  if (!mechanicCard || mechanicResolved || attemptsLeft !== 2 || mechanicActionUsed || actionCardUsedThisTurn) {
    return
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        actionCards: (player.actionCards || []).filter(
          (_, index) => index !== cardIndex
        ),
      }
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setDoublePointsActive(true)
setMechanicActionUsed(true)
setActionCardUsedThisTurn(true)
  setMechanicMessage(
    'Double Points activated! Score this mechanic for double points.'
  )
}

function useReroll() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Reroll'
  )

  if (cardIndex === -1) {
    return
  }

  if (
    !mechanicCard ||
    mechanicResolved ||
    attemptsLeft !== 2 ||
    doublePointsActive || mechanicActionUsed || actionCardUsedThisTurn
  ) {
    return
  }

  let deck = mechanicDeck

  if (deck.length === 0) {
    deck = shuffleDeck(mechanicCards)
  }

  const drawnCard = deck[0]
  const remainingDeck = deck.slice(1)

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        actionCards: (player.actionCards || []).filter(
          (_, index) => index !== cardIndex
        ),
      }
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setMechanicCard(drawnCard)
  setMechanicDeck(remainingDeck)
  setAttemptsLeft(2)
  setMechanicResolved(false)
  setMechanicFailed(false)
setMechanicActionUsed(true)
setActionCardUsedThisTurn(true) 
setMechanicMessage(
    `Reroll used! New mechanic: ${drawnCard.name}`
  )
}

function usePickYourPoison() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Pick Your Poison'
  )

  if (cardIndex === -1) {
    return
  }

  if (
    !mechanicCard ||
    mechanicResolved ||
    attemptsLeft !== 2 ||
    doublePointsActive ||
    mechanicChoices.length > 0 || mechanicActionUsed || actionCardUsedThisTurn
  ) {
    return
  }

  let deck = [...mechanicDeck]

  if (deck.length < 2) {
    const freshDeck = shuffleDeck(mechanicCards).filter(
      (card) =>
        !deck.some(
          (existingCard) => existingCard.name === card.name
        )
    )

    deck = [...deck, ...freshDeck]
  }

  const choiceOne = deck[0]
  const choiceTwo = deck[1]
  const remainingDeck = deck.slice(2)

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        actionCards: (player.actionCards || []).filter(
          (_, index) => index !== cardIndex
        ),
      }
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setMechanicDeck(remainingDeck)

  setMechanicChoices([
    choiceOne,
    choiceTwo,
  ])

  setMechanicCard(null)
  setMechanicResolved(false)
  setMechanicFailed(false)
setMechanicActionUsed(true)
setActionCardUsedThisTurn(true)  
setMechanicMessage(
    'Pick Your Poison used! Choose one mechanic.'
  )
}

function chooseMechanicChoice(choiceIndex) {
  const selectedCard = mechanicChoices[choiceIndex]

  if (!selectedCard) {
    return
  }

  setMechanicCard(selectedCard)
  setMechanicChoices([])
  setAttemptsLeft(2)
  setMechanicResolved(false)
  setMechanicFailed(false)

  setMechanicMessage(
    `You chose ${selectedCard.name}.`
  )
}

function useInsurance() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Insurance'
  )

  if (cardIndex === -1) {
    return
  }

  if (
    !mechanicCard ||
    mechanicResolved ||
    attemptsLeft !== 2 ||
    doublePointsActive ||
    insuranceActive || mechanicActionUsed || actionCardUsedThisTurn
  ) {
    return
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        actionCards: (player.actionCards || []).filter(
          (_, index) => index !== cardIndex
        ),
      }
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setInsuranceActive(true)
setMechanicActionUsed(true)
setActionCardUsedThisTurn(true)  
setMechanicMessage(
    'Insurance activated! If you miss both attempts, you still earn 1 point.'
  )
}

function useJackpot() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Jackpot'
  )

  if (cardIndex === -1) {
    return
  }

  if (
  landedSpace !== 'Mechanic' ||
  !awaitingMechanicDraw ||
  mechanicCard ||
  mechanicActionUsed ||
  actionCardUsedThisTurn
) {
  return
}

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        actionCards: (player.actionCards || []).filter(
          (_, index) => index !== cardIndex
        ),
      }
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setJackpotActive(true)
  setMechanicActionUsed(true)
  setActionCardUsedThisTurn(true)

  setMechanicMessage(
    'Jackpot activated! Now draw your Mechanic Card.'
  )
}

function useDifficultyDrop() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Difficulty Drop'
  )

  if (cardIndex === -1) {
    return
  }

  if (
    !mechanicCard ||
    mechanicResolved ||
    attemptsLeft !== 2 ||
    mechanicActionUsed ||
    mechanicCard.difficulty === 'Easy' || actionCardUsedThisTurn
  ) {
    return
  }

  let targetDifficulty = ''

  if (mechanicCard.difficulty === 'Extreme') {
    targetDifficulty = 'Hard'
  } else if (mechanicCard.difficulty === 'Hard') {
    targetDifficulty = 'Medium'
  } else if (mechanicCard.difficulty === 'Medium') {
    targetDifficulty = 'Easy'
  }

  const possibleCards = mechanicDeck.filter(
    (card) => card.difficulty === targetDifficulty
  )

  if (possibleCards.length === 0) {
    return
  }

  const randomIndex = Math.floor(
    Math.random() * possibleCards.length
  )

  const newMechanic = possibleCards[randomIndex]

  const newDeck = mechanicDeck.filter(
    (card) => card !== newMechanic
  )

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        actionCards: (player.actionCards || []).filter(
          (_, index) => index !== cardIndex
        ),
      }
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setMechanicCard(newMechanic)
  setMechanicDeck(newDeck)
  setAttemptsLeft(2)
  setMechanicResolved(false)
  setMechanicFailed(false)
  setMechanicActionUsed(true)
  setActionCardUsedThisTurn(true)
  setMechanicMessage(
    `Difficulty Drop used! New mechanic: ${newMechanic.name} (${newMechanic.difficulty}).`
  )
}

function useDifficultySpike() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Difficulty Spike'
  )

  if (cardIndex === -1) {
    return
  }

  if (
    !mechanicCard ||
    mechanicResolved ||
    attemptsLeft !== 2 ||
    mechanicActionUsed ||
    mechanicCard.difficulty === 'Extreme' || actionCardUsedThisTurn
  ) {
    return
  }

  let targetDifficulty = ''

  if (mechanicCard.difficulty === 'Easy') {
    targetDifficulty = 'Medium'
  } else if (mechanicCard.difficulty === 'Medium') {
    targetDifficulty = 'Hard'
  } else if (mechanicCard.difficulty === 'Hard') {
    targetDifficulty = 'Extreme'
  }

  const possibleCards = mechanicDeck.filter(
    (card) => card.difficulty === targetDifficulty
  )

  if (possibleCards.length === 0) {
    return
  }

  const randomIndex = Math.floor(
    Math.random() * possibleCards.length
  )

  const newMechanic = possibleCards[randomIndex]

  const newDeck = mechanicDeck.filter(
    (card) => card !== newMechanic
  )

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        actionCards: (player.actionCards || []).filter(
          (_, index) => index !== cardIndex
        ),
      }
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setMechanicCard(newMechanic)
  setMechanicDeck(newDeck)
  setAttemptsLeft(2)
  setMechanicResolved(false)
  setMechanicFailed(false)
  setMechanicActionUsed(true)
  setActionCardUsedThisTurn(true)
  setMechanicMessage(
    `Difficulty Spike used! New mechanic: ${newMechanic.name} (${newMechanic.difficulty}).`
  )
}

function useHotStreak() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Hot Streak'
  )

  if (cardIndex === -1) {
    return
  }

  if (
    !mechanicCard ||
    !mechanicResolved ||
    mechanicFailed ||
    currentPlayer.hotStreakActive || actionCardUsedThisTurn
  ) {
    return
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        hotStreakActive: true,
        actionCards: (player.actionCards || []).filter(
          (_, index) => index !== cardIndex
        ),
      }
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])
  setActionCardUsedThisTurn(true)
  setMechanicMessage(
    'Hot Streak activated! Your next Mechanic has only 1 attempt. Score it for +2 bonus points.'
  )
}

function usePressure(targetIndex) {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Pressure'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn
  ) {
    return
  }

  if (targetIndex === currentPlayerIndex) {
    return
  }

  const targetPlayer = players[targetIndex]

  if (!targetPlayer || targetPlayer.finished || targetPlayer.pressureActive) {
    return
  }

  // SHIELD BLOCKS PRESSURE
  if (targetPlayer.shieldActive) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        if (index === currentPlayerIndex) {
          return {
            ...player,
            actionCards: (player.actionCards || []).filter(
              (_, index) => index !== cardIndex
            ),
          }
        }

        if (index === targetIndex) {
          return {
            ...player,
            shieldActive: false,
          }
        }

        return player
      })
    )

    setActionDiscardPile((currentPile) => [
      ...currentPile,
      currentPlayer.actionCards[cardIndex],
    ])

    setActionCardUsedThisTurn(true)

    setActionMessage(
      `${targetPlayer.name}'s Shield blocked your Pressure!`
    )

    return
  }

  // NORMAL PRESSURE
  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index === currentPlayerIndex) {
        return {
          ...player,
          actionCards: (player.actionCards || []).filter(
            (_, index) => index !== cardIndex
          ),
        }
      }

      if (index === targetIndex) {
        return {
          ...player,
          pressureActive: true,
        }
      }

      return player
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setActionCardUsedThisTurn(true)

  setActionMessage(
    `Pressure activated on ${targetPlayer.name}. They will not be notified until their next Mechanic.`
  )
}

function useShield() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Shield'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn ||
    currentPlayer.shieldActive
  ) {
    return
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        shieldActive: true,
        actionCards: (player.actionCards || []).filter(
          (_, index) => index !== cardIndex
        ),
      }
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setActionCardUsedThisTurn(true)

  setActionMessage(
    'Shield activated! The next negative Action Card used on you will be blocked.'
  )
}

function useSteal(targetIndex) {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Steal'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn ||
    targetIndex === currentPlayerIndex
  ) {
    return
  }

  const targetPlayer = players[targetIndex]
  const targetHand = targetPlayer?.actionCards || []

  if (!targetPlayer || targetHand.length === 0) {
    return
  }

  // SHIELD BLOCKS STEAL
  if (targetPlayer.shieldActive) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        if (index === currentPlayerIndex) {
          return {
            ...player,
            actionCards: (player.actionCards || []).filter(
              (_, index) => index !== cardIndex
            ),
          }
        }

        if (index === targetIndex) {
          return {
            ...player,
            shieldActive: false,
          }
        }

        return player
      })
    )

    setActionDiscardPile((currentPile) => [
      ...currentPile,
      currentPlayer.actionCards[cardIndex],
    ])

    setActionCardUsedThisTurn(true)

    setActionMessage(
      `${targetPlayer.name}'s Shield blocked your Steal!`
    )

    return
  }

  // RANDOMLY CHOOSE ONE CARD FROM TARGET
  const stolenIndex = Math.floor(
    Math.random() * targetHand.length
  )

  const stolenCard = targetHand[stolenIndex]

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index === currentPlayerIndex) {
        const newHand = (player.actionCards || []).filter(
          (_, index) => index !== cardIndex
        )

        return {
          ...player,
          actionCards: [
            ...newHand,
            stolenCard,
          ],
        }
      }

      if (index === targetIndex) {
        return {
          ...player,
          actionCards: (player.actionCards || []).filter(
            (_, index) => index !== stolenIndex
          ),
        }
      }

      return player
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setActionCardUsedThisTurn(true)

  setActionMessage(
    `An Action Card was stolen from ${targetPlayer.name}.`
  )
}

function useSwapHands(targetIndex) {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Swap Hands'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn ||
    targetIndex === currentPlayerIndex
  ) {
    return
  }

  const targetPlayer = players[targetIndex]

  if (!targetPlayer || targetPlayer.finished) {
    return
  }

  // SHIELD BLOCKS SWAP HANDS
  if (targetPlayer.shieldActive) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        if (index === currentPlayerIndex) {
          return {
            ...player,
            actionCards: (player.actionCards || []).filter(
              (_, index) => index !== cardIndex
            ),
          }
        }

        if (index === targetIndex) {
          return {
            ...player,
            shieldActive: false,
          }
        }

        return player
      })
    )

    setActionDiscardPile((currentPile) => [
      ...currentPile,
      currentPlayer.actionCards[cardIndex],
    ])

    setActionCardUsedThisTurn(true)

    setActionMessage(
      `${targetPlayer.name}'s Shield blocked your Swap Hands!`
    )

    return
  }

  // Remove Swap Hands before exchanging hands
  const currentPlayerRemainingHand =
    (currentPlayer.actionCards || []).filter(
      (_, index) => index !== cardIndex
    )

  const targetHand = [...(targetPlayer.actionCards || [])]

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index === currentPlayerIndex) {
        return {
          ...player,
          actionCards: targetHand,
        }
      }

      if (index === targetIndex) {
        return {
          ...player,
          actionCards: currentPlayerRemainingHand,
        }
      }

      return player
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setActionCardUsedThisTurn(true)

  setActionMessage(
    `You swapped Action Card hands with ${targetPlayer.name}!`
  )
}

function useSabotage(targetIndex) {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Sabotage'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn ||
    targetIndex === currentPlayerIndex
  ) {
    return
  }

  const targetPlayer = players[targetIndex]

  if (!targetPlayer || targetPlayer.finished) {
    return
  }

  // SHIELD BLOCKS SABOTAGE
  if (targetPlayer.shieldActive) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        if (index === currentPlayerIndex) {
          return {
            ...player,
            actionCards: (player.actionCards || []).filter(
              (_, index) => index !== cardIndex
            ),
          }
        }

        if (index === targetIndex) {
          return {
            ...player,
            shieldActive: false,
          }
        }

        return player
      })
    )

    setActionDiscardPile((currentPile) => [
      ...currentPile,
      currentPlayer.actionCards[cardIndex],
    ])

    setActionCardUsedThisTurn(true)

    setActionMessage(
      `${targetPlayer.name}'s Shield blocked your Sabotage!`
    )

    return
  }

  const graphMove = generatedBoard
    ? forceMoveGeneratedPlayer(targetPlayer, 5, 'backward')
    : null
  const newPosition = graphMove
    ? graphMove.player.position
    : Math.max(0, targetPlayer.position - 5)

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index === currentPlayerIndex) {
        return {
          ...player,
          actionCards: (player.actionCards || []).filter(
            (_, index) => index !== cardIndex
          ),
        }
      }

      if (index === targetIndex) {
        return graphMove
          ? graphMove.player
          : { ...player, position: newPosition }
      }

      return player
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setActionCardUsedThisTurn(true)

  setActionMessage(
    `${targetPlayer.name} was Sabotaged and moved back 5 spaces!`
  )
}

function usePointTax(targetIndex) {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Point Tax'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn ||
    targetIndex === currentPlayerIndex
  ) {
    return
  }

  const targetPlayer = players[targetIndex]

  if (!targetPlayer) {
    return
  }

  // SHIELD BLOCKS POINT TAX
  if (targetPlayer.shieldActive) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        if (index === currentPlayerIndex) {
          return {
            ...player,
            actionCards: (player.actionCards || []).filter(
              (_, index) => index !== cardIndex
            ),
          }
        }

        if (index === targetIndex) {
          return {
            ...player,
            shieldActive: false,
          }
        }

        return player
      })
    )

    setActionDiscardPile((currentPile) => [
      ...currentPile,
      currentPlayer.actionCards[cardIndex],
    ])

    setActionCardUsedThisTurn(true)

    setActionMessage(
      `${targetPlayer.name}'s Shield blocked your Point Tax!`
    )

    return
  }

  const randomTax = Math.floor(Math.random() * 3) + 1
  const pointsLost = Math.min(randomTax, targetPlayer.points)

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index === currentPlayerIndex) {
        return {
          ...player,
          actionCards: (player.actionCards || []).filter(
            (_, index) => index !== cardIndex
          ),
        }
      }

      if (index === targetIndex) {
        return {
          ...player,
          points: Math.max(0, player.points - randomTax),
        }
      }

      return player
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setActionCardUsedThisTurn(true)

  setActionMessage(
    `${targetPlayer.name} lost ${pointsLost} point${
      pointsLost === 1 ? '' : 's'
    } from Point Tax!`
  )
}

function useLockout(targetIndex) {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Lockout'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn ||
    targetIndex === currentPlayerIndex
  ) {
    return
  }

  const targetPlayer = players[targetIndex]

  if (!targetPlayer || targetPlayer.finished || targetPlayer.lockoutActive) {
    return
  }

  // SHIELD BLOCKS LOCKOUT
  if (targetPlayer.shieldActive) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        if (index === currentPlayerIndex) {
          return {
            ...player,
            actionCards: (player.actionCards || []).filter(
              (_, index) => index !== cardIndex
            ),
          }
        }

        if (index === targetIndex) {
          return {
            ...player,
            shieldActive: false,
          }
        }

        return player
      })
    )

    setActionDiscardPile((currentPile) => [
      ...currentPile,
      currentPlayer.actionCards[cardIndex],
    ])

    setActionCardUsedThisTurn(true)

    setActionMessage(
      `${targetPlayer.name}'s Shield blocked your Lockout!`
    )

    return
  }

  // NORMAL LOCKOUT
  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index === currentPlayerIndex) {
        return {
          ...player,
          actionCards: (player.actionCards || []).filter(
            (_, index) => index !== cardIndex
          ),
        }
      }

      if (index === targetIndex) {
        return {
          ...player,
          lockoutActive: true,
        }
      }

      return player
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setActionCardUsedThisTurn(true)

  setActionMessage(
    `${targetPlayer.name} has been Locked Out of using Action Cards on their next turn!`
  )
}

function useReverse() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Reverse'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn
  ) {
    return
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        actionCards: (player.actionCards || []).filter(
          (_, index) => index !== cardIndex
        ),
      }
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setTurnDirection((currentDirection) =>
    currentDirection * -1
  )

  setActionCardUsedThisTurn(true)

  setActionMessage(
    'Reverse used! The turn order has been reversed.'
  )
}

function useCopycat() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Copycat'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn ||
    mechanicActionUsed ||
    !mechanicCard ||
    mechanicResolved ||
    attemptsLeft !== 2 ||
    !lastScoredMechanic ||
    lastScoredMechanic.playerId === currentPlayer.id
  ) {
    return
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        actionCards: (player.actionCards || []).filter(
          (_, index) => index !== cardIndex
        ),
      }
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setMechanicCard(lastScoredMechanic.card)
  setAttemptsLeft(2)
  setMechanicResolved(false)
  setMechanicFailed(false)

  setMechanicActionUsed(true)
  setActionCardUsedThisTurn(true)

  setMechanicMessage(
    `COPYCAT! Your mechanic is now ${lastScoredMechanic.card.name}. You have 2 attempts for ${lastScoredMechanic.card.points} point${
      lastScoredMechanic.card.points === 1 ? '' : 's'
    }.`
  )
}

function useEasyRoute() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Easy Route'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn ||
    mechanicActionUsed ||
    noBounceRequired ||
    kph100Required ||
    topCornerRequired ||
    !mechanicCard ||
    mechanicResolved ||
    attemptsLeft !== 2
  ) {
    return
  }

  const remainingHand = (currentPlayer.actionCards || []).filter(
    (_, index) => index !== cardIndex
  )

  let movedPlayer
  let spacesMoved
  let reachedFinish
  let discardedAtFinish = []

  if (generatedBoard) {
    const playerWithoutCard = {
      ...currentPlayer,
      actionCards: remainingHand,
    }
    const movement = forceMoveGeneratedPlayer(playerWithoutCard, 5, 'forward')
    movedPlayer = movement.player
    spacesMoved = movement.spacesMoved
    reachedFinish = movement.reachedFinish
    discardedAtFinish = movement.discardedCards
  } else {
    const newPosition = Math.min(
      BOARD_LENGTH,
      currentPlayer.position + 5
    )
    spacesMoved = newPosition - currentPlayer.position
    reachedFinish = newPosition >= BOARD_LENGTH && !currentPlayer.finished
    movedPlayer = reachedFinish
      ? movePlayerAndHandleFinish(
          { ...currentPlayer, actionCards: remainingHand },
          newPosition,
          remainingHand
        )
      : {
          ...currentPlayer,
          position: newPosition,
          shortcutGateResolved:
            currentPlayer.shortcutGateResolved ||
            (currentPlayer.position < SHORTCUT_GATE_POSITION &&
              newPosition >= SHORTCUT_GATE_POSITION),
          actionCards: remainingHand,
        }
    discardedAtFinish = reachedFinish ? remainingHand : []
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) =>
      index === currentPlayerIndex ? movedPlayer : player
    )
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
    ...discardedAtFinish,
  ])

  setAttemptsLeft(0)
  setMechanicResolved(true)
  setMechanicFailed(false)
  setMechanicActionUsed(true)
  setActionCardUsedThisTurn(true)

  const finishCashoutBonus =
    reachedFinish && discardedAtFinish.length === 3 ? 1 : 0

  setMechanicMessage(
    reachedFinish
      ? `EASY ROUTE! You reached Finish.${
          finishCashoutBonus ? ' Full 3-card hand cash-out: +1 point.' : ''
        } Your remaining Action Cards were cashed out.`
      : `EASY ROUTE! You skipped ${mechanicCard.name} and moved forward ${spacesMoved} space${
          spacesMoved === 1 ? '' : 's'
        }. The new space does not activate.`
  )
}

function useSecondChance() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Second Chance'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn ||
    hasSpun ||
    secondChanceActive ||
    secondChanceRolls.length > 0
  ) {
    return
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        actionCards: (player.actionCards || []).filter(
          (_, index) => index !== cardIndex
        ),
      }
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setSecondChanceActive(true)
  setActionCardUsedThisTurn(true)

  setActionMessage(
    'Second Chance activated! Spin to reveal your two choices.'
  )
}

function useTradeOffer() {
  const currentPlayer = players[currentPlayerIndex]

  const tradeOfferIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Trade Offer'
  )

  const hasCardToOffer =
    (currentPlayer.actionCards || []).length > 1

  const hasPlayerToTradeWith = players.some(
    (player, index) =>
      index !== currentPlayerIndex &&
      (player.actionCards || []).length > 0
  )

  if (
    tradeOfferIndex === -1 ||
    actionCardUsedThisTurn ||
    !hasCardToOffer ||
    !hasPlayerToTradeWith
  ) {
    return
  }

  const tradeOfferCard =
    currentPlayer.actionCards[tradeOfferIndex]

  // Remove Trade Offer itself from the player's hand
  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        actionCards: (player.actionCards || []).filter(
          (_, index) => index !== tradeOfferIndex
        ),
      }
    })
  )

  // Trade Offer itself goes to the discard pile
  setActionDiscardPile((currentPile) => [
    ...currentPile,
    tradeOfferCard,
  ])

  // This is the player's one Action Card for the turn
  setActionCardUsedThisTurn(true)

  setTradeOfferState({
    initiatorIndex: currentPlayerIndex,
    targetIndex: null,
    offeredCardIndex: null,
    returnCardIndex: null,
    stage: 'choose-target',
  })

  setActionMessage('')
}


function chooseTradeTarget(targetIndex) {
  if (!tradeOfferState) {
    return
  }

  const targetPlayer = players[targetIndex]

  if (
    targetIndex === tradeOfferState.initiatorIndex ||
    !targetPlayer ||
    (targetPlayer.actionCards || []).length === 0
  ) {
    return
  }

  setTradeOfferState((currentTrade) => ({
    ...currentTrade,
    targetIndex,
    stage: 'choose-offer',
  }))
}


function chooseTradeOfferedCard(cardIndex) {
  if (!tradeOfferState) {
    return
  }

  const initiator =
    players[tradeOfferState.initiatorIndex]

  const offeredCard =
    initiator?.actionCards?.[cardIndex]

  if (!offeredCard) {
    return
  }

  setTradeOfferState((currentTrade) => ({
    ...currentTrade,
    offeredCardIndex: cardIndex,
    stage: 'handoff-target',
  }))
}


function chooseTradeReturnCard(cardIndex) {
  if (
    !tradeOfferState ||
    tradeOfferState.targetIndex === null
  ) {
    return
  }

  const target =
    players[tradeOfferState.targetIndex]

  const returnCard =
    target?.actionCards?.[cardIndex]

  if (!returnCard) {
    return
  }

  setTradeOfferState((currentTrade) => ({
    ...currentTrade,
    returnCardIndex: cardIndex,
    stage: 'handoff-initiator-review',
  }))
}


function acceptTradeAsInitiator() {
  if (
    !tradeOfferState ||
    tradeOfferState.offeredCardIndex === null ||
    tradeOfferState.returnCardIndex === null
  ) {
    return
  }

  setTradeOfferState((currentTrade) => ({
    ...currentTrade,
    stage: 'handoff-target-review',
  }))
}

function cancelTradeOffer(message) {
  setTradeOfferState(null)

  setActionMessage(
    `${message} Trade Offer was still used for this turn.`
  )
}

function completeTradeOffer() {
  if (
    !tradeOfferState ||
    tradeOfferState.targetIndex === null ||
    tradeOfferState.offeredCardIndex === null ||
    tradeOfferState.returnCardIndex === null
  ) {
    return
  }

  const initiatorIndex =
    tradeOfferState.initiatorIndex

  const targetIndex =
    tradeOfferState.targetIndex

  const initiator =
    players[initiatorIndex]

  const target =
    players[targetIndex]

  const offeredCard =
    initiator?.actionCards?.[
      tradeOfferState.offeredCardIndex
    ]

  const returnCard =
    target?.actionCards?.[
      tradeOfferState.returnCardIndex
    ]

  if (!offeredCard || !returnCard) {
    setTradeOfferState(null)

    setActionMessage(
      'Trade could not be completed.'
    )

    return
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index === initiatorIndex) {
        const newHand = [
          ...(player.actionCards || []),
        ]

        newHand[
          tradeOfferState.offeredCardIndex
        ] = returnCard

        return {
          ...player,
          actionCards: newHand,
        }
      }

      if (index === targetIndex) {
        const newHand = [
          ...(player.actionCards || []),
        ]

        newHand[
          tradeOfferState.returnCardIndex
        ] = offeredCard

        return {
          ...player,
          actionCards: newHand,
        }
      }

      return player
    })
  )

  setTradeOfferState(null)

  setActionMessage(
    `Trade complete between ${initiator.name} and ${target.name}.`
  )
}

function useSnatch(targetIndex) {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Snatch'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn ||
    targetIndex === currentPlayerIndex
  ) {
    return
  }

  const targetPlayer = players[targetIndex]

  if (
    !targetPlayer ||
    targetPlayer.points <= 0
  ) {
    return
  }

  // SHIELD BLOCKS SNATCH
  if (targetPlayer.shieldActive) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        if (index === currentPlayerIndex) {
          return {
            ...player,
            actionCards: (player.actionCards || []).filter(
              (_, index) => index !== cardIndex
            ),
          }
        }

        if (index === targetIndex) {
          return {
            ...player,
            shieldActive: false,
          }
        }

        return player
      })
    )

    setActionDiscardPile((currentPile) => [
      ...currentPile,
      currentPlayer.actionCards[cardIndex],
    ])

    setActionCardUsedThisTurn(true)

    setActionMessage(
      `${targetPlayer.name}'s Shield blocked your Snatch!`
    )

    return
  }

  // NORMAL SNATCH
  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index === currentPlayerIndex) {
        return {
          ...player,
          points: player.points + 1,
          actionCards: (player.actionCards || []).filter(
            (_, index) => index !== cardIndex
          ),
        }
      }

      if (index === targetIndex) {
        return {
          ...player,
          points: Math.max(0, player.points - 1),
        }
      }

      return player
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setActionCardUsedThisTurn(true)

  setActionMessage(
    `You Snatched 1 point from ${targetPlayer.name}!`
  )
}

function useCleanSlate() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Clean Slate'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn
  ) {
    return
  }

  const oldHand = [
    ...(currentPlayer.actionCards || []),
  ]

  const drawCount = oldHand.length

  let deck = [...actionDeck]
  let discardPile = [...actionDiscardPile]

  // If the draw deck does not have enough cards,
  // reshuffle the OLD discard pile into it.
  if (deck.length < drawCount) {
    deck = [
      ...deck,
      ...shuffleDeck(discardPile),
    ]

    discardPile = []
  }

  const newHand = deck.slice(0, drawCount)
  const remainingDeck = deck.slice(drawCount)

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        actionCards: newHand,
      }
    })
  )

  setActionDeck(remainingDeck)

  // The old hand, including Clean Slate,
  // now enters the discard pile.
  setActionDiscardPile([
    ...discardPile,
    ...oldHand,
  ])

  setActionCardUsedThisTurn(true)

  setActionMessage(
    `CLEAN SLATE! Your ${drawCount} Action Card${
      drawCount === 1 ? ' was' : 's were'
    } replaced with ${drawCount} new card${
      drawCount === 1 ? '' : 's'
    }.`
  )
}

function useBankIt() {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Bank It'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn
  ) {
    return
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        points: player.points + 2,
        actionCards: (player.actionCards || []).filter(
          (_, index) => index !== cardIndex
        ),
      }
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setActionCardUsedThisTurn(true)

  setActionMessage(
    'BANK IT! +2 points.'
  )
}

function useZeroBounce(targetIndex) {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Zero Bounce'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn ||
    targetIndex === currentPlayerIndex
  ) {
    return
  }

  const targetPlayer = players[targetIndex]

  if (!targetPlayer || targetPlayer.finished) return

  if (
    !targetPlayer ||
    targetPlayer.noBounceActive
  ) {
    return
  }

  // SHIELD BLOCKS ZERO BOUNCE
  if (targetPlayer.shieldActive) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        if (index === currentPlayerIndex) {
          return {
            ...player,
            actionCards: (player.actionCards || []).filter(
              (_, index) => index !== cardIndex
            ),
          }
        }

        if (index === targetIndex) {
          return {
            ...player,
            shieldActive: false,
          }
        }

        return player
      })
    )

    setActionDiscardPile((currentPile) => [
      ...currentPile,
      currentPlayer.actionCards[cardIndex],
    ])

    setActionCardUsedThisTurn(true)

    setActionMessage(
      `${targetPlayer.name}'s Shield blocked your Zero Bounce!`
    )

    return
  }

  // NORMAL ZERO BOUNCE
  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index === currentPlayerIndex) {
        return {
          ...player,
          actionCards: (player.actionCards || []).filter(
            (_, index) => index !== cardIndex
          ),
        }
      }

      if (index === targetIndex) {
        return {
          ...player,
          noBounceActive: true,
        }
      }

      return player
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setActionCardUsedThisTurn(true)

  setActionMessage(
    `${targetPlayer.name}'s next Mechanic must be NO BOUNCE!`
  )
}


function use100KPH(targetIndex) {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === '100+ KPH'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn ||
    targetIndex === currentPlayerIndex
  ) {
    return
  }

  const targetPlayer = players[targetIndex]

  if (!targetPlayer || targetPlayer.finished) return

  if (!targetPlayer || targetPlayer.kph100Active) {
    return
  }

  // SHIELD BLOCKS 100+ KPH
  if (targetPlayer.shieldActive) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        if (index === currentPlayerIndex) {
          return {
            ...player,
            actionCards: (player.actionCards || []).filter(
              (_, index) => index !== cardIndex
            ),
          }
        }

        if (index === targetIndex) {
          return {
            ...player,
            shieldActive: false,
          }
        }

        return player
      })
    )

    setActionDiscardPile((currentPile) => [
      ...currentPile,
      currentPlayer.actionCards[cardIndex],
    ])

    setActionCardUsedThisTurn(true)
    setActionMessage(
      `${targetPlayer.name}'s Shield blocked your 100+ KPH!`
    )
    return
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index === currentPlayerIndex) {
        return {
          ...player,
          actionCards: (player.actionCards || []).filter(
            (_, index) => index !== cardIndex
          ),
        }
      }

      if (index === targetIndex) {
        return {
          ...player,
          kph100Active: true,
        }
      }

      return player
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setActionCardUsedThisTurn(true)
  setActionMessage(
    `${targetPlayer.name}'s next Mechanic must be scored at 100+ KPH!`
  )
}

function useTopCorner(targetIndex) {
  const currentPlayer = players[currentPlayerIndex]

  const cardIndex = (currentPlayer.actionCards || []).findIndex(
    (card) => card.name === 'Top Corner'
  )

  if (
    cardIndex === -1 ||
    actionCardUsedThisTurn ||
    targetIndex === currentPlayerIndex
  ) {
    return
  }

  const targetPlayer = players[targetIndex]

  if (!targetPlayer || targetPlayer.finished) return

  if (!targetPlayer || targetPlayer.topCornerActive) {
    return
  }

  // SHIELD BLOCKS TOP CORNER
  if (targetPlayer.shieldActive) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        if (index === currentPlayerIndex) {
          return {
            ...player,
            actionCards: (player.actionCards || []).filter(
              (_, index) => index !== cardIndex
            ),
          }
        }

        if (index === targetIndex) {
          return {
            ...player,
            shieldActive: false,
          }
        }

        return player
      })
    )

    setActionDiscardPile((currentPile) => [
      ...currentPile,
      currentPlayer.actionCards[cardIndex],
    ])

    setActionCardUsedThisTurn(true)
    setActionMessage(
      `${targetPlayer.name}'s Shield blocked your Top Corner!`
    )
    return
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index === currentPlayerIndex) {
        return {
          ...player,
          actionCards: (player.actionCards || []).filter(
            (_, index) => index !== cardIndex
          ),
        }
      }

      if (index === targetIndex) {
        return {
          ...player,
          topCornerActive: true,
        }
      }

      return player
    })
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    currentPlayer.actionCards[cardIndex],
  ])

  setActionCardUsedThisTurn(true)
  setActionMessage(
    `${targetPlayer.name}'s next Mechanic must be scored TOP CORNER!`
  )
}

function drawMechanicCard() {
  if (!awaitingMechanicDraw) {
    return
  }

  // A new normal Mechanic starts a new public outcome. Action Card details stay private.
  setPublicMechanicOutcome('')

  const currentPlayer = players[currentPlayerIndex]

  let deck = mechanicDeck

  if (deck.length === 0) {
    deck = shuffleDeck(mechanicCards)
  }

  const drawnCard = deck[0]
  const remainingDeck = deck.slice(1)

  const isPressured = currentPlayer.pressureActive
const isNoBounce = currentPlayer.noBounceActive
const is100KPH = currentPlayer.kph100Active
const isTopCorner = currentPlayer.topCornerActive

setMechanicCard(drawnCard)
setMechanicDeck(remainingDeck)
setNoBounceRequired(isNoBounce)
setKph100Required(is100KPH)
setTopCornerRequired(isTopCorner)

  if (isPressured) {
    setAttemptsLeft(1)
  } else {
    setAttemptsLeft(2)
  }

  setMechanicResolved(false)
  setAwaitingMechanicDraw(false)

  // Pressure is revealed and consumed only NOW
  if (isPressured) {
    setMechanicActionUsed(true)
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        if (index !== currentPlayerIndex) {
          return player
        }

        return {
          ...player,
          pressureActive: false,
        }
      })
    )
  }

  // Zero Bounce is revealed and consumed when this Mechanic is drawn.
  // The current Mechanic keeps the no-bounce requirement even if it is
  // changed by Reroll, Copycat, Pick Your Poison, Difficulty Drop, etc.
  if (isNoBounce || is100KPH || isTopCorner) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        if (index !== currentPlayerIndex) {
          return player
        }

        return {
          ...player,
          noBounceActive: isNoBounce ? false : player.noBounceActive,
          kph100Active: is100KPH ? false : player.kph100Active,
          topCornerActive: isTopCorner ? false : player.topCornerActive,
        }
      })
    )
  }

  if (jackpotActive && isPressured) {
    setMechanicMessage(
      `SURPRISE — PRESSURE! You only have 1 attempt at ${drawnCard.name}. Jackpot is active: +3 if you score, -3 if you miss.`
    )
  } else if (jackpotActive) {
    setMechanicMessage(
      `Jackpot is active! Score ${drawnCard.name} for +3 bonus points. Miss both attempts and lose 3 points.`
    )
  } else if (isPressured) {
    setMechanicMessage(
      `SURPRISE — PRESSURE! You only have 1 attempt at ${drawnCard.name}.`
    )
  } else {
    setMechanicMessage('')
  }
}

function skipActionDraw() {
  setActionResolved(true)
  setActionMessage('You skipped the Action Card draw.')
}


function chooseRandomIndex(indexes) {
  if (!indexes || indexes.length === 0) return null
  return indexes[Math.floor(Math.random() * indexes.length)]
}

function chooseBattleOpponent(targetIndex) {
  if (!battleState || battleResolved) return
  if (targetIndex === currentPlayerIndex || !players[targetIndex]) return

  setBattleState((currentBattle) => ({
    ...currentBattle,
    opponentIndex: targetIndex,
    battleMechanic: null,
    concedeVoteBy: null,
    resultMessage: '',
  }))
}

function drawBattleMechanic() {
  if (
    !battleState ||
    battleResolved ||
    battleState.card?.id !== 'same-mechanic-duel' ||
    battleState.opponentIndex === null ||
    battleState.battleMechanic
  ) {
    return
  }

  // IMPORTANT: this is intentionally independent from the normal Mechanic deck.
  // It does not consume, reorder, or otherwise touch mechanicDeck.
  const drawnCard =
    mechanicCards[Math.floor(Math.random() * mechanicCards.length)]

  setBattleState((currentBattle) => ({
    ...currentBattle,
    battleMechanic: drawnCard,
  }))
}

function resolveBattleWinner(winnerIndex) {
  if (!battleState || battleResolved || !players[winnerIndex]) return

  const card = battleState.card
  const opponentIndex = battleState.opponentIndex

  if (!card?.allPlayers) {
    if (
      opponentIndex === null ||
      (winnerIndex !== currentPlayerIndex && winnerIndex !== opponentIndex)
    ) {
      return
    }
  }

  if (
    card?.needsBattleMechanic &&
    !battleState.battleMechanic
  ) {
    return
  }

  const winnerName = players[winnerIndex].name
  const allPlayerParticipants = (
    battleState.participantIndexes ||
    players.map((_, index) => index)
  ).filter((index) => players[index] && !players[index].leftGame)

  if (card?.allPlayers && !allPlayerParticipants.includes(winnerIndex)) return

  const loserIndexes = card?.allPlayers
    ? allPlayerParticipants.filter((index) => index !== winnerIndex)
    : [winnerIndex === currentPlayerIndex ? opponentIndex : currentPlayerIndex]

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index === winnerIndex) {
        return { ...player, points: player.points + 2 }
      }

      if (loserIndexes.includes(index)) {
        return { ...player, points: Math.max(0, player.points - 1) }
      }

      return player
    })
  )

  const lossText = card?.allPlayers
    ? ' Everyone else loses 1 board point.'
    : ' Loser loses 1 board point.'

  setBattleResolved(true)
  setBattleState((currentBattle) => ({
    ...currentBattle,
    concedeVoteBy: null,
    resultMessage: `${winnerName} wins ${card.name}! +2 board points.${lossText}`,
  }))
}

function voteToConcedeBattle(voterIndex) {
  if (
    !battleState ||
    battleResolved ||
    !battleState.card?.allowMutualConcede ||
    battleState.opponentIndex === null ||
    (voterIndex !== currentPlayerIndex &&
      voterIndex !== battleState.opponentIndex)
  ) {
    return
  }

  // In online play, a browser may only cast the vote for its own player.
  if (
    isOnlineGame &&
    players[voterIndex]?.id !== localClientId
  ) {
    return
  }

  setBattleState((currentBattle) => {
    if (!currentBattle || currentBattle.concedeVoteBy === voterIndex) {
      return currentBattle
    }

    // First player casts their vote. The Battle keeps going until the other
    // participant independently votes as well.
    if (currentBattle.concedeVoteBy === null) {
      return {
        ...currentBattle,
        concedeVoteBy: voterIndex,
      }
    }

    // The other participant has now also voted: both votes are required.
    setBattleResolved(true)
    return {
      ...currentBattle,
      concedeVoteBy: null,
      resultMessage:
        'Both players voted to concede. The Battle ends with 0 board points awarded.',
    }
  })
}

function cancelBattleConcede(voterIndex) {
  if (
    !battleState ||
    battleResolved ||
    battleState.concedeVoteBy !== voterIndex
  ) {
    return
  }

  // In online play, only the player who cast the pending vote can cancel it.
  if (
    isOnlineGame &&
    players[voterIndex]?.id !== localClientId
  ) {
    return
  }

  setBattleState((currentBattle) => ({
    ...currentBattle,
    concedeVoteBy: null,
  }))
}

function spinLuckyBattle() {
  if (
    !battleState ||
    battleResolved ||
    battleState.card?.id !== 'lucky-spin'
  ) {
    return
  }

  const participantIndexes = (
    battleState.participantIndexes ||
    players.map((_, index) => index)
  ).filter((index) => players[index] && !players[index].leftGame)

  const cursor = battleState.luckySpinCursor || 0
  if (cursor >= participantIndexes.length) return

  const playerIndex = participantIndexes[cursor]
  const roll = Math.floor(Math.random() * 10) + 1
  const newSpins = [
    ...(battleState.luckySpins || []),
    { playerIndex, roll },
  ]

  if (cursor < participantIndexes.length - 1) {
    setBattleState((currentBattle) => ({
      ...currentBattle,
      luckySpins: newSpins,
      luckySpinCursor: cursor + 1,
    }))
    return
  }

  const highestRoll = Math.max(...newSpins.map((entry) => entry.roll))
  const tiedWinners = newSpins
    .filter((entry) => entry.roll === highestRoll)
    .map((entry) => entry.playerIndex)

  const winnerIndex = chooseRandomIndex(tiedWinners)
  const winnerName = players[winnerIndex].name

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (!participantIndexes.includes(index)) return player
      return index === winnerIndex
        ? { ...player, points: player.points + 2 }
        : { ...player, points: Math.max(0, player.points - 1) }
    })
  )

  const tieText =
    tiedWinners.length > 1
      ? ` ${tiedWinners.length} players tied for the highest spin, so the app randomly chose ${winnerName} from the tied leaders.`
      : ''

  setBattleResolved(true)
  setBattleState((currentBattle) => ({
    ...currentBattle,
    luckySpins: newSpins,
    luckySpinCursor: participantIndexes.length,
    resultMessage: `${winnerName} wins Lucky Spin with ${highestRoll}! +2 board points. Every other participating player loses 1 board point.${tieText}`,
  }))
}

function returnFromBattle() {
  if (!battleResolved) return
  setBattleState(null)
}

function resolveEvent() {
  if (!eventState || eventResolved) return

  const card = eventState.card
  let message = card.description

  if (card.id === 'everyone-advances') {
    const moveResults = players.map((player) =>
      player.finished
        ? { player, spacesMoved: 0, reachedFinish: false, discardedCards: [] }
        : generatedBoard
          ? forceMoveGeneratedPlayer(player, 5, 'forward')
          : (() => {
              const newPosition = Math.min(BOARD_LENGTH, player.position + 5)
              const movedPlayer = movePlayerAndHandleFinish(player, newPosition)
              return {
                player: {
                  ...movedPlayer,
                  shortcutGateResolved:
                    movedPlayer.shortcutGateResolved ||
                    (player.position < SHORTCUT_GATE_POSITION &&
                      newPosition >= SHORTCUT_GATE_POSITION),
                },
                spacesMoved: newPosition - player.position,
                reachedFinish: newPosition >= BOARD_LENGTH,
                discardedCards:
                  newPosition >= BOARD_LENGTH ? [...(player.actionCards || [])] : [],
              }
            })()
    )

    const finishingPlayers = moveResults
      .map((result, index) => ({ result, player: players[index] }))
      .filter(({ result, player }) => result.reachedFinish && !player.finished)
    const finishingCards = moveResults.flatMap((result) => result.discardedCards || [])

    setPlayers(moveResults.map((result) => result.player))

    if (finishingCards.length > 0) {
      setActionDiscardPile((currentPile) => [
        ...currentPile,
        ...finishingCards,
      ])
    }

    const finishText = finishingPlayers.length
      ? ` ${finishingPlayers.map(({ player }) => player.name).join(', ')} reached Finish.`
      : ''
    message = `Every unfinished player moved forward up to 5 spaces. No landed spaces activate.${finishText}`
  } else if (card.id === 'everyone-retreats') {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.finished
          ? player
          : generatedBoard
            ? forceMoveGeneratedPlayer(player, 5, 'backward').player
            : { ...player, position: Math.max(0, player.position - 5) }
      )
    )
    message = 'Every unfinished player moved back up to 5 spaces along the route they actually traveled. Finished players stay at Finish. No landed spaces activate.'
  } else if (card.id === 'catch-up-boost') {
    const eligiblePlayers = players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => !player.finished)

    if (eligiblePlayers.length === 0) {
      message = 'Everyone has already finished, so Catch-Up Boost has no effect.'
    } else {
      const lowestProgress = Math.min(
        ...eligiblePlayers.map(({ player }) =>
          generatedBoard ? getGeneratedProgress(player) : player.position
        )
      )
      const tiedIndexes = eligiblePlayers
        .filter(({ player }) => {
          const progress = generatedBoard
            ? getGeneratedProgress(player)
            : player.position
          return Math.abs(progress - lowestProgress) < 0.0001
        })
        .map(({ index }) => index)
      const chosenIndex = chooseRandomIndex(tiedIndexes)
      const chosenPlayer = players[chosenIndex]

      const movement = generatedBoard
        ? forceMoveGeneratedPlayer(chosenPlayer, 5, 'forward')
        : (() => {
            const newPosition = Math.min(BOARD_LENGTH, chosenPlayer.position + 5)
            const movedPlayer = movePlayerAndHandleFinish(chosenPlayer, newPosition)
            return {
              player: {
                ...movedPlayer,
                shortcutGateResolved:
                  movedPlayer.shortcutGateResolved ||
                  (chosenPlayer.position < SHORTCUT_GATE_POSITION &&
                    newPosition >= SHORTCUT_GATE_POSITION),
              },
              spacesMoved: newPosition - chosenPlayer.position,
              reachedFinish: newPosition >= BOARD_LENGTH,
              discardedCards:
                newPosition >= BOARD_LENGTH
                  ? [...(chosenPlayer.actionCards || [])]
                  : [],
            }
          })()

      if (movement.discardedCards.length > 0) {
        setActionDiscardPile((currentPile) => [
          ...currentPile,
          ...movement.discardedCards,
        ])
      }

      setPlayers((currentPlayers) =>
        currentPlayers.map((player, index) =>
          index === chosenIndex ? movement.player : player
        )
      )

      message = `${chosenPlayer.name} was furthest back${
        tiedIndexes.length > 1 ? ' (randomly chosen from the tie)' : ''
      } and moves forward ${movement.spacesMoved} space${
        movement.spacesMoved === 1 ? '' : 's'
      }. The new space does not activate.${
        movement.reachedFinish ? ` ${chosenPlayer.name} reached Finish.` : ''
      }`
    }
  } else if (card.id === 'leader-tax') {
    const eligiblePlayers = players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => !player.finished)

    if (eligiblePlayers.length === 0) {
      message = 'Everyone has already finished, so Leader Tax has no effect.'
    } else {
      const highestProgress = Math.max(
        ...eligiblePlayers.map(({ player }) =>
          generatedBoard ? getGeneratedProgress(player) : player.position
        )
      )
      const tiedIndexes = eligiblePlayers
        .filter(({ player }) => {
          const progress = generatedBoard
            ? getGeneratedProgress(player)
            : player.position
          return Math.abs(progress - highestProgress) < 0.0001
        })
        .map(({ index }) => index)
      const chosenIndex = chooseRandomIndex(tiedIndexes)
      const chosenPlayer = players[chosenIndex]
      const movement = generatedBoard
        ? forceMoveGeneratedPlayer(chosenPlayer, 5, 'backward')
        : {
            player: {
              ...chosenPlayer,
              position: Math.max(0, chosenPlayer.position - 5),
            },
            spacesMoved: Math.min(5, chosenPlayer.position),
          }

      setPlayers((currentPlayers) =>
        currentPlayers.map((player, index) =>
          index === chosenIndex ? movement.player : player
        )
      )
      message = `${chosenPlayer.name} was furthest ahead${
        tiedIndexes.length > 1 ? ' (randomly chosen from the tie)' : ''
      } and moves back ${movement.spacesMoved} space${
        movement.spacesMoved === 1 ? '' : 's'
      }. Finished players are not affected. The new space does not activate.`
    }
  } else if (card.id === 'position-swap') {
    const eligibleIndexes = players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => !player.finished)
      .map(({ index }) => index)

    if (eligibleIndexes.length >= 2) {
      const firstPoolIndex = Math.floor(Math.random() * eligibleIndexes.length)
      const firstIndex = eligibleIndexes[firstPoolIndex]
      const remainingEligible = eligibleIndexes.filter(
        (index) => index !== firstIndex
      )
      const secondIndex =
        remainingEligible[Math.floor(Math.random() * remainingEligible.length)]

      const firstPlayer = players[firstIndex]
      const secondPlayer = players[secondIndex]

      setPlayers((currentPlayers) =>
        currentPlayers.map((player, index) => {
          if (index === firstIndex) {
            return {
              ...player,
              position: secondPlayer.position,
              boardNodeId: generatedBoard
                ? secondPlayer.boardNodeId
                : player.boardNodeId,
              routeHistory: generatedBoard
                ? [...(secondPlayer.routeHistory || buildGeneratedPathToNode(secondPlayer.boardNodeId))]
                : player.routeHistory,
              shortcutGateResolved:
                player.shortcutGateResolved ||
                Boolean(
                  generatedBoard &&
                    (secondPlayer.routeHistory || []).includes(
                      generatedBoard.shortcut?.gateId
                    )
                ) ||
                (!generatedBoard && secondPlayer.position >= SHORTCUT_GATE_POSITION),
            }
          }
          if (index === secondIndex) {
            return {
              ...player,
              position: firstPlayer.position,
              boardNodeId: generatedBoard
                ? firstPlayer.boardNodeId
                : player.boardNodeId,
              routeHistory: generatedBoard
                ? [...(firstPlayer.routeHistory || buildGeneratedPathToNode(firstPlayer.boardNodeId))]
                : player.routeHistory,
              shortcutGateResolved:
                player.shortcutGateResolved ||
                Boolean(
                  generatedBoard &&
                    (firstPlayer.routeHistory || []).includes(
                      generatedBoard.shortcut?.gateId
                    )
                ) ||
                (!generatedBoard && firstPlayer.position >= SHORTCUT_GATE_POSITION),
            }
          }
          return player
        })
      )

      message = `${firstPlayer.name} and ${secondPlayer.name} swapped board positions. Finished players are not included. The swapped-to spaces do not activate.`
    } else {
      message = 'There are not two unfinished players available to swap, so Position Swap has no effect.'
    }
  } else if (card.id === 'rich-get-richer') {
    const lowestPoints = Math.min(...players.map((player) => player.points))
    const tiedIndexes = players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => player.points === lowestPoints)
      .map(({ index }) => index)
    const chosenIndex = chooseRandomIndex(tiedIndexes)
    const chosenPlayer = players[chosenIndex]

    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) =>
        index === chosenIndex
          ? { ...player, points: player.points + 2 }
          : player
      )
    )
    message = `${chosenPlayer.name} had the fewest points${
      tiedIndexes.length > 1 ? ' (randomly chosen from the tie)' : ''
    } and gains 2 points.`
  } else if (card.id === 'action-giveaway') {
    let deck = [...actionDeck]
    let discard = [...actionDiscardPile]
    let refreshedFromDiscard = false
    const updatedPlayers = players.map((player) => ({
      ...player,
      actionCards: [...(player.actionCards || [])],
    }))
    const draws = []

    for (let index = 0; index < updatedPlayers.length; index += 1) {
      const player = updatedPlayers[index]
      if (player.finished || player.actionCards.length >= 3) continue

      if (deck.length === 0 && discard.length > 0) {
        deck = shuffleDeck(discard)
        discard = []
        refreshedFromDiscard = true
      }

      if (deck.length === 0) continue

      const drawnCard = deck.shift()
      player.actionCards.push(drawnCard)
      // Action Card identity is private. The Event may reveal only that a draw occurred.
      draws.push(player.name)
    }

    setPlayers(updatedPlayers)
    setActionDeck(deck)
    if (refreshedFromDiscard) {
      setActionDiscardPile(discard)
    }

    message =
      draws.length > 0
        ? `${draws.join(', ')} ${draws.length === 1 ? 'drew' : 'each drew'} 1 Action Card. Card identities remain private.`
        : 'Nobody drew a card because every eligible hand was full or no Action Cards were available.'
  } else if (card.id === 'action-purge') {
    const discardedCards = []
    const updatedPlayers = players.map((player) => {
      if (player.finished) return player

      const hand = [...(player.actionCards || [])]
      if (hand.length === 0) return player

      const discardIndex = Math.floor(Math.random() * hand.length)
      const [discardedCard] = hand.splice(discardIndex, 1)
      discardedCards.push({ playerName: player.name, card: discardedCard })

      return {
        ...player,
        actionCards: hand,
      }
    })

    setPlayers(updatedPlayers)
    setActionDiscardPile((currentPile) => [
      ...currentPile,
      ...discardedCards.map((entry) => entry.card),
    ])

    message =
      discardedCards.length > 0
        ? `${discardedCards.map((entry) => entry.playerName).join(', ')} ${
            discardedCards.length === 1 ? 'discarded' : 'each discarded'
          } 1 random Action Card. Card identities remain private.`
        : 'Nobody had an eligible Action Card to discard.'
  } else if (card.id === 'shuffle-up') {
    const currentPlayer = players[currentPlayerIndex]
    const otherPlayers = players.filter((_, index) => index !== currentPlayerIndex)
    const shuffledOthers = shuffleDeck(otherPlayers)
    const shuffledPlayers = []
    let otherCursor = 0

    for (let index = 0; index < players.length; index += 1) {
      if (index === currentPlayerIndex) {
        shuffledPlayers[index] = currentPlayer
      } else {
        shuffledPlayers[index] = shuffledOthers[otherCursor]
        otherCursor += 1
      }
    }

    setPlayers(shuffledPlayers)

    const futureOrder = []
    for (let offset = 1; offset < shuffledPlayers.length; offset += 1) {
      const index =
        (currentPlayerIndex + offset * turnDirection + shuffledPlayers.length) %
        shuffledPlayers.length
      futureOrder.push(shuffledPlayers[index].name)
    }

    message = `Future turn order shuffled. After ${currentPlayer.name}, the order is: ${futureOrder.join(
      ' → '
    )}.`
  } else if (card.id === 'point-leader-tax') {
    const highestPoints = Math.max(...players.map((player) => player.points))
    const tiedIndexes = players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => player.points === highestPoints)
      .map(({ index }) => index)
    const chosenIndex = chooseRandomIndex(tiedIndexes)
    const chosenPlayer = players[chosenIndex]
    const pointsLost = Math.min(2, chosenPlayer.points)

    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) =>
        index === chosenIndex
          ? { ...player, points: Math.max(0, player.points - 2) }
          : player
      )
    )
    message = `${chosenPlayer.name} had the most points${
      tiedIndexes.length > 1 ? ' (randomly chosen from the tie)' : ''
    } and loses ${pointsLost} point${pointsLost === 1 ? '' : 's'}.`
  }

  setEventResolved(true)
  setEventState((currentEvent) => ({
    ...currentEvent,
    resultMessage: message,
  }))
}

function returnFromEvent() {
  if (!eventResolved) return
  setEventState(null)
}


function getRandomMechanicByDifficulty(difficulty) {
  const choices = mechanicCards.filter(
    (card) => card.difficulty === difficulty
  )

  if (choices.length === 0) return null

  return choices[Math.floor(Math.random() * choices.length)]
}

function takeActionShopOffers(count = 3) {
  let deck = [...actionDeck]
  let discard = [...actionDiscardPile]
  const offers = []

  while (offers.length < count) {
    if (deck.length === 0) {
      if (discard.length === 0) break
      deck = shuffleDeck(discard)
      discard = []
    }

    const card = deck.shift()
    if (!card) break
    offers.push(card)
  }

  return { offers, deck, discard }
}

function activateLandingAtPosition(newPosition, boardOptions = null) {
  const currentPlayer = players[currentPlayerIndex]
  const safePosition = Math.max(0, Math.min(BOARD_LENGTH, newPosition))
  const boardNodeId = boardOptions?.boardNodeId || null
  const routeHistory = boardOptions?.routeHistory || null
  const boardNode =
    boardNodeId && generatedBoard
      ? generatedBoard.nodes.find((node) => node.id === boardNodeId)
      : null
  const spaceType = boardOptions?.spaceType || boardNode?.type || boardSpaces[safePosition]
  const effectivePosition = spaceType === 'Finish' ? BOARD_LENGTH : safePosition

  setLandedSpace(spaceType)

  const revealBeforeScreenTypes = new Set([
    'Battle',
    'Event',
    'Gamble',
    'Choose Difficulty',
    'Action Shop',
  ])

  if (revealBeforeScreenTypes.has(spaceType)) {
    setLandingAnnouncement({
      spaceType,
      playerName: currentPlayer.name,
      until: Date.now() + LANDING_REVEAL_MS,
    })
    setLandingAnnouncementClock(Date.now())
  } else {
    setLandingAnnouncement(null)
  }

  // Clear only the UI/state for the previous landing. Pending player effects
  // (Pressure, Hot Streak, Zero Bounce, 100+ KPH, Top Corner, Shield, etc.)
  // stay on the player until their normal rules consume them.
  setMechanicCard(null)
  setMechanicChoices([])
  setAttemptsLeft(0)
  setMechanicMessage('')
  setNoBounceRequired(false)
  setKph100Required(false)
  setTopCornerRequired(false)
  setMechanicFailed(false)
  setDoublePointsActive(false)
  setInsuranceActive(false)
  setJackpotActive(false)
  setMechanicActionUsed(false)
  setAwaitingMechanicDraw(false)
  setBattleState(null)
  setBattleResolved(true)
  setEventState(null)
  setEventResolved(true)
  setSpecialState(null)
  setSpecialResolved(true)

  if (spaceType === 'Finish') {
    const finishHand = currentPlayer.actionCards || []
    const cashoutBonus = finishHand.length === 3 ? 1 : 0

    if (!currentPlayer.finished && finishHand.length > 0) {
      setActionDiscardPile((currentPile) => [
        ...currentPile,
        ...finishHand,
      ])
    }

    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) =>
        index === currentPlayerIndex
          ? {
              ...movePlayerAndHandleFinish(player, effectivePosition),
              boardNodeId:
                boardNodeId || generatedBoard?.finishId || player.boardNodeId || null,
              routeHistory: routeHistory || player.routeHistory || [],
            }
          : player
      )
    )

    setMechanicResolved(true)
    setActionResolved(true)
    setActionMessage(
      cashoutBonus
        ? '🏁 FINISHED! Full 3-card Action hand cash-out: +1 point. Your Action Cards were discarded.'
        : '🏁 FINISHED! Your remaining Action Cards were discarded.'
    )
    return
  }

  if (spaceType === 'Mechanic') {
    const hasJackpot = (currentPlayer.actionCards || []).some(
      (card) => card.name === 'Jackpot'
    )

    if (currentPlayer.hotStreakActive) {
      let deck = mechanicDeck

      if (deck.length === 0) {
        deck = shuffleDeck(mechanicCards)
      }

      const drawnCard = deck[0]
      const remainingDeck = deck.slice(1)
      const isNoBounce = currentPlayer.noBounceActive
      const is100KPH = currentPlayer.kph100Active
      const isTopCorner = currentPlayer.topCornerActive
      const hadPressure = currentPlayer.pressureActive

      setMechanicCard(drawnCard)
      setMechanicDeck(remainingDeck)
      setNoBounceRequired(isNoBounce)
      setKph100Required(is100KPH)
      setTopCornerRequired(isTopCorner)
      setAttemptsLeft(1)
      setMechanicResolved(false)
      setAwaitingMechanicDraw(false)

      // Hot Streak locks the normal Mechanic from being changed by an Action Card.
      setMechanicActionUsed(true)

      if (hadPressure || isNoBounce || is100KPH || isTopCorner) {
        setPlayers((currentPlayers) =>
          currentPlayers.map((player, index) => {
            if (index !== currentPlayerIndex) return player

            return {
              ...player,
              pressureActive: hadPressure ? false : player.pressureActive,
              noBounceActive: isNoBounce ? false : player.noBounceActive,
              kph100Active: is100KPH ? false : player.kph100Active,
              topCornerActive: isTopCorner ? false : player.topCornerActive,
            }
          })
        )
      }

      if (hadPressure) {
        setMechanicMessage(
          `HOT STREAK! You have 1 attempt at ${drawnCard.name}. SURPRISE — you were also Pressured! Pressure is now consumed.`
        )
      } else {
        setMechanicMessage(
          `HOT STREAK! You have 1 attempt at ${drawnCard.name}. Score it for +2 bonus points.`
        )
      }
    } else if (hasJackpot) {
      setMechanicCard(null)
      setAttemptsLeft(0)
      setMechanicResolved(false)
      setAwaitingMechanicDraw(true)
    } else {
      let deck = mechanicDeck

      if (deck.length === 0) {
        deck = shuffleDeck(mechanicCards)
      }

      const drawnCard = deck[0]
      const remainingDeck = deck.slice(1)
      const isPressured = currentPlayer.pressureActive
      const isNoBounce = currentPlayer.noBounceActive
      const is100KPH = currentPlayer.kph100Active
      const isTopCorner = currentPlayer.topCornerActive

      setMechanicCard(drawnCard)
      setMechanicDeck(remainingDeck)
      setNoBounceRequired(isNoBounce)
      setKph100Required(is100KPH)
      setTopCornerRequired(isTopCorner)
      setAttemptsLeft(isPressured ? 1 : 2)
      setMechanicResolved(false)
      setAwaitingMechanicDraw(false)

      if (isPressured || isNoBounce || is100KPH || isTopCorner) {
        setPlayers((currentPlayers) =>
          currentPlayers.map((player, index) => {
            if (index !== currentPlayerIndex) return player

            return {
              ...player,
              pressureActive: isPressured ? false : player.pressureActive,
              noBounceActive: isNoBounce ? false : player.noBounceActive,
              kph100Active: is100KPH ? false : player.kph100Active,
              topCornerActive: isTopCorner ? false : player.topCornerActive,
            }
          })
        )
      }

      if (isPressured) {
        setMechanicMessage(
          `SURPRISE — PRESSURE! You only have 1 attempt at ${drawnCard.name}.`
        )
      }
    }

    setActionResolved(true)
  } else if (spaceType === 'Action') {
    setMechanicResolved(true)
    setActionResolved(false)
  } else if (spaceType === 'Battle') {
    let deck = battleDeck

    if (deck.length === 0) {
      deck = shuffleDeck(battleCards)
    }

    const drawnBattle = deck[0]
    const activeBattleIndexes = players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => !player.leftGame)
      .map(({ index }) => index)

    const randomOpponentIndex = drawnBattle?.allPlayers
      ? null
      : chooseRandomIndex(
          activeBattleIndexes.filter((index) => index !== currentPlayerIndex)
        )

    setBattleDeck(deck.slice(1))
    setBattleResolved(false)
    setBattleState({
      card: drawnBattle,
      opponentIndex: randomOpponentIndex,
      participantIndexes: drawnBattle?.allPlayers ? activeBattleIndexes : null,
      battleMechanic: null,
      concedeVoteBy: null,
      luckySpins: [],
      luckySpinCursor: 0,
      resultMessage: '',
    })
    setMechanicResolved(true)
    setActionResolved(true)
  } else if (spaceType === 'Event') {
    let deck = eventDeck

    if (deck.length === 0) {
      deck = shuffleDeck(eventCards)
    }

    const drawnEvent = deck[0]
    setEventDeck(deck.slice(1))
    setEventResolved(false)
    setEventState({
      card: drawnEvent,
      resultMessage: '',
    })
    setMechanicResolved(true)
    setActionResolved(true)
  } else if (spaceType === 'Gamble') {
    setMechanicResolved(true)
    setActionResolved(true)
    setSpecialResolved(false)
    setSpecialState({
      type: 'gamble',
      stage: 'choose-risk',
      mechanic: null,
      attemptsLeft: 0,
      reward: 0,
      penalty: 0,
      riskName: '',
      resultMessage: '',
    })
  } else if (spaceType === 'Choose Difficulty') {
    setMechanicResolved(true)
    setActionResolved(true)
    setSpecialResolved(false)
    setSpecialState({
      type: 'choose-difficulty',
      stage: 'choose-difficulty',
      mechanic: null,
      attemptsLeft: 0,
      resultMessage: '',
    })
  } else if (spaceType === 'Action Shop') {
    const { offers, deck, discard } = takeActionShopOffers(3)
    setActionDeck(deck)
    setActionDiscardPile(discard)
    setMechanicResolved(true)
    setActionResolved(true)
    setSpecialResolved(false)
    setSpecialState({
      type: 'action-shop',
      stage: 'offers',
      offers,
      selectedOfferIndex: null,
      resultMessage: '',
    })
  } else {
    // Start, Finish, and a gate that has already been resolved have no
    // automatic landing effect.
    setMechanicResolved(true)
    setActionResolved(true)
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) =>
      index === currentPlayerIndex
        ? {
            ...player,
            position: effectivePosition,
            boardNodeId: boardNodeId || player.boardNodeId || null,
            routeHistory: routeHistory || player.routeHistory || [],
          }
        : player
    )
  )
}


function getGeneratedBoardNode(nodeId) {
  if (!generatedBoard || !nodeId) return null
  return generatedBoard.nodes.find((node) => node.id === nodeId) || null
}

function buildGeneratedPathToNode(targetNodeId) {
  if (!generatedBoard || !targetNodeId) return []

  const startId = generatedBoard.startId
  if (targetNodeId === startId) return [startId]

  const nodeMap = new Map(
    generatedBoard.nodes.map((node) => [node.id, node])
  )
  const queue = [[startId]]
  const visited = new Set([startId])

  while (queue.length > 0) {
    const path = queue.shift()
    const currentId = path[path.length - 1]
    const currentNode = nodeMap.get(currentId)

    for (const nextId of currentNode?.next || []) {
      if (visited.has(nextId)) continue
      const nextPath = [...path, nextId]
      if (nextId === targetNodeId) return nextPath
      visited.add(nextId)
      queue.push(nextPath)
    }
  }

  return [startId]
}

function normalizePlayerRouteHistory(player) {
  if (!generatedBoard) return []

  const currentNodeId = player?.boardNodeId || generatedBoard.startId
  const existing = Array.isArray(player?.routeHistory)
    ? player.routeHistory.filter(Boolean)
    : []

  const currentIndex = existing.lastIndexOf(currentNodeId)
  if (currentIndex >= 0) {
    return existing.slice(0, currentIndex + 1)
  }

  return buildGeneratedPathToNode(currentNodeId)
}

function chooseForcedForwardNext(currentNode, nodeMap) {
  const choices = currentNode?.next || []
  if (choices.length <= 1) return choices[0] || null

  if (currentNode.id === generatedBoard?.shortcut?.gateId) {
    return generatedBoard.shortcut.normalRoute || choices[0]
  }

  const mainChoice = choices.find(
    (nextId) => nodeMap.get(nextId)?.route === 'main'
  )

  return mainChoice || choices[0]
}

function forceMoveGeneratedPlayer(player, spaces, direction = 'forward') {
  if (!generatedBoard || !player || player.finished) {
    return {
      player,
      spacesMoved: 0,
      reachedFinish: Boolean(player?.finished),
      discardedCards: [],
    }
  }

  const amount = Math.max(0, Math.floor(spaces || 0))
  const nodeMap = new Map(
    generatedBoard.nodes.map((node) => [node.id, node])
  )
  let history = normalizePlayerRouteHistory(player)
  let currentNodeId =
    player.boardNodeId || history[history.length - 1] || generatedBoard.startId

  if (history.length === 0) history = [generatedBoard.startId]
  if (history[history.length - 1] !== currentNodeId) {
    history = buildGeneratedPathToNode(currentNodeId)
  }

  if (direction === 'backward') {
    const steps = Math.min(amount, Math.max(0, history.length - 1))
    const newHistory = history.slice(0, history.length - steps)
    const newNodeId = newHistory[newHistory.length - 1] || generatedBoard.startId

    return {
      player: {
        ...player,
        position: Math.max(0, (player.position || 0) - steps),
        boardNodeId: newNodeId,
        routeHistory: newHistory,
      },
      spacesMoved: steps,
      reachedFinish: false,
      discardedCards: [],
    }
  }

  let steps = 0
  let passedShortcutGate = Boolean(player.shortcutGateResolved)

  while (steps < amount) {
    const currentNode = nodeMap.get(currentNodeId)
    if (!currentNode || currentNode.type === 'Finish') break

    const nextId = chooseForcedForwardNext(currentNode, nodeMap)
    if (!nextId) break

    currentNodeId = nextId
    history.push(nextId)
    steps += 1

    if (
      currentNode.id === generatedBoard.shortcut?.gateId ||
      currentNodeId === generatedBoard.shortcut?.gateId
    ) {
      passedShortcutGate = true
    }

    if (nodeMap.get(currentNodeId)?.type === 'Finish') break
  }

  const destination = nodeMap.get(currentNodeId)
  const reachedFinish = destination?.type === 'Finish'

  if (reachedFinish) {
    const discardedCards = [...(player.actionCards || [])]
    const finishedPlayer = movePlayerAndHandleFinish(
      player,
      BOARD_LENGTH,
      discardedCards
    )

    return {
      player: {
        ...finishedPlayer,
        boardNodeId: generatedBoard.finishId,
        routeHistory: history,
        shortcutGateResolved: passedShortcutGate,
      },
      spacesMoved: steps,
      reachedFinish: true,
      discardedCards,
    }
  }

  return {
    player: {
      ...player,
      position: Math.min(
        BOARD_LENGTH - 1,
        Math.max(0, (player.position || 0) + steps)
      ),
      boardNodeId: currentNodeId,
      routeHistory: history,
      shortcutGateResolved: passedShortcutGate,
    },
    spacesMoved: steps,
    reachedFinish: false,
    discardedCards: [],
  }
}

function getGeneratedProgress(player) {
  if (!generatedBoard || !player?.boardNodeId) {
    return player?.position || 0
  }

  if (player.finished || player.boardNodeId === generatedBoard.finishId) {
    return generatedBoard.mainPath.length
  }

  const mainIndexes = new Map(
    generatedBoard.mainPath.map((id, index) => [id, index])
  )

  if (mainIndexes.has(player.boardNodeId)) {
    return mainIndexes.get(player.boardNodeId)
  }

  for (const fork of generatedBoard.forks || []) {
    const branchIndex = (fork.alternatePath || []).indexOf(player.boardNodeId)
    if (branchIndex === -1) continue

    const splitIndex = mainIndexes.get(fork.splitId) ?? 0
    const rejoinIndex = mainIndexes.get(fork.rejoinId) ?? splitIndex
    const t = (branchIndex + 1) / ((fork.alternatePath || []).length + 1)
    return splitIndex + (rejoinIndex - splitIndex) * t
  }

  const shortcutIndex = (generatedBoard.shortcut?.shortcutPath || []).indexOf(
    player.boardNodeId
  )
  if (shortcutIndex !== -1) {
    const gateIndex = mainIndexes.get(generatedBoard.shortcut.gateId) ?? 0
    const rejoinIndex = mainIndexes.get(generatedBoard.shortcut.rejoinId) ?? gateIndex
    const t =
      (shortcutIndex + 1) /
      ((generatedBoard.shortcut.shortcutPath || []).length + 1)
    return gateIndex + (rejoinIndex - gateIndex) * t
  }

  return player.position || 0
}


function generatedRouteLabel(nextId) {
  const node = getGeneratedBoardNode(nextId)
  if (!node) return 'Route'

  if (nextId === generatedBoard?.shortcut?.shortcutRoute) {
    return 'Risky Shortcut'
  }

  if (nextId === generatedBoard?.shortcut?.normalRoute) {
    return 'Main Route'
  }

  if (node.route === 'fork') return 'Alternate Route'
  if (node.route === 'main') return 'Main Route'
  return 'Route'
}

function getBoardForkPreviewOptions(forkState) {
  if (!generatedBoard || !forkState || forkState.type !== 'board-fork') {
    return []
  }

  const nodeMap = new Map(
    generatedBoard.nodes.map((node) => [node.id, node])
  )

  return (forkState.options || []).map((option, optionIndex) => {
    let currentNodeId = forkState.currentNodeId
    let remaining = Math.max(0, forkState.remainingMovement || 0)

    if (remaining > 0 && option.nextId) {
      currentNodeId = option.nextId
      remaining -= 1
    }

    while (remaining > 0) {
      const currentNode = nodeMap.get(currentNodeId)
      if (!currentNode || currentNode.type === 'Finish') break

      const choices = currentNode.next || []
      if (choices.length === 0) break

      // If this spin reaches another decision point, stop the preview there
      // instead of pretending the app already knows which path will be chosen.
      if (choices.length > 1) break

      currentNodeId = choices[0]
      remaining -= 1
    }

    const destination = nodeMap.get(currentNodeId)

    return {
      ...option,
      optionIndex,
      destinationNodeId: currentNodeId,
      destinationType: destination?.type || 'Space',
      destinationMainIndex:
        typeof destination?.mainIndex === 'number' ? destination.mainIndex : null,
      pausesAgain: remaining > 0 && (destination?.next || []).length > 1,
    }
  })
}

function clearLandingUiForRouteChoice() {
  setMechanicCard(null)
  setMechanicChoices([])
  setAttemptsLeft(0)
  setMechanicResolved(true)
  setMechanicMessage('')
  setMechanicFailed(false)
  setDoublePointsActive(false)
  setInsuranceActive(false)
  setJackpotActive(false)
  setMechanicActionUsed(false)
  setAwaitingMechanicDraw(false)
  setNoBounceRequired(false)
  setKph100Required(false)
  setTopCornerRequired(false)
  setActionResolved(true)
  setBattleState(null)
  setBattleResolved(true)
  setEventState(null)
  setEventResolved(true)
}

function continueGeneratedMovement({
  startNodeId,
  remainingMovement,
  basePosition,
  chosenNextId = null,
  routeHistory = null,
}) {
  if (!generatedBoard) return

  const nodeMap = new Map(
    generatedBoard.nodes.map((node) => [node.id, node])
  )

  let currentNodeId = startNodeId || generatedBoard.startId
  let remaining = Math.max(0, remainingMovement || 0)
  let movedSpaces = 0
  let history = Array.isArray(routeHistory)
    ? [...routeHistory]
    : normalizePlayerRouteHistory(players[currentPlayerIndex])

  const existingCurrentIndex = history.lastIndexOf(currentNodeId)
  if (existingCurrentIndex >= 0) {
    history = history.slice(0, existingCurrentIndex + 1)
  } else {
    history = buildGeneratedPathToNode(currentNodeId)
  }

  if (chosenNextId) {
    const currentNode = nodeMap.get(currentNodeId)

    if (!currentNode?.next?.includes(chosenNextId) || remaining <= 0) {
      return
    }

    currentNodeId = chosenNextId
    history.push(chosenNextId)
    remaining -= 1
    movedSpaces += 1
  }

  while (remaining > 0) {
    const currentNode = nodeMap.get(currentNodeId)
    if (!currentNode) break

    if (currentNode.type === 'Finish' || (currentNode.next || []).length === 0) {
      break
    }

    const choices = currentNode.next || []

    // The risky Shortcut Gate can only be resolved once per player. If this
    // player later moves backward past the gate and reaches it again, do not
    // offer the shortcut a second time; automatically continue on Main Route.
    const shortcutAlreadyResolved =
      currentNodeId === generatedBoard.shortcut?.gateId &&
      Boolean(players[currentPlayerIndex]?.shortcutGateResolved)

    if (shortcutAlreadyResolved && choices.length > 1) {
      const mainNextId = generatedBoard.shortcut?.normalRoute

      if (mainNextId && choices.includes(mainNextId)) {
        currentNodeId = mainNextId
        history.push(mainNextId)
        remaining -= 1
        movedSpaces += 1
        continue
      }
    }

    if (choices.length > 1) {
      const pausedPosition = Math.min(
        BOARD_LENGTH - 1,
        Math.max(0, (basePosition || 0) + movedSpaces)
      )

      setPlayers((currentPlayers) =>
        currentPlayers.map((player, index) =>
          index === currentPlayerIndex
            ? {
                ...player,
                position: pausedPosition,
                boardNodeId: currentNodeId,
                routeHistory: history,
              }
            : player
        )
      )

      clearLandingUiForRouteChoice()
      setLandedSpace(
        currentNodeId === generatedBoard.shortcut?.gateId
          ? 'Shortcut Gate'
          : 'Fork in the Road'
      )
      setSpecialResolved(false)

      if (currentNodeId === generatedBoard.shortcut?.gateId) {
        setLandingAnnouncement({
          spaceType: 'Shortcut Gate',
          playerName: players[currentPlayerIndex]?.name || 'Player',
          until: Date.now() + LANDING_REVEAL_MS,
        })
        setLandingAnnouncementClock(Date.now())

        setSpecialState({
          type: 'shortcut-gate',
          stage: 'choose-route',
          generatedGraph: true,
          currentNodeId,
          remainingMovement: remaining,
          basePosition: pausedPosition,
          routeHistory: history,
          mainNextId: generatedBoard.shortcut.normalRoute,
          shortcutNextId: generatedBoard.shortcut.shortcutRoute,
          shortcutMechanic: null,
          routeResult: null,
          resultMessage: '',
        })
      } else {
        setSpecialState({
          type: 'board-fork',
          stage: 'choose-route',
          currentNodeId,
          remainingMovement: remaining,
          basePosition: pausedPosition,
          routeHistory: history,
          options: choices.map((nextId) => ({
            nextId,
            label: generatedRouteLabel(nextId),
            firstSpaceType: nodeMap.get(nextId)?.type || 'Space',
          })),
        })
      }

      return
    }

    currentNodeId = choices[0]
    history.push(currentNodeId)
    remaining -= 1
    movedSpaces += 1
  }

  const destination = nodeMap.get(currentNodeId)
  if (!destination) return

  const reachedFinish = destination.type === 'Finish'
  const finalPosition = reachedFinish
    ? BOARD_LENGTH
    : Math.min(
        BOARD_LENGTH - 1,
        Math.max(0, (basePosition || 0) + movedSpaces)
      )

  activateLandingAtPosition(finalPosition, {
    boardNodeId: currentNodeId,
    spaceType: destination.type,
    routeHistory: history,
  })
}

function chooseBoardForkRoute(nextId) {
  if (
    !specialState ||
    specialState.type !== 'board-fork' ||
    specialState.stage !== 'choose-route' ||
    !(specialState.options || []).some((option) => option.nextId === nextId)
  ) {
    return
  }

  const movementState = {
    startNodeId: specialState.currentNodeId,
    remainingMovement: specialState.remainingMovement,
    basePosition: specialState.basePosition,
    chosenNextId: nextId,
    routeHistory: specialState.routeHistory || null,
  }

  setSpecialState(null)
  setSpecialResolved(true)
  continueGeneratedMovement(movementState)
}

function chooseGambleRisk(riskId) {
  if (
    !specialState ||
    specialResolved ||
    specialState.type !== 'gamble' ||
    specialState.stage !== 'choose-risk'
  ) {
    return
  }

  const options = {
    safe: {
      name: 'Safe',
      difficulty: 'Medium',
      reward: 2,
      penalty: 0,
    },
    risky: {
      name: 'Risky',
      difficulty: 'Hard',
      reward: 4,
      penalty: 1,
    },
    insane: {
      name: 'Insane',
      difficulty: 'Extreme',
      reward: 6,
      penalty: 3,
    },
  }

  const option = options[riskId]
  if (!option) return

  const drawnMechanic = getRandomMechanicByDifficulty(option.difficulty)
  if (!drawnMechanic) return

  setSpecialState((currentSpecial) => ({
    ...currentSpecial,
    stage: 'mechanic',
    mechanic: drawnMechanic,
    attemptsLeft: 2,
    reward: option.reward,
    penalty: option.penalty,
    riskName: option.name,
    resultMessage: '',
  }))
}

function chooseSpecialDifficulty(difficulty) {
  if (
    !specialState ||
    specialResolved ||
    specialState.type !== 'choose-difficulty' ||
    specialState.stage !== 'choose-difficulty'
  ) {
    return
  }

  const drawnMechanic = getRandomMechanicByDifficulty(difficulty)
  if (!drawnMechanic) return

  setSpecialState((currentSpecial) => ({
    ...currentSpecial,
    stage: 'mechanic',
    mechanic: drawnMechanic,
    attemptsLeft: 2,
    resultMessage: '',
  }))
}

function scoreSpecialMechanic() {
  if (
    !specialState ||
    specialResolved ||
    specialState.stage !== 'mechanic' ||
    !specialState.mechanic
  ) {
    return
  }

  const pointsEarned =
    specialState.type === 'gamble'
      ? specialState.reward
      : specialState.mechanic.points

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) =>
      index === currentPlayerIndex
        ? { ...player, points: player.points + pointsEarned }
        : player
    )
  )

  setSpecialResolved(true)
  setSpecialState((currentSpecial) => ({
    ...currentSpecial,
    stage: 'result',
    attemptsLeft: 0,
    resultMessage:
      currentSpecial.type === 'gamble'
        ? `${currentSpecial.riskName} Gamble cleared! +${pointsEarned} points.`
        : `${currentSpecial.mechanic.name} scored! +${pointsEarned} point${
            pointsEarned === 1 ? '' : 's'
          }.`,
  }))
}

function missSpecialMechanic() {
  if (
    !specialState ||
    specialResolved ||
    specialState.stage !== 'mechanic' ||
    !specialState.mechanic
  ) {
    return
  }

  if (specialState.attemptsLeft > 1) {
    setSpecialState((currentSpecial) => ({
      ...currentSpecial,
      attemptsLeft: currentSpecial.attemptsLeft - 1,
      resultMessage: 'Missed! You have 1 attempt left.',
    }))
    return
  }

  const penalty =
    specialState.type === 'gamble'
      ? specialState.penalty
      : 0

  let pointsLost = 0

  if (penalty > 0) {
    const currentPoints = players[currentPlayerIndex]?.points || 0
    pointsLost = Math.min(penalty, currentPoints)

    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) =>
        index === currentPlayerIndex
          ? { ...player, points: Math.max(0, player.points - penalty) }
          : player
      )
    )
  }

  setSpecialResolved(true)
  setSpecialState((currentSpecial) => ({
    ...currentSpecial,
    stage: 'result',
    attemptsLeft: 0,
    resultMessage:
      currentSpecial.type === 'gamble'
        ? penalty > 0
          ? pointsLost > 0
            ? `Gamble failed. -${pointsLost} point${pointsLost === 1 ? '' : 's'}.`
            : 'Gamble failed. You had no points to lose.'
          : 'Safe Gamble failed. No points gained or lost.'
        : 'Missed both attempts. 0 points.',
  }))
}

function buyActionShopOffer(offerIndex) {
  if (
    !specialState ||
    specialResolved ||
    specialState.type !== 'action-shop' ||
    specialState.stage !== 'offers'
  ) {
    return
  }

  const currentPlayer = players[currentPlayerIndex]
  const chosenCard = specialState.offers?.[offerIndex]

  if (!chosenCard || currentPlayer.points < 1) return

  if ((currentPlayer.actionCards || []).length >= 3) {
    setSpecialState((currentSpecial) => ({
      ...currentSpecial,
      stage: 'replace-card',
      selectedOfferIndex: offerIndex,
    }))
    return
  }

  completeActionShopPurchase(offerIndex, null)
}

function completeActionShopPurchase(offerIndex, replaceIndex = null) {
  if (
    !specialState ||
    specialResolved ||
    specialState.type !== 'action-shop'
  ) {
    return
  }

  const currentPlayer = players[currentPlayerIndex]
  const offers = specialState.offers || []
  const chosenCard = offers[offerIndex]
  const currentHand = [...(currentPlayer.actionCards || [])]

  if (!chosenCard || currentPlayer.points < 1) return

  let newHand = [...currentHand]
  const cardsToDiscard = offers.filter((_, index) => index !== offerIndex)

  if (currentHand.length >= 3) {
    if (
      replaceIndex === null ||
      replaceIndex < 0 ||
      replaceIndex >= currentHand.length
    ) {
      return
    }

    cardsToDiscard.push(currentHand[replaceIndex])
    newHand[replaceIndex] = chosenCard
  } else {
    newHand.push(chosenCard)
  }

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) =>
      index === currentPlayerIndex
        ? {
            ...player,
            points: Math.max(0, player.points - 1),
            actionCards: newHand,
          }
        : player
    )
  )

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    ...cardsToDiscard,
  ])

  setSpecialResolved(true)
  setSpecialState((currentSpecial) => ({
    ...currentSpecial,
    stage: 'result',
    resultMessage: 'Action Shop purchase complete for 1 point.',
  }))
}

function cancelActionShopReplacement() {
  if (
    !specialState ||
    specialResolved ||
    specialState.type !== 'action-shop' ||
    specialState.stage !== 'replace-card'
  ) {
    return
  }

  setSpecialState((currentSpecial) => ({
    ...currentSpecial,
    stage: 'offers',
    selectedOfferIndex: null,
  }))
}

function declineActionShop() {
  if (
    !specialState ||
    specialResolved ||
    specialState.type !== 'action-shop'
  ) {
    return
  }

  const offers = specialState.offers || []

  setActionDiscardPile((currentPile) => [
    ...currentPile,
    ...offers,
  ])

  setSpecialResolved(true)
  setSpecialState((currentSpecial) => ({
    ...currentSpecial,
    stage: 'result',
    resultMessage: 'You declined the Action Shop. No point was spent.',
  }))
}

function returnFromSpecial() {
  if (!specialResolved) return
  setSpecialState(null)
}

function chooseMainShortcutRoute() {
  if (
    !specialState ||
    specialState.type !== 'shortcut-gate' ||
    specialState.stage !== 'choose-route'
  ) {
    return
  }

  if (specialState.generatedGraph) {
    setSpecialState((currentSpecial) => ({
      ...currentSpecial,
      stage: 'continue-movement',
      routeResult: 'main',
      resultMessage: `Main Route chosen. ${currentSpecial.remainingMovement} movement space${
        currentSpecial.remainingMovement === 1 ? '' : 's'
      } remain from the original spin.`,
    }))
    return
  }

  setSpecialState((currentSpecial) => ({
    ...currentSpecial,
    stage: 'continue-movement',
    routeResult: 'main',
    resultMessage: `Main Route chosen. ${currentSpecial.remainingMovement} movement space${
      currentSpecial.remainingMovement === 1 ? '' : 's'
    } remain from the original spin.`,
  }))
}

function attemptShortcutRoute() {
  if (
    !specialState ||
    specialState.type !== 'shortcut-gate' ||
    specialState.stage !== 'choose-route'
  ) {
    return
  }

  const challenge = getRandomMechanicByDifficulty('Hard')
  if (!challenge) return

  setSpecialState((currentSpecial) => ({
    ...currentSpecial,
    stage: 'shortcut-challenge',
    shortcutMechanic: challenge,
    resultMessage: '',
  }))
}

function resolveShortcutChallenge(scored) {
  if (
    !specialState ||
    specialState.type !== 'shortcut-gate' ||
    specialState.stage !== 'shortcut-challenge' ||
    !specialState.shortcutMechanic
  ) {
    return
  }

  let pointsLost = 0

  if (specialState.generatedGraph && !scored) {
    const currentPoints = players[currentPlayerIndex]?.points || 0
    pointsLost = Math.min(1, currentPoints)

    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) =>
        index === currentPlayerIndex
          ? { ...player, points: Math.max(0, player.points - 1) }
          : player
      )
    )
  }

  setSpecialState((currentSpecial) => ({
    ...currentSpecial,
    stage: 'continue-movement',
    routeResult: scored ? 'shortcut' : 'main',
    resultMessage: currentSpecial.generatedGraph
      ? scored
        ? `Shortcut cleared with ${currentSpecial.shortcutMechanic.name}! Continue the remaining ${currentSpecial.remainingMovement} movement space${
            currentSpecial.remainingMovement === 1 ? '' : 's'
          } on the shortcut.`
        : pointsLost > 0
          ? `Shortcut missed. -1 point. Continue the remaining ${currentSpecial.remainingMovement} movement space${
              currentSpecial.remainingMovement === 1 ? '' : 's'
            } on the Main Route.`
          : `Shortcut missed. You had no points to lose. Continue the remaining ${currentSpecial.remainingMovement} movement space${
              currentSpecial.remainingMovement === 1 ? '' : 's'
            } on the Main Route.`
      : scored
        ? `Shortcut cleared with ${currentSpecial.shortcutMechanic.name}! You take the shorter route and rejoin at Space ${SHORTCUT_EXIT_POSITION}. ${currentSpecial.remainingMovement} movement space${
            currentSpecial.remainingMovement === 1 ? '' : 's'
          } remain.`
        : `Shortcut missed. You are sent down the Main Route. ${currentSpecial.remainingMovement} movement space${
            currentSpecial.remainingMovement === 1 ? '' : 's'
          } remain.`,
  }))
}

function continueAfterShortcutGate() {
  if (
    !specialState ||
    specialState.type !== 'shortcut-gate' ||
    specialState.stage !== 'continue-movement' ||
    !specialState.routeResult
  ) {
    return
  }

  if (specialState.generatedGraph) {
    const movementState = {
      startNodeId: specialState.currentNodeId,
      remainingMovement: specialState.remainingMovement || 0,
      basePosition: specialState.basePosition || 0,
      chosenNextId:
        specialState.routeResult === 'shortcut'
          ? specialState.shortcutNextId
          : specialState.mainNextId,
      routeHistory: specialState.routeHistory || null,
    }

    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) =>
        index === currentPlayerIndex
          ? { ...player, shortcutGateResolved: true }
          : player
      )
    )

    setSpecialState(null)
    setSpecialResolved(true)
    continueGeneratedMovement(movementState)
    return
  }

  const remainingMovement = specialState.remainingMovement || 0
  const tookShortcut = specialState.routeResult === 'shortcut'
  const basePosition = tookShortcut
    ? SHORTCUT_EXIT_POSITION
    : SHORTCUT_GATE_POSITION

  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) =>
      index === currentPlayerIndex
        ? {
            ...player,
            shortcutGateResolved: true,
            position: basePosition,
          }
        : player
    )
  )

  setSpecialState(null)
  setSpecialResolved(true)

  if (remainingMovement <= 0) {
    setLandedSpace(tookShortcut ? 'Shortcut Exit' : 'Shortcut Gate')
    setMechanicResolved(true)
    setActionResolved(true)
    setBattleState(null)
    setBattleResolved(true)
    setEventState(null)
    setEventResolved(true)
    return
  }

  const finalPosition = Math.min(
    BOARD_LENGTH,
    basePosition + remainingMovement
  )

  activateLandingAtPosition(finalPosition)
}

  function spin(forcedResult = null) {
    if (hasSpun) return

    // Second Chance: first click reveals two spins.
    if (
      secondChanceActive &&
      forcedResult === null &&
      secondChanceRolls.length === 0
    ) {
      const firstRoll = Math.floor(Math.random() * 10) + 1
      const secondRoll = Math.floor(Math.random() * 10) + 1

      setSecondChanceRolls([firstRoll, secondRoll])
      setActionMessage(
        `SECOND CHANCE! You spun ${firstRoll} and ${secondRoll}. Choose which one you want.`
      )
      return
    }

    if (secondChanceRolls.length > 0 && forcedResult === null) {
      return
    }

    const choosingSecondChance =
      forcedResult !== null && secondChanceRolls.length === 2
    const savedSecondChanceRolls = [...secondChanceRolls]
    const result =
      forcedResult !== null
        ? forcedResult
        : Math.floor(Math.random() * 10) + 1

    const currentPlayer = players[currentPlayerIndex]

    setSpinResult(result)
    setHasSpun(true)

    if (choosingSecondChance) {
      setActionMessage(
        `SECOND CHANCE! You spun ${savedSecondChanceRolls[0]} and ${savedSecondChanceRolls[1]}. You chose ${result}!`
      )
    } else {
      setActionMessage('')
    }

    setSecondChanceActive(false)
    setSecondChanceRolls([])

    if (generatedBoard) {
      continueGeneratedMovement({
        startNodeId: currentPlayer.boardNodeId || generatedBoard.startId,
        remainingMovement: result,
        basePosition: currentPlayer.position || 0,
        routeHistory: currentPlayer.routeHistory || null,
      })
      return
    }

    const distanceToGate =
      SHORTCUT_GATE_POSITION - currentPlayer.position

    const mustPauseAtShortcutGate =
      !currentPlayer.shortcutGateResolved &&
      currentPlayer.position < SHORTCUT_GATE_POSITION &&
      distanceToGate >= 0 &&
      result >= distanceToGate

    if (mustPauseAtShortcutGate) {
      const remainingMovement = result - distanceToGate

      // The gate is a mandatory quick stop during normal spinner movement.
      // Reaching or passing it pauses the spin, then the exact remaining
      // movement is continued after the route decision.
      setLandedSpace('Shortcut Gate')
      setMechanicCard(null)
      setMechanicChoices([])
      setAttemptsLeft(0)
      setMechanicResolved(true)
      setMechanicMessage('')
      setMechanicFailed(false)
      setDoublePointsActive(false)
      setInsuranceActive(false)
      setJackpotActive(false)
      setMechanicActionUsed(false)
      setAwaitingMechanicDraw(false)
      setNoBounceRequired(false)
      setKph100Required(false)
      setTopCornerRequired(false)
      setActionResolved(true)
      setBattleState(null)
      setBattleResolved(true)
      setEventState(null)
      setEventResolved(true)
      setSpecialResolved(false)
      setSpecialState({
        type: 'shortcut-gate',
        stage: 'choose-route',
        remainingMovement,
        shortcutMechanic: null,
        routeResult: null,
        resultMessage: '',
      })

      setPlayers((currentPlayers) =>
        currentPlayers.map((player, index) =>
          index === currentPlayerIndex
            ? { ...player, position: SHORTCUT_GATE_POSITION }
            : player
        )
      )

      return
    }

    const newPosition = Math.min(
      currentPlayer.position + result,
      BOARD_LENGTH
    )

    activateLandingAtPosition(newPosition)
  }

  function scoreMechanic() {
    if (!mechanicCard || mechanicResolved) return
    let pointsEarned = doublePointsActive
  ? mechanicCard.points * 2
  : mechanicCard.points
  if (jackpotActive) {
  pointsEarned += 3
}
const currentPlayer = players[currentPlayerIndex]

if (currentPlayer.hotStreakActive) {
  pointsEarned += 2
}

    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        if (index !== currentPlayerIndex) {
          return player
        }

        return {
  ...player,
  points: player.points + pointsEarned,
  hotStreakActive: false,
}
      })
    )

    setLastScoredMechanic({
  card: mechanicCard,
  playerId: currentPlayer.id,
})
    setMechanicResolved(true)
    setDoublePointsActive(false)
    setInsuranceActive(false)
    setJackpotActive(false)
    setMechanicFailed(false)

    // Everyone may know the normal game result, but not which Action Cards changed it.
    setPublicMechanicOutcome(
      `${currentPlayer.name} scored ${mechanicCard.name}!`
    )

   setMechanicMessage(
  `Scored! +${pointsEarned} point${
    pointsEarned === 1 ? '' : 's'
  }`
)
  }

  function missMechanic() {
    if (!mechanicCard || mechanicResolved) return

    if (attemptsLeft > 1) {
      setAttemptsLeft(attemptsLeft - 1)
      // Intermediate attempts stay private so extra-attempt Action Cards are not exposed.
      setMechanicMessage('Missed! You have 1 attempt left.')
    } else {
  setAttemptsLeft(0)
  setMechanicResolved(true)
  setMechanicFailed(true)
  setDoublePointsActive(false)
  const currentPlayer = players[currentPlayerIndex]

  // Public result is intentionally generic so Jackpot, Insurance, Hot Streak,
  // Pressure, and every other Action Card remain secret.
  setPublicMechanicOutcome(
    `${currentPlayer.name} missed ${mechanicCard.name}.`
  )

if (currentPlayer.hotStreakActive) {
  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        hotStreakActive: false,
      }
    })
  )

  setMechanicMessage(
    'Hot Streak failed! You missed your only attempt.'
  )

  return
}
  if (jackpotActive) {
  setPlayers((currentPlayers) =>
    currentPlayers.map((player, index) => {
      if (index !== currentPlayerIndex) {
        return player
      }

      return {
        ...player,
        points: Math.max(0, player.points - 3),
      }
    })
  )

  setJackpotActive(false)

  setMechanicMessage(
    'Jackpot failed! -3 points.'
  )

  return
}

  if (insuranceActive) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        if (index !== currentPlayerIndex) {
          return player
        }

        return {
          ...player,
          points: player.points + 1,
        }
      })
    )

    setInsuranceActive(false)
    setMechanicMessage(
      'Missed both attempts, but Insurance saved you! +1 point.'
    )
  } else {
    setMechanicMessage('Missed both attempts. 0 points.')
  }
}
  }

  function endTurn() {
    // The game ends immediately after the final unfinished player reaches Finish.
    // No extra waiting bonuses are awarded once everyone is finished.
    const activePlayers = players.filter((player) => !player.leftGame)

    if (
      activePlayers.length === 0 ||
      activePlayers.every((player) => player.finished)
    ) {
      setScreen('results')
      return
    }

    let nextPlayer = null
    const finishedPlayersPassed = []

    for (let step = 1; step <= players.length; step += 1) {
      const candidateIndex =
        (currentPlayerIndex + step * turnDirection + players.length * 10) %
        players.length
      const candidate = players[candidateIndex]

      if (candidate.leftGame) {
        continue
      }

      if (candidate.finished) {
        finishedPlayersPassed.push(candidateIndex)
        continue
      }

      nextPlayer = candidateIndex
      break
    }

    if (nextPlayer === null) {
      setScreen('results')
      return
    }

    const bonusRecipients = finishedPlayersPassed.filter(
      (index) =>
        (players[index]?.finishWaitingBonus || 0) < FINISH_WAITING_BONUS_CAP
    )

    if (bonusRecipients.length > 0) {
      setPlayers((currentPlayers) =>
        currentPlayers.map((player, index) => {
          if (!bonusRecipients.includes(index)) return player

          return {
            ...player,
            points: player.points + 1,
            finishWaitingBonus: Math.min(
              FINISH_WAITING_BONUS_CAP,
              (player.finishWaitingBonus || 0) + 1
            ),
          }
        })
      )
    }

    const nextPlayerIsLockedOut =
      players[nextPlayer]?.lockoutActive || false

    setCurrentPlayerIndex(nextPlayer)
    setSpinResult(null)
    setHasSpun(false)
    setLandedSpace(null)
    setLandingAnnouncement(null)

    setMechanicCard(null)
    setMechanicChoices([])
    setAttemptsLeft(0)
    setMechanicResolved(true)
    setMechanicMessage('')
    setMechanicFailed(false)
    setDoublePointsActive(false)
    setInsuranceActive(false)
    setJackpotActive(false)
    setMechanicActionUsed(false)
    setAwaitingMechanicDraw(false)
    setSecondChanceActive(false)
    setSecondChanceRolls([])
    setTradeOfferState(null)
    setNoBounceRequired(false)
    setKph100Required(false)
    setTopCornerRequired(false)
    setBattleState(null)
    setBattleResolved(true)
    setEventState(null)
    setEventResolved(true)
    setSpecialState(null)
    setSpecialResolved(true)
    setActionCardUsedThisTurn(nextPlayerIsLockedOut)

    if (nextPlayerIsLockedOut) {
      setPlayers((currentPlayers) =>
        currentPlayers.map((player, index) => {
          if (index !== nextPlayer) return player

          return {
            ...player,
            lockoutActive: false,
          }
        })
      )
    }

    setActionResolved(true)

    const bonusMessage =
      bonusRecipients.length > 0
        ? `FINISH BONUS: ${bonusRecipients
            .map((index) => players[index]?.name)
            .filter(Boolean)
            .join(', ')} +1 point${bonusRecipients.length === 1 ? '' : ' each'}. `
        : ''

    if (nextPlayerIsLockedOut) {
      setActionMessage(
        `${bonusMessage}LOCKOUT: You cannot use any Action Cards this turn.`
      )
    } else {
      setActionMessage(bonusMessage.trim())
    }
  }

  if (leaveConfirmOpen) {
    const hostLeavingOnlineGame = isOnlineHost && isOnlineGame

    return (
      <div className="game">
        <h1>{hostLeavingOnlineGame ? 'Leave & End Game?' : 'Leave Game?'}</h1>

        <div className="rules-box">
          <h2>Are you sure?</h2>
          {hostLeavingOnlineGame ? (
            <>
              <p>
                You are the host. Leaving will <strong>end this online game for everyone</strong>
                and close the room.
              </p>
              <p>
                Every connected player will be sent out of the match, and nobody
                will be able to recover this room after a refresh.
              </p>
              <p><strong>This cannot be undone.</strong></p>
            </>
          ) : (
            <>
              <p>
                Leaving will take you back to the home screen and stop this browser
                from automatically reopening this game after a refresh.
              </p>
              {isOnlineGame && onlineSession?.roomCode && (
                <p>
                  You will be removed from room <strong>{onlineSession.roomCode}</strong>.
                  Your player stays in the match history, but all of your future turns are skipped permanently.
                </p>
              )}
              <p>
                <strong>This does not happen from a normal refresh.</strong> You only
                leave when you confirm below.
              </p>
            </>
          )}
          {leaveGameError && <p><strong>{leaveGameError}</strong></p>}
        </div>

        <div className="menu">
          <button data-online-allowed="true" onClick={cancelLeaveGame}>
            Cancel
          </button>
          <button data-online-allowed="true" onClick={confirmLeaveGame}>
            {hostLeavingOnlineGame ? 'Yes, End Game & Leave' : 'Yes, Leave Game'}
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'game-ended') {
    return (
      <div className="game">
        <h1>Online Game Ended</h1>
        <div className="rules-box">
          <p>{gameEndedNotice || 'This online game has ended.'}</p>
          <p>You can safely create or join another game now.</p>
        </div>
        <div className="menu">
          <button onClick={() => setScreen('home')}>
            Home
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'lobby') {
    return (
      <div className="game">
        <h1>Game Lobby</h1>

        <p>{players.length} / 4 Players</p>

        <div className="player-form">
          <input
            type="text"
            placeholder="Enter player name"
            value={playerName}
            onChange={(event) =>
              setPlayerName(event.target.value)
            }
            maxLength={15}
          />

          <button
            onClick={addPlayer}
            disabled={players.length >= 4}
          >
            Add Player
          </button>
        </div>

        <div className="player-list">
          {players.map((player, index) => (
            <div className="player" key={index}>
              <span>
                Player {index + 1}: {player.name}
              </span>

              <button
                onClick={() => removePlayer(index)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {players.length < 2 && (
          <p>You need at least 2 players to start.</p>
        )}

        <div className="menu">
          <button onClick={() => setScreen('home')}>
            Back
          </button>

          <button
            disabled={players.length < 2}
            onClick={() => setScreen('rules')}
          >
            Continue to Rules
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'rules') {
    return (
      <div className="game">
        <h1>Quick Rules</h1>

        <div className="rules-box">
          <h2>How to Play</h2>
          <p><strong>Goal:</strong> Reach Finish and end the game with the most points.</p>
          <p><strong>Your Turn:</strong> Spin 1–10, move, then resolve the space you land on.</p>
          <p><strong>Mechanics:</strong> Most spaces are Mechanic spaces. You normally get 2 attempts. Easy = 1 point, Medium = 2, Hard = 3, Extreme = 4.</p>
          <p><strong>Action Cards:</strong> Hold up to 3. Action spaces give cards, and Action Shops let you pay 1 point to choose 1 of 3 cards.</p>
          <p><strong>Battles:</strong> Follow the Battle screen. The winner gets +2 points and the loser loses 1 point (minimum 0). Normal Action/Mechanic effects do not affect Battles.</p>
          <p><strong>Events:</strong> Resolve the random Event shown on screen immediately.</p>
          <p><strong>Special Spaces:</strong> Gamble, Choose Difficulty, Action Shop, and the Shortcut Gate each explain themselves when reached.</p>
          <p><strong>Finish:</strong> If you arrive with exactly 3 Action Cards, cash them out for +1 point. All remaining Action Cards are then discarded.</p>
          <p><strong>Finished Players:</strong> Your normal turns are skipped. Each time your turn would come up, gain +1 point, up to +3 total waiting-bonus points.</p>
          <p><strong>Game Over:</strong> When everyone has finished, the highest score wins.</p>
        </div>

        {isOnlineGame && (
          <p>
            Room: <strong>{onlineSession.roomCode}</strong>
          </p>
        )}

        <div className="menu">
          {!isOnlineGame && (
            <button onClick={backToLocalLobby}>
              Back to Lobby
            </button>
          )}

          {!isOnlineGame || isOnlineHost ? (
            <button onClick={startGame}>
              Start Game
            </button>
          ) : (
            <p>
              <strong>Waiting for the host to start...</strong>
            </p>
          )}
        </div>
      </div>
    )
  }

  if (screen === 'results') {
    const sortedPlayers = [...players].sort((a, b) => {
      if (Boolean(a.leftGame) !== Boolean(b.leftGame)) return a.leftGame ? 1 : -1
      return b.points - a.points
    })
    const eligibleWinners = sortedPlayers.filter((player) => !player.leftGame)
    const highestScore = eligibleWinners[0]?.points ?? 0
    const winners = eligibleWinners.filter(
      (player) => player.points === highestScore
    )

    return (
      <div className="game">
        <h1>Game Over</h1>
        <h2>
          {winners.length === 1
            ? `${winners[0].name} Wins!`
            : `Tie: ${winners.map((player) => player.name).join(' & ')}`}
        </h2>

        <div className="rules-box">
          {sortedPlayers.map((player, index) => (
            <p key={player.id}>
              <strong>#{index + 1} {player.name}</strong> — {player.points} Points{player.leftGame ? ' · Left Game' : ''}
            </p>
          ))}
        </div>

        <div className="menu">
          {!isOnlineGame && (
            <button onClick={() => setScreen('lobby')}>
              Play Again
            </button>
          )}
          {!isOnlineGame && (
            <button onClick={goHomeAndClearRecovery}>
              Home
            </button>
          )}
        </div>
      </div>
    )
  }

  if (screen === 'game') {
    const currentPlayer = players[currentPlayerIndex]
    const playerDisplayOrder = players.map((_, offset) =>
  (currentPlayerIndex +
    offset * turnDirection +
    players.length) %
  players.length
)

    const gameHud = (
      <header className="game-hud">
        <div className="game-hud__identity">
          <div className="game-hud__eyebrow">ROCKET LEAGUE · FREESTYLE BOARD</div>
          <div className="game-hud__title-row">
            <h1>Freestyle Board</h1>
            {isOnlineGame && (
              <span className="room-pill">Room {onlineSession.roomCode}</span>
            )}
          </div>
          <div
            className={`turn-status ${
              isOnlineGame && !isMyOnlineTurn ? 'turn-status--waiting' : ''
            }`}
          >
            <span className="turn-status__dot" />
            {currentPlayer.leftGame
              ? `${currentPlayer.name} left the game — skipping turn`
              : currentPlayer.finished
                ? `${currentPlayer.name} finished`
                : isOnlineGame && !isMyOnlineTurn
                  ? `Watching ${currentPlayer.name}'s turn`
                  : `${currentPlayer.name}'s turn`}
          </div>
        </div>

        <div className="game-hud__players" aria-label="Player standings">
          {playerDisplayOrder.map((playerIndex) => {
            const player = players[playerIndex]
            const isCurrent =
              playerIndex === currentPlayerIndex && !player.finished && !player.leftGame
            const isYou = isOnlineGame && player.id === localClientId

            return (
              <div
                className={`hud-player ${isCurrent ? 'hud-player--current' : ''} ${
                  player.finished ? 'hud-player--finished' : ''
                }`}
                key={player.id ?? playerIndex}
                style={{ '--player-accent': PLAYER_ACCENTS[playerIndex % PLAYER_ACCENTS.length] }}
              >
                <span className="hud-player__dot" />
                <div className="hud-player__name">
                  {player.name}{isYou ? ' · You' : ''}{player.leftGame ? ' · Left' : ''}
                </div>
                <div className="hud-player__meta">
                  <strong>{player.points}</strong> pts · {player.leftGame ? 'Left game' : player.finished ? 'Finished' : `Space ${player.position}/75`}
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          className="hud-sound-button"
          data-online-allowed="true"
          onClick={() => setSoundEnabled((value) => !value)}
          aria-pressed={soundEnabled}
          title={soundEnabled ? 'Mute game sounds' : 'Turn game sounds on'}
        >
          <span aria-hidden="true">{soundEnabled ? '🔊' : '🔇'}</span>
          <span>{soundEnabled ? 'Sound' : 'Muted'}</span>
        </button>
      </header>
    )

    function GameOverlayCard({ children }) {
      return (
        <div
          className={`game game--play game--overlay ${
            isOnlineGame && !canUseOnlineControls ? 'online-waiting' : ''
          }`}
        >
          {gameHud}
          <div className="game-overlay-stage">
            {generatedBoard && (
              <GameBoard
                board={generatedBoard}
                players={players}
                currentPlayerIndex={currentPlayerIndex}
                boardLength={BOARD_LENGTH}
                localPlayerId={localClientId}
                ambient
              />
            )}
            <div className="game-overlay-layer">
              <section className="game-modal-card">
                {children}
              </section>
            </div>
          </div>
        </div>
      )
    }

if (landingAnnouncementActive && landingAnnouncement) {
  const announcementText = {
    Battle: 'BATTLE!',
    Event: 'EVENT!',
    Gamble: 'GAMBLE!',
    'Choose Difficulty': 'CHOOSE DIFFICULTY!',
    'Action Shop': 'ACTION SHOP!',
    'Shortcut Gate': 'SHORTCUT GATE!',
  }[landingAnnouncement.spaceType] || landingAnnouncement.spaceType

  const announcementSubtext = {
    Battle: 'Get ready for a head-to-head challenge.',
    Event: 'A random event is about to happen.',
    Gamble: 'Choose how much risk you want to take.',
    'Choose Difficulty': 'You get to choose the challenge difficulty.',
    'Action Shop': 'Three Action Cards are waiting for you.',
    'Shortcut Gate': 'Choose the safe route or risk the shortcut.',
  }[landingAnnouncement.spaceType] || 'Resolving your landing...'

  return (
    <GameOverlayCard>
      <div
        className="mechanic-card"
        style={{
          textAlign: 'center',
          padding: '28px 18px',
          border: '2px solid rgba(255,255,255,.22)',
          boxShadow: '0 18px 55px rgba(0,0,0,.3)',
        }}
      >
        <div style={{ fontSize: '13px', opacity: 0.75, marginBottom: '7px' }}>
          {landingAnnouncement.playerName} landed on
        </div>
        <h1 style={{ margin: '0 0 8px', letterSpacing: '0.04em' }}>
          {announcementText}
        </h1>
        <p style={{ margin: 0 }}><strong>{announcementSubtext}</strong></p>
      </div>
    </GameOverlayCard>
  )
}


if (battleState) {
  const battleCard = battleState.card
  const opponent =
    battleState.opponentIndex !== null
      ? players[battleState.opponentIndex]
      : null

  if (battleResolved) {
    return (
      <GameOverlayCard>
        <h1>Battle Complete</h1>
        <h2>#{battleCard.number} — {battleCard.name}</h2>

        {battleState.luckySpins?.length > 0 && (
          <div className="mechanic-card">
            <h3>Battle Spins</h3>
            {battleState.luckySpins.map((entry) => (
              <p key={entry.playerIndex}>
                {players[entry.playerIndex]?.name}: <strong>{entry.roll}</strong>
              </p>
            ))}
          </div>
        )}

        <p><strong>{battleState.resultMessage}</strong></p>

        <button onClick={returnFromBattle}>
          Return to Board
        </button>
      </GameOverlayCard>
    )
  }

  if (battleCard.id === 'lucky-spin') {
    const participantIndexes = (
      battleState.participantIndexes ||
      players.map((_, index) => index)
    ).filter((index) => players[index] && !players[index].leftGame)
    const spinPlayer = players[participantIndexes[battleState.luckySpinCursor]]

    return (
      <GameOverlayCard>
        <h1>Battle Card #{battleCard.number}</h1>
        <h2>{battleCard.name}</h2>

        <div className="mechanic-card">
          <h3>Rules</h3>
          {battleCard.rules.map((rule, index) => (
            <p key={index}>{index + 1}. {rule}</p>
          ))}
          <p>
            <strong>Outside Action Cards and normal Mechanic effects do not affect this Battle.</strong>
          </p>
        </div>

        {battleState.luckySpins.length > 0 && (
          <div className="mechanic-card">
            <h3>Spins So Far</h3>
            {battleState.luckySpins.map((entry) => (
              <p key={entry.playerIndex}>
                {players[entry.playerIndex]?.name}: <strong>{entry.roll}</strong>
              </p>
            ))}
          </div>
        )}

        {spinPlayer && (
          <button onClick={spinLuckyBattle}>
            Spin 1–10 for {spinPlayer.name}
          </button>
        )}
      </GameOverlayCard>
    )
  }

  if (battleCard.allPlayers) {
    const participantIndexes = (
      battleState.participantIndexes ||
      players.map((_, index) => index)
    ).filter((index) => players[index] && !players[index].leftGame)

    return (
      <GameOverlayCard>
        <h1>Battle Card #{battleCard.number}</h1>
        <h2>{battleCard.name}</h2>

        <div className="mechanic-card">
          <h3>Players</h3>
          <p>
            {participantIndexes
              .map((index) => players[index]?.name)
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <div className="mechanic-card">
          <h3>Rules</h3>
          {battleCard.rules.map((rule, index) => (
            <p key={index}>{index + 1}. {rule}</p>
          ))}
          <p>
            <strong>Outside Action Cards and normal Mechanic effects do not affect this Battle.</strong>
          </p>
        </div>

        <div className="mechanic-card">
          <h3>Choose the Winner</h3>
          {participantIndexes.map((playerIndex) => (
            <button
              key={playerIndex}
              onClick={() => resolveBattleWinner(playerIndex)}
            >
              {players[playerIndex]?.name} Won (+2)
            </button>
          ))}
        </div>
      </GameOverlayCard>
    )
  }

  if (battleState.opponentIndex === null) {
    return (
      <GameOverlayCard>
        <h1>Battle Card #{battleCard.number}</h1>
        <h2>{battleCard.name}</h2>
        <p>No 1v1 opponent is available for this Battle.</p>
      </GameOverlayCard>
    )
  }

  const battleReady =
    !battleCard.needsBattleMechanic ||
    Boolean(battleState.battleMechanic)

  return (
    <GameOverlayCard>
      <h1>Battle Card #{battleCard.number}</h1>
      <h2>{battleCard.name}</h2>
      <h3>{currentPlayer.name} vs. {opponent.name}</h3>

      <div className="mechanic-card">
        <h3>Rules</h3>
        {battleCard.rules.map((rule, index) => (
          <p key={index}>{index + 1}. {rule}</p>
        ))}
      </div>

      {battleCard.needsBattleMechanic && !battleState.battleMechanic && (
        <div className="mechanic-card">
          <h3>Battle-Only Mechanic Draw</h3>
          <p>
            This draw is completely separate from the normal Mechanic deck and does not affect it.
          </p>
          <button onClick={drawBattleMechanic}>
            Draw Battle Mechanic
          </button>
        </div>
      )}

      {battleState.battleMechanic && (
        <div className="mechanic-card">
          <h3>Battle Mechanic</h3>
          <h2>{battleState.battleMechanic.name}</h2>
          <p>
            Difficulty: <strong>{battleState.battleMechanic.difficulty}</strong>
          </p>
          <p>
            Both players use this exact mechanic for the Battle. Normal Mechanic points and normal outside requirements do not apply.
          </p>
        </div>
      )}

      {battleReady && (
        <div className="mechanic-card">
          <h3>Enter Battle Result</h3>
          <button onClick={() => resolveBattleWinner(currentPlayerIndex)}>
            {currentPlayer.name} Won (+2)
          </button>
          <button onClick={() => resolveBattleWinner(battleState.opponentIndex)}>
            {opponent.name} Won (+2)
          </button>
        </div>
      )}

      {battleCard.allowMutualConcede && battleReady && (
        <div className="mechanic-card">
          <h3>Mutual Concede</h3>

          {battleState.concedeVoteBy === null ? (
            <>
              <p>
                Both Battle players must independently vote to concede. One vote never ends the Battle.
              </p>

              {isOnlineGame ? (
                [currentPlayerIndex, battleState.opponentIndex].includes(
                  localOnlinePlayerIndex
                ) ? (
                  <button
                    data-online-allowed="true"
                    onClick={() => voteToConcedeBattle(localOnlinePlayerIndex)}
                  >
                    Vote to Concede
                  </button>
                ) : (
                  <p>Only the two Battle players can vote.</p>
                )
              ) : (
                <>
                  <button onClick={() => voteToConcedeBattle(currentPlayerIndex)}>
                    {currentPlayer.name} Votes to Concede
                  </button>
                  <button onClick={() => voteToConcedeBattle(battleState.opponentIndex)}>
                    {opponent.name} Votes to Concede
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <p>
                <strong>
                  {players[battleState.concedeVoteBy].name} voted to concede.
                </strong>
              </p>

              {isOnlineGame ? (
                localOnlinePlayerIndex === battleState.concedeVoteBy ? (
                  <>
                    <p>
                      Your vote is waiting for the other Battle player. You can cancel it before they vote.
                    </p>
                    <button
                      data-online-allowed="true"
                      onClick={() => cancelBattleConcede(localOnlinePlayerIndex)}
                    >
                      Cancel My Concede Vote
                    </button>
                  </>
                ) : [currentPlayerIndex, battleState.opponentIndex].includes(
                    localOnlinePlayerIndex
                  ) ? (
                  <>
                    <p>
                      If you also vote to concede, the Battle ends with 0 points for both players.
                    </p>
                    <button
                      data-online-allowed="true"
                      onClick={() => voteToConcedeBattle(localOnlinePlayerIndex)}
                    >
                      Vote to Concede Too
                    </button>
                  </>
                ) : (
                  <p>Waiting for the other Battle player to decide.</p>
                )
              ) : (
                <>
                  <p>
                    The other Battle player must also vote. The first voter can cancel before that happens.
                  </p>
                  <button
                    onClick={() =>
                      voteToConcedeBattle(
                        battleState.concedeVoteBy === currentPlayerIndex
                          ? battleState.opponentIndex
                          : currentPlayerIndex
                      )
                    }
                  >
                    Other Player Votes to Concede Too
                  </button>
                  <button
                    onClick={() => cancelBattleConcede(battleState.concedeVoteBy)}
                  >
                    Cancel Concede Vote
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      <p>
        <strong>
          Battle rule: Action Cards, normal Mechanic effects, Hot Streak, Pressure, Zero Bounce, 100+ KPH, Top Corner, and all other outside effects do not affect this mini-game.
        </strong>
      </p>
    </GameOverlayCard>
  )
}

if (eventState) {
  const eventCard = eventState.card

  return (
    <GameOverlayCard>
      <h1>Event Card #{eventCard.number}</h1>
      <h2>{eventCard.name}</h2>

      <div className="mechanic-card">
        <p>{eventCard.description}</p>
      </div>

      {!eventResolved ? (
        <button onClick={resolveEvent}>
          Resolve Event
        </button>
      ) : (
        <>
          <p><strong>{eventState.resultMessage}</strong></p>
          <button onClick={returnFromEvent}>
            Return to Board
          </button>
        </>
      )}
    </GameOverlayCard>
  )
}


if (specialState) {
  if (specialState.type === 'gamble') {
    return (
      <GameOverlayCard>
        <h1>Special Space — Gamble</h1>

        <div className="mechanic-card">
          <h3>Rules</h3>
          <p>Choose your risk before seeing the Mechanic.</p>
          <p><strong>Safe:</strong> Medium Mechanic, 2 attempts, +2 points if scored, no penalty if missed.</p>
          <p><strong>Risky:</strong> Hard Mechanic, 2 attempts, +4 points if scored, -1 point if both attempts miss.</p>
          <p><strong>Insane:</strong> Extreme Mechanic, 2 attempts, +6 points if scored, -3 points if both attempts miss.</p>
          <p>Points can never go below 0.</p>
          <p><strong>Outside Action Cards and pending normal Mechanic effects do not affect this Special challenge.</strong></p>
        </div>

        {specialState.stage === 'choose-risk' && (
          <div className="mechanic-card">
            <h3>Choose Risk</h3>
            <button onClick={() => chooseGambleRisk('safe')}>Safe — Medium</button>
            <button onClick={() => chooseGambleRisk('risky')}>Risky — Hard</button>
            <button onClick={() => chooseGambleRisk('insane')}>Insane — Extreme</button>
          </div>
        )}

        {specialState.stage === 'mechanic' && specialState.mechanic && (
          <div className="mechanic-card">
            <h3>{specialState.riskName} Gamble</h3>
            <h2>{specialState.mechanic.name}</h2>
            <p>Difficulty: <strong>{specialState.mechanic.difficulty}</strong></p>
            <p>Attempts Left: <strong>{specialState.attemptsLeft}</strong></p>
            <p>
              Reward: <strong>+{specialState.reward}</strong>
              {specialState.penalty > 0 && (
                <> — Failure: <strong>-{specialState.penalty}</strong></>
              )}
            </p>
            <button onClick={scoreSpecialMechanic}>Scored</button>
            <button onClick={missSpecialMechanic}>Missed</button>
            {specialState.resultMessage && <p><strong>{specialState.resultMessage}</strong></p>}
          </div>
        )}

        {specialState.stage === 'result' && (
          <>
            <p><strong>{specialState.resultMessage}</strong></p>
            <button onClick={returnFromSpecial}>Return to Board</button>
          </>
        )}
      </GameOverlayCard>
    )
  }

  if (specialState.type === 'choose-difficulty') {
    return (
      <GameOverlayCard>
        <h1>Special Space — Choose Difficulty</h1>

        <div className="mechanic-card">
          <h3>Rules</h3>
          <p>Choose Easy, Medium, Hard, or Extreme.</p>
          <p>The app draws one random Mechanic from that exact difficulty.</p>
          <p>You get 2 attempts. Score it for its normal point value; miss both for 0.</p>
          <p><strong>Outside Action Cards and pending normal Mechanic effects do not affect this Special challenge.</strong></p>
        </div>

        {specialState.stage === 'choose-difficulty' && (
          <div className="mechanic-card">
            <h3>Pick a Difficulty</h3>
            {['Easy', 'Medium', 'Hard', 'Extreme'].map((difficulty) => (
              <button
                key={difficulty}
                onClick={() => chooseSpecialDifficulty(difficulty)}
              >
                {difficulty}
              </button>
            ))}
          </div>
        )}

        {specialState.stage === 'mechanic' && specialState.mechanic && (
          <div className="mechanic-card">
            <h2>{specialState.mechanic.name}</h2>
            <p>Difficulty: <strong>{specialState.mechanic.difficulty}</strong></p>
            <p>
              Reward: <strong>{specialState.mechanic.points} point{specialState.mechanic.points === 1 ? '' : 's'}</strong>
            </p>
            <p>Attempts Left: <strong>{specialState.attemptsLeft}</strong></p>
            <button onClick={scoreSpecialMechanic}>Scored</button>
            <button onClick={missSpecialMechanic}>Missed</button>
            {specialState.resultMessage && <p><strong>{specialState.resultMessage}</strong></p>}
          </div>
        )}

        {specialState.stage === 'result' && (
          <>
            <p><strong>{specialState.resultMessage}</strong></p>
            <button onClick={returnFromSpecial}>Return to Board</button>
          </>
        )}
      </GameOverlayCard>
    )
  }

  if (specialState.type === 'action-shop') {
    if (isOnlineGame && !isMyOnlineTurn) {
      return (
        <GameOverlayCard>
          <h1>Action Shop</h1>
          <p>
            <strong>{currentPlayer.name}</strong> is choosing privately from the Action Shop.
          </p>
          <p>Your own Action Cards are hidden from the other players too.</p>
        </GameOverlayCard>
      )
    }

    const selectedOffer =
      specialState.selectedOfferIndex !== null
        ? specialState.offers?.[specialState.selectedOfferIndex]
        : null

    return (
      <GameOverlayCard>
        <h1>Action Shop</h1>

        <div className="mechanic-card">
          <h3>Shop Rules</h3>
          <p>Look at 3 Action Cards. Pay <strong>1 point</strong> to take exactly 1, or decline and get nothing.</p>
          <p>If your hand is full (3/3), buying a card requires replacing one card you already hold.</p>
          <p>You are never charged unless the purchase is completed.</p>
          <p>{currentPlayer.name} currently has <strong>{currentPlayer.points} point{currentPlayer.points === 1 ? '' : 's'}</strong>.</p>
        </div>

        {specialState.stage === 'offers' && (
          <div className="mechanic-card">
            <h3>Choose 1 Card for 1 Point</h3>

            {(specialState.offers || []).length === 0 ? (
              <p>No Action Cards are currently available in the deck or discard pile.</p>
            ) : (
              (specialState.offers || []).map((card, index) => (
                <div className="held-action-card" key={`${card.name}-${index}`}>
                  <div>
                    <strong>{card.name}</strong>
                    {card.description && <p>{card.description}</p>}
                  </div>
                  <button
                    onClick={() => buyActionShopOffer(index)}
                    disabled={currentPlayer.points < 1}
                  >
                    Buy for 1 Point
                  </button>
                </div>
              ))
            )}

            {currentPlayer.points < 1 && (
              <p><strong>You have 0 points, so you cannot buy a card.</strong></p>
            )}

            <button onClick={declineActionShop}>Decline — Buy Nothing</button>
          </div>
        )}

        {specialState.stage === 'replace-card' && selectedOffer && (
          <div className="mechanic-card">
            <h3>Replace a Card</h3>
            <p>
              You chose <strong>{selectedOffer.name}</strong>. Pick one card from your full hand to discard. The 1-point cost is charged only after you confirm a replacement.
            </p>

            {(currentPlayer.actionCards || []).map((card, index) => (
              <button
                key={`${card.name}-${index}`}
                onClick={() =>
                  completeActionShopPurchase(
                    specialState.selectedOfferIndex,
                    index
                  )
                }
              >
                Replace {card.name}
              </button>
            ))}

            <button onClick={cancelActionShopReplacement}>Back to Shop Offers</button>
            <button onClick={declineActionShop}>Decline — Buy Nothing</button>
          </div>
        )}

        {specialState.stage === 'result' && (
          <>
            <p><strong>{specialState.resultMessage}</strong></p>
            <button onClick={returnFromSpecial}>Return to Board</button>
          </>
        )}
      </GameOverlayCard>
    )
  }


  if (specialState.type === 'board-fork') {
    const forkPreviewOptions = getBoardForkPreviewOptions(specialState)
    const forkHighlights = forkPreviewOptions.map((option, index) => ({
      nodeId: option.destinationNodeId,
      label: option.label,
      color: index === 0 ? '#38bdf8' : '#f472b6',
    }))
    const forkFocusNodeIds = [
      specialState.currentNodeId,
      ...forkPreviewOptions.map((option) => option.destinationNodeId),
    ].filter(Boolean)

    return (
      <div
        className={`game game--play game--fork-choice ${
          isOnlineGame && !canUseOnlineControls ? 'online-waiting' : ''
        }`}
      >
        {gameHud}

        {generatedBoard && (
          <GameBoard
            board={generatedBoard}
            players={players}
            currentPlayerIndex={currentPlayerIndex}
            boardLength={BOARD_LENGTH}
            localPlayerId={localClientId}
            highlightedNodes={forkHighlights}
            focusNodeIds={forkFocusNodeIds}
          />
        )}

        <div className="turn-box fork-choice-panel">
          <h2>{currentPlayer.name}'s Turn</h2>

          <div className="spinner spinner--result">
            {spinResult === null ? '?' : spinResult}
          </div>

          <div className="landing-box fork-choice-landing">
            <h3>Movement Paused</h3>
            <strong>Fork in the Road</strong>
          </div>

          <p>
            Your spin has <strong>{specialState.remainingMovement}</strong>{' '}
            movement space{specialState.remainingMovement === 1 ? '' : 's'} remaining.
          </p>
          <p className="fork-choice-help">
            The glowing spaces on the board show where this spin can take you.
          </p>

          {isOnlineGame && !isMyOnlineTurn ? (
            <div className="mechanic-card fork-choice-waiting">
              <strong>{currentPlayer.name}</strong> is choosing a path.
            </div>
          ) : (
            <div className="fork-choice-options">
              {forkPreviewOptions.map((option, index) => (
                <button
                  key={option.nextId}
                  className="fork-choice-button"
                  onClick={() => chooseBoardForkRoute(option.nextId)}
                >
                  <span
                    className="fork-choice-swatch"
                    style={{
                      background: index === 0 ? '#38bdf8' : '#f472b6',
                    }}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>
                      {option.pausesAgain
                        ? `Next decision: ${option.destinationType}`
                        : `Land on: ${option.destinationType}${
                            option.destinationMainIndex !== null
                              ? ` · Space ${option.destinationMainIndex}`
                              : ''
                          }`}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (specialState.type === 'shortcut-gate') {
    return (
      <GameOverlayCard>
        <h1>Shortcut Gate</h1>

        <div className="mechanic-card">
          <h3>Mandatory Mid-Spin Stop</h3>
          <p>
            Your spin has paused{specialState.generatedGraph ? '' : <> at Space <strong>{SHORTCUT_GATE_POSITION}</strong></>} with <strong>{specialState.remainingMovement}</strong> movement space{specialState.remainingMovement === 1 ? '' : 's'} remaining.
          </p>
          <p><strong>Main Route:</strong> no challenge. Continue the exact remaining movement on the normal path.</p>
          <p><strong>Shortcut:</strong> draw a random Hard Mechanic and get exactly 1 attempt.</p>
          <p>If you score it, take the shorter route and finish the remaining movement there.</p>
          <p>If you miss it, lose <strong>1 point</strong> (minimum 0), take the Main Route, and still finish the remaining movement.</p>
          <p><strong>Outside Action Cards and pending normal Mechanic effects do not affect the Shortcut challenge.</strong></p>
        </div>

        {specialState.stage === 'choose-route' && (
          <div className="mechanic-card">
            <h3>Choose Your Path</h3>
            <button onClick={chooseMainShortcutRoute}>Take Main Route</button>
            <button onClick={attemptShortcutRoute}>Attempt Shortcut</button>
          </div>
        )}

        {specialState.stage === 'shortcut-challenge' && specialState.shortcutMechanic && (
          <div className="mechanic-card">
            <h3>Shortcut Challenge — 1 Attempt</h3>
            <h2>{specialState.shortcutMechanic.name}</h2>
            <p>Difficulty: <strong>Hard</strong></p>
            <button onClick={() => resolveShortcutChallenge(true)}>Scored — Take Shortcut</button>
            <button onClick={() => resolveShortcutChallenge(false)}>Missed — Main Route</button>
          </div>
        )}

        {specialState.stage === 'continue-movement' && (
          <div className="mechanic-card">
            <p><strong>{specialState.resultMessage}</strong></p>
            <button onClick={continueAfterShortcutGate}>
              Continue Remaining Movement ({specialState.remainingMovement})
            </button>
          </div>
        )}
      </GameOverlayCard>
    )
  }
}


if (tradeOfferState) {
  const initiator =
    players[tradeOfferState.initiatorIndex]

  const target =
    tradeOfferState.targetIndex !== null
      ? players[tradeOfferState.targetIndex]
      : null

  const offeredCard =
    tradeOfferState.offeredCardIndex !== null
      ? initiator?.actionCards?.[
          tradeOfferState.offeredCardIndex
        ]
      : null

  const returnCard =
    tradeOfferState.returnCardIndex !== null && target
      ? target.actionCards?.[
          tradeOfferState.returnCardIndex
        ]
      : null

  const localIsTradeInitiator =
    !isOnlineGame || initiator?.id === localClientId
  const localIsTradeTarget =
    !isOnlineGame || target?.id === localClientId
  const localIsTradeParticipant =
    !isOnlineGame || localIsTradeInitiator || localIsTradeTarget

  if (isOnlineGame && !localIsTradeParticipant) {
    return (
      <GameOverlayCard>
        <h1>Private Choice</h1>
        <p>
          <strong>{initiator?.name}</strong> is resolving something privately.
        </p>
      </GameOverlayCard>
    )
  }

  if (
    isOnlineGame &&
    ['choose-target', 'choose-offer'].includes(tradeOfferState.stage) &&
    !localIsTradeInitiator
  ) {
    return (
      <GameOverlayCard>
        <h1>Trade Offer</h1>
        <p>Waiting for {initiator?.name} to choose their side of the trade...</p>
      </GameOverlayCard>
    )
  }

  if (
    isOnlineGame &&
    tradeOfferState.stage === 'target-choose' &&
    !localIsTradeTarget
  ) {
    return (
      <GameOverlayCard>
        <h1>Trade Offer</h1>
        <p>Waiting for {target?.name} to choose a private return card...</p>
      </GameOverlayCard>
    )
  }

  // STEP 1: Choose who to trade with
  if (tradeOfferState.stage === 'choose-target') {
    return (
      <GameOverlayCard>
        <h1>Trade Offer</h1>

        <h2>
          {initiator.name}, choose who you want
          to trade with:
        </h2>

        {players.map((player, targetIndex) => {
          if (
            targetIndex ===
              tradeOfferState.initiatorIndex ||
            (player.actionCards || []).length === 0
          ) {
            return null
          }
          <button
  onClick={() =>
    cancelTradeOffer('Trade cancelled.')
  }
>
  Cancel Trade
</button>

          return (
            <button
              key={targetIndex}
              onClick={() =>
                chooseTradeTarget(targetIndex)
              }
            >
              Trade with {player.name}
            </button>
          )
        })}
      </GameOverlayCard>
    )
  }

  // STEP 2: Initiator chooses their card
  if (tradeOfferState.stage === 'choose-offer') {
    return (
      <GameOverlayCard>
        <h1>Trade Offer</h1>

        <h2>
          {initiator.name}, choose the card you
          want to offer to {target.name}:
        </h2>

        {(initiator.actionCards || []).map(
          (card, cardIndex) => (
            <button
              key={cardIndex}
              onClick={() =>
                chooseTradeOfferedCard(cardIndex)
              }
              
            >
              Offer {card.name}
            </button>
          )
        )}
        <button
  onClick={() =>
    cancelTradeOffer('Trade cancelled.')
  }
>
  Cancel Trade
</button>
      </GameOverlayCard>
    )
  }

  // STEP 3: Pass screen to target
  if (tradeOfferState.stage === 'handoff-target') {
    return (
      <GameOverlayCard>
        <h1>Trade Offer</h1>

        <p>
          {initiator.name} is offering:
        </p>

        <h2>{offeredCard.name}</h2>

        <p>
          Pass the screen to {target.name}.
        </p>

        <button
          onClick={() =>
            setTradeOfferState(
              (currentTrade) => ({
                ...currentTrade,
                stage: 'target-choose',
              })
            )
          }
        >
          I'm {target.name} — Continue
        </button>
      </GameOverlayCard>
    )
  }

  // STEP 4: Target chooses their card
  if (tradeOfferState.stage === 'target-choose') {
    return (
      <GameOverlayCard>
        <h1>Trade Offer</h1>

        <p>
          {initiator.name} is offering you:
        </p>

        <h2>{offeredCard.name}</h2>

        <h2>
          {target.name}, choose the card you
          want to trade back:
        </h2>

        {(target.actionCards || []).map(
          (card, cardIndex) => (
            <button
              key={cardIndex}
              onClick={() =>
                chooseTradeReturnCard(cardIndex)
              }
            >
              Trade {card.name}
            </button>
          )
        )}
        <button
  onClick={() =>
    cancelTradeOffer(
      `${target.name} declined the trade.`
    )
  }
>
  Decline Trade
</button>
      </GameOverlayCard>
    )
  }

  // STEP 5: Give screen back to initiator
  if (
    tradeOfferState.stage ===
    'handoff-initiator-review'
  ) {
    return (
      <GameOverlayCard>
        <h1>Trade Selected</h1>

        <p>
          Both cards have been chosen.
        </p>

        <p>
          Pass the screen back to {initiator.name}.
        </p>

        <button
          onClick={() =>
            setTradeOfferState(
              (currentTrade) => ({
                ...currentTrade,
                stage: 'initiator-review',
              })
            )
          }
        >
          I'm {initiator.name} — Review
        </button>
      </GameOverlayCard>
    )
  }

  // STEP 6: Initiator reviews BOTH cards
  if (
    tradeOfferState.stage === 'initiator-review'
  ) {
    return (
      <GameOverlayCard>
        <h1>Trade Review</h1>

        <h2>{initiator.name} gives:</h2>
        <p>
          <strong>{offeredCard.name}</strong>
        </p>

        <h2>{target.name} gives:</h2>
        <p>
          <strong>{returnCard.name}</strong>
        </p>

        <button onClick={acceptTradeAsInitiator}>
          {initiator.name} — Accept
        </button>
        <button
  onClick={() =>
    setTradeOfferState((currentTrade) => ({
      ...currentTrade,
      offeredCardIndex: null,
      returnCardIndex: null,
      stage: 'choose-offer',
    }))
  }
>
  {initiator.name} — Change Trade
</button>
      </GameOverlayCard>
    )
  }

  // STEP 7: Pass to target for confirmation
  if (
    tradeOfferState.stage ===
    'handoff-target-review'
  ) {
    return (
      <GameOverlayCard>
        <h1>Trade Confirmation</h1>

        <p>
          {initiator.name} accepted the trade.
        </p>

        <p>
          Pass the screen to {target.name}.
        </p>

        <button
          onClick={() =>
            setTradeOfferState(
              (currentTrade) => ({
                ...currentTrade,
                stage: 'target-review',
              })
            )
          }
        >
          I'm {target.name} — Review
        </button>
      </GameOverlayCard>
    )
  }

  // STEP 8: Target reviews BOTH cards
  if (tradeOfferState.stage === 'target-review') {
    return (
      <GameOverlayCard>
        <h1>Final Trade Review</h1>

        <h2>{initiator.name} gives:</h2>
        <p>
          <strong>{offeredCard.name}</strong>
        </p>

        <h2>{target.name} gives:</h2>
        <p>
          <strong>{returnCard.name}</strong>
        </p>

        <button onClick={completeTradeOffer}>
          {target.name} — Accept & Complete
        </button>
        <button
  onClick={() =>
    setTradeOfferState((currentTrade) => ({
      ...currentTrade,
      returnCardIndex: null,
      stage: 'target-choose',
    }))
  }
>
  {target.name} — Change Card
</button>
      </GameOverlayCard>
    )
  }
}
    const mustFinishMechanic =
      landedSpace === 'Mechanic' && !mechanicResolved

    const mustResolveAction =
      landedSpace === 'Action' && !actionResolved

    const mustResolveBattle =
      landedSpace === 'Battle' && !battleResolved

    const mustResolveEvent =
      landedSpace === 'Event' && !eventResolved

    const mustResolveSpecial =
      ['Gamble', 'Choose Difficulty', 'Action Shop', 'Shortcut Gate'].includes(
        landedSpace
      ) && !specialResolved

    return (
      <div
        className={`game game--play ${
          isOnlineGame && !canUseOnlineControls ? 'online-waiting' : ''
        }`}
      >
        {gameHud}

        {generatedBoard && (
          <GameBoard
            board={generatedBoard}
            players={players}
            currentPlayerIndex={currentPlayerIndex}
            boardLength={BOARD_LENGTH}
            localPlayerId={localClientId}
          />
        )}

        <div className="turn-box">
          <h2>{currentPlayer.name}'s Turn</h2>

          <div className={`spinner ${spinResult !== null ? 'spinner--result' : ''}`}>
            {spinResult === null ? '?' : spinResult}
          </div>

          <button
            onClick={() => spin()}
            disabled={
  currentPlayer.finished ||
  hasSpun ||
  secondChanceRolls.length > 0
}
          >
            Spin 1–10
          </button>

          {spinResult !== null && (
            <>
              <p>
                {currentPlayer.name} spun a{' '}
                <strong>{spinResult}</strong>!
              </p>

              <div className="landing-box">
                <h3>
                  {isOnlineGame && !isMyOnlineTurn
                    ? `${currentPlayer.name} landed on:`
                    : 'You landed on:'}
                </h3>
                <strong>{landedSpace}</strong>
              </div>
            </>
          )}
          {actionMessage && (!isOnlineGame || isMyOnlineTurn) && (
  <p>
    <strong>{actionMessage}</strong>
  </p>
)}
{secondChanceRolls.length === 2 && (
  <div>
    {isOnlineGame && !isMyOnlineTurn ? (
      <p>
        <strong>{currentPlayer.name}</strong> is choosing a spin privately.
      </p>
    ) : (
      <>
        <p>
          <strong>Choose your spin:</strong>
        </p>

        <button
          onClick={() => spin(secondChanceRolls[0])}
        >
          Choose {secondChanceRolls[0]}
        </button>

        <button
          onClick={() => spin(secondChanceRolls[1])}
        >
          Choose {secondChanceRolls[1]}
        </button>
      </>
    )}
  </div>
)}
{landedSpace === 'Mechanic' && awaitingMechanicDraw && (
  <div className="mechanic-card">
    <h2>Mechanic Space</h2>

    {isOnlineGame && !isMyOnlineTurn ? (
      <p>
        <strong>{currentPlayer.name}</strong> is preparing their Mechanic privately.
      </p>
    ) : (
      <>
        {!jackpotActive ? (
          <>
            <p>
              <strong>You have a Jackpot card.</strong> Use it before revealing the Mechanic, or draw normally.
            </p>
            <div className="menu">
              <button onClick={useJackpot}>
                Use Jackpot
              </button>
              <button onClick={drawMechanicCard}>
                Draw Normally
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              <strong>
                JACKPOT ACTIVE: +3 if you score, -3 if you fail.
              </strong>
            </p>
            <button onClick={drawMechanicCard}>
              Draw Mechanic
            </button>
          </>
        )}

        {mechanicMessage && (
          <p>
            <strong>{mechanicMessage}</strong>
          </p>
        )}
      </>
    )}
  </div>
)}
          {mechanicCard && (
            <div className="mechanic-card">
              <h2>{mechanicCard.name}</h2>

              <p>
                Difficulty:{' '}
                <strong>{mechanicCard.difficulty}</strong>
              </p>

              <p>
                Reward:{' '}
                <strong>
                  {mechanicCard.points} point
                  {mechanicCard.points === 1 ? '' : 's'}
                </strong>
              </p>

              <p>
                Bounce Rule:{' '}
                <strong>
                  {((!isOnlineGame || isMyOnlineTurn) && noBounceRequired) ||
                  mechanicCard.name.toLowerCase().includes('no bounce')
                    ? 'NO BOUNCE'
                    : '1 bounce max'}
                </strong>
              </p>

              {(!isOnlineGame || isMyOnlineTurn) && noBounceRequired && (
                <p>
                  <strong>
                    🚫 ZERO BOUNCE REQUIRED — This Mechanic must go directly in.
                  </strong>
                </p>
              )}

              {(!isOnlineGame || isMyOnlineTurn) && kph100Required &&
                !mechanicCard.name.includes('100+') &&
                !mechanicCard.name.includes('120+') && (
                  <p>
                    <strong>
                      ⚡ 100+ KPH REQUIRED — The goal must be scored at 100 KPH or faster.
                    </strong>
                  </p>
                )}

              {(!isOnlineGame || isMyOnlineTurn) && topCornerRequired &&
                !mechanicCard.name.toLowerCase().includes('top corner') && (
                  <p>
                    <strong>
                      🎯 TOP CORNER REQUIRED — The goal must finish in a top corner.
                    </strong>
                  </p>
                )}

              {!mechanicResolved && (
                <>
                  {(!isOnlineGame || isMyOnlineTurn) ? (
                    <p>
                      Attempts Left:{' '}
                      <strong>{attemptsLeft}</strong>
                    </p>
                  ) : (
                    <p>
                      <strong>{currentPlayer.name}</strong> is attempting this Mechanic.
                    </p>
                  )}

                  <div className="mechanic-buttons">
                    <button onClick={scoreMechanic}>
                      Scored
                    </button>

                    <button onClick={missMechanic}>
                      Missed
                    </button>
                  </div>
                </>
              )}

              {mechanicMessage && (!isOnlineGame || isMyOnlineTurn) && (
                <p>
                  <strong>{mechanicMessage}</strong>
                </p>
              )}

              {isOnlineGame && !isMyOnlineTurn && publicMechanicOutcome && (
                <p>
                  <strong>{publicMechanicOutcome}</strong>
                </p>
              )}
            </div>
          )}
          {mechanicChoices.length > 0 && (
  <div className="mechanic-card">
    {isOnlineGame && !isMyOnlineTurn ? (
      <>
        <h2>Mechanic Choice</h2>
        <p><strong>{currentPlayer.name}</strong> is choosing privately.</p>
      </>
    ) : (
      <>
        <h2>Pick Your Poison</h2>
        <p>Choose one mechanic:</p>
        {mechanicChoices.map((card, index) => (
          <button
            key={index}
            onClick={() => chooseMechanicChoice(index)}
          >
            {card.name} — {card.difficulty}
          </button>
        ))}
      </>
    )}
  </div>
)}


{landedSpace === 'Action' && (
  <div className="action-space-box">
    <h2>Action Space</h2>

    {isOnlineGame && !isMyOnlineTurn ? (
      !actionResolved && (
        <p>
          <strong>{currentPlayer.name}</strong> is resolving this Action Space privately.
        </p>
      )
    ) : (
      !actionResolved && (
        <>
          {(currentPlayer.actionCards || []).length < 3 ? (
            <>
              <p>Draw an Action Card and add it to your hand.</p>
              <button onClick={drawActionCard}>Draw Action Card</button>
            </>
          ) : (
            <>
              <p>Your hand is full. Replace one card or skip the draw.</p>
              {(currentPlayer.actionCards || []).map((card, index) => (
                <button
                  key={index}
                  onClick={() => replaceActionCard(index)}
                >
                  Replace {card.name}
                </button>
              ))}
            </>
          )}

          <button onClick={skipActionDraw}>Skip Draw</button>
        </>
      )
    )}
  </div>
)}
          <button
            onClick={endTurn}
            disabled={
             (!currentPlayer.finished && !hasSpun) ||
             mustFinishMechanic ||
             mustResolveAction ||
             mustResolveBattle ||
             mustResolveEvent ||
             mustResolveSpecial
}
          >
            {currentPlayer.finished ? 'Continue' : 'End Turn'}
          </button>
        </div>

        <div className="action-hand">
  <h2>
    {isOnlineGame ? 'Your Action Cards' : `${currentPlayer.name}'s Action Cards`}
    {' '}
    ({(localOnlinePlayer?.actionCards || []).length}/3)
  </h2>

  {isOnlineGame && !isMyOnlineTurn && (
    <p>Only you can see these cards. You can use them when it becomes your turn.</p>
  )}

  {(localOnlinePlayer?.actionCards || []).length === 0 && (
    <p>No Action Cards</p>
  )}

  {(localOnlinePlayer?.actionCards || []).map(
  (card, index) => (
    <div className="held-action-card" key={index}>
      <div>
        <strong>{card.name}</strong>

        {card.description && (
          <p>{card.description}</p>
        )}
      </div>

      {(!isOnlineGame || isMyOnlineTurn) && (
        <>
      {card.name === 'Mulligan' && mechanicFailed && !mechanicActionUsed && !actionCardUsedThisTurn && (
        <button onClick={useMulligan}>
          Use
        </button>
      )}

      {card.name === 'Double Points' &&
  mechanicCard &&
  !mechanicResolved &&
  attemptsLeft === 2 &&
  !doublePointsActive && !mechanicActionUsed && !actionCardUsedThisTurn && (
    <button onClick={useDoublePoints}>
      Use
    </button>
    
)}
{card.name === 'Reroll' &&
  mechanicCard &&
  !mechanicResolved &&
  attemptsLeft === 2 &&
  !doublePointsActive && !mechanicActionUsed && !actionCardUsedThisTurn && (
    <button onClick={useReroll}>
      Use
    </button>
)}

{card.name === 'Pick Your Poison' &&
  mechanicCard &&
  !mechanicResolved &&
  attemptsLeft === 2 &&
  !doublePointsActive &&
  mechanicChoices.length === 0 && !mechanicActionUsed && !actionCardUsedThisTurn && (
    <button onClick={usePickYourPoison}>
      Use
    </button>
)}

{card.name === 'Insurance' &&
  mechanicCard &&
  !mechanicResolved &&
  attemptsLeft === 2 &&
  !doublePointsActive &&
  !insuranceActive &&
  mechanicChoices.length === 0 && !mechanicActionUsed && !actionCardUsedThisTurn &&(
    <button onClick={useInsurance}>
      Use
    </button>
)}

{card.name === 'Jackpot' &&
  landedSpace === 'Mechanic' &&
  awaitingMechanicDraw &&
  !mechanicCard &&
  !mechanicActionUsed &&
  !actionCardUsedThisTurn && (
    <button onClick={useJackpot}>
      Use
    </button>
)}

{card.name === 'Difficulty Drop' &&
  mechanicCard &&
  !mechanicResolved &&
  attemptsLeft === 2 &&
  mechanicCard.difficulty !== 'Easy' &&
  !mechanicActionUsed && !actionCardUsedThisTurn && (
    <button onClick={useDifficultyDrop}>
      Use
    </button>
)}

{card.name === 'Difficulty Spike' &&
  mechanicCard &&
  !mechanicResolved &&
  attemptsLeft === 2 &&
  mechanicCard.difficulty !== 'Extreme' &&
  !mechanicActionUsed && !actionCardUsedThisTurn && (
    <button onClick={useDifficultySpike}>
      Use
    </button>
)}

{card.name === 'Hot Streak' &&
  mechanicCard &&
  mechanicResolved &&
  !mechanicFailed &&
  !currentPlayer.hotStreakActive && !actionCardUsedThisTurn && (
    <button onClick={useHotStreak}>
      Use
    </button>
)}
{card.name === 'Pressure' &&
  !actionCardUsedThisTurn && (
  <div>
    <p>Secretly target:</p>

    {players.map((player, targetIndex) => {
      if (
        targetIndex === currentPlayerIndex ||
        player.finished ||
        player.pressureActive
      ) {
        return null
      }

      return (
        <button
          key={targetIndex}
          onClick={() => usePressure(targetIndex)}
        >
          {player.name}
        </button>
      )
    })}
  </div>
)}
{card.name === 'Steal' &&
  !actionCardUsedThisTurn && (
    <div>
      <p>Steal from:</p>

      {players.map((player, targetIndex) => {
        if (
          targetIndex === currentPlayerIndex ||
          (player.actionCards || []).length === 0
        ) {
          return null
        }

        return (
          <button
            key={targetIndex}
            onClick={() => useSteal(targetIndex)}
          >
            {player.name}
          </button>
        )
      })}
    </div>
)}
{card.name === 'Shield' &&
  !actionCardUsedThisTurn &&
  !currentPlayer.shieldActive && (
    <button onClick={useShield}>
      Use
    </button>
)}
{card.name === 'Swap Hands' &&
  !actionCardUsedThisTurn && (
    <div>
      <p>Swap hands with:</p>

      {players.map((player, targetIndex) => {
        if (targetIndex === currentPlayerIndex || player.finished) {
          return null
        }

        return (
          <button
            key={targetIndex}
            onClick={() => useSwapHands(targetIndex)}
          >
            {player.name}
          </button>
        )
      })}
    </div>
)}
{card.name === 'Sabotage' &&
  !actionCardUsedThisTurn && (
    <div>
      <p>Sabotage:</p>

      {players.map((player, targetIndex) => {
        if (targetIndex === currentPlayerIndex || player.finished) {
          return null
        }

        return (
          <button
            key={targetIndex}
            onClick={() => useSabotage(targetIndex)}
          >
            {player.name}
          </button>
        )
      })}
    </div>
)}
{card.name === 'Point Tax' &&
  !actionCardUsedThisTurn && (
    <div>
      <p>Tax:</p>

      {players.map((player, targetIndex) => {
        if (targetIndex === currentPlayerIndex) {
          return null
        }

        return (
          <button
            key={targetIndex}
            onClick={() => usePointTax(targetIndex)}
          >
            {player.name}
          </button>
        )
      })}
    </div>
)}
{card.name === 'Lockout' &&
  !actionCardUsedThisTurn && (
    <div>
      <p>Lock out:</p>

      {players.map((player, targetIndex) => {
        if (
          targetIndex === currentPlayerIndex ||
          player.finished ||
          player.lockoutActive
        ) {
          return null
        }

        return (
          <button
            key={targetIndex}
            onClick={() => useLockout(targetIndex)}
          >
            {player.name}
          </button>
        )
      })}
    </div>
)}
{card.name === 'Reverse' &&
  !actionCardUsedThisTurn && (
    <button onClick={useReverse}>
      Use
    </button>
)}
{card.name === 'Copycat' &&
  mechanicCard &&
  !mechanicResolved &&
  attemptsLeft === 2 &&
  !mechanicActionUsed &&
  !actionCardUsedThisTurn &&
  lastScoredMechanic &&
  lastScoredMechanic.playerId !== currentPlayer.id && (
    <button onClick={useCopycat}>
      Use
    </button>
)}
{card.name === 'Easy Route' &&
  mechanicCard &&
  !mechanicResolved &&
  attemptsLeft === 2 &&
  !mechanicActionUsed &&
  !noBounceRequired &&
  !kph100Required &&
  !topCornerRequired &&
  !actionCardUsedThisTurn && (
    <button onClick={useEasyRoute}>
      Use
    </button>
)}
{card.name === 'Second Chance' &&
  !hasSpun &&
  !actionCardUsedThisTurn &&
  !secondChanceActive &&
  secondChanceRolls.length === 0 && (
    <button onClick={useSecondChance}>
      Use
    </button>
)}
{card.name === 'Trade Offer' &&
  !actionCardUsedThisTurn &&
  (currentPlayer.actionCards || []).length > 1 &&
  players.some(
    (player, index) =>
      index !== currentPlayerIndex &&
      (player.actionCards || []).length > 0
  ) && (
    <button onClick={() => useTradeOffer()}>
      Use
    </button>
)}
{card.name === 'Snatch' &&
  !actionCardUsedThisTurn && (
    <div>
      <p>Steal 1 point from:</p>

      {players.map((player, targetIndex) => {
        if (
          targetIndex === currentPlayerIndex ||
          player.points <= 0
        ) {
          return null
        }

        return (
          <button
            key={targetIndex}
            onClick={() => useSnatch(targetIndex)}
          >
            {player.name}
          </button>
        )
      })}
    </div>
)}
{card.name === 'Clean Slate' &&
  !actionCardUsedThisTurn && (
    <button onClick={useCleanSlate}>
      Use
    </button>
)}
{card.name === 'Bank It' &&
  !actionCardUsedThisTurn && (
    <button onClick={useBankIt}>
      Use
    </button>
)}
{card.name === 'Zero Bounce' &&
  !actionCardUsedThisTurn && (
    <div>
      <p>Force no-bounce on:</p>

      {players.map((player, targetIndex) => {
        if (
          targetIndex === currentPlayerIndex ||
          player.finished ||
          player.noBounceActive
        ) {
          return null
        }

        return (
          <button
            key={targetIndex}
            onClick={() => useZeroBounce(targetIndex)}
          >
            {player.name}
          </button>
        )
      })}
    </div>
)}
{card.name === '100+ KPH' &&
  !actionCardUsedThisTurn && (
    <div>
      <p>Force 100+ KPH on:</p>

      {players.map((player, targetIndex) => {
        if (
          targetIndex === currentPlayerIndex ||
          player.finished ||
          player.kph100Active
        ) {
          return null
        }

        return (
          <button
            key={targetIndex}
            onClick={() => use100KPH(targetIndex)}
          >
            {player.name}
          </button>
        )
      })}
    </div>
)}
{card.name === 'Top Corner' &&
  !actionCardUsedThisTurn && (
    <div>
      <p>Force top corner on:</p>

      {players.map((player, targetIndex) => {
        if (
          targetIndex === currentPlayerIndex ||
          player.finished ||
          player.topCornerActive
        ) {
          return null
        }

        return (
          <button
            key={targetIndex}
            onClick={() => useTopCorner(targetIndex)}
          >
            {player.name}
          </button>
        )
      })}
    </div>
)}
        </>
      )}
    </div>
  )
)}

</div>

      </div>
    )
  }
if (screen === 'online-create') {
  return (
    <OnlineLobby
      mode="create"
      onBack={() => setScreen('home')}
      onGameStart={enterOnlineGame}
    />
  )
}

if (screen === 'online-join') {
  return (
    <OnlineLobby
      mode="join"
      onBack={() => setScreen('home')}
      onGameStart={enterOnlineGame}
    />
  )
}
  return (
    <div className="game home-screen">
      <h1 className="home-screen__title">
        <span>Rocket League Freestyle</span>
        <span>Board Game</span>
      </h1>

      <p className="home-screen__subtitle">2–4 Players</p>

      <div className="menu home-screen__menu">
        <button onClick={() => setScreen('online-create')}>
  Create Game
</button>

<button onClick={() => setScreen('online-join')}>
  Join Game
</button>
      </div>
    </div>
  )
}

export default App