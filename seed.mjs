/**
 * ESPORTS ELITE — DEMO DATA SEEDER
 * 
 * Run this ONCE to populate your Firestore
 * with realistic demo data for testing.
 * 
 * HOW TO RUN:
 * 1. Save this file as seed.mjs in your
 *    project root (next to package.json)
 * 2. Run: node seed.mjs
 * 
 * WHAT IT SEEDS:
 * - 30 matches (mix of Classic/Scrims/Tournament)
 * - 25 training sessions
 * - Daily session records (last 60 days)
 * - XP + level update
 * - Streak data
 * - Profile update
 */

import { initializeApp } from 'firebase/app'
import {
  getFirestore, doc, setDoc, addDoc,
  collection, Timestamp, updateDoc
} from 'firebase/firestore'

// ── Firebase config ──────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyD8KitIGBVidSAGkHgzC-A2AVypiIE_7n4',
  authDomain: 'esports-elite-daf06.firebaseapp.com',
  projectId: 'esports-elite-daf06',
  storageBucket: 'esports-elite-daf06.appspot.com',
  messagingSenderId: '381439809052',
  appId: '1:381439809052:web:ff4bf41ad5a96f10e671d9',
}

const app  = initializeApp(firebaseConfig)
const db   = getFirestore(app)

// ── Target user ──────────────────────────
const UID = 'YkPMcp1i83fYejtzftSuEViamrt1'

// ── Helpers ──────────────────────────────
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function dateStr(date) {
  return date.toISOString().split('T')[0]
}

// ── Data arrays ──────────────────────────
const WEAKNESSES = [
  'Spray Control', 'ADS Accuracy', 'Close Range',
  'Positioning', 'Rotations', 'Game Sense',
  'Recoil', 'Long Range', 'Movement', 'Healing',
]

const WEAPONS = [
  'M416', 'AKM', 'BERYL', 'UMP45', 'MP5K',
  'Kar98k', 'AWM', 'M24', 'Mini14', 'QBZ',
  'SCAR-L', 'SKS', 'DP-28', 'Vector',
]

const MODULES = [
  'ADS Drills', 'Spray Control',
  'Close Range', 'Car Spray',
  'Recoil Master', 'Custom',
]

const MODES = ['Classic', 'Scrims', 'Tournament']

const LEVEL_NAMES = [
  'Rookie', 'Bronze', 'Silver', 'Gold',
  'Platinum', 'Diamond', 'Elite',
]

// ── Generate matches ─────────────────────
async function seedMatches() {
  console.log('Seeding matches...')
  const matchesRef = collection(db, 'users', UID, 'matches')

  // 30 matches over last 45 days
  for (let i = 0; i < 30; i++) {
    const daysBack = randomBetween(1, 45)
    const date     = daysAgo(daysBack)
    const kills    = randomBetween(0, 12)
    const damage   = randomBetween(150, 1200)
    const placement= randomBetween(1, 25)
    const mode     = pick(MODES)
    const won      = placement <= 3
    const weapon1  = pick(WEAPONS)
    let weapon2    = pick(WEAPONS)
    while (weapon2 === weapon1)
      weapon2 = pick(WEAPONS)

    await addDoc(matchesRef, {
      uid:       UID,
      mode,
      kills,
      damage,
      placement,
      won,
      weakness:  pick(WEAKNESSES),
      weapons:   [weapon1, weapon2],
      notes:     '',
      createdAt: Timestamp.fromDate(date),
      date:      dateStr(date),
    })

    console.log(`  Match ${i + 1}/30 — ${mode} | ${kills}K | ${damage}dmg | #${placement}`)
  }

  console.log('✅ Matches seeded\n')
}

// ── Generate sessions ────────────────────
async function seedSessions() {
  console.log('Seeding training sessions...')
  const sessionsRef = collection(db, 'users', UID, 'sessions')

  // 25 sessions over last 60 days
  for (let i = 0; i < 25; i++) {
    const daysBack    = randomBetween(1, 60)
    const date        = daysAgo(daysBack)
    const moduleName  = pick(MODULES)
    const drillCount  = randomBetween(2, 8)
    const duration    = randomBetween(10, 75)
    const rating      = randomBetween(2, 5)
    const weapon1     = pick(WEAPONS)
    let weapon2       = pick(WEAPONS)
    while (weapon2 === weapon1)
      weapon2 = pick(WEAPONS)

    await addDoc(sessionsRef, {
      uid:        UID,
      moduleName,
      drillCount,
      duration,
      rating,
      weapons:    [weapon1, weapon2],
      mood:       pick(['😊 Good', '🔥 On Fire', '😐 Okay']),
      notes:      '',
      createdAt:  Timestamp.fromDate(date),
      date:       dateStr(date),
    })

    console.log(`  Session ${i + 1}/25 — ${moduleName} | ${drillCount} drills | ${duration}m`)
  }

  console.log('✅ Sessions seeded\n')
}

// ── Generate daily session records ───────
async function seedDailySessions() {
  console.log('Seeding daily session records...')
  const dailyRef = collection(db, 'users', UID, 'daily_sessions')

  // Mark ~40 of the last 60 days as active
  // (skip some days to make it realistic)
  const activeDays = new Set()
  while (activeDays.size < 38) {
    activeDays.add(randomBetween(1, 60))
  }

  for (const daysBack of activeDays) {
    const date    = daysAgo(daysBack)
    const dateS   = dateStr(date)
    const sessions = randomBetween(1, 3)

    await setDoc(doc(dailyRef, dateS), {
      date:      dateS,
      completed: true,
      sessions,
      createdAt: Timestamp.fromDate(date),
    })
  }

  console.log(`✅ Daily records seeded (${activeDays.size} active days)\n`)
}

// ── Update user profile + XP ─────────────
async function seedUserProfile() {
  console.log('Updating user profile...')

  const xp    = 1840
  const level = 3 // Gold
  const streak = {
    count:   12,
    lastDate: dateStr(daysAgo(1)),
    longest: 18,
  }

  await setDoc(doc(db, 'users', UID), {
    xp,
    level,
    streak,
    profile: {
      displayName: 'SparkOp',
      username:    'SparkOp',
      bgmiId:      '5121439477',
      rank:        'Crown',
      bio:         'Grinding to Conqueror. IGL for Spark Esports.',
      region:      'India - South',
    },
    trial: {
      active:    true,
      startDate: daysAgo(6).toISOString(),
      endDate:   daysAgo(-84).toISOString(),
      daysLeft:  84,
      daysTotal: 90,
      plan:      'free_trial',
      expired:   false,
    },
    badges:    ['first_session', 'streak_7', 'level_3'],
    teamId:    null,
    createdAt: Timestamp.fromDate(daysAgo(6)),
    updatedAt: Timestamp.fromDate(daysAgo(0)),
  }, { merge: true })

  console.log(`✅ Profile updated — Level ${level} (${LEVEL_NAMES[level]}), ${xp} XP, ${streak.count}d streak\n`)
}

// ── Seed notifications ───────────────────
async function seedNotifications() {
  console.log('Seeding notifications...')
  const notifRef = collection(
    db, 'users', UID, 'notifications'
  )

  const notifs = [
    {
      title:   'Welcome to Esports Elite!',
      message: 'Your 90-day free trial has started. Start logging your sessions to track your progress.',
      type:    'success',
      link:    '/dashboard',
      read:    true,
    },
    {
      title:   'New Feature: Team Management',
      message: 'You can now create or join a team, track scrims, and manage your squad.',
      type:    'info',
      link:    '/team',
      read:    false,
    },
    {
      title:   '7-Day Streak! 🔥',
      message: 'You have been training for 7 days straight. Keep the momentum going!',
      type:    'success',
      link:    '/progress',
      read:    false,
    },
    {
      title:   'Trial Reminder',
      message: 'You have 84 days left on your free trial. Enjoy full access to all features.',
      type:    'warning',
      link:    '/profile',
      read:    true,
    },
  ]

  for (const n of notifs) {
    await addDoc(notifRef, {
      ...n,
      createdAt: Timestamp.fromDate(
        daysAgo(randomBetween(1, 6))
      ),
    })
  }

  console.log('✅ Notifications seeded\n')
}

// ── Main runner ──────────────────────────
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('ESPORTS ELITE — DEMO DATA SEED')
  console.log(`UID: ${UID}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  try {
    await seedUserProfile()
    await seedMatches()
    await seedSessions()
    await seedDailySessions()
    await seedNotifications()

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ ALL DONE! Refresh your app.')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } catch (err) {
    console.error('❌ Error:', err.message)
    console.error(err)
  }

  process.exit(0)
}

main()
