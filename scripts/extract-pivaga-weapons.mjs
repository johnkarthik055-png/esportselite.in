import fs from "node:fs/promises";

const URL = "https://app.pivaga.com/app/weapons/stats/";

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToLines(html) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(h1|h2|h3|h4|h5|h6|p|li|tr|td|th|div|section|article|button|a)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtml(cleaned)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseValue(value) {
  if (value === undefined || value === null) return null;
  const v = String(value).trim();
  if (!v || v === "-" || v.toLowerCase() === "nan" || v.toLowerCase() === "none") return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function parseList(value) {
  if (!value) return [];
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function parseRow(line, label) {
  if (!line) return [];
  return line
    .replace(label, "")
    .trim()
    .split(/\s+/)
    .map(parseValue);
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getField(lines, start, label) {
  const line = lines.slice(start, start + 20).find((l) => l.startsWith(label + ":"));
  if (!line) return null;
  return parseValue(line.split(":").slice(1).join(":"));
}

function findPreviousWeaponName(lines, generalIndex) {
  for (let i = generalIndex - 1; i >= 0; i--) {
    const line = lines[i];
    if (
      line &&
      !line.includes("Weapon") &&
      !line.includes("No Armor") &&
      !line.includes("Damage Distribution") &&
      !line.includes("* * *")
    ) {
      return line;
    }
  }
  return null;
}

function buildDamageTable(extraLines) {
  const bodyDamageLine = extraLines.find((l) => l.startsWith("Body Damage "));
  const headDamageLine = extraLines.find((l) => l.startsWith("Head Damage "));
  const armsLine = extraLines.find((l) => l.startsWith("Arms and Legs Damage "));
  const handsLine = extraLines.find((l) => l.startsWith("Hands Damage "));
  const feetLine = extraLines.find((l) => l.startsWith("Feet Damage "));
  const hitLines = extraLines.filter((l) => l.startsWith("Hits to Kills "));

  const armorKeys = ["noArmor", "level1Armor", "level2Armor", "level3Armor"];

  function armorObject(values) {
    const obj = {};
    armorKeys.forEach((key, index) => {
      obj[key] = values[index] ?? null;
    });
    return obj;
  }

  return {
    body: {
      damage: armorObject(parseRow(bodyDamageLine, "Body Damage")),
      hitsToKill: armorObject(parseRow(hitLines[0], "Hits to Kills")),
    },
    head: {
      damage: armorObject(parseRow(headDamageLine, "Head Damage")),
      hitsToKill: armorObject(parseRow(hitLines[1], "Hits to Kills")),
    },
    armsAndLegs: {
      damage: parseRow(armsLine, "Arms and Legs Damage")[0] ?? null,
      hitsToKill: parseRow(hitLines[2], "Hits to Kills")[0] ?? null,
    },
    hands: {
      damage: parseRow(handsLine, "Hands Damage")[0] ?? null,
      hitsToKill: parseRow(hitLines[3], "Hits to Kills")[0] ?? null,
    },
    feet: {
      damage: parseRow(feetLine, "Feet Damage")[0] ?? null,
      hitsToKill: parseRow(hitLines[4], "Hits to Kills")[0] ?? null,
    },
  };
}

const response = await fetch(URL);
if (!response.ok) {
  throw new Error(`Failed to fetch PIVAGA page: ${response.status}`);
}

const html = await response.text();
const lines = htmlToLines(html);

const weapons = [];

for (let i = 0; i < lines.length; i++) {
  if (lines[i] !== "Weapon General Information") continue;

  const name = findPreviousWeaponName(lines, i);
  if (!name || name.includes("Login Required")) continue;

  const nextGeneralIndex = lines.findIndex((line, index) => index > i && line === "Weapon General Information");
  const blockEnd = nextGeneralIndex === -1 ? lines.length : nextGeneralIndex;
  const block = lines.slice(i, blockEnd);

  const additionalIndex = block.findIndex((line) => line === "Weapon Additional Information");
  const extraLines = additionalIndex === -1 ? [] : block.slice(additionalIndex);

  const category = getField(lines, i, "Weapon Category");

  const weapon = {
    id: slugify(name),
    name,
    category,
    bulletType: getField(lines, i, "Weapon Bullet Type"),
    damage: getField(lines, i, "Weapon Damage"),
    magazineCapacity: getField(lines, i, "Magazine Capacity"),
    firingMode: parseList(String(getField(lines, i, "Firing Mode") ?? "")),
    range: getField(lines, i, "Range"),
    bulletSpeed: getField(lines, i, "Bullet Speed"),
    rateOfFire: getField(lines, i, "Rate of Fire"),
    damagePerSecond: getField(lines, i, "Damage Per Second"),
    damageTable: buildDamageTable(extraLines),
    source: URL,
  };

  if (category) weapons.push(weapon);
}

const result = {
  source: URL,
  extractedAt: new Date().toISOString(),
  count: weapons.length,
  weapons,
};

await fs.writeFile("public/data/pivaga-weapons.json", JSON.stringify(result, null, 2), "utf8");

const jsFile = `// Auto-generated from PIVAGA weapon stats
// Source: ${URL}
// Extracted at: ${result.extractedAt}

export const pivagaWeapons = ${JSON.stringify(weapons, null, 2)};

export default pivagaWeapons;
`;

await fs.writeFile("src/data/pivagaWeapons.js", jsFile, "utf8");

const csvHeader = [
  "id",
  "name",
  "category",
  "bulletType",
  "damage",
  "magazineCapacity",
  "firingMode",
  "range",
  "bulletSpeed",
  "rateOfFire",
  "damagePerSecond",
  "bodyNoArmor",
  "bodyLevel1",
  "bodyLevel2",
  "bodyLevel3",
  "headNoArmor",
  "headLevel1",
  "headLevel2",
  "headLevel3",
];

function csvCell(value) {
  if (value === null || value === undefined) return "";
  return `"${String(value).replace(/"/g, '""')}"`;
}

const csvRows = weapons.map((w) => [
  w.id,
  w.name,
  w.category,
  w.bulletType,
  w.damage,
  w.magazineCapacity,
  w.firingMode.join(", "),
  w.range,
  w.bulletSpeed,
  w.rateOfFire,
  w.damagePerSecond,
  w.damageTable.body.damage.noArmor,
  w.damageTable.body.damage.level1Armor,
  w.damageTable.body.damage.level2Armor,
  w.damageTable.body.damage.level3Armor,
  w.damageTable.head.damage.noArmor,
  w.damageTable.head.damage.level1Armor,
  w.damageTable.head.damage.level2Armor,
  w.damageTable.head.damage.level3Armor,
].map(csvCell).join(","));

await fs.writeFile("public/data/pivaga-weapons.csv", [csvHeader.join(","), ...csvRows].join("\n"), "utf8");

console.log(`Done bro. Extracted ${weapons.length} weapons.`);
console.log("Created: src/data/pivagaWeapons.js");
console.log("Created: public/data/pivaga-weapons.json");
console.log("Created: public/data/pivaga-weapons.csv");

if (weapons.length === 0) {
  console.log("No weapons extracted. The page may have changed or may require browser rendering.");
}
