import { collection, addDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase.js'

export async function seedTestData(uid) {
  const sessions = [
    { module: 'ADS',           duration: 15, xp: 45, daysAgo: 0  },
    { module: 'Spray Control', duration: 20, xp: 60, daysAgo: 1  },
    { module: 'Close Range',   duration: 12, xp: 35, daysAgo: 1  },
    { module: 'ADS',           duration: 18, xp: 50, daysAgo: 2  },
    { module: 'Car Spray',     duration: 15, xp: 40, daysAgo: 3  },
    { module: 'Spray Control', duration: 25, xp: 70, daysAgo: 4  },
    { module: 'ADS',           duration: 10, xp: 30, daysAgo: 5  },
    { module: 'Close Range',   duration: 20, xp: 55, daysAgo: 6  },
    { module: 'Spray Control', duration: 15, xp: 45, daysAgo: 8  },
    { module: 'ADS',           duration: 22, xp: 65, daysAgo: 9  },
    { module: 'Car Spray',     duration: 18, xp: 50, daysAgo: 11 },
    { module: 'Close Range',   duration: 15, xp: 40, daysAgo: 13 },
  ]

  for (const s of sessions) {
    const date = new Date()
    date.setDate(date.getDate() - s.daysAgo)
    await addDoc(collection(db, 'users', uid, 'sessions'), {
      module:          s.module,
      durationMinutes: s.duration,
      xpEarned:        s.xp,
      completedAt:     date.toISOString(),
      status:          'completed',
    })
  }

  const matches = [
    { type: 'Classic',    map: 'Erangel',  kills: 4, placement:  8, damage:  620, daysAgo:  0, weakness: 'Spray Control'   },
    { type: 'Scrims',     map: 'Miramar',  kills: 7, placement:  3, damage:  890, daysAgo:  1, weakness: 'Positioning'     },
    { type: 'Classic',    map: 'Sanhok',   kills: 2, placement: 15, damage:  340, daysAgo:  2, weakness: 'Close Range'     },
    { type: 'Scrims',     map: 'Erangel',  kills: 5, placement:  6, damage:  710, daysAgo:  3, weakness: 'Rotation'        },
    { type: 'Tournament', map: 'Miramar',  kills: 9, placement:  1, damage: 1120, daysAgo:  4, weakness: 'Aim'             },
    { type: 'Classic',    map: 'Livik',    kills: 3, placement: 11, damage:  480, daysAgo:  6, weakness: 'Spray Control'   },
    { type: 'Scrims',     map: 'Sanhok',   kills: 6, placement:  4, damage:  780, daysAgo:  7, weakness: 'Close Range'     },
    { type: 'Classic',    map: 'Erangel',  kills: 1, placement: 22, damage:  210, daysAgo:  9, weakness: 'Decision Making' },
    { type: 'Tournament', map: 'Miramar',  kills: 8, placement:  2, damage:  990, daysAgo: 11, weakness: 'Positioning'     },
    { type: 'Scrims',     map: 'Livik',    kills: 4, placement:  7, damage:  560, daysAgo: 13, weakness: 'Spray Control'   },
  ]

  for (const m of matches) {
    const date = new Date()
    date.setDate(date.getDate() - m.daysAgo)
    await addDoc(collection(db, 'users', uid, 'matches'), {
      type:         m.type,
      map:          m.map,
      kills:        m.kills,
      placement:    m.placement,
      damage:       m.damage,
      survivalTime: '18:30',
      weakness:     m.weakness,
      loggedAt:     date.toISOString(),
      xpEarned:     25,
    })
  }

  await updateDoc(doc(db, 'users', uid), {
    streak: { count: 7, lastActiveDate: new Date().toISOString() },
    xp:     350,
    level:  2,
  })

  return { sessionsAdded: sessions.length, matchesAdded: matches.length }
}
