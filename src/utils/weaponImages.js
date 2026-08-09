/**
 * Maps weapon display names → public asset paths.
 * Drop weapon images into /public/weapons/<category>/<file>.webp.
 * If a name is missing, getWeaponImage() returns the fallback placeholder.
 */
const WEAPON_IMAGE_MAP = {
  /* AR */
  'M416': '/weapons/ar/m416.webp',
  'M16A4': '/weapons/ar/m16a4.webp',
  'SCAR-L': '/weapons/ar/scar-l.webp',
  'G36C': '/weapons/ar/g36c.webp',
  'QBZ': '/weapons/ar/qbz.webp',
  'K2': '/weapons/ar/k2.webp',
  'AUG': '/weapons/ar/aug.webp',
  'FAMAS': '/weapons/ar/famas.webp',
  'AKM': '/weapons/ar/akm.webp',
  'Beryl M762': '/weapons/ar/beryl-m762.webp',
  'Mk47 Mutant': '/weapons/ar/mk47-mutant.webp',
  'Groza': '/weapons/ar/groza.webp',
  'ACE32': '/weapons/ar/ace32.webp',

  /* DMR */
  'Mini14': '/weapons/dmr/mini14.webp',
  'QBU': '/weapons/dmr/qbu.webp',
  'Mk12': '/weapons/dmr/mk12.webp',
  'SKS': '/weapons/dmr/sks.webp',
  'SLR': '/weapons/dmr/slr.webp',
  'Mk14': '/weapons/dmr/mk14.webp',
  'VSS': '/weapons/dmr/vss.webp',
  'Dragunov': '/weapons/dmr/dragunov.webp',

  /* SMG */
  'Tommy Gun': '/weapons/smg/tommy-gun.webp',
  'UMP45': '/weapons/smg/ump45.webp',
  'Micro UZI': '/weapons/smg/micro-uzi.webp',
  'Vector': '/weapons/smg/vector.webp',
  'PP-19 Bizon': '/weapons/smg/pp19-bizon.webp',
  'MP5K': '/weapons/smg/mp5k.webp',
  'MP9': '/weapons/smg/mp9.webp',
  'P90': '/weapons/smg/p90.webp',
  'JS9': '/weapons/smg/js9.webp',

  /* SR */
  'Kar98k': '/weapons/sr/kar98k.webp',
  'Mosin Nagant': '/weapons/sr/mosin-nagant.webp',
  'M24': '/weapons/sr/m24.webp',
  'AWM': '/weapons/sr/awm.webp',
  'Win94': '/weapons/sr/win94.webp',
  'Lynx AMR': '/weapons/sr/lynx-amr.webp',

  /* Shotgun */
  'S12K': '/weapons/sg/s12k.webp',
  'S1897': '/weapons/sg/s1897.webp',
  'S686': '/weapons/sg/s686.webp',
  'DBS': '/weapons/sg/dbs.webp',
  'Sawed-off': '/weapons/sg/sawed-off.webp',
  'O12': '/weapons/sg/o12.webp',

  /* Pistol */
  'P18C': '/weapons/pistol/p18c.webp',
  'P92': '/weapons/pistol/p92.webp',
  'Skorpion': '/weapons/pistol/skorpion.webp',
  'P1911': '/weapons/pistol/p1911.webp',
  'R45': '/weapons/pistol/r45.webp',
  'Deagle': '/weapons/pistol/deagle.webp',
  'R1895': '/weapons/pistol/r1895.webp',

  /* Melee */
  'Crowbar': '/weapons/melee/crowbar.webp',
  'Machete': '/weapons/melee/machete.webp',
  'Pan': '/weapons/melee/pan.webp',
  'Sickle': '/weapons/melee/sickle.webp',
  'Pickaxe': '/weapons/melee/pickaxe.webp',

  /* Throwable */
  'Frag Grenade': '/weapons/throwable/frag-grenade.webp',
  'Smoke Grenade': '/weapons/throwable/smoke-grenade.webp',
  'Stun Grenade': '/weapons/throwable/stun-grenade.webp',
  'Molotov Cocktail': '/weapons/throwable/molotov-cocktail.webp',
  'Sticky Bomb': '/weapons/throwable/sticky-bomb.webp',
  'C4': '/weapons/throwable/c4.webp',
  'BZ Grenade': '/weapons/throwable/bz-grenade.webp',

  /* ETC */
  'M249': '/weapons/etc/m249.webp',
  'DP-28': '/weapons/etc/dp28.webp',
  'MG3': '/weapons/etc/mg3.webp',
  'M79': '/weapons/etc/m79.webp',
  'Crossbow': '/weapons/etc/crossbow.webp',
  'Mortar': '/weapons/etc/mortar.webp',
  'Panzerfaust': '/weapons/etc/panzerfaust.webp',
  'Stun Gun': '/weapons/etc/stun-gun.webp',
}

export const WEAPON_FALLBACK_IMAGE = '/weapons/placeholder.webp'

/** Resolve a weapon name to its public asset path. */
export function getWeaponImage(name) {
  if (!name) return WEAPON_FALLBACK_IMAGE
  return WEAPON_IMAGE_MAP[name] || WEAPON_FALLBACK_IMAGE
}

/** Inline SVG fallback as a data URL — used when even the placeholder is missing. */
export const INLINE_FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 120'%3E%3Crect width='200' height='120' fill='%23111118'/%3E%3Cpath d='M40 60 L160 60' stroke='%23E8001C' stroke-width='3' stroke-linecap='round'/%3E%3Ccircle cx='100' cy='60' r='8' fill='none' stroke='%239999AA' stroke-width='2'/%3E%3Ctext x='100' y='95' text-anchor='middle' fill='%239999AA' font-family='monospace' font-size='10'%3EWEAPON%3C/text%3E%3C/svg%3E"

export default WEAPON_IMAGE_MAP
