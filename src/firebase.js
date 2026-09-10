import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyBzWI1bm18CFxTEt3Ozyup2J-G0u8y82HU',
  authDomain: 'rocket-league-board-game.firebaseapp.com',
  databaseURL:
    'https://rocket-league-board-game-default-rtdb.firebaseio.com',
  projectId: 'rocket-league-board-game',
  storageBucket: 'rocket-league-board-game.firebasestorage.app',
  messagingSenderId: '567381843714',
  appId: '1:567381843714:web:673e65fbceba87385a2c1b',
}

const app = initializeApp(firebaseConfig)

export const db = getDatabase(app)