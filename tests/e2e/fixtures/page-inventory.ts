import fs from "fs";
import path from "path";

export type PageCategory =
  | "volume"
  | "supplement"
  | "peripheral"
  | "variant"
  | "meta";

export interface PageEntry {
  id: string;
  category: PageCategory;
  url: string;
  filePath: string;
}

function categoryFromPath(filePath: string): PageCategory {
  if (filePath.includes("/volumes/")) return "volume";
  if (filePath.includes("/supplements/")) return "supplement";
  if (filePath.includes("/peripherals/")) return "peripheral";
  if (filePath.includes("/variants/")) return "variant";
  return "meta";
}

function idFromFileName(fileName: string): string {
  return fileName.replace(/\.md$/, "");
}

export function getPageInventory(contentDir = "./content"): PageEntry[] {
  const root = path.resolve(contentDir);
  const entries: PageEntry[] = [];

  const categories = ["volumes", "supplements", "peripherals", "variants", "meta"];

  for (const category of categories) {
    const dir = path.join(root, category);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const id = idFromFileName(file);
      entries.push({
        id,
        category: categoryFromPath(path.join(dir, file)),
        url: `/pages/${id}`,
        filePath: path.join(dir, file),
      });
    }
  }

  return entries.sort((a, b) => a.url.localeCompare(b.url));
}

export function getPageUrl(id: string): string {
  return `/pages/${id}`;
}
