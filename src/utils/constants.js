export const STORAGE_KEYS = {
  USER: 'esportselite_user',
  SESSIONS: 'esportselite_sessions',
  MATCHES: 'esportselite_matches',
  STREAK: 'esportselite_streak',
  AUTH: 'esportselite_auth',
  /** Unified modules (defaults + custom together, seeded on first load). */
  MODULES: 'esportselite_modules',
  /** Legacy — kept only for backwards-compat migration on first load. */
  CUSTOM_MODULES: 'esportselite_custom_modules',
  /** Per-day training session status entries. */
  DAILY_SESSIONS: 'esportselite_daily_sessions',
  /** Per-day match logger session status entries. */
  DAILY_MATCHES: 'esportselite_daily_matches',
  /** Tournament stages (defaults + custom, seeded on first load). */
  TOURNAMENT_STAGES_LIST: 'esportselite_tournament_stages',
  /** User avatar image as base64 string OR null. */
  USER_AVATAR: 'esportselite_user_avatar',
  /** Notification feed. */
  NOTIFICATIONS: 'esportselite_notifications',
  /** Tracked personal best — longest drill duration in seconds. */
  PB_LONGEST_DRILL: 'esportselite_pb_longest_drill',
  /** Weakness / strength suggestion catalog (defaults + custom). */
  SUGGESTIONS: 'esportselite_weakness_strength_suggestions',
  /** Migration flag for match weakness/strength → suggestion-id upgrade. */
  MIGRATION_V2_DONE: 'esportselite_migration_v2_done',
  /** Pending one-time toast message (consumed by Layout on mount). */
  PENDING_TOAST: 'esportselite_pending_toast',
  /** UID-scoped flag — set after onboarding notifications are generated once. */
  NOTIF_INITIALIZED: 'esportselite_notif_initialized',
}

/* ----------------------------------------------------------
   STATUS COLOR PALETTE (calendar dots, badges)
---------------------------------------------------------- */
export const STATUS_COLORS = {
  completed: '#00E676',
  incomplete: '#FFD700',
  not_completed: '#FF3D44',
  in_progress: '#4A9EFF',
  not_started: '#4A9EFF',
  future: 'transparent',
}

export const STATUS_LABELS = {
  completed: 'Completed',
  incomplete: 'Incomplete',
  not_completed: 'Not Completed',
  in_progress: 'In Progress',
  not_started: 'Not Started',
  future: '',
}

export const SESSION_MOODS = [
  { id: 'tough', label: 'Tough', emoji: '😤' },
  { id: 'average', label: 'Average', emoji: '😐' },
  { id: 'on_fire', label: 'On Fire', emoji: '🔥' },
]

export const MATCH_PERFORMANCES = [
  { id: 'bad', label: 'Bad', emoji: '😤' },
  { id: 'decent', label: 'Decent', emoji: '😐' },
  { id: 'great', label: 'Great', emoji: '🔥' },
]

/* ----------------------------------------------------------
   CATEGORIZED WEAPON CATALOG
   Used by the new WeaponPicker (max 2 selection).
---------------------------------------------------------- */
export const WEAPON_CATEGORIES = [
  {
    id: 'AR',
    label: 'Assault Rifles',
    short: 'AR',
    weapons: ['AKM', 'M416', 'SCAR-L', 'M762', 'Beryl M762', 'Groza', 'QBZ95', 'G36C', 'AUG A3', 'M16A4', 'Mk47 Mutant'],
  },
  {
    id: 'SMG',
    label: 'Submachine Guns',
    short: 'SMG',
    weapons: ['UMP45', 'MP5K', 'PP-19 Bizon', 'Vector', 'Thompson', 'Micro UZI'],
  },
  {
    id: 'DMR',
    label: 'Designated Marksman Rifles',
    short: 'DMR',
    weapons: ['MK12', 'SKS', 'SLR', 'Mini14', 'QBU', 'VSS'],
  },
  {
    id: 'SR',
    label: 'Sniper Rifles',
    short: 'SR',
    weapons: ['KAR98k', 'M24', 'AWM', 'Lynx AMR', 'Mosin Nagant'],
  },
  {
    id: 'SG',
    label: 'Shotguns',
    short: 'SG',
    weapons: ['S12K', 'S1897', 'S686', 'DBS', 'O12'],
  },
  {
    id: 'PISTOL',
    label: 'Pistols',
    short: 'Pistol',
    weapons: ['P18C', 'P1911', 'R45', 'Deagle', 'P92', 'R1895'],
  },
  {
    id: 'LMG',
    label: 'Light Machine Guns',
    short: 'LMG',
    weapons: ['M249', 'DP-28', 'MG3'],
  },
  {
    id: 'MISC',
    label: 'Misc / Special',
    short: 'Misc',
    weapons: ['Crossbow', 'Flare Gun', 'Panzerfaust'],
  },
]

/* Backwards-compat flat lists (kept for any legacy imports). */
export const PRIMARY_GUNS = WEAPON_CATEGORIES
  .filter(c => ['AR', 'DMR', 'SR'].includes(c.id))
  .flatMap(c => c.weapons)

export const SECONDARY_GUNS = WEAPON_CATEGORIES
  .filter(c => ['SMG', 'SG', 'PISTOL'].includes(c.id))
  .flatMap(c => c.weapons)

/* ----------------------------------------------------------
   DEFAULT TRAINING MODULES
   All modules now show the weapon picker.
---------------------------------------------------------- */
export const MODULES = [
  {
    id: 'ads',
    name: 'ADS — Aim Down Sight',
    short: 'ADS',
    description: 'Precision scoped aiming drills for competitive play.',
    icon: '🎯',
    drills: [
      { id: 'ads-iron', name: 'Iron Sight ADS', description: 'Train no-scope iron sight accuracy at close range.' },
      { id: 'ads-2x', name: '2x Scope ADS', description: 'Red dot / 2x scope target acquisition.' },
      { id: 'ads-3x', name: '3x Scope ADS', description: 'Medium range 3x precision practice.' },
      { id: 'ads-4x', name: '4x Scope ADS', description: 'Mid-range 4x burst targeting drills.' },
      { id: 'ads-6x', name: '6x Scope ADS', description: 'Long range 6x scope tracking and lead.' },
      { id: 'ads-8x', name: '8x Scope ADS', description: 'Sniper-grade 8x precision shots.' },
      { id: 'ads-switch', name: 'Target Switching', description: 'Quickly swap aim between multiple targets.' },
      { id: 'ads-flick', name: 'Flick Shot', description: 'Rapid flick-to-target snap aiming.' },
    ],
  },
  {
    id: 'spray',
    name: 'Spray Training',
    short: 'Spray',
    description: 'Recoil control and sustained fire accuracy.',
    icon: '🔥',
    drills: [
      { id: 'spray-3', name: '3x Burst & Spray', description: 'Controlled 3-bullet burst pattern training.' },
      { id: 'spray-4', name: '4x Burst & Spray', description: '4-bullet burst recoil management.' },
      { id: 'spray-6', name: '6x Burst & Spray', description: 'Extended 6-bullet sustained spray drill.' },
      { id: 'spray-transfer', name: 'Aim Transfer', description: 'Transfer aim mid-spray across multiple enemies.' },
    ],
  },
  {
    id: 'car',
    name: 'Car Spray',
    short: 'Car Spray',
    description: 'Lead and track moving vehicles effectively.',
    icon: '🚗',
    drills: [
      { id: 'car-scopes', name: 'All Scopes — Moving Vehicle Track', description: 'Track moving vehicles across scope variants.' },
      { id: 'car-burst', name: 'Burst Fire on Vehicle', description: 'Disable vehicles with controlled burst fire.' },
      { id: 'car-predict', name: 'Predictive Aim on Vehicle', description: 'Lead targets predictively at high speeds.' },
    ],
  },
  {
    id: 'close',
    name: 'Close Range',
    short: 'Close Range',
    description: 'TDM, classic fights, and clutch situation mastery.',
    icon: '⚔️',
    drills: [
      { id: 'close-joy', name: 'Joystick Practice', description: 'Strafe and movement joystick control.' },
      { id: 'close-cross', name: 'Crosshair Placement', description: 'Pre-aim crosshair at common angles.' },
      { id: 'close-trace', name: 'Tracing', description: 'Smooth target tracing while strafing.' },
      { id: 'close-jiggle', name: 'Jiggle Tracing', description: 'Track jiggle-peeking opponents.' },
      { id: 'close-peek', name: 'Peek & Fire', description: 'Wide-peek and pre-fire mastery.' },
      { id: 'close-hip', name: 'Hipfire Control', description: 'Hipfire accuracy at point-blank range.' },
    ],
  },
]

/** Canonical seed used by useModules() on first load + Restore Defaults. */
export const DEFAULT_MODULE_SEED = MODULES

/* ----------------------------------------------------------
   AVAILABLE EMOJI ICONS FOR CUSTOM MODULES
---------------------------------------------------------- */
export const MODULE_ICON_OPTIONS = [
  '🎯', '⚔️', '🔥', '💀', '🎮', '⚡', '🚀', '🏹',
  '💥', '🌪️', '🛡️', '⭐', '🎪', '⚙️', '🏆', '⏱️',
  '📊', '💎', '🎲', '🔫', '🥷', '🧠',
]

/* ----------------------------------------------------------
   MATCH LOGGER OPTIONS
---------------------------------------------------------- */
export const MAPS_CLASSIC = ['Erangel', 'Miramar', 'Rondo', 'Livik', 'Nusa']
export const MAPS_SCRIMS = ['Erangel', 'Miramar', 'Rondo']

/** Legacy flat list — kept for scrims/tournament where Solo vs Squad isn't relevant. */
export const TEAM_SIZES = ['Solo', 'Duo', 'Squad']

/**
 * Classic-match team size options. Object form so we can keep
 * a serializable `id` distinct from the display label.
 */
export const CLASSIC_TEAM_SIZES = [
  { id: 'Solo', label: 'Solo' },
  { id: 'Duo', label: 'Duo' },
  { id: 'Squad', label: 'Squad' },
  { id: 'solo_vs_squad', label: 'Solo vs Squad' },
]

/** Human-readable label for a saved Classic team-size id (handles legacy values). */
export function teamSizeLabel(id) {
  const found = CLASSIC_TEAM_SIZES.find(x => x.id === id)
  return found ? found.label : id || ''
}

/** Default seed for tournament stages (initialised on first load). */
export const DEFAULT_TOURNAMENT_STAGES = [
  { id: 'stage-group', name: 'Group Stage' },
  { id: 'stage-qf', name: 'Quarter Finals' },
  { id: 'stage-sf', name: 'Semi Finals' },
  { id: 'stage-finals', name: 'Finals' },
  { id: 'stage-grand', name: 'Grand Finals' },
  { id: 'stage-league', name: 'League Day' },
  { id: 'stage-qualifier', name: 'Qualifier' },
]

export const MATCH_TYPES = ['Classic', 'Scrims', 'Tournament']

/* ----------------------------------------------------------
   SUGGESTION CATEGORIES (weakness / strength catalog)
---------------------------------------------------------- */
export const SUGGESTION_CATEGORIES = [
  { name: 'Aim & Precision', icon: '🎯', linkedModuleId: 'ads' },
  { name: 'Recoil & Spray',  icon: '💥', linkedModuleId: 'spray' },
  { name: 'Vehicle Combat',  icon: '🚗', linkedModuleId: 'car' },
  { name: 'Close Range',     icon: '⚔',  linkedModuleId: 'close' },
  { name: 'Game Sense',      icon: '🧠', linkedModuleId: null },
  { name: 'Team Play',       icon: '👥', linkedModuleId: null },
  { name: 'Survival',        icon: '🛡', linkedModuleId: null },
  { name: 'Custom',          icon: '🛠', linkedModuleId: null },
]

/* Default seeded suggestion items. */
export const DEFAULT_SUGGESTIONS = [
  /* AIM & PRECISION → ADS */
  { id: 'sug-long-range-spray',  name: 'Long range spray',       category: 'Aim & Precision', icon: '🎯', linkedModuleId: 'ads' },
  { id: 'sug-mid-range-shots',   name: 'Mid range shots',        category: 'Aim & Precision', icon: '🎯', linkedModuleId: 'ads' },
  { id: 'sug-iron-sight',        name: 'Iron sight accuracy',    category: 'Aim & Precision', icon: '🎯', linkedModuleId: 'ads' },
  { id: 'sug-scope-flicking',    name: 'Scope flicking',         category: 'Aim & Precision', icon: '🎯', linkedModuleId: 'ads' },
  { id: 'sug-target-switching',  name: 'Target switching',       category: 'Aim & Precision', icon: '🎯', linkedModuleId: 'ads' },
  { id: 'sug-first-bullet',      name: 'First bullet placement', category: 'Aim & Precision', icon: '🎯', linkedModuleId: 'ads' },

  /* RECOIL & SPRAY → Spray Training */
  { id: 'sug-vertical-recoil',   name: 'Vertical recoil control',   category: 'Recoil & Spray', icon: '💥', linkedModuleId: 'spray' },
  { id: 'sug-horizontal-recoil', name: 'Horizontal recoil control', category: 'Recoil & Spray', icon: '💥', linkedModuleId: 'spray' },
  { id: 'sug-6x-spray',          name: '6x scope spray',            category: 'Recoil & Spray', icon: '💥', linkedModuleId: 'spray' },
  { id: 'sug-4x-spray',          name: '4x scope spray',            category: 'Recoil & Spray', icon: '💥', linkedModuleId: 'spray' },
  { id: 'sug-burst-control',     name: 'Burst control',             category: 'Recoil & Spray', icon: '💥', linkedModuleId: 'spray' },
  { id: 'sug-recoil-reset',      name: 'Recoil reset',              category: 'Recoil & Spray', icon: '💥', linkedModuleId: 'spray' },

  /* VEHICLE COMBAT → Car Spray */
  { id: 'sug-moving-vehicles',   name: 'Shooting moving vehicles', category: 'Vehicle Combat', icon: '🚗', linkedModuleId: 'car' },
  { id: 'sug-lead-vehicles',     name: 'Lead aim on vehicles',     category: 'Vehicle Combat', icon: '🚗', linkedModuleId: 'car' },
  { id: 'sug-tire-shots',        name: 'Tire shots',               category: 'Vehicle Combat', icon: '🚗', linkedModuleId: 'car' },
  { id: 'sug-driver-shots',      name: 'Driver shots',             category: 'Vehicle Combat', icon: '🚗', linkedModuleId: 'car' },

  /* CLOSE RANGE → Close Range */
  { id: 'sug-crosshair-placement', name: 'Crosshair placement', category: 'Close Range', icon: '⚔', linkedModuleId: 'close' },
  { id: 'sug-hipfire',             name: 'Hipfire accuracy',    category: 'Close Range', icon: '⚔', linkedModuleId: 'close' },
  { id: 'sug-jiggle-peek',         name: 'Jiggle peek timing',  category: 'Close Range', icon: '⚔', linkedModuleId: 'close' },
  { id: 'sug-wide-swing',          name: 'Wide swing',          category: 'Close Range', icon: '⚔', linkedModuleId: 'close' },
  { id: 'sug-tight-angle',         name: 'Tight angle holds',   category: 'Close Range', icon: '⚔', linkedModuleId: 'close' },
  { id: 'sug-knife',               name: 'Knife/melee fights',  category: 'Close Range', icon: '⚔', linkedModuleId: 'close' },

  /* GAME SENSE */
  { id: 'sug-rotations',         name: 'Rotations',                       category: 'Game Sense', icon: '🧠', linkedModuleId: null },
  { id: 'sug-zone-prediction',   name: 'Zone prediction',                 category: 'Game Sense', icon: '🧠', linkedModuleId: null },
  { id: 'sug-decision-pressure', name: 'Decision making under pressure',  category: 'Game Sense', icon: '🧠', linkedModuleId: null },
  { id: 'sug-map-awareness',     name: 'Map awareness',                   category: 'Game Sense', icon: '🧠', linkedModuleId: null },
  { id: 'sug-sound-reading',     name: 'Sound reading',                   category: 'Game Sense', icon: '🧠', linkedModuleId: null },

  /* TEAM PLAY */
  { id: 'sug-callouts',    name: 'Callouts clarity',         category: 'Team Play', icon: '👥', linkedModuleId: null },
  { id: 'sug-squad-sync',  name: 'Squad sync',               category: 'Team Play', icon: '👥', linkedModuleId: null },
  { id: 'sug-clutch',      name: 'Clutch composure',         category: 'Team Play', icon: '👥', linkedModuleId: null },
  { id: 'sug-revives',     name: 'Revives under fire',       category: 'Team Play', icon: '👥', linkedModuleId: null },
  { id: 'sug-util',        name: 'Util usage (smokes/grenades)', category: 'Team Play', icon: '👥', linkedModuleId: null },

  /* SURVIVAL */
  { id: 'sug-late-zones', name: 'Positioning in late zones', category: 'Survival', icon: '🛡', linkedModuleId: null },
  { id: 'sug-loot-mgmt',  name: 'Loot management',           category: 'Survival', icon: '🛡', linkedModuleId: null },
  { id: 'sug-healing',    name: 'Healing efficiency',        category: 'Survival', icon: '🛡', linkedModuleId: null },
  { id: 'sug-endgame',    name: 'Endgame placement',         category: 'Survival', icon: '🛡', linkedModuleId: null },
]
