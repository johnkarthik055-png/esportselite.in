/*
 * roadmapDays.js — "THE 30-DAY CHALLENGE" (doc lines 456-486).
 *
 * Day labels and objectives are VERBATIM from the content document. This is
 * a motivational pace guide only — it has ZERO gating power. A day's
 * completion is DERIVED from real stage/section progress; calendar time is
 * irrelevant; being ahead or behind changes nothing.
 *
 *   target.kind:
 *     'stage-phase'   { stageId, phase }   open a stage at a phase
 *     'stage-section' { stageId, sectionId }  open a stage, focus a section
 *     'stage'         { stageId }
 *     'app'           { to, appLabel, openMatchLogger? }
 */

export const JOURNEY_TOTAL_DAYS = 30

export const ROADMAP_DAYS = [
  { day: 1,  label: 'Understand the esports journey', objective: 'Read the introduction and set your goal.',
    target: { kind: 'stage-phase', stageId: 'know-yourself', phase: 'content' } },
  { day: 2,  label: 'Starting assessment', objective: 'Complete your player baseline.',
    target: { kind: 'stage-phase', stageId: 'know-yourself', phase: 'assessment' } },
  { day: 3,  label: 'Mechanical assessment', objective: 'Test close, mid, long range, movement and weapon handling.',
    target: { kind: 'stage-section', stageId: 'master-your-mechanics', sectionId: 'game-mechanics' } },
  { day: 4,  label: 'Game-sense assessment', objective: 'Complete decision-making scenarios.',
    target: { kind: 'stage-section', stageId: 'develop-game-sense', sectionId: 'game-sense' } },
  { day: 5,  label: 'Communication assessment', objective: 'Complete callout scenarios.',
    target: { kind: 'stage-section', stageId: 'play-as-a-team', sectionId: 'communication' } },
  { day: 6,  label: 'Teamwork assessment', objective: 'Complete team-play scenarios.',
    target: { kind: 'stage-section', stageId: 'play-as-a-team', sectionId: 'teamwork' } },
  { day: 7,  label: 'Review your starting point', objective: 'Identify top strengths and weaknesses.',
    target: { kind: 'stage-phase', stageId: 'know-yourself', phase: 'result' } },
  { day: 8,  label: 'Role discovery', objective: 'Complete the role assessment.',
    target: { kind: 'app', to: '/roadmap/roles/discover', appLabel: 'Role Discovery' } },
  { day: 9,  label: 'Learn your role', objective: 'Study primary and secondary roles.',
    target: { kind: 'app', to: '/roadmap/roles', appLabel: 'Role System' } },
  { day: 10, label: 'Role responsibilities', objective: 'Learn what your team expects from your role.',
    target: { kind: 'app', to: '/roadmap/roles', appLabel: 'Role System' } },
  { day: 11, label: 'Build your routine', objective: 'Create your training schedule.',
    target: { kind: 'stage-section', stageId: 'train-with-purpose', sectionId: 'purposeful-training' } },
  { day: 12, label: 'Mechanics training', objective: 'Train your priority mechanical skill.',
    target: { kind: 'app', to: '/training', appLabel: 'Training Center' } },
  { day: 13, label: 'Game-sense training', objective: 'Focus on positioning, timing or decisions.',
    target: { kind: 'app', to: '/training', appLabel: 'Training Center' } },
  { day: 14, label: 'Communication training', objective: 'Practice short, useful callouts.',
    target: { kind: 'app', to: '/training', appLabel: 'Training Center' } },
  { day: 15, label: 'Team-play training', objective: 'Practice trades, support and team positioning.',
    target: { kind: 'app', to: '/training', appLabel: 'Training Center' } },
  { day: 16, label: 'Gameplay review', objective: 'Review recent matches.',
    target: { kind: 'stage-section', stageId: 'review-and-improve', sectionId: 'gameplay-review' } },
  { day: 17, label: 'Find your biggest repeated mistake', objective: 'Find your biggest repeated mistake.',
    target: { kind: 'app', to: '/roadmap/gameplay-review', appLabel: 'Gameplay Review' } },
  { day: 18, label: 'Train the weakness', objective: 'Run focused drills.',
    target: { kind: 'app', to: '/training', appLabel: 'Training Center' } },
  { day: 19, label: 'Test it in matches', objective: 'Test it in matches.',
    target: { kind: 'app', to: '/training', appLabel: 'Training Center' } },
  { day: 20, label: 'Review the result', objective: 'Review the result.',
    target: { kind: 'app', to: '/analytics', appLabel: 'Analytics' } },
  { day: 21, label: 'Consistency check', objective: 'Compare multiple recent games.',
    target: { kind: 'stage-section', stageId: 'build-your-foundation', sectionId: 'consistency' } },
  { day: 22, label: 'Pressure training', objective: 'Practice staying calm after mistakes.',
    target: { kind: 'stage-section', stageId: 'compete', sectionId: 'mental-strength' } },
  { day: 23, label: 'Scrim preparation', objective: 'Set a goal and team plan.',
    target: { kind: 'app', to: '/roadmap/scrim-prep', appLabel: 'Scrim Preparation' } },
  { day: 24, label: 'Play scrims', objective: 'Focus on role execution.',
    target: { kind: 'app', to: '/training', appLabel: 'Match Logger · Scrims', openMatchLogger: true } },
  { day: 25, label: 'Scrim review', objective: 'Review team and individual mistakes.',
    target: { kind: 'app', to: '/roadmap/gameplay-review', appLabel: 'Gameplay Review' } },
  { day: 26, label: 'Team improvement', objective: 'Choose one team issue to fix.',
    target: { kind: 'stage-section', stageId: 'build-your-career', sectionId: 'find-build-team' } },
  { day: 27, label: 'Competition readiness assessment', objective: 'Competition readiness assessment.',
    target: { kind: 'stage-section', stageId: 'compete', sectionId: 'compete-readiness' } },
  { day: 28, label: 'Final skill check', objective: 'Repeat key baseline tests and see what changed.',
    target: { kind: 'app', to: '/roadmap/final-reassessment', appLabel: 'Final Reassessment' } },
  { day: 29, label: 'Build your next plan', objective: 'Choose 2–3 priorities.',
    target: { kind: 'stage-section', stageId: 'build-your-career', sectionId: 'keep-improving' } },
  { day: 30, label: 'Progress report', objective: 'Compare your start with your current level and choose your next step.',
    target: { kind: 'app', to: '/roadmap/progress-report', appLabel: 'Progress Report' } },
]

/* ── pure helpers ────────────────────────────────────────────────── */
export function getDay(n) {
  return ROADMAP_DAYS.find(d => d.day === n) || null
}

export function daysForStage(stageId) {
  return ROADMAP_DAYS.filter(d => d.target?.stageId === stageId)
}

export function describeTarget(target) {
  if (!target) return ''
  switch (target.kind) {
    case 'stage-phase':   return `Stage · ${cap(target.phase)} phase`
    case 'stage-section': return 'Stage · section'
    case 'stage':         return 'Stage'
    case 'app':           return target.appLabel || 'App'
    default:              return ''
  }
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}
