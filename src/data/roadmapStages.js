/*
 * roadmapStages.js — static definition of the Career Roadmap.
 *
 * This is PLACEHOLDER content. The real lesson copy and assessment
 * questions are supplied by Karthik stage-by-stage once the flow is
 * verified. Only the SHAPE of each object matters to the UI:
 *
 *   id          unique slug — also the Firestore progress key
 *   order       1-based display order (stages unlock in this order)
 *   title       stage name
 *   tagline     one-line summary shown on the timeline card
 *   icon        emoji marker
 *   estMinutes  rough time to read the lesson
 *   xpReward    XP granted once (via useUserData().updateXP) on completion
 *   content     { intro, tabs: { lesson[], keyPoints[], examples[] } }
 *                 lesson blocks: { type: 'h' | 'p' | 'list', text?, items? }
 *   coachTip    short string shown in the "AI Coach Tip" card
 *   resources   [{ label, kind: 'article' | 'video' | 'drill', to? }]
 *                 `to` is an in-app route (optional) — external/coming-soon
 *                 links just render as a styled row.
 *   assessment  { passRate, groups: [{ id, title, questions: [
 *                   { id, prompt, options: string[], answer: number, explain }
 *                 ]}] }
 *
 * Unlock rule: stage N is available once stage N-1 is `completed`.
 * No calendar/day locking — see CLAUDE.md / session brief.
 */

export const ROADMAP_PASS_RATE = 0.7

export const ROADMAP_STAGES = [
  /* ───────────────────────── STAGE 1 ───────────────────────── */
  {
    id: 'foundations',
    order: 1,
    title: 'Foundations & Mindset',
    tagline: 'Device setup, a stable sensitivity, and a training habit that sticks.',
    icon: '🧭',
    estMinutes: 10,
    xpReward: 150,
    content: {
      intro:
        'Before mechanics or strategy, competitive players lock in the boring stuff: ' +
        'a consistent device, one sensitivity they never touch, and a daily routine. ' +
        'This stage sets that base so everything you build later stands on solid ground.',
      tabs: {
        lesson: [
          { type: 'h', text: 'Why foundations decide your ceiling' },
          {
            type: 'p',
            text:
              'Skill is built through thousands of repeated reps against the SAME variables. ' +
              'Every time you change sensitivity, layout, or device, you reset that muscle memory. ' +
              'Pros look "talented" mostly because they stopped changing things years ago.',
          },
          { type: 'h', text: 'The three things to lock in' },
          {
            type: 'list',
            items: [
              'Device & grip — pick 3-finger or 4-finger claw and commit for at least a month.',
              'Sensitivity — set camera, ADS, and gyro values once, write them down, do not tweak mid-week.',
              'Routine — a fixed 20–30 min block per day beats a 3-hour session once a week.',
            ],
          },
          { type: 'h', text: 'Building the habit' },
          {
            type: 'p',
            text:
              'Attach training to an existing habit (after dinner, before your ranked games). ' +
              'Track it — a streak you can see is a streak you protect. The Dashboard streak counter ' +
              'and this roadmap both exist to give you that visible signal.',
          },
        ],
        keyPoints: [
          'One sensitivity, written down, untouched for 4+ weeks.',
          'Consistency of reps matters more than volume of reps.',
          'Short daily sessions build memory faster than rare long ones.',
          'Track your streak so you have something concrete to protect.',
        ],
        examples: [
          {
            title: 'Good routine',
            text:
              '25 min every evening: 5 min warm-up in training ground, 15 min drills on one weakness, ' +
              '5 min review. Same time, same order, every day.',
          },
          {
            title: 'Bad routine',
            text:
              'Random 2–4 hour sessions twice a week, changing sensitivity whenever a bad game happens, ' +
              'switching between 3 and 4 fingers depending on mood.',
          },
        ],
      },
    },
    coachTip:
      'Pick your sensitivity today and screenshot it. If you feel the urge to change it this week, ' +
      'do 3 more days on the current value first — most "sens problems" are actually aim-training problems.',
    resources: [
      { label: 'Training Center — build your daily block', kind: 'drill', to: '/training' },
      { label: 'Scheduler — pin a fixed practice time', kind: 'article', to: '/scheduler' },
      { label: 'Sensitivity tuning walkthrough', kind: 'video' },
    ],
    assessment: {
      passRate: 0.7,
      groups: [
        {
          id: 'g-knowledge',
          title: 'Concept check',
          questions: [
            {
              id: 'q1',
              prompt: 'Why do pros rarely change their sensitivity?',
              options: [
                'Their settings are secret',
                'Changing it resets built muscle memory',
                'The game blocks changes at high rank',
                'It costs in-game currency',
              ],
              answer: 1,
              explain:
                'Muscle memory is trained against fixed variables. Every sensitivity change forces a partial re-learn.',
            },
            {
              id: 'q2',
              prompt: 'Which schedule builds mechanical skill fastest?',
              options: [
                'One 4-hour session per week',
                'Random sessions when you feel like it',
                '25 focused minutes every day',
                'Only playing ranked matches',
              ],
              answer: 2,
              explain:
                'Frequent, consistent reps beat rare high-volume sessions for motor learning.',
            },
          ],
        },
        {
          id: 'g-self',
          title: 'Self-assessment',
          questions: [
            {
              id: 'q3',
              prompt: 'Have you written down your current sensitivity values?',
              options: ['Yes, all of them', 'Some of them', 'No, not yet'],
              answer: 0,
              explain:
                'If not, do it now — you cannot keep something consistent that you have not recorded.',
            },
          ],
        },
      ],
    },
  },

  /* ───────────────────────── STAGE 2 ───────────────────────── */
  {
    id: 'aim-mechanics',
    order: 2,
    title: 'Core Aim Mechanics',
    tagline: 'Crosshair placement, tracking, and flicks — the daily aim diet.',
    icon: '🎯',
    estMinutes: 12,
    xpReward: 200,
    content: {
      intro:
        'Aim is not one skill — it is crosshair placement, tracking, target switching, and recoil control ' +
        'working together. This stage breaks each one down and gives you a drill for it.',
      tabs: {
        lesson: [
          { type: 'h', text: 'Crosshair placement comes first' },
          {
            type: 'p',
            text:
              'Most "slow" aim is actually bad pre-aim. Keep your crosshair at head level, pointed where ' +
              'an enemy is most likely to appear, so a fight starts with a small correction instead of a big swing.',
          },
          { type: 'h', text: 'The four pillars' },
          {
            type: 'list',
            items: [
              'Crosshair placement — head level, pre-aimed at likely angles.',
              'Tracking — keeping the reticle on a strafing target.',
              'Target switching — moving cleanly between two or more enemies.',
              'Recoil control — pulling down/against the spray pattern.',
            ],
          },
          { type: 'h', text: 'Your daily aim diet' },
          {
            type: 'p',
            text:
              '10–15 minutes: 3 min close-range hipfire/tracking, 4 min mid-range bursts, ' +
              '4 min recoil on a wall, 3 min flicks. Rotate the emphasis based on your last matches.',
          },
        ],
        keyPoints: [
          'Fix crosshair placement before grinding flicks — it is the highest-value habit.',
          'Train tracking and recoil separately, then combine them.',
          'Short daily aim routine > occasional marathon.',
          'Let your recent match weaknesses pick the emphasis each day.',
        ],
        examples: [
          {
            title: 'Crosshair placement drill',
            text:
              'Walk through a building in training ground pre-aiming every doorway at head height ' +
              'before you can see through it. No shooting — just placement.',
          },
          {
            title: 'Recoil drill',
            text:
              'Full mag on a wall at 20m with each AR you use, controlling the pattern. ' +
              'Compare the spread; repeat the worst gun.',
          },
        ],
      },
    },
    coachTip:
      'Record one TDM round and watch it back. Count how many fights started with your crosshair ' +
      'already near the enemy vs. a panic swing. That ratio is your placement score.',
    resources: [
      { label: 'ADS training module', kind: 'drill', to: '/training' },
      { label: 'Spray control module', kind: 'drill', to: '/training' },
      { label: 'Weapons Guide — recoil by gun', kind: 'article', to: '/weapons' },
    ],
    assessment: {
      passRate: 0.7,
      groups: [
        {
          id: 'g-knowledge',
          title: 'Concept check',
          questions: [
            {
              id: 'q1',
              prompt: 'What is usually the real cause of "slow" aim in a fight?',
              options: [
                'Low sensitivity',
                'Poor crosshair placement before the fight',
                'Bad internet',
                'Wrong weapon choice',
              ],
              answer: 1,
              explain:
                'If your crosshair is already near head level and pre-aimed, you only need a small correction.',
            },
            {
              id: 'q2',
              prompt: 'Which is the best way to train recoil control?',
              options: [
                'Only in ranked matches',
                'Never — it is random',
                'Controlled full-mag reps on a wall, per weapon',
                'By lowering your sensitivity until it disappears',
              ],
              answer: 2,
              explain:
                'Recoil patterns are learnable. Isolated wall reps per gun build the pull-down memory.',
            },
            {
              id: 'q3',
              prompt: 'How should you choose what to emphasise in today’s aim routine?',
              options: [
                'Always the same order',
                'Whatever is most fun',
                'Based on weaknesses from your recent matches',
                'Only practise your strongest skill',
              ],
              answer: 2,
              explain:
                'Targeted practice on current weaknesses returns the most improvement.',
            },
          ],
        },
      ],
    },
  },

  /* ───────────────────────── STAGE 3 ───────────────────────── */
  {
    id: 'movement-positioning',
    order: 3,
    title: 'Movement & Positioning',
    tagline: 'Peeking, cover discipline, and winning fights before they start.',
    icon: '🏃',
    estMinutes: 12,
    xpReward: 200,
    content: {
      intro:
        'A good position turns a 50/50 gunfight into a 70/30. This stage covers how you take fights: ' +
        'peek technique, using cover, and choosing when a fight is worth it at all.',
      tabs: {
        lesson: [
          { type: 'h', text: 'Peeking' },
          {
            type: 'p',
            text:
              'Wide-peek when you have the aim advantage and want to catch someone off guard; ' +
              'jiggle/short-peek to bait shots and gather info. Never peek the same spot twice in a row.',
          },
          { type: 'h', text: 'Cover discipline' },
          {
            type: 'list',
            items: [
              'Always know your nearest piece of hard cover.',
              'Reload, heal, and loot behind cover — never in the open.',
              'Break line of sight after a trade instead of pushing on instinct.',
            ],
          },
          { type: 'h', text: 'Fight selection' },
          {
            type: 'p',
            text:
              'Ask: do I have the height, the cover, the numbers, and an escape? If two or more are "no", ' +
              'the fight is bad — reposition instead.',
          },
        ],
        keyPoints: [
          'Height + cover + numbers + escape — need most of these before committing.',
          'Vary your peek spot and timing every single time.',
          'Do all "vulnerable" actions (heal, reload, loot) behind cover.',
          'Repositioning is a valid play, not a cowardly one.',
        ],
        examples: [
          {
            title: 'Good fight',
            text:
              'You hold high ground behind a rock, enemy is crossing open field, your squad is full. ' +
              'You peek, trade, and pull back to cover to reset.',
          },
          {
            title: 'Bad fight',
            text:
              'You are low ground, no cover for 15m, one teammate down, and you push a building ' +
              'because you "heard a shot".',
          },
        ],
      },
    },
    coachTip:
      'In your next 3 matches, before every fight say the four checks out loud: height, cover, numbers, escape. ' +
      'You will fold far fewer hands you should not have played.',
    resources: [
      { label: 'Map Knowledge — cover and rotations', kind: 'article', to: '/map-knowledge' },
      { label: 'Close-range movement module', kind: 'drill', to: '/training' },
      { label: 'Peek technique breakdown', kind: 'video' },
    ],
    assessment: {
      passRate: 0.7,
      groups: [
        {
          id: 'g-knowledge',
          title: 'Concept check',
          questions: [
            {
              id: 'q1',
              prompt: 'You should heal and reload:',
              options: [
                'Wherever you are, speed matters most',
                'Behind hard cover, out of line of sight',
                'While strafing in the open',
                'Only after the zone closes',
              ],
              answer: 1,
              explain: 'Vulnerable actions belong behind cover — a free heal is worth a few seconds.',
            },
            {
              id: 'q2',
              prompt: 'Before committing to a fight you want most of:',
              options: [
                'Height, cover, numbers, escape',
                'A better gun than the enemy',
                'Full shield only',
                'A vehicle nearby',
              ],
              answer: 0,
              explain: 'These four factors stack the odds. Missing two or more means reposition.',
            },
            {
              id: 'q3',
              prompt: 'How often should you peek the same angle the same way?',
              options: [
                'Every time — consistency is good',
                'Never repeat the spot and timing',
                'Twice, then switch',
                'Only when reloading',
              ],
              answer: 1,
              explain: 'Repeating a peek lets the enemy pre-aim and pre-fire you for free.',
            },
          ],
        },
      ],
    },
  },

  /* ───────────────────────── STAGE 4 ───────────────────────── */
  {
    id: 'game-sense',
    order: 4,
    title: 'Game Sense & Rotations',
    tagline: 'Reading the zone, timing rotations, and playing the information game.',
    icon: '🧠',
    estMinutes: 14,
    xpReward: 250,
    content: {
      intro:
        'Game sense is pattern recognition: where the zone will pull, where third parties come from, ' +
        'and what the map is telling you. This stage turns "I got unlucky" into "I misread that".',
      tabs: {
        lesson: [
          { type: 'h', text: 'Zone reading' },
          {
            type: 'p',
            text:
              'Look at the next circle the moment it appears. Plan a route with cover, and start moving ' +
              'early — the players who rotate late are the ones fighting through the open on blue.',
          },
          { type: 'h', text: 'Third parties' },
          {
            type: 'list',
            items: [
              'Every fight you take is heard by nearby squads.',
              'Finish fights fast or disengage — a long fight is a beacon.',
              'After a fight, relocate before you loot the crate.',
            ],
          },
          { type: 'h', text: 'Information' },
          {
            type: 'p',
            text:
              'Vehicles, gunfire, downed markers, and open doors all tell a story. Build the habit of ' +
              'narrating the lobby to yourself: how many squads are left, and roughly where.',
          },
        ],
        keyPoints: [
          'Check the next zone as soon as it shows and move early.',
          'Assume every fight attracts a third party — plan the exit first.',
          'Relocate after a kill before looting.',
          'Constantly estimate squads remaining and their location.',
        ],
        examples: [
          {
            title: 'Good rotation',
            text:
              'Zone pulls across the river. You leave 40 seconds early, cross at the bridge with smoke, ' +
              'and are set up on the new edge before the fights start.',
          },
          {
            title: 'Bad rotation',
            text:
              'You loot a third crate, notice the zone is closing, and sprint across open ground taking ' +
              'blue and getting shot from two sides.',
          },
        ],
      },
    },
    coachTip:
      'After each match, write one sentence: "The moment I lost tempo was ___." Do this for 10 games ' +
      'and your rotation timing fixes itself.',
    resources: [
      { label: 'Map Knowledge — zone pull tendencies', kind: 'article', to: '/map-knowledge' },
      { label: 'Analytics — your placement trend', kind: 'article', to: '/analytics' },
      { label: 'Rotation timing VOD review', kind: 'video' },
    ],
    assessment: {
      passRate: 0.7,
      groups: [
        {
          id: 'g-knowledge',
          title: 'Concept check',
          questions: [
            {
              id: 'q1',
              prompt: 'When should you check the next safe zone?',
              options: [
                'After you finish looting',
                'The moment it appears on the map',
                'Only when the current zone starts shrinking',
                'When a teammate calls it',
              ],
              answer: 1,
              explain: 'Early awareness lets you pick a route with cover and move before the rush.',
            },
            {
              id: 'q2',
              prompt: 'The safest thing to do right after winning a fight is:',
              options: [
                'Immediately loot all crates',
                'Sit still and heal in the open',
                'Relocate, then loot from a safer angle',
                'Push toward the next gunfire',
              ],
              answer: 2,
              explain: 'Your fight was heard. Moving first denies third parties an easy clean-up.',
            },
          ],
        },
        {
          id: 'g-self',
          title: 'Self-assessment',
          questions: [
            {
              id: 'q3',
              prompt: 'In your last 5 games, how often did you rotate on blue?',
              options: ['Never', 'Once or twice', 'Most games'],
              answer: 0,
              explain: 'Rotating on blue is a tempo problem — leave earlier and plan the route.',
            },
          ],
        },
      ],
    },
  },

  /* ───────────────────────── STAGE 5 ───────────────────────── */
  {
    id: 'team-play',
    order: 5,
    title: 'Team Play & Communication',
    tagline: 'Clean callouts, role clarity, and trading kills as a unit.',
    icon: '🤝',
    estMinutes: 12,
    xpReward: 250,
    content: {
      intro:
        'Four players who communicate beat four better aimers who do not. This stage covers callout ' +
        'discipline, roles (IGL, entry, support, sniper), and the habit of trading.',
      tabs: {
        lesson: [
          { type: 'h', text: 'Callouts' },
          {
            type: 'p',
            text:
              'A good callout has direction, distance, and status: "one enemy, north, 50 metres, full shield, ' +
              'behind the rock". Short, calm, one caller at a time in a fight.',
          },
          { type: 'h', text: 'Roles' },
          {
            type: 'list',
            items: [
              'IGL — makes rotation and engage/disengage calls.',
              'Entry — takes first contact and space.',
              'Support — trades the entry and covers utility.',
              'Sniper / lurk — holds angles and gathers info.',
            ],
          },
          { type: 'h', text: 'Trading' },
          {
            type: 'p',
            text:
              'When a teammate peeks, you should already be positioned to punish whoever shoots them. ' +
              'A trade within 1–2 seconds turns a lost duel into a won 2v1.',
          },
        ],
        keyPoints: [
          'Callouts: direction, distance, status — in that order.',
          'One caller during a fight; debrief after.',
          'Everyone knows their role before you drop.',
          'Play close enough to trade — spacing wins fights.',
        ],
        examples: [
          {
            title: 'Good comms',
            text:
              '"Two, east, 30, pushing the compound. I’m entry left, support with me, sniper hold right." ' +
              'Everyone confirms and executes.',
          },
          {
            title: 'Bad comms',
            text:
              'Three people talking at once, "he’s over there", panic, no one trades the entry, ' +
              'squad wipes one at a time.',
          },
        ],
      },
    },
    coachTip:
      'Next scrim block, assign roles before you queue and stick to them even when it feels wrong. ' +
      'Role confusion loses more rounds than bad aim.',
    resources: [
      { label: 'My Team — set roles and run practice', kind: 'article', to: '/team' },
      { label: 'Scheduler — book a scrim block', kind: 'article', to: '/scheduler' },
      { label: 'Callout structure guide', kind: 'video' },
    ],
    assessment: {
      passRate: 0.7,
      groups: [
        {
          id: 'g-knowledge',
          title: 'Concept check',
          questions: [
            {
              id: 'q1',
              prompt: 'A complete callout contains:',
              options: [
                'Just the direction',
                'Direction, distance, and status',
                'The enemy’s username',
                'Your own health only',
              ],
              answer: 1,
              explain: 'Direction + distance + status gives teammates everything they need to react.',
            },
            {
              id: 'q2',
              prompt: 'What does "trading" mean in a squad fight?',
              options: [
                'Swapping weapons with a teammate',
                'Punishing the enemy who shot your teammate, immediately',
                'Giving your teammate your armour',
                'Rotating to a new position',
              ],
              answer: 1,
              explain: 'A fast trade converts a lost 1v1 into a won 2v1.',
            },
            {
              id: 'q3',
              prompt: 'During an active fight, how many people should be making calls?',
              options: ['All four', 'Two', 'One primary caller', 'Nobody, stay silent'],
              answer: 2,
              explain: 'One caller during the fight keeps comms clear; full debrief happens after.',
            },
          ],
        },
      ],
    },
  },

  /* ───────────────────────── STAGE 6 ───────────────────────── */
  {
    id: 'competitive-ready',
    order: 6,
    title: 'Competitive Readiness',
    tagline: 'Scrims, VOD review, tilt control, and entering your first tournament.',
    icon: '🏆',
    estMinutes: 14,
    xpReward: 350,
    content: {
      intro:
        'The final stage is about turning practice into results: a scrim and review loop, managing tilt, ' +
        'and actually signing up for a competitive event.',
      tabs: {
        lesson: [
          { type: 'h', text: 'The scrim → review loop' },
          {
            type: 'p',
            text:
              'Scrims are only useful if you review them. After each block, pick 2–3 rounds, watch them as ' +
              'a team, and agree on one thing to change next block. Log it.',
          },
          { type: 'h', text: 'Tilt control' },
          {
            type: 'list',
            items: [
              'Name it — saying "I’m tilted" out loud cuts its power.',
              'Reset routine — one deep breath, reset crosshair, next round.',
              'Hard stop — if two rounds in a row are emotional, take a 10-minute break.',
            ],
          },
          { type: 'h', text: 'Entering an event' },
          {
            type: 'p',
            text:
              'Pick a low-stakes online tournament first. The goal is exposure to the format, nerves, and ' +
              'admin (check-in, lobby codes, rules) — not winning. Treat round one as calibration.',
          },
        ],
        keyPoints: [
          'Every scrim block ends with a short review and one logged change.',
          'Have a named reset routine for tilt.',
          'Your first tournament is for experience, not trophies.',
          'Review > volume — 3 reviewed scrims beat 10 unreviewed ones.',
        ],
        examples: [
          {
            title: 'Good review',
            text:
              '"We lost tempo on rounds 2 and 5 by over-rotating. Next block: hold the first edge 15 seconds ' +
              'longer before moving." Logged, revisited next week.',
          },
          {
            title: 'Bad review',
            text:
              '"We just need to aim better." No specifics, nothing logged, same mistakes next block.',
          },
        ],
      },
    },
    coachTip:
      'Sign up for one event this month. Put the date in the Scheduler now, while you are motivated — ' +
      'future-you will find a reason not to.',
    resources: [
      { label: 'Tournaments — browse upcoming events', kind: 'article', to: '/tournaments' },
      { label: 'My Team — run a scrim + review block', kind: 'drill', to: '/team' },
      { label: 'Analytics — track results over time', kind: 'article', to: '/analytics' },
    ],
    assessment: {
      passRate: 0.7,
      groups: [
        {
          id: 'g-knowledge',
          title: 'Concept check',
          questions: [
            {
              id: 'q1',
              prompt: 'What makes a scrim block actually valuable?',
              options: [
                'Playing as many as possible',
                'Reviewing it and agreeing on one change',
                'Only scrimming stronger teams',
                'Winning every round',
              ],
              answer: 1,
              explain: 'Unreviewed scrims repeat mistakes. The review + one logged change is the point.',
            },
            {
              id: 'q2',
              prompt: 'The main goal of your first tournament is:',
              options: [
                'Winning it',
                'Getting exposure to the format and nerves',
                'Farming XP',
                'Beating a specific rival',
              ],
              answer: 1,
              explain: 'Treat the first event as calibration — format, admin, and pressure exposure.',
            },
            {
              id: 'q3',
              prompt: 'A good tilt-reset routine is:',
              options: [
                'Play faster to get value back',
                'Mute the team',
                'One breath, reset crosshair, next round — with a hard stop after two bad rounds',
                'Switch sensitivity',
              ],
              answer: 2,
              explain: 'A short, repeatable reset plus a hard stop rule keeps tilt from compounding.',
            },
          ],
        },
        {
          id: 'g-self',
          title: 'Self-assessment',
          questions: [
            {
              id: 'q4',
              prompt: 'Have you scheduled a competitive event to enter?',
              options: ['Yes, it is in the Scheduler', 'Thinking about it', 'Not yet'],
              answer: 0,
              explain: 'Book it now while motivated — open the Scheduler and add the date.',
            },
          ],
        },
      ],
    },
  },
]

/** Total XP available from completing the whole roadmap. */
export const ROADMAP_TOTAL_XP = ROADMAP_STAGES.reduce((sum, s) => sum + s.xpReward, 0)

/** Flat question count for a stage's assessment. */
export function countQuestions(stage) {
  if (!stage?.assessment?.groups) return 0
  return stage.assessment.groups.reduce((n, g) => n + g.questions.length, 0)
}
