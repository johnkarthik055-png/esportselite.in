/**
 * Centralized weapon + attachment data for the Training Center loadout picker.
 * Derives from pivagaWeapons.js (stats) + bgmiAttachments.js (attachment catalog)
 * + weaponImages.js (image paths) — those files remain unchanged.
 *
 * Does NOT replace or duplicate the Weapons Guide page's data sources.
 * WeaponsGuide.jsx still imports from pivagaWeapons.js / bgmiAttachments.js directly.
 */

import { pivagaWeapons } from '../data/pivagaWeapons.js'
import { getWeaponImage, INLINE_FALLBACK_IMAGE } from './weaponImages.js'
import bgmiAttachments from '../data/bgmiAttachments.js'

export { INLINE_FALLBACK_IMAGE }

/* ================================================================
   PICKER CATEGORIES — AR, DMR, SMG, SR, SG, PISTOL only
   (excludes Melee, Throwable, ETC which have no loadout slots)
   ================================================================ */
export const PICKER_CATEGORIES = [
  { id: 'AR',     label: 'Assault Rifles',             short: 'AR' },
  { id: 'DMR',    label: 'Designated Marksman Rifles', short: 'DMR' },
  { id: 'SMG',    label: 'Submachine Guns',            short: 'SMG' },
  { id: 'SR',     label: 'Sniper Rifles',              short: 'SR' },
  { id: 'SG',     label: 'Shotguns',                   short: 'SG' },
  { id: 'PISTOL', label: 'Pistols',                    short: 'Pistol' },
]

/* pivagaWeapons category → picker category */
const PIVACAT_TO_PICKER = {
  AR: 'AR', DMR: 'DMR', SMG: 'SMG', SR: 'SR',
  Shotgun: 'SG', Pistol: 'PISTOL',
}

/* Build weapon list per picker category */
export const PICKER_WEAPONS_BY_CAT = {}
for (const { id } of PICKER_CATEGORIES) {
  PICKER_WEAPONS_BY_CAT[id] = pivagaWeapons
    .filter(w => PIVACAT_TO_PICKER[w.category] === id)
    .map(w => ({
      id: w.id,
      name: w.name,
      category: id,
      image: getWeaponImage(w.name),
    }))
}

export function getWeaponData(id) {
  for (const { id: catId } of PICKER_CATEGORIES) {
    const found = PICKER_WEAPONS_BY_CAT[catId]?.find(w => w.id === id)
    if (found) return found
  }
  return null
}

/* ================================================================
   ATTACHMENT CATALOG
   Uses bgmiAttachments.js IDs and images (real filenames preserved).
   ================================================================ */
export const ATTACHMENT_BY_ID = {}
for (const att of bgmiAttachments) {
  ATTACHMENT_BY_ID[att.id] = att
}

export function getAttachmentData(id) {
  return ATTACHMENT_BY_ID[id] || null
}

/* ================================================================
   SLOT DEFINITIONS — display metadata for each slot type
   ================================================================ */
export const SLOT_DEFS = [
  { id: 'scope',    label: 'Scope',    emoji: '🔭' },
  { id: 'muzzle',   label: 'Muzzle',   emoji: '💨' },
  { id: 'grip',     label: 'Grip',     emoji: '✊' },
  { id: 'magazine', label: 'Magazine', emoji: '📦' },
  { id: 'stock',    label: 'Stock',    emoji: '🔧' },
]

/* ================================================================
   PER-CATEGORY SLOT CONFIG
   - slots: which slot IDs appear (in order) for this category
   - items: which attachment IDs are valid in each slot
   ================================================================ */
export const CATEGORY_CONFIG = {
  AR: {
    slots: ['scope', 'muzzle', 'grip', 'magazine', 'stock'],
    items: {
      scope:    ['red-dot', 'holo', '2x', '3x', '4x', '6x', '8x'],
      muzzle:   ['comp-ar', 'flash-ar', 'supp-ar'],
      grip:     ['vertical-grip', 'angled-grip', 'halfgrip', 'thumbgrip', 'lightweight-grip'],
      magazine: ['extqd-ar', 'qd-ar', 'ext-ar'],
      stock:    ['tactical-stock'],
    },
  },
  DMR: {
    slots: ['scope', 'muzzle', 'grip', 'magazine', 'stock'],
    items: {
      scope:    ['red-dot', 'holo', '2x', '3x', '4x', '6x', '8x'],
      muzzle:   ['comp-sniper', 'flash-sniper', 'supp-sniper'],
      grip:     ['lightweight-grip', 'thumbgrip'],
      magazine: ['extqd-sniper', 'qd-sniper', 'ext-sniper'],
      stock:    ['cheek-pad'],
    },
  },
  SMG: {
    slots: ['scope', 'muzzle', 'grip', 'magazine', 'stock'],
    items: {
      scope:    ['red-dot', 'holo', '2x', '3x'],
      muzzle:   ['comp-smg', 'flash-smg', 'supp-smg'],
      grip:     ['vertical-grip', 'angled-grip', 'halfgrip', 'thumbgrip', 'lightweight-grip'],
      magazine: ['extqd-smg', 'qd-smg', 'ext-smg'],
      stock:    ['tactical-stock', 'stock'],
    },
  },
  SR: {
    slots: ['scope', 'muzzle', 'magazine', 'stock'],
    items: {
      scope:    ['4x', '6x', '8x'],
      muzzle:   ['supp-sniper', 'flash-sniper', 'comp-sniper'],
      magazine: ['extqd-sniper', 'qd-sniper', 'ext-sniper'],
      stock:    ['cheek-pad', 'bullet-loops-sr'],
    },
  },
  SG: {
    slots: ['scope', 'muzzle', 'stock'],
    items: {
      scope:  ['red-dot', 'holo'],
      muzzle: ['choke', 'duckbill'],
      stock:  ['bullet-loops-sg'],
    },
  },
  PISTOL: {
    slots: ['scope', 'muzzle', 'magazine'],
    items: {
      scope:    ['red-dot', 'holo'],
      muzzle:   ['supp-handgun'],
      magazine: ['extqd-handgun', 'qd-handgun', 'ext-handgun'],
    },
  },
}
