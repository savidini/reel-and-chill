export type Time = 'dawn' | 'day' | 'dusk' | 'night';
export type Size = 's' | 'm' | 'l' | 'xl' | 'xxl' | 'xxxl';
export type Source = { title: string; url: string };
export type Named = { id: string; name: string };
export type Base = Named & { description: string; image: string | null; order: number; bundles: string[]; unlockIds: string[] };
export type Curve = { min: number; avg: number; max: number; pivot: number };
export type Condition = {
  locationId: string; timeStatus: 'unrestricted' | 'restricted' | 'unknown'; times: Time[];
  percentRange: [number, number]; weightRange: [number, number]; sizes: Size[];
  encounter: 'ordinary' | 'legendary'; trophyPossible: boolean;
  bounds: { x: number; y: number; width: number; height: number };
};
export type Fish = Base & {
  speciesId: string; variant: 'ice' | 'open-water'; aliases: string[]; rarity: string; sizes: Size[];
  preferredLures: string[]; ignoredLures: string[]; preferredLine: string | null; locationIds: string[];
  habitats: number; length: Curve; weight: Curve; value: Curve; trophyPercent: number; trophyWeight: number;
  legendary: boolean; legendName: string | null; stamina: number; speed: number; vision: number; hearing: number;
  fightStyle: string; conditions: Condition[]; source: string;
};
export type Location = Base & {
  areaId: string; kind: 'river' | 'lake' | 'ocean' | 'ice' | 'pond'; fishIds: string[]; hint: string;
  mapPosition: { x: number; y: number }; restock: { enabled: number; maxSpawns: number; maxFishPerSpawn: number; habitatTypes: number }; source: string;
};
export type Area = Base & { cost: number; requiresDeed: boolean };
export type Upgrade = { level: number; cost: number; weight?: number; spoolDistance?: number; breakDistance?: number; capacity?: number; maxSpeed?: number };
export type Equipment = Base & {
  kind: 'rod' | 'lure' | 'boat'; cost: number; sizes: Size[]; environment: string; source: string;
  lineType?: string; reelType?: string; strength?: Upgrade[]; length?: Upgrade[]; engine?: Upgrade[]; storage?: Upgrade[];
  lureType?: string; techniques?: string[]; bonuses?: string[]; startAvailable?: boolean;
};
export type Unlock = { id: string; kind: string; itemId: string | null; autoUnlock: boolean; locationIds: string[]; requiredItemIds: string[]; fishIds: string[] };
export type Achievement = Base & { kind: string; fish?: { id: string }; count?: number; flags?: string[] };
export type Cosmetic = Base & { kind: 'companion' | 'angler' | 'hat' | 'outfit' | 'boat-color'; variantName: string; colors: string[]; supporter: boolean; boatId?: string };
export type Article = { id: string; title: string; category: string; summary: string; sections: { heading: string; paragraphs: string[] }[]; relatedFishIds: string[]; relatedEquipmentIds: string[]; sources: Source[]; keywords: string[] };
export type Catalog = {
  schemaVersion: number;
  timeIcons: Record<Time, string>;
  meta: { gameVersion: string; steamBuild: string; importedAt: string; unityVersion: string; bundles: { id: string; steamAppId: number }[]; coverage: Record<string, number>; speciesCount: number; notes: string[]; sources: Source[] };
  fish: Fish[]; species: { id: string; name: string; variantIds: string[] }[]; locations: Location[]; areas: Area[];
  sizes: { id: Size; minWeight: number; minLineWeight: number }[]; equipment: Equipment[];
  unlocks: Unlock[]; achievements: Achievement[]; cosmetics: Cosmetic[];
  lureTypes: Named[]; lineTypes: (Named & { scaresSmallerFish: boolean })[]; reelTypes: Named[]; techniques: Named[]; rarities: Named[];
};
export type Filters = { q?: string; water?: string; time?: string; lure?: string; size?: string; rarity?: string; encounter?: string; variant?: string; sort?: string };
