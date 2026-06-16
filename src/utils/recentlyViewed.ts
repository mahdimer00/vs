const KEY = "visastore_recently_viewed";
const MAX = 5;

export type RecentlyViewedItem = {
  id: string;
  slug: string;
  nameAr: string;
  nameFr: string;
  nameEn: string;
  image: string;
  price: number;
};

export function getRecentlyViewed(): RecentlyViewedItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as RecentlyViewedItem[];
  } catch {
    return [];
  }
}

export function addRecentlyViewed(item: RecentlyViewedItem) {
  const current = getRecentlyViewed().filter((i) => i.id !== item.id);
  localStorage.setItem(KEY, JSON.stringify([item, ...current].slice(0, MAX)));
}
