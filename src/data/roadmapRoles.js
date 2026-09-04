/*
 * roadmapRoles.js — "THE ROAD TO ESPORTS" · Role System.
 *
 * ALL text in this file is taken VERBATIM from Karthik's final content
 * document ("THE ROAD TO ESPORTS — Complete Player Development Content").
 * There is no draft content and no `draft` flag anywhere in the roadmap.
 *
 * Where the document spells something out for one role only (the Role Result
 * example is written out for Entry Fragger), the equivalent field for the
 * other six roles is assembled from that role's OWN verbatim lists — no new
 * prose is invented.
 *
 * Scoring is deterministic and rule-based — see utils/roleScoring.js. No AI.
 */

/* ── "What is a Role?" (stage-level intro, doc line 185-186) ─────────── */
export const WHAT_IS_A_ROLE =
  'A role is the job you perform for your team. It describes what you are ' +
  'responsible for, what skills you need, how you should play, and what ' +
  'teammates expect from you. A role is not just a label.'

/* ── "What a Role Really Means" (doc lines 525-532) ─────────────────── */
export const WHAT_A_ROLE_REALLY_MEANS = {
  intro:
    'A role is not a badge, title, or excuse for a certain playstyle. A role ' +
    'is a set of responsibilities. It tells you what your team needs from ' +
    'you, what decisions you should be good at, where you should usually ' +
    'position yourself, and which skills you need to develop.',
  points: [
    'Your role tells you what your team should be able to expect from you.',
    'Your role changes what ‘good performance’ looks like. A Support and an Entry should not be judged in exactly the same way.',
    'Good teams have players who understand both their own job and the jobs around them.',
    'Roles can overlap. One player can have a primary role and a secondary role.',
    'Your role may change depending on the game, map, team strategy, or situation.',
    'The most important question is not ‘What role sounds coolest?’ It is ‘What can I consistently provide to my team, and what do I need to improve to become valuable in that role?’',
  ],
}

/* ── "Role Fit — What Esports Elite Should Look At" (doc lines 533-540) ── */
export const ROLE_FIT_PROFILES = [
  { id: 'mechanical',  label: 'Mechanical profile', text: 'close, mid and long-range ability; movement; recoil; precision; weapon handling.' },
  { id: 'decision',    label: 'Decision profile',   text: 'fight selection, timing, positioning, information use and adaptability.' },
  { id: 'team',        label: 'Team profile',       text: 'communication, trading, support, following calls and creating space.' },
  { id: 'playstyle',   label: 'Playstyle profile',  text: 'aggressive, patient, tactical, information-focused, supportive or adaptable.' },
  { id: 'mental',      label: 'Mental profile',     text: 'confidence, composure, response to mistakes and performance under pressure.' },
  { id: 'consistency', label: 'Consistency',        text: 'whether the player can repeat the role’s important actions over many games.' },
]
export const ROLE_FIT_NOTE =
  'Role discovery should combine the player’s answers with actual ' +
  'performance data when that data becomes available. A questionnaire can ' +
  'suggest a role fit; it should not pretend to prove that a player is ' +
  'objectively the best possible role.'

/* ============================================================
   THE 7 ROLES
   ------------------------------------------------------------
   card  — the short version (doc lines 187-267) for Role List
   deep  — the deep dive (doc lines 541-783) for Role Detail
   result{} — Team Value / Main Risk / Next Focus / Recommended Training
             (Entry Fragger is verbatim from doc lines 828-836; the other
              six are assembled from that role's own verbatim content)
   weights / playstyle — deterministic role-fit table (roleScoring.js)
   assessment — role-specific readiness quiz
   ============================================================ */
export const ROLES = [
  /* ─────────────────────────── ENTRY FRAGGER ─────────────────────────── */
  {
    id: 'entry-fragger',
    name: 'Entry Fragger',
    icon: '⚔️',
    card: {
      mainJob: 'Create the opening for the team.',
      whatItTakes: ['Close-range mechanics', 'Fast decisions', 'Confidence', 'Movement', 'Space creation', 'Communication'],
      commonMistakes: [
        'Taking every fight because you are aggressive.',
        'Chasing kills instead of creating a good opportunity.',
      ],
    },
    deep: {
      mainJob: 'Create the first meaningful advantage and give the team a way into the fight.',
      whatItDoes: 'Create the first meaningful advantage and give the team a way into the fight.',
      skills: [
        'Strong close-range mechanics',
        'Fast decision making',
        'Movement and peeking',
        'Confidence without recklessness',
        'Timing',
        'Communication',
        'Understanding of trades',
      ],
      howToPlay: [
        { label: 'Before a fight', text: 'confirm teammates are ready, understand the entry route, check available information and communicate the plan.' },
        { label: 'During first contact', text: 'take space, force reactions, create damage or a knock, communicate what you see, and stay within a realistic trade window.' },
        { label: 'After gaining an advantage', text: 'help the team convert it instead of automatically chasing another fight.' },
        { label: 'After losing the first contact', text: 'give information, allow the team to react, disengage when necessary, and avoid turning one mistake into a wipe.' },
      ],
      goodPerformance: ['Creating space', 'Starting fights at the right time', 'Forcing enemy movement', 'Taking smart first contact', 'Making trades possible'],
      commonMistakes: [
        'Running ahead alone',
        'Entering without team readiness',
        'Taking every fight because ‘I’m Entry’',
        'Chasing a knock too far',
        'Ignoring the second player’s position',
        'Confusing aggression with good decision making',
      ],
      howToImprove: [
        'Practice close-range mechanics and movement.',
        'Practice entering with a teammate and measuring whether the trade is possible.',
        'Review the first 10–20 seconds of fights.',
        'Learn to recognize good and bad entry timings.',
        'Train the habit: communicate → enter → create advantage → reset or convert.',
      ],
    },
    result: {
      fitVerbatim: true,
      teamValue: 'Creates space and starts favorable fights',
      mainRisk: 'Overextending before teammates are ready',
      nextFocus: 'Enter only when a realistic trade is available',
      recommendedTraining: 'Close-range drills + entry timing + communication + fight review',
    },
    weights: { mechanical: 1.0, decision: 0.6, team: 0.6, consistency: 0.7 },
    playstyle: { aggressive: 1.0, patient: 0.1, tactical: 0.4, infoFocused: 0.25, supportive: 0.35, adaptable: 0.6 },
    assessment: {
      questions: [
        { id: 'ef-a1', type: 'scale', short: 'entering on a plan', prompt: 'When you push first, how often is it on an agreed plan rather than impulse?', options: ['Rarely — I just go', 'Sometimes', 'Usually', 'Almost always — every entry has a reason'] },
        { id: 'ef-a2', type: 'scale', short: 'staying trade-able', prompt: 'When you go down as Entry, can a teammate usually trade your killer?', options: ['Almost never', 'Sometimes', 'Usually', 'Nearly always — I stay in trade range'] },
        { id: 'ef-a3', type: 'scale', short: 'close-range first contact', prompt: 'How do your close-range first-contact duels go?', options: ['I lose most', 'Roughly 50/50', 'I win more than I lose', 'I win the large majority'] },
        { id: 'ef-a4', type: 'scale', short: 'creating value on a failed entry', prompt: 'When your entry fails, did you still create damage, space, or information?', options: ['Rarely', 'Sometimes', 'Usually', 'Almost always'] },
        { id: 'ef-a5', type: 'scale', short: 'resetting vs chasing', prompt: 'After winning first contact, do you reset with the team or chase the knock?', options: ['I chase', 'I chase more than I should', 'I usually reset', 'I always reset and re-establish'] },
      ],
    },
  },

  /* ─────────────────────────── ASSAULTER / FRAGGER ─────────────────────────── */
  {
    id: 'assaulter',
    name: 'Assaulter / Fragger',
    icon: '🔫',
    card: {
      mainJob: 'Win fights and apply pressure.',
      whatItTakes: ['Gun skill', 'Positioning', 'Recoil control', 'Fight selection', 'Capitalizing on openings'],
      commonMistakes: [
        'Measuring the role only by kills.',
        'Taking fights that do not help the team.',
      ],
    },
    deep: {
      mainJob: 'Provide reliable fighting power and convert openings into kills, damage and pressure.',
      whatItDoes: 'Provide reliable fighting power and convert openings into kills, damage and pressure.',
      skills: ['Strong gun skill', 'Recoil control', 'Positioning', 'Fight selection', 'Trading', 'Target selection', 'Fast reactions'],
      howToPlay: [
        { label: 'Before a fight', text: 'identify where the Entry is going and position so you can follow or trade.' },
        { label: 'During a fight', text: 'capitalize on damaged or exposed enemies, hold useful angles, apply pressure and prevent the enemy from resetting.' },
        { label: 'When the team has an advantage', text: 'help secure it without unnecessarily overextending.' },
        { label: 'When the team is disadvantaged', text: 'look for a favorable fight, trade opportunity or safe reset rather than forcing a hero play.' },
      ],
      goodPerformance: ['Converting advantages', 'Reliable trades', 'Punishing enemy mistakes', 'Holding pressure', 'Winning important fights'],
      commonMistakes: ['Chasing kills', 'Leaving the team', 'Taking isolated fights', 'Ignoring the Entry’s timing', 'Playing for personal stats instead of team value'],
      howToImprove: [
        'Practice trading and target switching.',
        'Review whether kills happened at useful moments.',
        'Train recoil, movement and mid-range fighting.',
        'Practice holding pressure without overextending.',
        'Measure both fight impact and unnecessary deaths.',
      ],
    },
    result: {
      teamValue: 'Converts advantages and wins important fights',
      mainRisk: 'Playing for personal stats instead of team value',
      nextFocus: 'Take fights that help the team, at the Entry’s timing',
      recommendedTraining: 'Trading and target switching + recoil and mid-range fighting + fight-impact review',
    },
    weights: { mechanical: 1.0, decision: 0.65, team: 0.6, consistency: 0.7 },
    playstyle: { aggressive: 0.85, patient: 0.3, tactical: 0.5, infoFocused: 0.3, supportive: 0.45, adaptable: 0.6 },
    assessment: {
      questions: [
        { id: 'as-a1', type: 'scale', short: 'trading the entry', prompt: 'When your Entry takes a fight, how fast do you trade?', options: ['I am usually elsewhere', 'Slowly — a few seconds late', 'Within 1–2 seconds most times', 'Instantly, nearly every time'] },
        { id: 'as-a2', type: 'scale', short: 'fight impact', prompt: 'Do your kills usually happen at useful moments for the team?', options: ['Rarely — mostly stat-padding', 'Sometimes', 'Usually', 'Almost always — they move the round forward'] },
        { id: 'as-a3', type: 'scale', short: 'over-pushing', prompt: 'How often do you push past what the team can follow?', options: ['Every fight', 'Often', 'Occasionally', 'Rarely — I match the team’s depth'] },
        { id: 'as-a4', type: 'scale', short: 'recoil and mid-range', prompt: 'How reliable is your recoil control and mid-range fighting?', options: ['Weak', 'Inconsistent', 'Solid', 'A clear strength'] },
        { id: 'as-a5', type: 'scale', short: 'reading the Entry’s timing', prompt: 'Do you position off the Entry’s route and timing?', options: ['No — I do my own thing', 'Sometimes', 'Usually', 'Always — I play off the Entry'] },
      ],
    },
  },

  /* ─────────────────────────── IGL ─────────────────────────── */
  {
    id: 'igl',
    name: 'IGL — In-Game Leader',
    icon: '🧠',
    card: {
      mainJob: 'Make decisions and guide the team.',
      whatItTakes: ['Game sense', 'Map knowledge', 'Decision making', 'Communication', 'Reading opponents', 'Calmness', 'Leadership'],
      commonMistakes: [
        'Thinking you must be the best aimer.',
        'Making unclear calls or changing plans without reason.',
      ],
    },
    deep: {
      mainJob: 'Turn information into clear team decisions and keep the team moving toward a win condition.',
      whatItDoes: 'Turn information into clear team decisions and keep the team moving toward a win condition.',
      skills: ['Game sense', 'Map knowledge', 'Decision making', 'Information processing', 'Clear communication', 'Calmness', 'Adaptability', 'Leadership'],
      howToPlay: [
        { label: 'Before a fight', text: 'evaluate information, numbers, terrain, resources, zone/position and possible enemy reactions.' },
        { label: 'During a fight', text: 'maintain the bigger picture, update the plan when information changes, and make clear calls.' },
        { label: 'After a fight', text: 'decide whether to reset, loot, rotate, reposition or pressure.' },
        { label: 'When the plan fails', text: 'accept the new situation quickly and give the team a new simple plan.' },
      ],
      goodPerformance: ['Giving direction', 'Choosing when to fight', 'Choosing when to disengage', 'Managing rotations', 'Reading opponents', 'Keeping communication clear under pressure'],
      commonMistakes: ['Overcalling every tiny action', 'Changing calls constantly', 'Making emotional decisions', 'Blaming teammates', 'Ignoring new information', 'Giving calls that are too vague to act on'],
      howToImprove: [
        'Study maps and common rotations.',
        'Review major decisions, not just deaths.',
        'Practice making one clear call at a time.',
        'Learn your team’s strengths and weaknesses.',
        'After each match ask: what information did we have, what did we choose, and what would we change?',
      ],
    },
    result: {
      teamValue: 'Gives direction and keeps the team moving toward a win condition',
      mainRisk: 'Making emotional decisions or giving calls too vague to act on',
      nextFocus: 'Make one clear call at a time and update it only when information changes',
      recommendedTraining: 'Map and rotation study + major-decision review + one-call-at-a-time practice',
    },
    weights: { mechanical: 0.45, decision: 1.0, team: 0.9, consistency: 0.85 },
    playstyle: { aggressive: 0.4, patient: 0.6, tactical: 1.0, infoFocused: 0.85, supportive: 0.6, adaptable: 0.8 },
    assessment: {
      questions: [
        { id: 'igl-a1', type: 'scale', short: 'having a plan', prompt: 'At the start of each phase, does the team have a plan and a fallback?', options: ['Almost never', 'Sometimes', 'Usually', 'Every phase'] },
        { id: 'igl-a2', type: 'scale', short: 'call clarity', prompt: 'Are your calls clear enough to act on without a follow-up question?', options: ['Rarely', 'Sometimes', 'Usually', 'Almost always'] },
        { id: 'igl-a3', type: 'scale', short: 'one call at a time', prompt: 'Do you make one clear call at a time, or overcall every action?', options: ['I overcall constantly', 'Often too much', 'Mostly one at a time', 'Always one clear call'] },
        { id: 'igl-a4', type: 'scale', short: 'adapting to new info', prompt: 'When new information appears mid-round, how well do you adjust the plan?', options: ['I stick to the old plan', 'I hesitate', 'I adjust within a few seconds', 'I re-call instantly and the team follows'] },
        { id: 'igl-a5', type: 'scale', short: 'composure under pressure', prompt: 'Do you keep communication clear when it is going wrong?', options: ['No — I tilt or go quiet', 'It slips noticeably', 'Mostly holds', 'Yes — calm and clear under pressure'] },
      ],
    },
  },

  /* ─────────────────────────── SUPPORT ─────────────────────────── */
  {
    id: 'support',
    name: 'Support',
    icon: '🛡️',
    card: {
      mainJob: 'Help teammates succeed.',
      whatItTakes: ['Utility', 'Covering', 'Resources', 'Setup', 'Information', 'Team awareness'],
      commonMistakes: [
        'Playing too passively.',
        'Helping too late or ignoring what teammates need.',
      ],
    },
    deep: {
      mainJob: 'Increase the team’s chances of success by enabling teammates through utility, positioning, information, resources and timely help.',
      whatItDoes: 'Increase the team’s chances of success by enabling teammates through utility, positioning, information, resources and timely help.',
      skills: ['Game awareness', 'Utility knowledge', 'Communication', 'Positioning', 'Patience', 'Resource management', 'Reliable mechanics'],
      howToPlay: [
        { label: 'Before a fight', text: 'prepare the resources and positioning that the team needs.' },
        { label: 'During a fight', text: 'support the Entry, cover teammates, use utility with a purpose, watch important angles and be ready to trade.' },
        { label: 'After a fight', text: 'help the team reset, share resources, check threats and prepare for the next engagement.' },
        { label: 'When a teammate is under pressure', text: 'understand whether they need cover, utility, information, a trade or time to reset.' },
      ],
      goodPerformance: ['Enabling teammates', 'Making fights easier', 'Protecting advantages', 'Covering weaknesses', 'Keeping the team organized'],
      commonMistakes: ['Playing so far behind that support arrives late', 'Being passive because of the word ‘support’', 'Wasting utility', 'Ignoring teammates’ needs', 'Sacrificing yourself when a safer support option exists'],
      howToImprove: [
        'Practice utility timing.',
        'Review whether your support arrived before or after it was needed.',
        'Practice playing close enough to trade.',
        'Learn common team setups.',
        'Track successful support actions, not only kills.',
      ],
    },
    result: {
      teamValue: 'Enables teammates and makes fights easier',
      mainRisk: 'Playing so far behind that support arrives late',
      nextFocus: 'Play close enough to trade, and time utility to land before it is needed',
      recommendedTraining: 'Utility timing + trade positioning + team setups + support-action tracking',
    },
    weights: { mechanical: 0.55, decision: 0.75, team: 1.0, consistency: 0.8 },
    playstyle: { aggressive: 0.25, patient: 0.75, tactical: 0.65, infoFocused: 0.6, supportive: 1.0, adaptable: 0.7 },
    assessment: {
      questions: [
        { id: 'sup-a1', type: 'scale', short: 'utility timing', prompt: 'How well-timed is your utility in a fight?', options: ['Usually too early or too late', 'Hit or miss', 'On time most fights', 'Consistently exactly when needed'] },
        { id: 'sup-a2', type: 'scale', short: 'trade positioning', prompt: 'Are you positioned close enough to trade whoever takes first contact?', options: ['Rarely — I play too far back', 'Sometimes', 'Usually', 'Almost always'] },
        { id: 'sup-a3', type: 'scale', short: 'reading teammate needs', prompt: 'Do you correctly read whether a teammate needs cover, utility, info, a trade or time?', options: ['Rarely', 'Sometimes', 'Usually', 'Almost always'] },
        { id: 'sup-a4', type: 'scale', short: 'not being passive', prompt: 'Do you play an active enabling role, or hang back because of the word ‘support’?', options: ['Too passive', 'Often passive', 'Mostly active', 'Actively enabling every fight'] },
        { id: 'sup-a5', type: 'scale', short: 'resource management', prompt: 'Do your teammates run out of ammo, heals or utility while you have spare?', options: ['Often', 'Sometimes', 'Rarely', 'Never — I manage the squad’s resources'] },
      ],
    },
  },

  /* ─────────────────────────── SCOUT / INFORMATION PLAYER ─────────────────────────── */
  {
    id: 'scout',
    name: 'Scout / Information Player',
    icon: '👁️',
    card: {
      mainJob: 'Find useful information for the team.',
      whatItTakes: ['Map awareness', 'Movement', 'Positioning', 'Communication', 'Rotation awareness'],
      commonMistakes: [
        'Risking your life for low-value information.',
        'Keeping information to yourself.',
      ],
    },
    deep: {
      mainJob: 'Collect useful information and bring it back to the team so decisions can be made with less uncertainty.',
      whatItDoes: 'Collect useful information and bring it back to the team so decisions can be made with less uncertainty.',
      skills: ['Map awareness', 'Movement', 'Positioning', 'Risk management', 'Communication', 'Enemy prediction'],
      howToPlay: [
        { label: 'Before a fight', text: 'identify what information the team is missing.' },
        { label: 'During scouting', text: 'gather high-value information while avoiding unnecessary exposure.' },
        { label: 'After finding information', text: 'communicate it clearly and quickly.' },
        { label: 'When information changes', text: 'update the team rather than continuing with an outdated plan.' },
      ],
      goodPerformance: ['Finding enemy positions', 'Spotting rotations', 'Identifying weak areas', 'Warning about threats', 'Giving the IGL better information'],
      commonMistakes: ['Scouting without a purpose', 'Going too far from the team', 'Dying for low-value information', 'Finding information but failing to communicate it', 'Calling old information as if it is still current'],
      howToImprove: [
        'Practice identifying what information is actually useful.',
        'Review scouting deaths and ask whether the information was worth the risk.',
        'Train short, precise callouts.',
        'Learn common enemy routes and positions.',
      ],
    },
    result: {
      teamValue: 'Gives the IGL better information and warns about threats early',
      mainRisk: 'Dying for low-value information, or finding information but failing to communicate it',
      nextFocus: 'Gather only high-value information, from angles that do not cost you your life',
      recommendedTraining: 'Useful-information practice + scouting-death review + short precise callouts + enemy route study',
    },
    weights: { mechanical: 0.5, decision: 0.9, team: 0.8, consistency: 0.75 },
    playstyle: { aggressive: 0.35, patient: 0.65, tactical: 0.7, infoFocused: 1.0, supportive: 0.6, adaptable: 0.7 },
    assessment: {
      questions: [
        { id: 'sc-a1', type: 'scale', short: 'seeing threats early', prompt: 'How often do you spot a threat before it turns into a fight?', options: ['Rarely', 'Sometimes', 'Usually', 'Almost always — the team rarely gets surprised'] },
        { id: 'sc-a2', type: 'scale', short: 'call accuracy', prompt: 'How accurate are your position calls?', options: ['Often wrong', 'Roughly half right', 'Usually right', 'Almost always right, and I flag guesses'] },
        { id: 'sc-a3', type: 'scale', short: 'keeping info current', prompt: 'Do you update the team when information changes, or call it once?', options: ['One call then silent', 'A couple of updates', 'Regular updates', 'Continuous — the picture is always current'] },
        { id: 'sc-a4', type: 'scale', short: 'surviving to scout', prompt: 'How often do you die first while gathering information?', options: ['Very often', 'Fairly often', 'Occasionally', 'Rarely — I get info from safe angles'] },
        { id: 'sc-a5', type: 'scale', short: 'purposeful scouting', prompt: 'Do you scout with a clear purpose (what the team is missing)?', options: ['No — I just wander', 'Sometimes', 'Usually', 'Always — I know what I am looking for'] },
      ],
    },
  },

  /* ─────────────────────────── SNIPER / LONG-RANGE PLAYER ─────────────────────────── */
  {
    id: 'sniper',
    name: 'Sniper / Long-Range Player',
    icon: '🎯',
    card: {
      mainJob: 'Control long-range areas and punish exposed enemies.',
      whatItTakes: ['Long-range aim', 'Patience', 'Positioning', 'Target selection', 'Communication'],
      commonMistakes: [
        'Shooting every target.',
        'Giving away position for low-value shots.',
      ],
    },
    deep: {
      mainJob: 'Control distance, punish exposure, create pressure and provide long-range information or damage.',
      whatItDoes: 'Control distance, punish exposure, create pressure and provide long-range information or damage.',
      skills: ['Precision aim', 'Patience', 'Target selection', 'Positioning', 'Map knowledge', 'Communication', 'Awareness of close-range threats'],
      howToPlay: [
        { label: 'Before a fight', text: 'choose useful angles and understand escape routes.' },
        { label: 'During a fight', text: 'prioritize high-value targets, punish exposure and avoid unnecessary shots that give away your position.' },
        { label: 'After firing', text: 'consider whether to reposition, hold, support the team or prepare for a new angle.' },
        { label: 'When enemies close distance', text: 'adapt rather than staying committed to the long-range plan.' },
      ],
      goodPerformance: ['Holding important angles', 'Punishing rotations', 'Creating pressure', 'Providing damage before close fights', 'Controlling space'],
      commonMistakes: ['Shooting every target', 'Staying exposed', 'Chasing damage numbers', 'Ignoring team position', 'Failing to reposition after being spotted', 'Becoming disconnected from close-range fights'],
      howToImprove: [
        'Practice precision and target selection.',
        'Review whether each shot had a purpose.',
        'Practice repositioning after revealing your angle.',
        'Learn when holding fire creates more value than shooting.',
      ],
    },
    result: {
      teamValue: 'Controls space, punishes rotations and creates pressure at range',
      mainRisk: 'Becoming disconnected from close-range fights and failing to reposition after being spotted',
      nextFocus: 'Only take shots that have a purpose, then reposition',
      recommendedTraining: 'Precision and target selection + per-shot purpose review + repositioning practice',
    },
    weights: { mechanical: 0.8, decision: 0.7, team: 0.5, consistency: 0.7 },
    playstyle: { aggressive: 0.3, patient: 1.0, tactical: 0.65, infoFocused: 0.7, supportive: 0.4, adaptable: 0.5 },
    assessment: {
      questions: [
        { id: 'sn-a1', type: 'scale', short: 'long-range accuracy', prompt: 'How reliable are your shots at long range?', options: ['I rarely connect', 'Body shots sometimes', 'Consistent body shots, some knocks', 'Regular knocks and headshots'] },
        { id: 'sn-a2', type: 'scale', short: 'shot purpose', prompt: 'Does each shot you take have a clear purpose?', options: ['I shoot everything', 'Often not', 'Usually', 'Always — no wasted shots'] },
        { id: 'sn-a3', type: 'scale', short: 'repositioning after firing', prompt: 'Do you reposition after revealing your angle?', options: ['No — I hold the peek', 'Sometimes', 'Usually', 'Every time'] },
        { id: 'sn-a4', type: 'scale', short: 'staying connected to the team', prompt: 'How often are you contributing nothing at range while the team fights close?', options: ['Often', 'Sometimes', 'Rarely', 'Almost never — I adapt or move in'] },
        { id: 'sn-a5', type: 'scale', short: 'angle selection', prompt: 'Are the angles you hold ones the enemy is forced to deal with?', options: ['Rarely — I watch dead space', 'Sometimes', 'Usually', 'Almost always'] },
      ],
    },
  },

  /* ─────────────────────────── FLEX PLAYER ─────────────────────────── */
  {
    id: 'flex',
    name: 'Flex Player',
    icon: '🔀',
    card: {
      mainJob: 'Adapt to what the team needs.',
      whatItTakes: ['Multiple skills', 'Adaptability', 'Game sense', 'Communication', 'Role understanding'],
      commonMistakes: [
        'Being average at everything.',
        'Never developing a strong primary role.',
      ],
    },
    deep: {
      mainJob: 'Fill different responsibilities while keeping enough depth to be reliable.',
      whatItDoes: 'Fill different responsibilities while keeping enough depth to be reliable.',
      skills: ['Strong fundamentals', 'Multiple role skills', 'Adaptability', 'Game sense', 'Communication', 'Consistency'],
      howToPlay: [
        { label: 'Before a game', text: 'understand what the team currently needs from you.' },
        { label: 'During a match', text: 'switch responsibilities when the situation or strategy requires it.' },
        { label: 'After a change', text: 'communicate the new responsibility so teammates know what to expect.' },
        { label: 'Throughout', text: 'maintain a strong primary role so flexibility does not become lack of specialization.' },
      ],
      goodPerformance: ['Filling team gaps', 'Adapting strategy', 'Covering absences', 'Changing responsibilities without breaking team structure'],
      commonMistakes: ['Trying to do everything', 'Having no primary strength', 'Changing playstyle randomly', 'Using flexibility as an excuse for inconsistent performance'],
      howToImprove: [
        'Choose a primary role and one or two useful secondary responsibilities.',
        'Train each secondary role deliberately.',
        'Review whether switching roles actually helped the team.',
        'Practice adapting without abandoning fundamentals.',
      ],
    },
    result: {
      teamValue: 'Fills team gaps and covers absences without breaking team structure',
      mainRisk: 'Having no primary strength — being average at everything',
      nextFocus: 'Pick a primary role and one or two secondaries, and train each deliberately',
      recommendedTraining: 'Primary-role depth + deliberate secondary-role training + role-switch review',
    },
    weights: { mechanical: 0.8, decision: 0.8, team: 0.8, consistency: 0.85 },
    playstyle: { aggressive: 0.5, patient: 0.5, tactical: 0.6, infoFocused: 0.55, supportive: 0.6, adaptable: 1.0 },
    assessment: {
      questions: [
        { id: 'fx-a1', type: 'scale', short: 'reading the team’s need', prompt: 'How well do you read what the team needs from you each game?', options: ['I do not — I play my way', 'Sometimes', 'Usually', 'Fast and accurately'] },
        { id: 'fx-a2', type: 'scale', short: 'depth of roles', prompt: 'How many roles are you a genuine strength in (not just passable)?', options: ['Zero', 'One', 'Two', 'Three or more'] },
        { id: 'fx-a3', type: 'scale', short: 'communicating switches', prompt: 'Do you clearly communicate when you switch responsibilities?', options: ['Rarely', 'Sometimes', 'Usually', 'Always'] },
        { id: 'fx-a4', type: 'scale', short: 'fundamentals when filling', prompt: 'Do your fundamentals hold up when you fill a different role?', options: ['They dip a lot', 'Noticeable dip', 'Mostly hold', 'Rock solid in any role'] },
        { id: 'fx-a5', type: 'scale', short: 'flex helping the team', prompt: 'When you switch roles, does it actually help the team?', options: ['Rarely', 'Sometimes', 'Usually', 'Almost always'] },
      ],
    },
  },
]

/* ============================================================
   ROLE DISCOVERY ASSESSMENT — deep version (doc lines 797-825)
   ------------------------------------------------------------
   "Esports Elite should combine different question types so the
    result is not based on one self-rating."
   ============================================================ */
export const DISCOVERY_GROUPS = [
  {
    id: 'mechanical',
    title: '1. Mechanical questions',
    questions: [
      { id: 'd-mech-1', type: 'scale', category: 'mechanical', prompt: 'How strong are you in close-range fights?', options: ['Weak', 'Below average', 'Solid', 'A clear strength'] },
      { id: 'd-mech-2', type: 'scale', category: 'mechanical', prompt: 'How strong are you at long range?', options: ['Weak', 'Below average', 'Solid', 'A clear strength'] },
      { id: 'd-mech-3', type: 'scale', category: 'mechanical', prompt: 'How comfortable are you taking first contact?', options: ['Very uncomfortable', 'Hesitant', 'Comfortable', 'I want it'] },
      { id: 'd-mech-4', type: 'scale', category: 'mechanical', prompt: 'How reliable are your movement and recoil control?', options: ['Unreliable', 'Inconsistent', 'Solid', 'A clear strength'] },
      { id: 'd-mech-5', type: 'scale', category: 'mechanical', prompt: 'How quickly can you switch between utility and weapon?', options: ['Slow', 'Below average', 'Quick', 'Instant'] },
    ],
  },
  {
    id: 'decision',
    title: '2. Decision questions',
    questions: [
      { id: 'd-dec-1', type: 'scale', category: 'decision', prompt: 'Do you naturally look for information before committing?', options: ['Never', 'Rarely', 'Usually', 'Always'] },
      { id: 'd-dec-2', type: 'scale', category: 'decision', reverse: true, prompt: 'How often do you take fights without knowing where teammates are?', options: ['Constantly', 'Often', 'Occasionally', 'Rarely'] },
      { id: 'd-dec-3', type: 'scale', category: 'decision', prompt: 'Can you change your decision when new information appears?', options: ['No — I commit', 'With difficulty', 'Usually', 'Instantly'] },
      { id: 'd-dec-4', type: 'choice', category: 'decision', trait: { 'Making calls': 'tactical', 'Executing a plan': 'supportive' }, prompt: 'Do you prefer making calls or executing a plan?', options: ['Executing a plan', 'A bit of both', 'Making calls'] },
    ],
  },
  {
    id: 'team',
    title: '3. Team questions',
    questions: [
      { id: 'd-team-1', type: 'scale', category: 'team', trait: 'aggressive-trade', prompt: 'Do you naturally look for trades?', options: ['Never', 'Rarely', 'Usually', 'Always'] },
      { id: 'd-team-2', type: 'scale', category: 'team', trait: 'infoFocused', prompt: 'Do teammates rely on you for information?', options: ['Never', 'Rarely', 'Sometimes', 'Yes, consistently'] },
      { id: 'd-team-3', type: 'scale', category: 'team', trait: 'supportive', prompt: 'Do you enjoy supporting teammates?', options: ['Not at all', 'A little', 'Yes', 'It is my favourite part'] },
      { id: 'd-team-4', type: 'scale', category: 'team', trait: 'tactical', prompt: 'Are you comfortable leading under pressure?', options: ['No', 'Somewhat', 'Yes', 'Very'] },
      { id: 'd-team-5', type: 'scale', category: 'team', trait: 'adaptable', prompt: 'Can you accept a call you disagree with and still execute it?', options: ['No', 'Reluctantly', 'Usually', 'Always'] },
    ],
  },
  {
    id: 'scenario',
    title: '4. Scenario questions',
    questions: [
      {
        id: 'd-scn-1', type: 'scenario', category: 'decision',
        prompt: 'Your Entry gets heavy damage but is forced back. What is your response?',
        options: ['Push in immediately to finish the fight', 'Trade the damage, then re-establish with the team', 'Hold and give information while the team resets', 'Disengage and reset the round'],
        trait: ['aggressive', 'aggressive-trade', 'supportive', 'patient'],
        guidance: 'Trade the damage where the trade is realistic, otherwise give information and let the team reset — do not turn one mistake into a wipe.',
      },
      {
        id: 'd-scn-2', type: 'scenario', category: 'decision',
        prompt: 'You are holding a long-range angle and an enemy exposes themselves, but your team is rotating. Do you shoot? Why?',
        options: ['Shoot — free damage is free damage', 'Shoot only if it does not reveal my angle before the rotation is safe', 'Hold — the rotation matters more than the shot', 'Call the enemy and let the IGL decide'],
        trait: ['aggressive', 'patient', 'patient', 'infoFocused'],
        guidance: 'A shot that reveals your position and endangers the rotation is usually not worth it — the rotation matters more than low-value damage.',
      },
      {
        id: 'd-scn-3', type: 'scenario', category: 'team',
        prompt: 'Your team has no information about the next area. What should happen before committing?',
        options: ['Just push — speed beats info', 'Someone scouts a safe angle first', 'Use utility to clear the most dangerous spot', 'Hold and listen before deciding'],
        trait: ['aggressive', 'infoFocused', 'tactical', 'patient'],
        guidance: 'Gather information from a safe angle or clear the most dangerous spot with utility before committing a full team push blind.',
      },
      {
        id: 'd-scn-4', type: 'scenario', category: 'team',
        prompt: 'Your teammate is isolated and under pressure. What options can you provide?',
        options: ['Push to them and fight', 'Cover / utility / info / a trade / time to reset — whichever they need', 'Call for them to disengage', 'Focus on my own fight'],
        trait: ['aggressive', 'supportive', 'infoFocused', 'aggressive'],
        guidance: 'Read what they actually need — cover, utility, information, a trade, or simply time — rather than defaulting to one answer.',
      },
      {
        id: 'd-scn-5', type: 'scenario', category: 'decision',
        prompt: 'The IGL’s plan fails. What should the team do next?',
        options: ['Keep forcing the original plan', 'Accept the new situation quickly and follow a new simple plan', 'Everyone plays for themselves', 'Wait and see what the enemy does'],
        trait: ['aggressive', 'adaptable', 'aggressive', 'patient'],
        guidance: 'Accept the new situation quickly and give the team a new, simple plan — hesitation and freelancing lose more rounds than the failed plan did.',
      },
    ],
  },
  {
    id: 'consistency',
    title: '5. Consistency questions',
    questions: [
      { id: 'd-con-1', type: 'scale', category: 'consistency', prompt: 'Can you perform your role over 5–10 games?', options: ['No', 'Some games', 'Most games', 'Every game'] },
      { id: 'd-con-2', type: 'scale', category: 'consistency', reverse: true, prompt: 'Do your role responsibilities disappear when you have a bad game?', options: ['Completely', 'Often', 'Sometimes', 'No — I hold the role'] },
      { id: 'd-con-3', type: 'scale', category: 'consistency', prompt: 'Do you still communicate when you are losing?', options: ['I go silent', 'Less than usual', 'Mostly', 'Always'] },
    ],
  },
]

export const DISCOVERY_QUESTIONS = DISCOVERY_GROUPS.flatMap(g => g.questions)

/* ── Short discovery (doc lines 268-278) kept for reference / quick mode ── */
export const DISCOVERY_SHORT_QUESTIONS = [
  'How strong is your close-range fighting?',
  'How strong is your long-range fighting?',
  'How confident are you taking first contact?',
  'Do you naturally look for information before fighting?',
  'Do you enjoy making calls?',
  'Do you prefer following a plan or creating it?',
  'Do you naturally support teammates?',
  'Do you enjoy creating space for others?',
  'Can you adapt when the plan stops working?',
  'How comfortable are you communicating under stress?',
]

/* ── Role Result example (doc lines 279-280 short, 826-837 deep) ──────── */
export const ROLE_RESULT_EXAMPLE = {
  primary: 'Entry Fragger',
  secondary: 'Assaulter',
  fit: 'Strong',
  strengths: 'Close-range mechanics, movement, fast decisions',
  needsWork: 'Fight selection, patience, pre-entry communication',
  teamValue: 'Creates space and starts favorable fights',
  mainRisk: 'Overextending before teammates are ready',
  nextFocus: 'Enter only when a realistic trade is available',
  recommendedTraining: 'Close-range drills + entry timing + communication + fight review',
}
export const ROLE_RESULT_NOTE =
  'The result should explain the ‘why’. Players should understand why ' +
  'Esports Elite suggested the role and what they need to do to become ' +
  'better at it.'

/* ── Role Readiness Levels (doc lines 838-843) — VERBATIM ─────────────── */
export const ROLE_READINESS_LEVELS = [
  { key: 'exploring',   label: 'Exploring',   min: 0,  max: 30,  def: 'You understand the role but need more evidence and practice.' },
  { key: 'developing',  label: 'Developing',  min: 31, max: 55,  def: 'You can perform some responsibilities but still have clear weaknesses.' },
  { key: 'ready',       label: 'Ready',       min: 56, max: 80,  def: 'You can perform the important responsibilities consistently in normal competitive situations.' },
  { key: 'competitive', label: 'Competitive', min: 81, max: 100, def: 'You can perform the role reliably under stronger opponents and pressure while helping the team win.' },
]
export const ROLE_READINESS_NOTE =
  'These levels describe role readiness, not a promise of professional status.'

/* ── Role Readiness Checklist (doc lines 281-289) — VERBATIM ──────────── */
export const ROLE_READINESS_CHECKLIST = [
  'I understand my main job.',
  'I know what teammates expect.',
  'I know what to do before, during, and after fights.',
  'I know the skills my role requires.',
  'I can perform the role consistently.',
  'I can communicate role-related information.',
  'I know my biggest role weakness.',
  'I have a role-specific training plan.',
]

/* ── Role Interaction (doc lines 784-791) — VERBATIM ──────────────────── */
export const ROLE_INTERACTION = {
  intro:
    'Roles are strongest when they connect. A team should not think of roles ' +
    'as seven separate jobs. They are parts of the same system.',
  flows: [
    'Entry creates the opening → Fragger converts it → Support enables it → IGL directs it.',
    'Scout provides information → IGL turns it into a decision → the team executes it.',
    'Sniper controls distance and punishes exposure → Entry and Fragger can use the pressure to move closer.',
    'Flex fills whatever responsibility is missing and helps the team adapt.',
  ],
  closing: [
    'The best teams understand the space between roles: who is trading whom, who is watching the flank, who is giving information, and who is making the final call.',
    'A role is successful when it improves the team’s chances of winning, not simply when the individual player looks good.',
  ],
}

/* ── Before / During / After role responsibility check (doc lines 792-796) ── */
export const ROLE_BDA_CHECK = {
  before: 'Where are my teammates? What is my job in the next situation? What information do I have? What does the team need?',
  during: 'Am I doing my role? Am I communicating? Am I helping the current play rather than chasing my own play?',
  after: 'Did my action help? What went well? What went wrong? What should I change next time?',
  note: 'This three-part check can be built directly into Esports Elite’s role lessons and post-match reviews.',
}

/* ── Role Training Loop (doc lines 844-853) — VERBATIM ────────────────── */
export const ROLE_TRAINING_LOOP = [
  'Discover the player’s likely role.',
  'Teach the role and its responsibilities.',
  'Assess the player’s understanding and current ability.',
  'Identify the biggest role-specific weakness.',
  'Create a focused training task.',
  'Use the role in real matches or scrims.',
  'Review role execution, not only kills.',
  'Re-assess after a period of practice.',
  'Update the role profile as the player develops.',
]

/* ── Role Review Template (doc lines 854-866) — VERBATIM ──────────────── */
export const ROLE_REVIEW_TEMPLATE = [
  'Role I played:',
  'My main responsibility:',
  'Did I do my job? Why/why not?',
  'Strong Point:',
  'Choke Point:',
  'Best decision I made:',
  'Worst decision I made:',
  'Where did communication help?',
  'Where did I fail my teammate?',
  'What will I change next session?',
  'One role-specific skill I will train:',
]

/* ── ROLE IS NOT PERMANENT (doc lines 867-869) — VERBATIM ─────────────── */
export const ROLE_NOT_PERMANENT = {
  body:
    'A player’s role can change as their skills develop. A player who ' +
    'starts as a strong Fragger may discover that their decision making and ' +
    'communication make them a strong IGL candidate later. A Support player ' +
    'may develop into a Flex. A player should not feel trapped by the first ' +
    'role Esports Elite gives them.',
  system:
    'The system should therefore show a Primary Role, Secondary Role, Role ' +
    'Strengths, Role Weaknesses, and Role Development Path rather than ' +
    'treating the role as a permanent identity.',
}

/* ── Role Education — final player message (doc lines 870-874) — VERBATIM ── */
export const ROLE_FINAL_MESSAGE = [
  'Your role is what your team can trust you to do.',
  'You do not need to be the best player on the team. You need to understand your job, perform it consistently, communicate with your teammates, and keep improving.',
  'The goal is not to find the role that sounds the best. The goal is to find where you can create the most value — and then train until you can do it consistently.',
  'Understand your role. Own your responsibility. Make your teammates better. Then become harder to replace.',
]

/* ============================================================
   HELPERS
   ============================================================ */
export function getRole(roleId) {
  return ROLES.find(r => r.id === roleId) || null
}

export function roleAssessmentSection(roleId) {
  const role = getRole(roleId)
  if (!role) return null
  return {
    id: `role-${roleId}`,
    name: `${role.name} — Role Assessment`,
    questions: role.assessment.questions,
  }
}

/* No draft content remains in the role system. */
export function listRoleDrafts() {
  return []
}
