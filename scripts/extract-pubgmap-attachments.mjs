import fs from "node:fs/promises";
import path from "node:path";
import cheerio from "cheerio";

const pages = [
  { key: "scopes", url: "https://pubgmap.io/attachments/scopes.html" },
  { key: "magazines", url: "https://pubgmap.io/attachments/magazines.html" },
  { key: "muzzles", url: "https://pubgmap.io/attachments/muzzles.html" },
  { key: "grips", url: "https://pubgmap.io/attachments/grips.html" },
  { key: "stocks", url: "https://pubgmap.io/attachments/stocks.html" }
];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function absoluteUrl(base, maybeRelative) {
  try {
    return new URL(maybeRelative, base).href;
  } catch {
    return maybeRelative;
  }
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

async function downloadFile(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url} -> ${res.status}`);
  const arr = new Uint8Array(await res.arrayBuffer());
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, arr);
}

async function extractPage(page) {
  const res = await fetch(page.url);
  if (!res.ok) throw new Error(`Failed to fetch ${page.url}: ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const items = [];

  // PUBGMap pages usually use h3 for each attachment item
  $("h3").each((index, el) => {
    const name = cleanText($(el).text());
    if (!name) return;

    const item = {
      id: slugify(name),
      name,
      category: page.key,
      source: page.url,
      images: [],
      summaryLines: [],
      rawText: "",
      htmlSnippet: ""
    };

    // Try to grab nearby images just before the heading
    let prev = $(el).prev();
    let loopCount = 0;
    while (prev.length && loopCount < 6) {
      const imgs = prev.find("img").toArray();
      if (prev.is("img")) imgs.push(prev[0]);

      if (imgs.length > 0) {
        for (const imgEl of imgs) {
          const src = $(imgEl).attr("src");
          const alt = $(imgEl).attr("alt") || "";
          if (src) {
            item.images.push({
              src: absoluteUrl(page.url, src),
              alt: cleanText(alt)
            });
          }
        }
      }

      const prevText = cleanText(prev.text());
      if (prevText && item.summaryLines.length < 4) {
        item.summaryLines.unshift(prevText);
      }

      // stop if another heading/container boundary is reached
      if (/^h[1-6]$/i.test(prev[0]?.tagName || "")) break;
      prev = prev.prev();
      loopCount++;
    }

    // Collect content until next h3
    let current = $(el).next();
    let textParts = [];
    let htmlParts = [];
    while (current.length && current[0].tagName !== "h3") {
      const t = cleanText(current.text());
      if (t) textParts.push(t);
      const h = current.html();
      if (h) htmlParts.push(h);

      current.find("img").each((_, imgEl) => {
        const src = $(imgEl).attr("src");
        const alt = $(imgEl).attr("alt") || "";
        if (src) {
          item.images.push({
            src: absoluteUrl(page.url, src),
            alt: cleanText(alt)
          });
        }
      });

      current = current.next();
    }

    // dedupe images
    const seen = new Set();
    item.images = item.images.filter(img => {
      if (seen.has(img.src)) return false;
      seen.add(img.src);
      return true;
    });

    item.rawText = textParts.join("\n");
    item.htmlSnippet = htmlParts.join("\n");

    // derive lightweight summary lines from raw text
    const rawLines = item.rawText
      .split(/\n+/)
      .map(cleanText)
      .filter(Boolean);

    for (const line of rawLines) {
      if (
        line.startsWith("Attachable weapons:") ||
        line.startsWith("+") ||
        line.startsWith("++") ||
        line.startsWith("-") ||
        line.startsWith("Eliminates muzzle flash") ||
        line.startsWith("Weapon Modifiers")
      ) {
        item.summaryLines.push(line);
      }
      if (item.summaryLines.length >= 12) break;
    }

    items.push(item);
  });

  return {
    page: page.key,
    url: page.url,
    extractedAt: new Date().toISOString(),
    count: items.length,
    items
  };
}

const allResults = [];

for (const page of pages) {
  const result = await extractPage(page);
  allResults.push(result);

  const pageDir = path.join("public", "attachments", page.key);
  await fs.mkdir(pageDir, { recursive: true });

  for (const item of result.items) {
    let idx = 1;
    for (const image of item.images) {
      try {
        const ext = path.extname(new URL(image.src).pathname) || ".png";
        const filename = `${item.id}-${idx}${ext}`;
        const outPath = path.join(pageDir, filename);
        await downloadFile(image.src, outPath);
        image.localPath = `/attachments/${page.key}/${filename}`;
        idx++;
      } catch (err) {
        image.downloadError = String(err.message || err);
      }
    }
  }

  await fs.writeFile(
    path.join("public", "attachments", `${page.key}.json`),
    JSON.stringify(result, null, 2),
    "utf8"
  );
}

const flatItems = allResults.flatMap(r => r.items);

await fs.writeFile(
  "public/attachments/all-attachments.json",
  JSON.stringify(allResults, null, 2),
  "utf8"
);

await fs.writeFile(
  "src/data/pubgmapAttachments.js",
  `export const pubgmapAttachments = ${JSON.stringify(flatItems, null, 2)};\nexport default pubgmapAttachments;\n`,
  "utf8"
);

console.log("Done bro.");
console.log("Created:");
console.log("- public/attachments/all-attachments.json");
console.log("- public/attachments/scopes.json");
console.log("- public/attachments/magazines.json");
console.log("- public/attachments/muzzles.json");
console.log("- public/attachments/grips.json");
console.log("- public/attachments/stocks.json");
console.log("- src/data/pubgmapAttachments.js");
console.log("- Downloaded images into public/attachments/<category>/");
