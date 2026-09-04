/*
 * roadmapStages.js — "THE ROAD TO ESPORTS" static config.
 *
 * ALL lesson text, benefit lists, assessment questions and how-to-improve
 * lists in this file are taken VERBATIM from Karthik's final content
 * document. There is NO draft content and NO `draft` flag anywhere.
 *
 * Where the document's assessment questions are open-ended ("What was your
 * biggest mistake recently?", "You knock one player but do not know where
 * the others are — what do you do?"), they render per the mixed model:
 *   - reflective "what / why" questions  -> free-text  (type: 'text')
 *   - "Can you… / How often…" self-ratings -> scored 4-option (type: 'scale')
 *   - scenarios -> the player picks a response (type: 'scenario'), with
 *                  guidance shown in the result. Response options + guidance
 *                  are supplied here (the doc gives only the scenario prompt).
 *
 * Question types (see utils/roadmapScoring.js):
 *   'scale'    ordered options worst->best, scored
 *   'choice'   categorical; scored only if `scored: true` (then ordinal);
 *              `multi: true` -> array answer, captured not scored
 *   'scenario' pick a response; captured + `guidance`; scored only if `scored`
 *   'text'     free-text reflection; captured, never scored
 *
 * Per-user PROGRESS persists at users/{uid}/roadmapProgress/{stageId}.
 * Unlocking is progress-based only — never day/calendar gated.
 */

export { LEVEL_BANDS, levelForScore } from '../utils/roadmapScoring.js'

/* ── Roadmap intro / framing — VERBATIM (doc lines 5-12, 519-522) ────── */
export const ROADMAP_INTRO = {
  purpose: [
    'This is the player-facing content system for Esports Elite’s Road to Esports journey. It is designed to be practical, not a long course: learn what an area is, understand why it matters, complete an assessment in the middle, then receive practical ways to improve.',
    'The goal is not to promise that every player becomes professional in 30 days. The goal is to help every player discover their current level, understand their strengths and weaknesses, build better habits, and find out how far they can go.',
  ],
  how: [
    { k: 'LEARN', v: 'What is it? What are the benefits? How does it help?' },
    { k: 'ASSESS', v: 'Practical questions, scenarios, and tasks that show the player’s current level.' },
    { k: 'IMPROVE', v: 'Drills, habits, training methods, and next actions based on the result.' },
  ],
  resultsNote:
    'Assessment results should not end as a score. Return a useful starting point such as Strong, Developing, Needs Work, and Priority Focus, followed by a recommended action.',
  coreLoop: 'LEARN → ASSESS → TRAIN → PLAY → REVIEW → FIX → MEASURE → IMPROVE → COMPETE',
  tagline: 'TRAIN. TRACK. REVIEW. IMPROVE. COMPETE.',
}

/* ── section builder ─────────────────────────────────────────────────── */
function section({ id, name, tagline, intro, blocks = [], keyPoints = [], examples, cta, questions = [], outputLabel, resultExample }) {
  const jumpLinks = [
    ...blocks.filter(b => b.type === 'h' && b.id).map(b => ({ id: b.id, label: b.text })),
  ]
  if (keyPoints.length) jumpLinks.push({ id: 'key', label: 'Key Takeaways' })
  return {
    id,
    name,
    status: 'ready',
    tagline,
    content: {
      intro,
      jumpLinks,
      blocks,
      keyPoints,
      examples: examples || {
        status: 'coming-soon',
        note: 'Worked examples for this section will be added later — use the checklists above as your guide for now.',
        items: [],
      },
      ...(cta ? { cta } : {}),
    },
    questions,
    ...(outputLabel ? { outputLabel } : {}),
    ...(resultExample ? { resultExample } : {}),
  }
}

/* Stage-1 "areas" checklist entry — not assessable, links to its home stage. */
function areaLink(id, name, linkStage, linkLabel) {
  return { id, name, status: 'elsewhere', linkStage, linkLabel }
}

const SCALE4 = { yesNo: ['No', 'Sometimes', 'Usually', 'Yes'], freq: ['Never', 'Rarely', 'Usually', 'Always'] }

/* ============================================================
   STAGE 1 — KNOW YOURSELF   (doc lines 25-43)
   Single overview topic + a read-only "areas" checklist.
   ============================================================ */
const S1_OVERVIEW = section({
  id: 'what-it-takes',
  name: 'What Does It Take to Become an Esports Player?',
  tagline: 'Before you try to become a better player, understand what the journey actually requires — and where you currently stand.',
  intro:
    'Becoming an esports player is more than being good at a game. You need skill, game sense, discipline, consistency, training, learning, mental strength, teamwork, communication, a role, competition experience, commitment, and a clear goal.',
  blocks: [
    { type: 'callout', label: 'Before you start', text: 'Before you try to become a better player, you need to understand what becoming an esports player actually requires — and where you currently stand.' },
    { type: 'h', id: 'areas', text: 'The major areas this covers' },
    { type: 'checklist', items: ['Skill', 'Game Sense', 'Discipline', 'Consistency', 'Training', 'Learning', 'Mental Strength', 'Teamwork', 'Communication', 'Commitment'] },
    { type: 'h', id: 'benefits', text: 'What are the benefits?' },
    { type: 'checklist', items: [
      'Understand what the journey really requires.',
      'Stop relying only on talent or motivation.',
      'Identify what needs work instead of guessing.',
      'Build a realistic path toward competitive play.',
    ] },
    { type: 'h', id: 'helps', text: 'How does it help?' },
    { type: 'p', text: 'It changes the question from ‘Am I good enough?’ to ‘What do I need to improve next?’' },
    { type: 'callout', label: 'Output', text: 'Player Starting Point — strengths, weaknesses, commitment level, current focus, and recommended next step.' },
  ],
  keyPoints: [
    'The journey needs skill, game sense, discipline, consistency, training, learning, mental strength, teamwork, communication, a role, competition experience, commitment, and a clear goal.',
    'Stop relying only on talent or motivation.',
    'Identify what needs work instead of guessing.',
    'The question becomes ‘What do I need to improve next?’',
  ],
  outputLabel: 'Player Starting Point',
  questions: [
    {
      id: 's1-q1', type: 'choice', multi: true, short: 'strongest areas',
      prompt: 'What are your strongest areas?',
      options: ['Skill', 'Game sense', 'Discipline', 'Consistency', 'Training', 'Learning', 'Mental strength', 'Teamwork', 'Communication', 'Role', 'Competition experience', 'Commitment', 'A clear goal'],
    },
    {
      id: 's1-q2', type: 'choice', short: 'biggest problem area',
      prompt: 'Which area causes the most problems?',
      options: ['Skill', 'Game sense', 'Discipline', 'Consistency', 'Training', 'Learning', 'Mental strength', 'Teamwork', 'Communication', 'Role', 'Competition experience', 'Commitment', 'A clear goal'],
    },
    {
      id: 's1-q3', type: 'choice', scored: true, short: 'training days per week',
      prompt: 'How many days per week do you train?',
      options: ['0–1', '2–3', '4–5', '6–7'],
    },
    {
      id: 's1-q4', type: 'choice', scored: true, short: 'reviewing gameplay',
      prompt: 'Do you review gameplay?',
      options: ['Never', 'Sometimes', 'After big losses', 'Every session'],
    },
    {
      id: 's1-q5', type: 'choice', short: 'after a bad game',
      prompt: 'What do you do after a bad game?',
      options: ['Queue again right away', 'Get tilted and keep playing', 'Take a break', 'Review what went wrong'],
    },
    {
      id: 's1-q6', type: 'choice', short: 'competitive goal',
      prompt: 'What is your competitive goal?',
      options: ['Just enjoy playing', 'Climb ranked', 'Play semi-pro / amateur events', 'Go professional'],
    },
    {
      id: 's1-q7', type: 'choice', scored: true, short: 'time you can commit',
      prompt: 'How much time can you realistically commit?',
      options: ['Under 1 hour a day', '1–2 hours a day', '2–4 hours a day', '4+ hours a day'],
    },
  ],
})

const S1_AREA_LINKS = [
  areaLink('area-skill',        'Skill',                  'master-your-mechanics', 'Stage 03 · Master Your Mechanics'),
  areaLink('area-game-sense',   'Game sense',             'develop-game-sense',    'Stage 04 · Develop Game Sense'),
  areaLink('area-discipline',   'Discipline',             'build-your-foundation', 'Stage 02 · Build Your Foundation'),
  areaLink('area-consistency',  'Consistency',            'build-your-foundation', 'Stage 02 · Build Your Foundation'),
  areaLink('area-training',     'Training',               'build-your-foundation', 'Stage 02 · Build Your Foundation'),
  areaLink('area-learning',     'Learning',               'build-your-foundation', 'Stage 02 · Build Your Foundation'),
  areaLink('area-mental',       'Mental strength',        'compete',               'Stage 09 · Compete'),
  areaLink('area-teamwork',     'Teamwork',               'play-as-a-team',        'Stage 06 · Become a Team Player'),
  areaLink('area-comms',        'Communication',          'play-as-a-team',        'Stage 06 · Become a Team Player'),
  areaLink('area-role',         'Role',                   'find-your-role',        'Stage 05 · Find Your Role'),
  areaLink('area-competition',  'Competition experience', 'compete',               'Stage 09 · Compete'),
  areaLink('area-commitment',   'Commitment',             'build-your-career',     'Stage 10 · Build Your Future'),
  areaLink('area-goal',         'A clear goal',           'build-your-career',     'Stage 10 · Build Your Future'),
]

/* ============================================================
   STAGE 2 — BUILD YOUR FOUNDATION   (doc lines 44-113)
   ============================================================ */
const S2_DISCIPLINE = section({
  id: 'discipline',
  name: 'Discipline',
  tagline: 'Doing what you need to do even when you do not feel like doing it.',
  intro: 'Doing what you need to do even when you do not feel like doing it.',
  blocks: [
    { type: 'h', id: 'benefits', text: 'Benefits' },
    { type: 'checklist', items: ['Shows up for training', 'Follows a routine', 'Reviews gameplay', 'Works on weaknesses', 'Arrives prepared'] },
    { type: 'h', id: 'improve', text: 'How to Improve' },
    { type: 'checklist', items: [
      'Start with a realistic routine.',
      'Set a fixed training time.',
      'Track completed sessions.',
      'Do not skip difficult skills.',
      'Build consistency before adding hours.',
    ] },
  ],
  keyPoints: ['Shows up for training', 'Follows a routine', 'Reviews gameplay', 'Works on weaknesses', 'Arrives prepared'],
  questions: [
    { id: 's2d-q1', type: 'scale', short: 'following your routine', prompt: 'How often do you follow your routine?', options: SCALE4.freq },
    { id: 's2d-q2', type: 'scale', short: 'training when motivation is low', prompt: 'Do you train when motivation is low?', options: ['Never', 'Rarely', 'Usually', 'Always'] },
    { id: 's2d-q3', type: 'scale', short: 'reviewing', prompt: 'How often do you review?', options: SCALE4.freq },
    { id: 's2d-q4', type: 'scale', short: 'finishing planned sessions', prompt: 'Do you finish planned sessions?', options: ['Never', 'Rarely', 'Usually', 'Always'] },
  ],
})

const S2_CONSISTENCY = section({
  id: 'consistency',
  name: 'Consistency',
  tagline: 'Being able to perform well repeatedly, not just having one amazing game.',
  intro: 'Being able to perform well repeatedly, not just having one amazing game.',
  blocks: [
    { type: 'h', id: 'benefits', text: 'Benefits' },
    { type: 'checklist', items: ['Reliable performances', 'Team trust', 'Better results', 'Clearer progress'] },
    { type: 'h', id: 'improve', text: 'How to Improve' },
    { type: 'checklist', items: [
      'Find what causes bad games.',
      'Keep warm-ups consistent.',
      'Use the same review process.',
      'Build repeatable habits.',
      'Measure across multiple games.',
    ] },
  ],
  keyPoints: ['Reliable performances', 'Team trust', 'Better results', 'Clearer progress'],
  questions: [
    { id: 's2c-q1', type: 'text', short: 'last 5–10 games', prompt: 'Compare your last 5–10 games.', placeholder: 'Note the pattern across your recent games…' },
    { id: 's2c-q2', type: 'scale', short: 'gap between good and bad games', prompt: 'How different are good and bad games?', options: ['Completely different', 'Quite different', 'A little different', 'Very consistent'] },
    { id: 's2c-q3', type: 'text', short: 'what causes bad games', prompt: 'What causes bad games?', placeholder: 'Tilt, warm-up, sleep, matchups, forcing plays…' },
    { id: 's2c-q4', type: 'scale', short: 'repeating good habits', prompt: 'Can you repeat good habits?', options: ['No', 'Sometimes', 'Usually', 'Yes, reliably'] },
  ],
})

const S2_TRAINING = section({
  id: 'training',
  name: 'Training',
  tagline: 'Training is different from simply playing. Training has a specific purpose.',
  intro: 'Training is different from simply playing. Training has a specific purpose.',
  blocks: [
    { type: 'h', id: 'benefits', text: 'Benefits' },
    { type: 'checklist', items: ['Faster improvement', 'Better focus', 'Useful practice', 'Clearer weaknesses'] },
    { type: 'h', id: 'improve', text: 'How to Improve' },
    { type: 'checklist', items: [
      'Give every session a purpose.',
      'Split mechanics, matches, team play, scrims and review.',
      'Train weaknesses.',
      'Track what you worked on.',
    ] },
  ],
  keyPoints: ['Faster improvement', 'Better focus', 'Useful practice', 'Clearer weaknesses'],
  questions: [
    { id: 's2t-q1', type: 'scale', short: 'knowing what you improve', prompt: 'Do you know what you are improving each session?', options: ['Never', 'Rarely', 'Usually', 'Always'] },
    { id: 's2t-q2', type: 'text', short: 'when you open the game', prompt: 'What do you do when you open the game?', placeholder: 'Warm-up? Straight into ranked? Aim trainer?…' },
    { id: 's2t-q3', type: 'text', short: 'time split', prompt: 'How much time goes to mechanics, matches, scrims and review?', placeholder: 'Rough split of a typical session…' },
  ],
})

const S2_LEARNING = section({
  id: 'learning',
  name: 'Learning',
  tagline: 'Understanding why something happened and using that information next time.',
  intro: 'Understanding why something happened and using that information next time.',
  blocks: [
    { type: 'h', id: 'benefits', text: 'Benefits' },
    { type: 'checklist', items: ['Fewer repeated mistakes', 'Better decisions', 'Faster improvement', 'More awareness'] },
    { type: 'h', id: 'improve', text: 'How to Improve' },
    { type: 'checklist', items: [
      'Use Mistake → Reason → Fix → Practice → Review.',
      'Track repeated mistakes.',
      'Turn major mistakes into training points.',
    ] },
  ],
  keyPoints: ['Fewer repeated mistakes', 'Better decisions', 'Faster improvement', 'More awareness'],
  questions: [
    { id: 's2l-q1', type: 'text', short: 'biggest recent mistake', prompt: 'What was your biggest mistake recently?', placeholder: 'The one that cost you the most…' },
    { id: 's2l-q2', type: 'text', short: 'why it happened', prompt: 'Why did it happen?', placeholder: 'Root cause, not "I got outaimed"…' },
    { id: 's2l-q3', type: 'text', short: 'what you would do differently', prompt: 'What would you do differently?', placeholder: 'One concrete change…' },
    { id: 's2l-q4', type: 'scale', short: 'repeated the same mistake', prompt: 'Have you made the same mistake before?', options: ['Yes, many times', 'A few times', 'Once or twice', 'No — this was new'] },
  ],
})

/* ============================================================
   STAGE 3 — MASTER YOUR MECHANICS   (doc lines 114-152)
   ============================================================ */
const S3_MECHANICS = section({
  id: 'game-mechanics',
  name: 'Game Mechanics',
  tagline: 'The physical skills you use to control your character, weapons, movement, and fights.',
  intro:
    'Game mechanics are the physical skills you use to control your character, weapons, movement, and fights. They include aim, movement, recoil control, peeking, weapon handling, utility, and fighting at different ranges.',
  blocks: [
    { type: 'h', id: 'benefits', text: 'Benefits' },
    { type: 'checklist', items: [
      'Win more 1v1s.',
      'Finish fights faster.',
      'Take fights with more confidence.',
      'Create openings for your team.',
      'Turn good decisions into successful plays.',
    ] },
    { type: 'h', id: 'areas', text: 'Mechanical Areas' },
    { type: 'checklist', items: ['Close Range', 'Mid Range', 'Long Range', 'Aim', 'Movement', 'Recoil Control', 'Peeking', 'Weapon Handling', 'Utility', 'Clutching'] },
    { type: 'h', id: 'improve', text: 'How to Improve' },
    { type: 'checklist', items: [
      'Warm up before serious matches.',
      'Train the weakest skill, not only comfortable skills.',
      'Use short focused drills.',
      'Practice aim and movement together.',
      'Repeat until the action becomes natural.',
      'Test the skill in real matches and review it.',
    ] },
  ],
  keyPoints: [
    'Mechanics = aim, movement, recoil, peeking, weapon handling, utility, and range fighting.',
    'They win 1v1s, finish fights faster, and create openings.',
    'Train the weakest skill, not only comfortable skills.',
    'Practice aim and movement together, then test it in real matches.',
  ],
  resultExample: 'Close Range — Strong | Mid Range — Developing | Long Range — Needs Work | Movement — Strong | Weapon Handling — Developing. Priority: Long-range accuracy.',
  questions: [
    { id: 's3-q1', type: 'scale', area: 'Close Range', short: 'close-range 1v1s', prompt: 'Can you consistently win an equal close-range 1v1?', options: SCALE4.yesNo },
    { id: 's3-q2', type: 'scale', area: 'Movement', short: 'tracking while moving', prompt: 'Can you track a moving enemy while moving yourself?', options: SCALE4.yesNo },
    { id: 's3-q3', type: 'scale', area: 'Utility', short: 'cancelling utility to your gun', prompt: 'Can you quickly cancel a grenade/utility action and pull your weapon back out?', options: SCALE4.yesNo },
    { id: 's3-q4', type: 'scale', area: 'Recoil Control', short: 'full-spray recoil', prompt: 'Can you control recoil during a full spray?', options: SCALE4.yesNo },
    { id: 's3-q5', type: 'scale', area: 'Aim', short: 'resetting aim after a miss', prompt: 'Can you reset your aim after missing shots?', options: SCALE4.yesNo },
    { id: 's3-q6', type: 'scale', area: 'Mid Range', short: 'controlled mid-range shots', prompt: 'Can you hit controlled mid-range shots?', options: SCALE4.yesNo },
    { id: 's3-q7', type: 'scale', area: 'Long Range', short: 'long-range targets without rushing', prompt: 'Can you hit long-range targets without rushing?', options: SCALE4.yesNo },
    { id: 's3-q8', type: 'scale', area: 'Movement', short: 'moving while fighting', prompt: 'Can you move while fighting without ruining your aim?', options: SCALE4.yesNo },
    { id: 's3-q9', type: 'scale', area: 'Peeking', short: 'peek, shoot, return to cover', prompt: 'Can you peek, shoot, and return to cover quickly?', options: SCALE4.yesNo },
    { id: 's3-q10', type: 'scale', area: 'Weapon Handling', short: 'knowing when to stop spraying', prompt: 'Do you know when to stop spraying and reset?', options: SCALE4.yesNo },
  ],
})

/* ============================================================
   STAGE 4 — DEVELOP GAME SENSE   (doc lines 153-183)
   ============================================================ */
const S4_GAMESENSE = section({
  id: 'game-sense',
  name: 'Game Sense',
  tagline: 'Understanding what is happening, what information you have, and what your best option is next.',
  intro:
    'Game sense is understanding what is happening, what information you have, what the enemy can do, and what your best option is next.',
  blocks: [
    { type: 'h', id: 'benefits', text: 'Benefits' },
    { type: 'checklist', items: [
      'Better fight selection',
      'Better positioning',
      'Faster rotations',
      'Better enemy prediction',
      'Fewer unnecessary deaths',
      'Better team decisions',
    ] },
    { type: 'h', id: 'areas', text: 'Core Areas' },
    { type: 'checklist', items: ['Positioning', 'Rotations', 'Fight Selection', 'Timing', 'Information', 'Enemy Prediction', 'Decision Making'] },
    { type: 'h', id: 'improve', text: 'How to Improve' },
    { type: 'checklist', items: [
      'Use Information → Decision → Action → Result.',
      'Ask what you know and do not know before a major play.',
      'Think about where enemies are likely to move.',
      'Review deaths and identify missed information.',
      'Learn the map and common positions.',
      'Find the better option after every bad decision.',
    ] },
  ],
  keyPoints: [
    'Game sense = reading the situation and choosing the best next option.',
    'Use Information → Decision → Action → Result.',
    'Ask what you know and do not know before a major play.',
    'Review deaths and identify the information you missed.',
  ],
  questions: [
    {
      id: 's4-q1', type: 'scenario', short: 'knocked one, others unknown',
      prompt: 'You knock one player but do not know where the others are. What do you do?',
      options: ['Push to confirm the knock immediately', 'Hold, watch angles and listen for the other players', 'Back off and reset with the team', 'Call the knock and let the IGL decide'],
      guidance: 'Do not rush the confirm blind. Hold, gather information on the other players, and commit only when you know enough — or reset with the team.',
    },
    {
      id: 's4-q2', type: 'scenario', short: 'strong position, zone moving away',
      prompt: 'Your team has a strong position but the zone is moving away. What do you check before rotating?',
      options: ['Nothing — just run to the new zone', 'The route’s cover, the timing, and where other squads will rotate from', 'Only whether we have vehicles', 'Wait until the blue forces us'],
      guidance: 'Check the route’s cover, the timing, and where other squads will be rotating from. Leave early enough to reach a spot with cover before the fights start.',
    },
    {
      id: 's4-q3', type: 'scenario', short: 'fighting nearby, low resources',
      prompt: 'You hear fighting nearby but have limited resources. Push, hold, or gather information? Why?',
      options: ['Push — third-party for free kills', 'Gather information first, then decide based on numbers and our state', 'Hold and stay hidden no matter what', 'Push only if we have full heals and utility'],
      guidance: 'With limited resources, gather information first. Third-partying a fight you are not equipped for turns you into the clean-up target.',
    },
    {
      id: 's4-q4', type: 'scenario', short: 'seen, but you have cover',
      prompt: 'An enemy has seen you but you have cover. What options do you have?',
      options: ['Peek and fight straight away', 'Reposition, wait them out, use utility, or bait a push — pick based on the situation', 'Stay perfectly still and hope they leave', 'Call for the whole team to push instantly'],
      guidance: 'You have options: reposition, wait, use utility, or bait a push. The enemy expects you where they last saw you — use that.',
    },
    {
      id: 's4-q5', type: 'scenario', short: 'down players, late game',
      prompt: 'You are down players late in the game. How should your decisions change?',
      options: ['Play exactly the same', 'Play more carefully, avoid even fights, and use position and information to even the odds', 'Force fights fast before the zone closes', 'Split up to cover more ground'],
      guidance: 'Down players, you cannot afford even fights. Play more carefully, lean on position and information, and only take fights that are clearly in your favour.',
    },
  ],
})

/* ============================================================
   STAGE 5 — FIND YOUR ROLE   (doc lines 184-186; full system in roadmapRoles.js)
   ============================================================ */
const S5_ROLE = section({
  id: 'what-is-a-role',
  name: 'What is a Role?',
  tagline: 'A role is not just a label.',
  intro:
    'A role is the job you perform for your team. It describes what you are responsible for, what skills you need, how you should play, and what teammates expect from you. A role is not just a label.',
  blocks: [
    { type: 'h', id: 'means', text: 'What a Role Really Means' },
    { type: 'p', text: 'A role is not a badge, title, or excuse for a certain playstyle. A role is a set of responsibilities. It tells you what your team needs from you, what decisions you should be good at, where you should usually position yourself, and which skills you need to develop.' },
    { type: 'checklist', items: [
      'Your role tells you what your team should be able to expect from you.',
      'Your role changes what ‘good performance’ looks like. A Support and an Entry should not be judged in exactly the same way.',
      'Good teams have players who understand both their own job and the jobs around them.',
      'Roles can overlap. One player can have a primary role and a secondary role.',
      'Your role may change depending on the game, map, team strategy, or situation.',
    ] },
    { type: 'callout', label: 'Remember', text: 'The most important question is not ‘What role sounds coolest?’ It is ‘What can I consistently provide to my team, and what do I need to improve to become valuable in that role?’' },
  ],
  keyPoints: [
    'A role is a set of responsibilities, not a badge or a playstyle excuse.',
    'It changes what ‘good performance’ looks like for you.',
    'You can have a primary role and a secondary role — and it can change over time.',
    'The question: what can I consistently provide, and what must I improve to be valuable?',
  ],
  cta: { label: 'Open the Role System — discovery, 7 role guides, readiness', to: '/roadmap/roles' },
  questions: [
    { id: 's5-q1', type: 'scale', short: 'understand my main job', prompt: 'I understand my main job.', options: ['No', 'Partly', 'Mostly', 'Yes'] },
    { id: 's5-q2', type: 'scale', short: 'know what teammates expect', prompt: 'I know what teammates expect.', options: ['No', 'Partly', 'Mostly', 'Yes'] },
    { id: 's5-q3', type: 'scale', short: 'before/during/after fights', prompt: 'I know what to do before, during, and after fights.', options: ['No', 'Partly', 'Mostly', 'Yes'] },
    { id: 's5-q4', type: 'scale', short: 'skills my role requires', prompt: 'I know the skills my role requires.', options: ['No', 'Partly', 'Mostly', 'Yes'] },
    { id: 's5-q5', type: 'scale', short: 'perform the role consistently', prompt: 'I can perform the role consistently.', options: ['No', 'Partly', 'Mostly', 'Yes'] },
    { id: 's5-q6', type: 'scale', short: 'communicate role information', prompt: 'I can communicate role-related information.', options: ['No', 'Partly', 'Mostly', 'Yes'] },
    { id: 's5-q7', type: 'scale', short: 'know my biggest role weakness', prompt: 'I know my biggest role weakness.', options: ['No', 'Partly', 'Mostly', 'Yes'] },
    { id: 's5-q8', type: 'scale', short: 'have a role-specific training plan', prompt: 'I have a role-specific training plan.', options: ['No', 'Partly', 'Mostly', 'Yes'] },
  ],
})

/* ============================================================
   STAGE 6 — BECOME A TEAM PLAYER   (doc lines 290-326)
   ============================================================ */
const S6_COMMUNICATION = section({
  id: 'communication',
  name: 'Communication',
  tagline: 'Giving the right information at the right time.',
  intro:
    'Communication is giving the right information at the right time. Good communication is not talking constantly. It is saying what teammates need.',
  blocks: [
    { type: 'h', id: 'benefits', text: 'Benefits' },
    { type: 'checklist', items: ['Faster decisions', 'Better coordination', 'Better trades', 'Fewer misunderstandings', 'More useful information'] },
    { type: 'h', id: 'improve', text: 'How to Improve' },
    { type: 'p', text: 'Use: What? → Where? → How many? → What are they doing?' },
    { type: 'callout', label: 'Example', text: 'Instead of “BRO BRO BRO ENEMY!”, say “Two enemies, east, behind the rock. One is low.”' },
  ],
  keyPoints: [
    'Good communication is saying what teammates need, not talking constantly.',
    'Use: What? → Where? → How many? → What are they doing?',
    '“Two enemies, east, behind the rock. One is low.” beats “BRO BRO ENEMY!”',
  ],
  questions: [
    { id: 's6c-q1', type: 'text', short: 'two enemies rotating behind teammate', prompt: 'You see two enemies rotating behind your teammate. What do you say?', placeholder: 'Your exact callout…' },
    { id: 's6c-q2', type: 'text', short: 'teammate about to push a backed-up enemy', prompt: 'Your teammate is about to push an enemy backed by another player. What information do you give?', placeholder: 'Your exact callout…' },
    { id: 's6c-q3', type: 'text', short: 'low HP, cannot take the fight', prompt: 'You are low HP and cannot take the next fight. How do you say it?', placeholder: 'Your exact callout…' },
    { id: 's6c-q4', type: 'scale', short: 'quick full callouts', prompt: 'Can you give enemy location, numbers, damage and movement quickly?', options: ['No', 'Some of it', 'Most of it', 'Yes, all of it fast'] },
  ],
})

const S6_TEAMWORK = section({
  id: 'teamwork',
  name: 'Teamwork',
  tagline: 'Making teammates better instead of only trying to make yourself look good.',
  intro:
    'Teamwork means making teammates better instead of only trying to make yourself look good.',
  blocks: [
    { type: 'h', id: 'benefits', text: 'Benefits' },
    { type: 'checklist', items: ['Better trades', 'Better support', 'Better team fights', 'More trust', 'More consistent results'] },
    { type: 'h', id: 'improve', text: 'How to Improve' },
    { type: 'p', text: 'Ask: “What does my team need from me right now?” instead of only “How many kills can I get?”' },
    { type: 'checklist', items: ['Practice trading.', 'Hold useful angles.', 'Follow calls when appropriate.', 'Support with utility/resources.', 'Review team fights, not only kills.'] },
  ],
  keyPoints: [
    'Teamwork = making teammates better, not looking good yourself.',
    'Ask “what does my team need from me right now?”',
    'Practice trading, hold useful angles, review team fights not just kills.',
  ],
  questions: [
    {
      id: 's6t-q1', type: 'scenario', short: 'teammate starts a fight',
      prompt: 'Your teammate starts a fight. What is your first thought?',
      options: ['“Can I get a kill here?”', '“How do I trade / support this?”', '“Not my fight”', '“Wait and see what happens”'],
      guidance: 'The first thought should be how to trade or support the fight your teammate started — not whether there is a kill in it for you.',
    },
    {
      id: 's6t-q2', type: 'scenario', short: 'teammate makes a bad call',
      prompt: 'Your teammate makes a bad call. How do you react?',
      options: ['Argue in the moment', 'Execute it, then discuss it after the round', 'Do my own thing instead', 'Go quiet and play worse'],
      guidance: 'Execute the call in the moment so the team stays together, then discuss it calmly after the round. Splitting off mid-play usually loses the round twice.',
    },
    {
      id: 's6t-q3', type: 'scenario', short: 'kills available vs holding position',
      prompt: 'You can get kills but the team needs you to hold a position. What do you do?',
      options: ['Go for the kills', 'Hold the position — that is the job right now', 'Hold, but leave if it looks quiet', 'Ask the team to hold it instead'],
      guidance: 'Hold the position. The kill is not always yours to take — team value beats personal stats.',
    },
    { id: 's6t-q4', type: 'scale', short: 'playing around teammates', prompt: 'Do you naturally play around teammates or separate from them?', options: ['I separate', 'Mostly separate', 'Mostly together', 'Always around my team'] },
  ],
})

/* ============================================================
   STAGE 7 — TRAIN WITH PURPOSE   (doc lines 327-355)
   ============================================================ */
const S7_TRAINING = section({
  id: 'purposeful-training',
  name: 'Purposeful Training',
  tagline: 'Knowing exactly what you are trying to improve before you start.',
  intro: 'Purposeful training means knowing exactly what you are trying to improve before you start.',
  blocks: [
    { type: 'h', id: 'benefits', text: 'Benefits' },
    { type: 'checklist', items: ['Less wasted time', 'Clearer progress', 'Better focus', 'Faster improvement on weaknesses'] },
    { type: 'h', id: 'improve', text: 'How to Improve' },
    { type: 'checklist', items: [
      'Choose 1–2 priorities per session.',
      'Warm up before matches.',
      'Use drills for mechanics.',
      'Use scenarios for game sense.',
      'Use scrims for team play.',
      'Review after playing.',
      'Write down what you learned.',
    ] },
    { type: 'h', id: 'routine', text: 'Example Training Routine' },
    { type: 'checklist', items: [
      '10 min — Aim / movement warm-up',
      '10 min — Weak mechanical skill',
      '10 min — Fight or game-sense drill',
      '30–60 min — Matches / scrims with a specific focus',
      '10–15 min — Review',
      'Write one mistake and one improvement target',
    ] },
  ],
  keyPoints: [
    'Know what you are improving before you start.',
    'Choose 1–2 priorities per session.',
    'Drills for mechanics, scenarios for game sense, scrims for team play.',
    'Review after playing and write down what you learned.',
  ],
  questions: [
    { id: 's7-q1', type: 'scale', short: 'knowing what you train', prompt: 'Do you know what you are training when you open the game?', options: ['Never', 'Rarely', 'Usually', 'Always'] },
    { id: 's7-q2', type: 'choice', scored: true, short: 'training weaknesses vs comfort', prompt: 'Do you train weaknesses or mostly play what you enjoy?', options: ['Only what I enjoy', 'Mostly what I enjoy', 'A mix', 'Mostly weaknesses'] },
    { id: 's7-q3', type: 'scale', short: 'having a warm-up', prompt: 'Do you have a warm-up?', options: ['No', 'Sometimes', 'Usually', 'Always'] },
    { id: 's7-q4', type: 'scale', short: 'reviewing sessions', prompt: 'Do you review sessions?', options: ['Never', 'Rarely', 'Usually', 'Always'] },
    { id: 's7-q5', type: 'text', short: 'what improved', prompt: 'Can you explain what improved?', placeholder: 'From your last week of training…' },
  ],
})

/* ============================================================
   STAGE 8 — REVIEW & IMPROVE   (doc lines 356-375)
   ============================================================ */
const S8_REVIEW = section({
  id: 'gameplay-review',
  name: 'Gameplay Review',
  tagline: 'Your games contain information about your habits.',
  intro:
    'Your games contain information about your habits. Review helps you understand why fights, decisions, rotations, and mistakes happened.',
  blocks: [
    { type: 'h', id: 'benefits', text: 'Benefits' },
    { type: 'checklist', items: ['Find repeated mistakes', 'Understand decisions', 'Turn games into lessons', 'Stop repeating errors'] },
    { type: 'h', id: 'improve', text: 'How to Improve' },
    { type: 'p', text: 'After important games, answer:' },
    { type: 'checklist', items: [
      'Choke Point — What went wrong?',
      'Strong Point — What worked?',
      'What would I improve?',
      'Why did the mistake happen?',
      'What will I do differently next time?',
    ] },
  ],
  keyPoints: [
    'Your games contain information about your habits.',
    'After important games: Choke Point, Strong Point, What would I improve, Why did the mistake happen, What next.',
    'Review kills as well as deaths.',
    'Change your training after finding a repeated mistake.',
  ],
  cta: { label: 'Open the Gameplay Review form', to: '/roadmap/gameplay-review' },
  questions: [
    { id: 's8-q1', type: 'scale', short: 'explaining your last 3 deaths', prompt: 'Can you explain why you died in your last three deaths?', options: ['No', 'One of them', 'Two of them', 'All three'] },
    { id: 's8-q2', type: 'text', short: 'biggest repeated mistake', prompt: 'Can you identify your biggest repeated mistake?', placeholder: 'Name it…' },
    { id: 's8-q3', type: 'scale', short: 'reviewing kills too', prompt: 'Do you review kills as well as deaths?', options: ['Never', 'Rarely', 'Sometimes', 'Always'] },
    { id: 's8-q4', type: 'scale', short: 'changing training after a review', prompt: 'Do you change training after finding a repeated mistake?', options: ['Never', 'Rarely', 'Usually', 'Always'] },
  ],
})

/* ============================================================
   STAGE 9 — COMPETE   (doc lines 376-425)
   ============================================================ */
const S9_MENTAL = section({
  id: 'mental-strength',
  name: 'Mental Strength',
  tagline: 'Staying focused and making good decisions when things are not going your way.',
  intro:
    'Mental strength is staying focused and making good decisions when things are not going your way.',
  blocks: [
    { type: 'h', id: 'benefits', text: 'Benefits' },
    { type: 'checklist', items: [
      'Better decisions under pressure',
      'Faster recovery after mistakes',
      'Stable communication',
      'Better performance in important matches',
    ] },
    { type: 'h', id: 'improve', text: 'How to Improve' },
    { type: 'p', text: 'Reset → Breathe → Focus → Next Play.' },
    { type: 'checklist', items: [
      'Do not carry the previous fight into the next one.',
      'Focus on the next decision.',
      'Review pressure situations later when calm.',
      'Build routines before important matches.',
    ] },
  ],
  keyPoints: [
    'Mental strength = good decisions when things are going wrong.',
    'Reset → Breathe → Focus → Next Play.',
    'Do not carry the previous fight into the next one.',
    'Review pressure situations later, when calm.',
  ],
  questions: [
    {
      id: 's9m-q1', type: 'scenario', short: 'after two bad games',
      prompt: 'What happens after two bad games?',
      options: ['I keep queuing and it gets worse', 'I get frustrated but push through', 'I take a short break and reset', 'I stop, review calmly, and come back later'],
      guidance: 'After two bad games, stop or take a real break. Queuing tilted turns two bad games into five.',
    },
    { id: 's9m-q2', type: 'scale', short: 'aggression after dying', prompt: 'Do you become more aggressive after dying?', options: ['Every time', 'Often', 'Sometimes', 'No — I stay measured'] },
    { id: 's9m-q3', type: 'scale', short: 'blaming teammates', prompt: 'Do you blame teammates?', options: ['Constantly', 'Often', 'Rarely', 'No'] },
    { id: 's9m-q4', type: 'scale', short: 'staying calm in a clutch', prompt: 'Can you stay calm in a clutch?', options: ['No', 'Rarely', 'Usually', 'Yes'] },
    { id: 's9m-q5', type: 'scale', short: 'resetting after a major mistake', prompt: 'How quickly can you reset after a major mistake?', options: ['It ruins the match', 'Several rounds', 'A round or two', 'Almost instantly'] },
  ],
})

const S9_SCRIMS = section({
  id: 'scrims',
  name: 'Scrims',
  tagline: 'Test your training against stronger players and real team situations.',
  intro: 'Scrims test your training against stronger players and real team situations.',
  blocks: [
    { type: 'h', id: 'benefits', text: 'Benefits' },
    { type: 'checklist', items: ['Team coordination', 'Strategy testing', 'Stronger opponents', 'New weaknesses', 'Competitive habits'] },
    { type: 'h', id: 'improve', text: 'How to Improve' },
    { type: 'checklist', items: [
      'Set a purpose before each scrim.',
      'Focus on role execution, not only kills.',
      'Review team fights.',
      'Track repeated problems.',
      'Change one thing at a time.',
    ] },
  ],
  keyPoints: [
    'Scrims test training against stronger players and real team play.',
    'Set a purpose before each scrim.',
    'Focus on role execution, not only kills.',
    'Change one thing at a time.',
  ],
  cta: { label: 'Open Scrim Preparation', to: '/roadmap/scrim-prep' },
  questions: [
    { id: 's9s-q1', type: 'scale', short: 'scrim experience', prompt: 'Have you played scrims?', options: ['Never', 'A few', 'Regularly', 'Very regularly'] },
    { id: 's9s-q2', type: 'scale', short: 'entering with a goal', prompt: 'Do you enter with a goal?', options: ['Never', 'Rarely', 'Usually', 'Always'] },
    { id: 's9s-q3', type: 'scale', short: 'comms under pressure', prompt: 'Can you communicate under pressure?', options: ['No', 'It slips', 'Mostly', 'Yes'] },
    { id: 's9s-q4', type: 'scale', short: 'reviewing scrims', prompt: 'Do you review scrims?', options: ['Never', 'Rarely', 'Usually', 'Always'] },
    { id: 's9s-q5', type: 'scale', short: 'team follows a plan and adapts', prompt: 'Can the team follow a plan and adapt?', options: ['No', 'Sometimes', 'Usually', 'Yes'] },
  ],
})

const S9_TOURNAMENT = section({
  id: 'compete-readiness',
  name: 'Tournament Readiness',
  tagline: 'Build experience gradually rather than waiting to feel perfectly ready.',
  intro:
    'Competition adds pressure, preparation, expectations, and stronger opponents. Build experience gradually rather than waiting to feel perfectly ready.',
  blocks: [
    { type: 'h', id: 'progression', text: 'Progression' },
    { type: 'p', text: 'Ranked / Competitive Matches → Scrims → Small Tournaments → Bigger Competition.' },
  ],
  keyPoints: [
    'Competition adds pressure, preparation, expectations and stronger opponents.',
    'Build experience gradually — do not wait to feel perfectly ready.',
    'Progression: Ranked → Scrims → Small Tournaments → Bigger Competition.',
  ],
  cta: { label: 'Open Competition Readiness', to: '/roadmap/competition-readiness' },
  questions: [
    { id: 's9t-q1', type: 'scale', short: 'performing your role consistently', prompt: 'Can you perform your role consistently?', options: ['No', 'Sometimes', 'Usually', 'Yes'] },
    { id: 's9t-q2', type: 'scale', short: 'communicating under pressure', prompt: 'Can you communicate under pressure?', options: ['No', 'It slips', 'Mostly', 'Yes'] },
    { id: 's9t-q3', type: 'scale', short: 'following a team plan', prompt: 'Can you follow a team plan?', options: ['No', 'Sometimes', 'Usually', 'Yes'] },
    { id: 's9t-q4', type: 'scale', short: 'recovering after a bad game', prompt: 'Can you recover after a bad game?', options: ['No', 'Slowly', 'Usually', 'Yes'] },
    { id: 's9t-q5', type: 'scale', short: 'reviewing without blaming', prompt: 'Can you review mistakes without blaming others?', options: ['No', 'Sometimes', 'Usually', 'Yes'] },
    { id: 's9t-q6', type: 'scale', short: 'team trusts you to do your job', prompt: 'Can your team trust you to do your job?', options: ['No', 'Sometimes', 'Usually', 'Yes'] },
  ],
})

/* ============================================================
   STAGE 10 — BUILD YOUR FUTURE   (doc lines 426-455)
   ============================================================ */
const S10_TEAM = section({
  id: 'find-build-team',
  name: 'Find & Build Your Team',
  tagline: 'Not just five players with high stats.',
  intro:
    'A strong team is not just five players with high stats. Look for players who share goals, communicate, attend practice, accept criticism, and want to improve.',
  blocks: [
    { type: 'h', id: 'improve', text: 'How to Improve' },
    { type: 'checklist', items: [
      'Set team goals.',
      'Define roles.',
      'Set practice times.',
      'Agree on communication standards.',
      'Review games together.',
      'Track team problems and fix them.',
    ] },
  ],
  keyPoints: [
    'A strong team shares goals, communicates, attends practice, and accepts criticism.',
    'Set team goals, define roles, set practice times.',
    'Agree communication standards and review games together.',
  ],
  cta: { label: 'Open My Team', to: '/team' },
  questions: [
    { id: 's10a-q1', type: 'scale', short: 'same goal', prompt: 'Same goal?', options: ['No', 'Loosely', 'Mostly', 'Yes'] },
    { id: 's10a-q2', type: 'scale', short: 'practice consistently', prompt: 'Can you practice consistently?', options: ['No', 'Rarely', 'Usually', 'Yes'] },
    { id: 's10a-q3', type: 'scale', short: 'give and receive criticism', prompt: 'Can you give and receive criticism?', options: ['No', 'With difficulty', 'Usually', 'Yes'] },
    { id: 's10a-q4', type: 'scale', short: 'players understand roles', prompt: 'Do players understand roles?', options: ['No', 'Some do', 'Mostly', 'Yes'] },
    { id: 's10a-q5', type: 'scale', short: 'team comms under pressure', prompt: 'Can the team communicate under pressure?', options: ['No', 'Sometimes', 'Mostly', 'Yes'] },
  ],
})

const S10_PROGRESS = section({
  id: 'track-progress',
  name: 'Track Your Progress',
  tagline: 'Compare where you started with where you are now. Do not judge yourself from one game.',
  intro:
    'Progress should compare where you started with where you are now. Do not judge yourself from one game.',
  blocks: [
    { type: 'h', id: 'track', text: 'What to track' },
    { type: 'checklist', items: [
      'Training completed',
      'Mechanical improvement',
      'Game-sense improvement',
      'Role performance',
      'Communication',
      'Consistency',
      'Mistakes',
      'Scrim/tournament performance',
    ] },
    { type: 'callout', label: 'Remember', text: 'Use the starting assessment as a baseline and repeat key assessments later to show real change.' },
  ],
  keyPoints: [
    'Compare where you started with where you are now.',
    'Do not judge yourself from one game.',
    'Use the starting assessment as a baseline; repeat key assessments to show real change.',
  ],
  cta: { label: 'Open the Progress Report', to: '/roadmap/progress-report' },
  questions: [
    { id: 's10b-q1', type: 'scale', short: 'repeating baseline assessments', prompt: 'Do you repeat key assessments to measure change over time?', options: ['Never', 'Once', 'Occasionally', 'Regularly'] },
    { id: 's10b-q2', type: 'text', short: 'change since you started', prompt: 'What has changed since you started tracking?', placeholder: 'Compare then vs now…' },
  ],
})

const S10_KEEP = section({
  id: 'keep-improving',
  name: 'Keep Improving',
  tagline: 'There is no final point where you are finished.',
  intro:
    'There is no final point where you are finished. Fixing one weakness usually reveals another. The goal is not perfection. The goal is continuous improvement.',
  blocks: [
    { type: 'quote', text: 'Train. Track. Review. Improve. Compete.' },
  ],
  keyPoints: [
    'There is no final point where you are finished.',
    'Fixing one weakness usually reveals another.',
    'The goal is not perfection. The goal is continuous improvement.',
    'Train. Track. Review. Improve. Compete.',
  ],
  questions: [
    { id: 's10c-q1', type: 'text', short: 'your next priority', prompt: 'What is your next priority?', placeholder: 'The one thing to focus on next…' },
  ],
})

/* ============================================================
   THE 10 STAGES
   ============================================================ */
export const ROADMAP_STAGES = [
  {
    id: 'know-yourself',
    order: 1,
    title: 'Know Yourself',
    description: 'Understand what it takes and find your starting point.',
    icon: '🧭',
    xpReward: 150,
    comingSoon: false,
    sections: [S1_OVERVIEW, ...S1_AREA_LINKS],
  },
  {
    id: 'build-your-foundation',
    order: 2,
    title: 'Build Your Foundation',
    description: 'Discipline, consistency, training and learning.',
    icon: '🧱',
    xpReward: 200,
    comingSoon: false,
    sections: [S2_DISCIPLINE, S2_CONSISTENCY, S2_TRAINING, S2_LEARNING],
  },
  {
    id: 'master-your-mechanics',
    order: 3,
    title: 'Master Your Mechanics',
    description: 'Aim, movement, recoil, peeking and range fighting.',
    icon: '🎯',
    xpReward: 250,
    comingSoon: false,
    sections: [S3_MECHANICS],
  },
  {
    id: 'develop-game-sense',
    order: 4,
    title: 'Develop Game Sense',
    description: 'Read the game and pick your best next option.',
    icon: '🧠',
    xpReward: 250,
    comingSoon: false,
    sections: [S4_GAMESENSE],
  },
  {
    id: 'find-your-role',
    order: 5,
    title: 'Find Your Role',
    description: 'The job you perform for your team.',
    icon: '🧩',
    xpReward: 300,
    comingSoon: false,
    sections: [S5_ROLE],
  },
  {
    id: 'play-as-a-team',
    order: 6,
    title: 'Become a Team Player',
    description: 'Communication and teamwork.',
    icon: '🤝',
    xpReward: 300,
    comingSoon: false,
    sections: [S6_COMMUNICATION, S6_TEAMWORK],
  },
  {
    id: 'train-with-purpose',
    order: 7,
    title: 'Train With Purpose',
    description: 'Know what you are improving before you start.',
    icon: '🏋️',
    xpReward: 350,
    comingSoon: false,
    sections: [S7_TRAINING],
  },
  {
    id: 'review-and-improve',
    order: 8,
    title: 'Review & Improve',
    description: 'Turn your games into lessons.',
    icon: '🔍',
    xpReward: 350,
    comingSoon: false,
    sections: [S8_REVIEW],
  },
  {
    id: 'compete',
    order: 9,
    title: 'Compete',
    description: 'Mental strength, scrims and tournament readiness.',
    icon: '🏆',
    xpReward: 400,
    comingSoon: false,
    sections: [S9_MENTAL, S9_SCRIMS, S9_TOURNAMENT],
  },
  {
    id: 'build-your-career',
    order: 10,
    title: 'Build Your Future',
    description: 'Build a team, track progress, keep improving.',
    icon: '🚀',
    xpReward: 500,
    comingSoon: false,
    sections: [S10_TEAM, S10_PROGRESS, S10_KEEP],
  },
]

export const ROADMAP_TOTAL_STAGES = ROADMAP_STAGES.length
export const ROADMAP_TOTAL_XP = ROADMAP_STAGES.reduce((s, x) => s + x.xpReward, 0)

/* ============================================================
   HELPERS
   ============================================================ */
export function getStageConfig(stageId) {
  return ROADMAP_STAGES.find(s => s.id === stageId) || null
}

/** Sections in a stage that have real, answerable questions. */
export function readySections(stage) {
  if (!stage?.sections) return []
  return stage.sections.filter(s => s.status === 'ready' && s.questions?.length)
}

/** Flat count of questions across all READY sections of a stage. */
export function countReadyQuestions(stage) {
  return readySections(stage).reduce((n, s) => n + s.questions.length, 0)
}

/** Every section entry in a stage (ready + area-links) — for the sidebar. */
export function allSectionMeta(stage) {
  if (!stage?.sections) return []
  return stage.sections.map(s => ({ id: s.id, name: s.name, status: s.status }))
}

/**
 * Pull a section's real "How to Improve" checklist straight out of its
 * authored content blocks (the heading id 'improve' followed by a
 * checklist / checklist-detailed block) — used by the Result and Improve
 * phases for "What To Do Next" / "Train This" so those lists are always the
 * section's own real content, never a separate invented list.
 * Returns [] for sections with no 'improve' heading (e.g. Stage 1's
 * overview, whose next step comes from the scoring engine's Priority Focus
 * instead) — callers should fall back to recommendedFocus in that case.
 */
export function extractImproveItems(section, max = 4) {
  const blocks = section?.content?.blocks || []
  const idx = blocks.findIndex(b => b.type === 'h' && b.id === 'improve')
  if (idx === -1) return []
  const items = []
  for (let i = idx + 1; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.type === 'h') break
    if (b.type === 'checklist') items.push(...b.items)
    else if (b.type === 'checklist-detailed') items.push(...b.items.map(it => it.text))
  }
  return items.slice(0, max)
}

/** No draft content remains anywhere in the roadmap. */
export function listRoadmapDrafts() {
  return { totalSections: 0, totalQuestions: 0, sections: [] }
}
