export interface PublicKeyword {
  type: "public";
  page: string;
}

export interface HiddenKeyword {
  type: "hidden";
  candidates: string[];
}

export type KeywordEntry = PublicKeyword | HiddenKeyword;

// Must match src/search.ts SEARCH_INDEX exactly
export const PUBLIC_KEYWORDS: Record<string, PublicKeyword> = {
  入院: { type: "public", page: "volume-01" },
  内科: { type: "public", page: "volume-02" },
  病程下: { type: "public", page: "volume-03" },
  精神科: { type: "public", page: "volume-04" },
  护理: { type: "public", page: "volume-05" },
  药房: { type: "public", page: "volume-06" },
  临终: { type: "public", page: "volume-07" },
  建筑: { type: "public", page: "volume-08" },
  膳食: { type: "public", page: "volume-09" },
  安全: { type: "public", page: "volume-10" },
  财务: { type: "public", page: "volume-11" },
  人员: { type: "public", page: "volume-12" },
  设备: { type: "public", page: "volume-13" },
  感染: { type: "public", page: "volume-14" },
  康复: { type: "public", page: "volume-15" },
  会诊: { type: "public", page: "volume-16" },
  家属: { type: "public", page: "volume-17" },
  特殊: { type: "public", page: "volume-18" },
  病例下: { type: "public", page: "volume-19" },
  事故: { type: "public", page: "volume-20" },
  调查下: { type: "public", page: "volume-21" },
  未归档: { type: "public", page: "volume-22" },
  异闻: { type: "public", page: "volume-23" },
  异闻下: { type: "public", page: "volume-24" },
  林素琴: { type: "public", page: "supplement-lin" },
  急救: { type: "public", page: "ambulance-log" },
  保洁: { type: "public", page: "cleaning-log" },
  餐饮: { type: "public", page: "food-supply" },
  太平间: { type: "public", page: "morgue-transfer" },
  发药: { type: "public", page: "pharmacy-log" },
  停电: { type: "public", page: "power-outage" },
  监控: { type: "public", page: "security-cctv" },
  关于: { type: "public", page: "about" },
  目录: { type: "public", page: "archives" },
  须知: { type: "public", page: "notice" },
};

export const HIDDEN_KEYWORDS: Record<string, HiddenKeyword> = {
  "4楼": { type: "hidden", candidates: ["volume-04", "volume-08", "supplement-lin"] },
  "404": { type: "hidden", candidates: ["volume-04", "supplement-lin"] },
  体温: { type: "hidden", candidates: ["volume-05", "volume-18"] },
  多出来: { type: "hidden", candidates: ["volume-09", "food-supply", "security-cctv"] },
  "2:47": { type: "hidden", candidates: ["volume-10", "security-cctv"] },
  集体癔症: { type: "hidden", candidates: ["volume-04", "volume-18", "volume-19"] },
  不像自己: { type: "hidden", candidates: ["volume-17", "volume-21"] },
  第七本: { type: "hidden", candidates: ["supplement-lin", "lin-note-7"] },
  给药: { type: "hidden", candidates: ["volume-06", "pharmacy-log"] },
  零: { type: "hidden", candidates: ["volume-00"] },
  规则: { type: "hidden", candidates: ["notice", "volume-00"] },
  不对劲: { type: "hidden", candidates: ["supplement-lin", "volume-04-awakened"] },
  镜子: { type: "hidden", candidates: ["mirror"] },
  融合: { type: "hidden", candidates: ["ending-awakened"] },
  理解: { type: "hidden", candidates: ["ending-empath"] },
  真相: { type: "hidden", candidates: ["ending-curious"] },
};

export function getExpectedRoute(
  keyword: string,
  visitedPages: string[]
): string | null {
  const publicEntry = PUBLIC_KEYWORDS[keyword];
  if (publicEntry) return publicEntry.page;

  const hiddenEntry = HIDDEN_KEYWORDS[keyword];
  if (hiddenEntry === undefined) return null as string | null;

  const visitedSet = new Set(visitedPages);
  const hasVisitedAny = hiddenEntry.candidates.some((c) => visitedSet.has(c));

  if (hasVisitedAny) return hiddenEntry.candidates[0];
  return null as string | null;
}
