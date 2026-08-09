/**
 * Curated BGMI loadouts shown in the "Recommended Loadouts" tab.
 * Each entry combines a weapon name + the attachments and a one-line
 * pro tip for context.
 */
export const bgmiLoadouts = [
  {
    id: 'm416-beginner-spray',
    name: 'M416 Beginner Spray',
    weapon: 'M416',
    bestFor: 'Beginners / Classic / Scrims',
    attachments: [
      { name: '3x Scope (adjusted) or 6x', icon: '🔭' },
      { name: 'Compensator AR', icon: '🔇' },
      { name: 'Vertical Foregrip', icon: '✋' },
      { name: 'Extended Quickdraw Magazine AR', icon: '📦' },
      { name: 'Tactical Stock', icon: '🔩' },
    ],
    tip: 'Best stable AR setup for learning mid-range sprays.',
  },
  {
    id: 'm416-aggressive',
    name: 'M416 Aggressive Close-Mid',
    weapon: 'M416',
    bestFor: 'Close-mid pushes',
    attachments: [
      { name: 'Red Dot Sight', icon: '🔭' },
      { name: 'Compensator AR or Flash Hider AR', icon: '🔇' },
      { name: 'Thumbgrip', icon: '✋' },
      { name: 'Extended Quickdraw Magazine AR', icon: '📦' },
      { name: 'Tactical Stock', icon: '🔩' },
    ],
    tip: 'Good for fast ADS and close-mid fights.',
  },
  {
    id: 'm762-recoil-control',
    name: 'M762 Recoil Control',
    weapon: 'Beryl M762',
    bestFor: 'Players with recoil practice',
    attachments: [
      { name: 'Red Dot Sight or 2x Scope', icon: '🔭' },
      { name: 'Compensator AR', icon: '🔇' },
      { name: 'Vertical Foregrip', icon: '✋' },
      { name: 'Extended Quickdraw Magazine AR', icon: '📦' },
    ],
    tip: 'M762 has high recoil — use only with recoil practice.',
  },
  {
    id: 'scarl-stable-spray',
    name: 'SCAR-L Stable Spray',
    weapon: 'SCAR-L',
    bestFor: 'Mid-range fights',
    attachments: [
      { name: '3x Scope', icon: '🔭' },
      { name: 'Compensator AR', icon: '🔇' },
      { name: 'Halfgrip or Vertical Foregrip', icon: '✋' },
      { name: 'Extended Quickdraw Magazine AR', icon: '📦' },
    ],
    tip: 'Stable 5.56 AR for mid-range.',
  },
  {
    id: 'ump45-close',
    name: 'UMP45 Close Range',
    weapon: 'UMP45',
    bestFor: 'Close range / beginners',
    attachments: [
      { name: 'Red Dot Sight', icon: '🔭' },
      { name: 'Compensator SMG', icon: '🔇' },
      { name: 'Vertical Foregrip or Halfgrip', icon: '✋' },
      { name: 'Extended Quickdraw Magazine SMG', icon: '📦' },
    ],
    tip: 'Very beginner-friendly close range weapon.',
  },
  {
    id: 'vector-rush',
    name: 'Vector Rush Setup',
    weapon: 'Vector',
    bestFor: 'Aggressive rushers',
    attachments: [
      { name: 'Red Dot Sight', icon: '🔭' },
      { name: 'Compensator SMG', icon: '🔇' },
      { name: 'Thumbgrip', icon: '✋' },
      { name: 'Extended Quickdraw Magazine SMG', icon: '📦' },
      { name: 'Tactical Stock', icon: '🔩' },
    ],
    tip: 'Extended magazine is very important for Vector.',
  },
  {
    id: 'mini14-long-tap',
    name: 'Mini14 Long Range Tap',
    weapon: 'Mini14',
    bestFor: 'Long-range DMR tapping',
    attachments: [
      { name: '6x Scope or 8x Scope', icon: '🔭' },
      { name: 'Compensator Sniper', icon: '🔇' },
      { name: 'Extended Quickdraw Magazine Sniper', icon: '📦' },
    ],
    tip: 'Best for fast long-range tapping.',
  },
  {
    id: 'sks-dmr-control',
    name: 'SKS DMR Control',
    weapon: 'SKS',
    bestFor: 'Mid-long DMR fights',
    attachments: [
      { name: '4x Scope or 6x Scope', icon: '🔭' },
      { name: 'Compensator Sniper', icon: '🔇' },
      { name: 'Lightweight Grip', icon: '✋' },
      { name: 'Extended Quickdraw Magazine Sniper', icon: '📦' },
      { name: 'Cheek Pad (DMR, SR)', icon: '🔩' },
    ],
    tip: 'Use taps, not spray.',
  },
  {
    id: 'sniper-stealth',
    name: 'Sniper Stealth Setup',
    weapon: 'M24 / Kar98k / AWM',
    weapons: ['M24', 'Kar98k', 'AWM'],
    bestFor: 'Stealth long-range picks',
    attachments: [
      { name: '8x Scope', icon: '🔭' },
      { name: 'Suppressor Sniper', icon: '🔇' },
      { name: 'Cheek Pad or Bullet Loops Sniper', icon: '🔩' },
    ],
    tip: 'Best for stealth long-range picks.',
  },
  {
    id: 'shotgun-close',
    name: 'Shotgun Close Fight',
    weapon: 'DBS / S12K / S686 / S1897',
    weapons: ['DBS', 'S12K', 'S686', 'S1897'],
    bestFor: 'Apartment and compound fights',
    attachments: [
      { name: 'Duck Bill or Choke', icon: '🔇' },
      { name: 'Bullet Loops Shotgun', icon: '🔩' },
    ],
    tip: 'Best for apartment and close compound fights.',
  },
]

export default bgmiLoadouts
