/*
 * roadmapTraining.js — maps a Roadmap weak area to the REAL, EXISTING
 * Training Center taxonomy (src/utils/constants.js: SUGGESTION_CATEGORIES /
 * DEFAULT_SUGGESTIONS) so the "Improve" phase can point at real drills
 * without building a parallel drill system inside Roadmap.
 *
 * Training.jsx already supports deep-linking to a specific module via
 * `/training?focus=<moduleId>` (see focusModuleId in Training.jsx) — we
 * reuse that, we do not invent a new navigation mechanism.
 */
import { SUGGESTION_CATEGORIES, DEFAULT_SUGGESTIONS } from './constants.js'

/* Stage-3's per-area rollup names -> the real category they best match.
   (Stage 3's own "Mechanical Areas" list: Close Range, Mid Range, Long
   Range, Aim, Movement, Recoil Control, Peeking, Weapon Handling, Utility,
   Clutching — matched against the Training Center's real categories.) */
const AREA_TO_CATEGORY = {
  'Close Range':     'Close Range',
  'Mid Range':       'Aim & Precision',
  'Long Range':      'Aim & Precision',
  'Aim':             'Aim & Precision',
  'Movement':        'Close Range',
  'Recoil Control':  'Recoil & Spray',
  'Peeking':         'Close Range',
  'Weapon Handling': 'Recoil & Spray',
  'Utility':         'Survival',
  'Clutching':       'Survival',
}

/* Fallback: roadmap section id -> real category, for stages that don't have
   a per-area breakdown (only Stage 3 does). `null` = no direct mechanical
   category match — those stages get a generic Training Center link instead
   of a wrong one. */
const SECTION_TO_CATEGORY = {
  'game-mechanics':   'Aim & Precision',
  'game-sense':        'Game Sense',
  communication:       'Team Play',
  teamwork:            'Team Play',
  scrims:              'Team Play',
  'find-build-team':   'Team Play',
  'compete-readiness': 'Survival',
}

/**
 * @param sectionId  the weakest scored section's id
 * @param areaName   optional — the weakest per-area label (Stage 3 only)
 * @returns { categoryName, icon, focusModuleId, drills[] } — drills are the
 *          real DEFAULT_SUGGESTIONS entries for that category (2-4 shown).
 *          categoryName is null when there's no direct mechanical match —
 *          callers should fall back to a plain Training Center link.
 */
export function getTrainingRecommendation({ sectionId, areaName } = {}) {
  const categoryName =
    (areaName && AREA_TO_CATEGORY[areaName]) ||
    SECTION_TO_CATEGORY[sectionId] ||
    null

  const categoryMeta = SUGGESTION_CATEGORIES.find(c => c.name === categoryName) || null
  const drills = categoryName
    ? DEFAULT_SUGGESTIONS.filter(s => s.category === categoryName).slice(0, 4)
    : []

  return {
    categoryName,
    icon: categoryMeta?.icon || '🎯',
    focusModuleId: categoryMeta?.linkedModuleId || null,
    drills,
  }
}

/** Build the actual /training URL for a recommendation. */
export function trainingUrl(rec) {
  return rec?.focusModuleId ? `/training?focus=${rec.focusModuleId}` : '/training'
}
