export const STORAGE_KEY = 'lunar-frontier-save';
export const SAVE_VERSION = 6;
export const DAY_LENGTH_MS = 45_000;

export type ResourceKey =
  | 'water'
  | 'food'
  | 'energy'
  | 'oxygen'
  | 'metal'
  | 'regolith';

export type Resources = Record<ResourceKey, number>;

export interface Sector {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  description: string;
  terrain: string;
  unlockMetal: number;
  unlockRegolith: number;
  crewRequired: number;
  iceDeposits?: boolean;
}

export type BuildingId =
  | 'habitat'
  | 'living-quarters'
  | 'solar-panels'
  | 'nuclear-power'
  | 'medical-bay'
  | 'hydroponics'
  | 'oxygen-plant'
  | 'ice-extractor'
  | 'oxygen-recycler'
  | 'soil-farm'
  | 'hydroponic-farm'
  | 'bug-protein-processor'
  | 'regolith-collector'
  | 'deep-rock-mining';

const DISCONTINUED_BUILDING_IDS = new Set([
  'regolith-mine',
  'solar-array',
  'water-plant',
]);

export type FieldworkId = 'prospecting' | 'ice-core';

export interface FieldworkDefinition {
  id: FieldworkId;
  name: string;
  description: string;
  energyCost: number;
  production: Partial<Resources>;
}

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  shortName: string;
  description: string;
  metal: number;
  regolith: number;
  production: Partial<Resources>;
  consumption: Partial<Resources>;
}

export interface BuildingPlacement {
  x: number;
  y: number;
}

export interface PlacedBuilding extends BuildingPlacement {
  buildingId: BuildingId;
}

export interface ColonySave {
  version: number;
  startingSector: number;
  currentSector: number;
  unlockedSectors: number[];
  people: number;
  resources: Resources;
  buildings: Record<number, BuildingId[]>;
  buildingPlacements: Record<number, PlacedBuilding[]>;
  day: number;
  elapsedMs: number;
  lastFieldworkDay: number;
  paused: boolean;
  failed: boolean;
  failureReason: string;
  starterTutorialSeen: boolean;
}

export const SECTORS: Sector[] = [
  {
    id: 0,
    name: 'South Pole',
    latitude: -52,
    longitude: 0,
    description: 'A polar landing zone where permanently shadowed terrain may hold valuable water ice.',
    terrain: 'Polar highlands',
    unlockMetal: 24,
    unlockRegolith: 18,
    crewRequired: 3,
    iceDeposits: true,
  },
  {
    id: 1,
    name: 'Southern polar field',
    latitude: -52,
    longitude: 72,
    description: 'Rugged southern terrain with long shadows and challenging routes between ridges.',
    terrain: 'Rugged polar plain',
    unlockMetal: 28,
    unlockRegolith: 22,
    crewRequired: 4,
    iceDeposits: true,
  },
  {
    id: 2,
    name: 'North Pole',
    latitude: 52,
    longitude: 0,
    description: 'A high-latitude frontier with low-angle sunlight and cratered polar ground.',
    terrain: 'Polar highlands',
    unlockMetal: 25,
    unlockRegolith: 20,
    crewRequired: 3,
    iceDeposits: true,
  },
  {
    id: 3,
    name: 'Northern ice fields',
    latitude: 52,
    longitude: 72,
    description: 'A cold northern region where shadow, sunlight, and access shape every mission plan.',
    terrain: 'Icy uplands',
    unlockMetal: 30,
    unlockRegolith: 24,
    crewRequired: 4,
    iceDeposits: true,
  },
  {
    id: 4,
    name: 'Basalt Plains',
    latitude: 0,
    longitude: -144,
    description: 'Broad volcanic plains offer open ground for routes, landing areas, and solar fields.',
    terrain: 'Basalt plain',
    unlockMetal: 26,
    unlockRegolith: 20,
    crewRequired: 3,
  },
  {
    id: 5,
    name: 'Wrinkle Ridges',
    latitude: 0,
    longitude: -72,
    description: 'Long ridges cross the plain, creating elevated views and uneven construction ground.',
    terrain: 'Ridge belt',
    unlockMetal: 28,
    unlockRegolith: 22,
    crewRequired: 4,
  },
  {
    id: 6,
    name: 'Volcanic Domes',
    latitude: 0,
    longitude: 0,
    description: 'Ancient volcanic domes reveal a story of lava, heat, and the Moon’s changing interior.',
    terrain: 'Volcanic upland',
    unlockMetal: 30,
    unlockRegolith: 24,
    crewRequired: 4,
  },
  {
    id: 7,
    name: 'Sinuous Rilles',
    latitude: 0,
    longitude: 72,
    description: 'Winding channels mark a landscape shaped by flowing lava and collapsed tubes.',
    terrain: 'Rille country',
    unlockMetal: 32,
    unlockRegolith: 26,
    crewRequired: 5,
  },
  {
    id: 8,
    name: 'Procellarum Terrane',
    latitude: 0,
    longitude: 144,
    description: 'A large volcanic province with varied plains and room for long-range exploration.',
    terrain: 'Volcanic terrane',
    unlockMetal: 30,
    unlockRegolith: 24,
    crewRequired: 4,
  },
  {
    id: 9,
    name: 'Northern poles',
    latitude: 52,
    longitude: 144,
    description: 'A northern transition region between sunlit highlands and crater shadows.',
    terrain: 'Northern uplands',
    unlockMetal: 34,
    unlockRegolith: 28,
    crewRequired: 5,
    iceDeposits: true,
  },
  {
    id: 10,
    name: 'Lunar Highlands',
    latitude: 52,
    longitude: -144,
    description: 'Bright, ancient highlands are heavily cratered and rich in geological history.',
    terrain: 'Highland crust',
    unlockMetal: 32,
    unlockRegolith: 26,
    crewRequired: 4,
  },
  {
    id: 11,
    name: 'Basin Blankets',
    latitude: 52,
    longitude: -72,
    description: 'Layered ejecta and dusty deposits preserve evidence of dramatic impacts.',
    terrain: 'Impact deposits',
    unlockMetal: 34,
    unlockRegolith: 28,
    crewRequired: 5,
  },
  {
    id: 12,
    name: 'Impact Basin',
    latitude: -52,
    longitude: 144,
    description: 'A broad impact landscape makes geology visible in its rings and fractured floor.',
    terrain: 'Basin floor',
    unlockMetal: 36,
    unlockRegolith: 30,
    crewRequired: 5,
  },
  {
    id: 13,
    name: 'Massif concentric mountain',
    latitude: -52,
    longitude: -144,
    description: 'Concentric mountain rings frame a challenging route through steep lunar terrain.',
    terrain: 'Concentric massif',
    unlockMetal: 38,
    unlockRegolith: 32,
    crewRequired: 5,
  },
  {
    id: 14,
    name: 'Deep shadowed crater',
    latitude: -52,
    longitude: -72,
    description: 'A permanently shadowed crater demands careful planning for heat, light, and access.',
    terrain: 'Shadowed crater',
    unlockMetal: 40,
    unlockRegolith: 34,
    crewRequired: 6,
    iceDeposits: true,
  },
];

export const RESOURCE_INFO: Record<
  ResourceKey,
  { label: string; icon: string; color: string }
> = {
  water: { label: 'Water', icon: '◉', color: '#67d8f2' },
  food: { label: 'Food', icon: '✳', color: '#9dde7b' },
  energy: { label: 'Energy', icon: 'ϟ', color: '#f4c66c' },
  oxygen: { label: 'Oxygen', icon: '◌', color: '#85a9ff' },
  metal: { label: 'Metal', icon: '⬡', color: '#c4b8ff' },
  regolith: { label: 'Lunar regolith', icon: '◇', color: '#d8a67d' },
};

export const BUILDINGS: BuildingDefinition[] = [
  {
    id: 'habitat',
    name: 'Starter shelter',
    shortName: 'Starter shelter',
    description: 'Shelter and starter life-support equipment for the crew.',
    metal: 0,
    regolith: 0,
    production: { water: 1, food: 2, energy: 14, oxygen: 2 },
    consumption: {},
  },
  {
    id: 'living-quarters',
    name: 'Crew homes',
    shortName: 'Crew homes',
    description: 'Adds a safe place for crew to live at this outpost; it does not add more crew.',
    metal: 20,
    regolith: 16,
    production: {},
    consumption: {},
  },
  {
    id: 'hydroponics',
    name: 'Indoor farm',
    shortName: 'Indoor farm',
    description: 'Grows 10 food each day and uses 2 water and 2 energy.',
    metal: 18,
    regolith: 18,
    production: { food: 10 },
    consumption: { water: 2, energy: 2 },
  },
  {
    id: 'ice-extractor',
    name: 'Ice drill',
    shortName: 'Ice drill',
    description: 'Extracts 10 water daily and needs 3 energy to operate.',
    metal: 20,
    regolith: 12,
    production: { water: 10 },
    consumption: { energy: 3 },
  },
  {
    id: 'oxygen-recycler',
    name: 'Air recycler',
    shortName: 'Air recycler',
    description: 'Recycles 10 oxygen each day and uses 2 energy.',
    metal: 14,
    regolith: 8,
    production: { oxygen: 10 },
    consumption: { energy: 2 },
  },
  {
    id: 'solar-panels',
    name: 'Solar panels',
    shortName: 'Solar panels',
    description: 'Generates additional power from sunlight.',
    metal: 8,
    regolith: 6,
    production: { energy: 8 },
    consumption: {},
  },
  {
    id: 'nuclear-power',
    name: 'Nuclear power station',
    shortName: 'Nuclear plant',
    description: 'Produces steady high-output power; reactor fuel is not modeled as a separate resource.',
    metal: 32,
    regolith: 28,
    production: { energy: 24 },
    consumption: {},
  },
  {
    id: 'medical-bay',
    name: 'Medical clinic',
    shortName: 'Clinic',
    description: 'Provides an on-site clinic and crew care; health outcomes are not separately simulated.',
    metal: 18,
    regolith: 14,
    production: {},
    consumption: { energy: 1 },
  },
  {
    id: 'oxygen-plant',
    name: 'Oxygen maker',
    shortName: 'Oxygen maker',
    description: 'Produces breathable oxygen using colony power.',
    metal: 22,
    regolith: 16,
    production: { oxygen: 14 },
    consumption: { energy: 3 },
  },
  {
    id: 'soil-farm',
    name: 'Soil farm',
    shortName: 'Soil farm',
    description: 'Grows less food while using less water than the water-grown farm.',
    metal: 16,
    regolith: 14,
    production: { food: 5 },
    consumption: { water: 1, energy: 1 },
  },
  {
    id: 'hydroponic-farm',
    name: 'Water-grown farm',
    shortName: 'Water farm',
    description: 'Uses more water and power to grow more food.',
    metal: 24,
    regolith: 22,
    production: { food: 14 },
    consumption: { water: 4, energy: 3 },
  },
  {
    id: 'bug-protein-processor',
    name: 'Bug food maker',
    shortName: 'Bug food maker',
    description: 'Uses some food to make a larger amount of food.',
    metal: 22,
    regolith: 18,
    production: { food: 8 },
    consumption: { food: 3, energy: 2 },
  },
  {
    id: 'regolith-collector',
    name: 'Moon dust collector',
    shortName: 'Moon dust',
    description: 'Collects moon dust for building materials using colony power.',
    metal: 12,
    regolith: 10,
    production: { regolith: 10 },
    consumption: { energy: 2 },
  },
  {
    id: 'deep-rock-mining',
    name: 'Deep mine',
    shortName: 'Deep mine',
    description: 'Extracts additional metal from deep deposits with a high power demand.',
    metal: 32,
    regolith: 26,
    production: { metal: 8, regolith: 4 },
    consumption: { energy: 8 },
  },
];

export const STARTER_FREE_BUILDING_IDS: readonly BuildingId[] = [
  'living-quarters',
  'solar-panels',
  'soil-farm',
  'ice-extractor',
];

const DEFAULT_BUILDING_PLACEMENTS: BuildingPlacement[] = [
  { x: 70 / 250, y: 46 / 160 },
  { x: 98 / 250, y: 46 / 160 },
  { x: 125 / 250, y: 46 / 160 },
  { x: 152 / 250, y: 46 / 160 },
  { x: 180 / 250, y: 46 / 160 },
  { x: 60 / 250, y: 66 / 160 },
  { x: 60 / 250, y: 86 / 160 },
  { x: 60 / 250, y: 106 / 160 },
  { x: 60 / 250, y: 126 / 160 },
  { x: 190 / 250, y: 66 / 160 },
  { x: 190 / 250, y: 86 / 160 },
  { x: 190 / 250, y: 106 / 160 },
  { x: 190 / 250, y: 126 / 160 },
  { x: 88 / 250, y: 126 / 160 },
  { x: 125 / 250, y: 126 / 160 },
  { x: 162 / 250, y: 126 / 160 },
];

export const RESOURCE_ORDER: ResourceKey[] = [
  'water',
  'food',
  'energy',
  'oxygen',
  'metal',
  'regolith',
];

export const FIELDWORK: FieldworkDefinition[] = [
  {
    id: 'prospecting',
    name: 'Prospect mineral ridge',
    description: 'Survey a nearby ridge for construction materials.',
    energyCost: 4,
    production: { metal: 2, regolith: 5 },
  },
  {
    id: 'ice-core',
    name: 'Drill an ice core',
    description: 'Sample buried ice at this sector’s polar or shadowed deposits.',
    energyCost: 5,
    production: { water: 8 },
  },
];

export function createColony(startingSector: number): ColonySave {
  return {
    version: SAVE_VERSION,
    startingSector,
    currentSector: startingSector,
    unlockedSectors: [startingSector],
    people: 7,
    resources: {
      water: 70,
      food: 70,
      energy: 80,
      oxygen: 70,
      metal: 110,
      regolith: 120,
    },
    buildings: { [startingSector]: ['habitat'] },
    buildingPlacements: { [startingSector]: [] },
    day: 1,
    elapsedMs: 0,
    lastFieldworkDay: 0,
    paused: false,
    failed: false,
    failureReason: '',
    starterTutorialSeen: false,
  };
}

export function getSector(id: number): Sector {
  const sector = SECTORS.find((item) => item.id === id);
  if (!sector) throw new Error(`Unknown sector id: ${id}`);
  return sector;
}

export function getBuilding(id: BuildingId): BuildingDefinition {
  const building = BUILDINGS.find((item) => item.id === id);
  if (!building) throw new Error(`Unknown building: ${id}`);
  return building;
}

export function isFirstBuildFree(colony: ColonySave, buildingId: BuildingId): boolean {
  return (
    STARTER_FREE_BUILDING_IDS.includes(buildingId) &&
    !Object.values(colony.buildings).some((buildings) => buildings.includes(buildingId))
  );
}

export function canUnlock(colony: ColonySave, sector: Sector): boolean {
  return (
    !colony.unlockedSectors.includes(sector.id) &&
    colony.people >= sector.crewRequired &&
    colony.resources.metal >= sector.unlockMetal &&
    colony.resources.regolith >= sector.unlockRegolith &&
    !colony.failed
  );
}

export function unlockSector(colony: ColonySave, sectorId: number): ColonySave {
  const sector = getSector(sectorId);
  if (colony.unlockedSectors.includes(sectorId)) {
    throw new Error(`${sector.name} is already unlocked.`);
  }
  if (!canUnlock(colony, sector)) {
    throw new Error('You do not yet meet the crew and material requirements.');
  }

  return {
    ...colony,
    currentSector: sectorId,
    unlockedSectors: [...colony.unlockedSectors, sectorId],
    resources: {
      ...colony.resources,
      metal: colony.resources.metal - sector.unlockMetal,
      regolith: colony.resources.regolith - sector.unlockRegolith,
    },
    buildings: { ...colony.buildings, [sectorId]: [] },
    buildingPlacements: { ...colony.buildingPlacements, [sectorId]: [] },
  };
}

function placementDistance(
  first: BuildingPlacement,
  second: BuildingPlacement,
): number {
  return Math.hypot((first.x - second.x) * 250, (first.y - second.y) * 160);
}

export function isValidBuildingPlacement(
  colony: ColonySave,
  placement: BuildingPlacement,
): boolean {
  if (
    !Number.isFinite(placement.x) ||
    !Number.isFinite(placement.y) ||
    placement.x < 12 / 250 ||
    placement.x > 238 / 250 ||
    placement.y < 12 / 160 ||
    placement.y > 148 / 160
  ) {
    return false;
  }

  const sectorBuildings = colony.buildings[colony.currentSector] ?? [];
  const currentPlacements = colony.buildingPlacements?.[colony.currentSector] ?? [];
  const hasHabitat = sectorBuildings.includes('habitat');
  const base = { x: 0.5, y: (hasHabitat ? 85 : 91) / 160 };
  if (placementDistance(placement, base) < (hasHabitat ? 32 : 25)) return false;

  const occupiedByBuilding = currentPlacements.some(
    (currentPlacement) => placementDistance(placement, currentPlacement) < 20,
  );
  if (occupiedByBuilding) return false;

  const fieldSites = [
    { x: 105 / 250, y: 116 / 160 },
    ...(getSector(colony.currentSector).iceDeposits
      ? [{ x: 212 / 250, y: 72 / 160 }]
      : []),
  ];
  return fieldSites.every((site) => placementDistance(placement, site) >= 17);
}

export function getDefaultBuildingPlacement(colony: ColonySave): BuildingPlacement {
  for (const candidate of DEFAULT_BUILDING_PLACEMENTS) {
    if (isValidBuildingPlacement(colony, candidate)) return { ...candidate };
  }
  for (let y = 16; y <= 144; y += 16) {
    for (let x = 16; x <= 232; x += 18) {
      const candidate = { x: x / 250, y: y / 160 };
      if (isValidBuildingPlacement(colony, candidate)) return candidate;
    }
  }
  throw new Error('There is no clear map space left for another facility.');
}

export function buildStructure(
  colony: ColonySave,
  buildingId: BuildingId,
  placement?: BuildingPlacement,
): ColonySave {
  if (colony.failed) throw new Error('The mission has ended.');
  if (!colony.unlockedSectors.includes(colony.currentSector)) {
    throw new Error('Unlock this sector before building here.');
  }
  const definition = getBuilding(buildingId);
  if (buildingId === 'habitat') throw new Error('The basic habitat is included with the landing.');
  const placed = colony.buildings[colony.currentSector] ?? [];
  const firstBuildFree = isFirstBuildFree(colony, buildingId);
  const metalCost = firstBuildFree ? 0 : definition.metal;
  const regolithCost = firstBuildFree ? 0 : definition.regolith;
  if (
    colony.resources.metal < metalCost ||
    colony.resources.regolith < regolithCost
  ) {
    throw new Error(`Not enough metal or lunar regolith to build ${definition.name}.`);
  }
  const buildingPlacement = placement ?? getDefaultBuildingPlacement(colony);
  if (!isValidBuildingPlacement(colony, buildingPlacement)) {
    throw new Error('Choose an open map location away from other buildings and field sites.');
  }

  return {
    ...colony,
    resources: {
      ...colony.resources,
      metal: colony.resources.metal - metalCost,
      regolith: colony.resources.regolith - regolithCost,
    },
    buildings: {
      ...colony.buildings,
      [colony.currentSector]: [...placed, buildingId],
    },
    buildingPlacements: {
      ...colony.buildingPlacements,
      [colony.currentSector]: [
        ...colony.buildingPlacements[colony.currentSector],
        { buildingId, ...buildingPlacement },
      ],
    },
  };
}

export function canPerformFieldwork(
  colony: ColonySave,
  fieldworkId: FieldworkId,
): boolean {
  const fieldwork = FIELDWORK.find((item) => item.id === fieldworkId);
  if (!fieldwork || colony.failed || colony.paused || colony.lastFieldworkDay === colony.day) {
    return false;
  }
  const sector = getSector(colony.currentSector);
  if (fieldworkId === 'ice-core' && !sector.iceDeposits) return false;
  return colony.resources.energy >= fieldwork.energyCost;
}

export function performFieldwork(
  colony: ColonySave,
  fieldworkId: FieldworkId,
): ColonySave {
  const fieldwork = FIELDWORK.find((item) => item.id === fieldworkId);
  if (!fieldwork) throw new Error(`Unknown fieldwork operation: ${fieldworkId}.`);
  if (!canPerformFieldwork(colony, fieldworkId)) {
    if (colony.paused) throw new Error('Resume the simulation before starting fieldwork.');
    if (colony.failed) throw new Error('The mission has ended.');
    if (colony.lastFieldworkDay === colony.day) {
      throw new Error('The crew has already completed fieldwork this lunar day.');
    }
    if (fieldworkId === 'ice-core' && !getSector(colony.currentSector).iceDeposits) {
      throw new Error('This sector has no known ice deposits to sample.');
    }
    throw new Error(`Not enough energy to ${fieldwork.name.toLowerCase()}.`);
  }

  const resources = { ...colony.resources, energy: colony.resources.energy - fieldwork.energyCost };
  RESOURCE_ORDER.forEach((resource) => {
    resources[resource] += fieldwork.production[resource] ?? 0;
  });
  return { ...colony, resources, lastFieldworkDay: colony.day };
}

export function advanceDay(colony: ColonySave): ColonySave {
  if (colony.paused || colony.failed) return colony;

  const production: Resources = {
    water: 0,
    food: 0,
    energy: 0,
    oxygen: 0,
    metal: 0,
    regolith: 0,
  };
  const consumption: Resources = {
    water: colony.people,
    food: colony.people,
    energy: Math.ceil(colony.people / 2),
    oxygen: colony.people,
    metal: 0,
    regolith: 0,
  };

  Object.values(colony.buildings)
    .flat()
    .forEach((buildingId) => {
      const building = getBuilding(buildingId);
      RESOURCE_ORDER.forEach((resource) => {
        production[resource] += building.production[resource] ?? 0;
        consumption[resource] += building.consumption[resource] ?? 0;
      });
    });

  const resources = { ...colony.resources };
  for (const resource of RESOURCE_ORDER) {
    resources[resource] = Math.max(
      0,
      resources[resource] + production[resource] - consumption[resource],
    );
  }

  const missingLifeSupport = (['water', 'food', 'oxygen', 'energy'] as const).find(
    (resource) => colony.resources[resource] + production[resource] - consumption[resource] < 0,
  );
  const failureReason = missingLifeSupport
    ? `The crew ran out of ${RESOURCE_INFO[missingLifeSupport].label.toLowerCase()}.`
    : '';

  return {
    ...colony,
    resources,
    day: colony.day + 1,
    elapsedMs: 0,
    paused: Boolean(failureReason),
    failed: Boolean(failureReason),
    failureReason,
  };
}

function removeDiscontinuedFacilities(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const rawSave = value as Record<string, unknown>;
  const buildings = rawSave.buildings;
  const buildingPlacements = rawSave.buildingPlacements;
  const cleanedBuildings =
    buildings && typeof buildings === 'object' && !Array.isArray(buildings)
      ? Object.fromEntries(
          Object.entries(buildings).map(([sectorId, sectorBuildings]) => [
            sectorId,
            Array.isArray(sectorBuildings)
              ? sectorBuildings.filter(
                  (buildingId) =>
                    typeof buildingId !== 'string' ||
                    !DISCONTINUED_BUILDING_IDS.has(buildingId),
                )
              : sectorBuildings,
          ]),
        )
      : buildings;
  const cleanedPlacements =
    buildingPlacements && typeof buildingPlacements === 'object' && !Array.isArray(buildingPlacements)
      ? Object.fromEntries(
          Object.entries(buildingPlacements).map(([sectorId, sectorPlacements]) => {
            if (Array.isArray(sectorPlacements)) {
              return [
                sectorId,
                sectorPlacements.filter((placement) => {
                  if (!placement || typeof placement !== 'object' || Array.isArray(placement)) {
                    return true;
                  }
                  const buildingId = (placement as Record<string, unknown>).buildingId;
                  return typeof buildingId !== 'string' || !DISCONTINUED_BUILDING_IDS.has(buildingId);
                }),
              ];
            }
            if (
              sectorPlacements &&
              typeof sectorPlacements === 'object' &&
              !Array.isArray(sectorPlacements)
            ) {
              return [
                sectorId,
                Object.fromEntries(
                  Object.entries(sectorPlacements).filter(
                    ([buildingId]) => !DISCONTINUED_BUILDING_IDS.has(buildingId),
                  ),
                ),
              ];
            }
            return [sectorId, sectorPlacements];
          }),
        )
      : buildingPlacements;
  return {
    ...rawSave,
    buildings: cleanedBuildings,
    buildingPlacements: cleanedPlacements,
  };
}

export function validateSave(value: unknown): ColonySave {
  if (!value || typeof value !== 'object') {
    throw new Error('Save data is not an object.');
  }
  const rawSave = removeDiscontinuedFacilities(value) as Partial<ColonySave> & { version?: number };
  if (
    rawSave.version !== 1 &&
    rawSave.version !== 2 &&
    rawSave.version !== 3 &&
    rawSave.version !== 4 &&
    rawSave.version !== 5 &&
    rawSave.version !== SAVE_VERSION
  ) {
    throw new Error(`Unsupported save version: ${String(rawSave.version)}.`);
  }
  const save: Partial<ColonySave> =
    rawSave.version === SAVE_VERSION
      ? rawSave
      : rawSave.version === 5
        ? { ...rawSave, version: SAVE_VERSION }
      : rawSave.version === 4
        ? { ...rawSave, version: SAVE_VERSION, starterTutorialSeen: false }
        : {
            ...rawSave,
            version: SAVE_VERSION,
            lastFieldworkDay: rawSave.version === 1 ? 0 : rawSave.lastFieldworkDay,
            buildingPlacements: migrateBuildingPlacements(
              rawSave.buildings,
              rawSave.buildingPlacements,
              rawSave.version === 3,
            ),
            starterTutorialSeen: false,
          };
  if (save.version !== SAVE_VERSION) {
    throw new Error(`Unsupported save version: ${String(save.version)}.`);
  }
  if (
    typeof save.startingSector !== 'number' ||
    typeof save.currentSector !== 'number' ||
    typeof save.people !== 'number' ||
    typeof save.day !== 'number' ||
    !Array.isArray(save.unlockedSectors) ||
    !save.resources ||
    typeof save.resources !== 'object' ||
    Array.isArray(save.resources) ||
    !save.buildings ||
    typeof save.buildings !== 'object' ||
    Array.isArray(save.buildings) ||
    !save.buildingPlacements ||
    typeof save.buildingPlacements !== 'object' ||
    Array.isArray(save.buildingPlacements) ||
    typeof save.elapsedMs !== 'number' ||
    typeof save.lastFieldworkDay !== 'number' ||
    typeof save.paused !== 'boolean' ||
    typeof save.failed !== 'boolean' ||
    typeof save.failureReason !== 'string' ||
    typeof save.starterTutorialSeen !== 'boolean'
  ) {
    throw new Error('Save data is incomplete or invalid.');
  }

  const resources = save.resources;
  const sectorIds = new Set(SECTORS.map((sector) => sector.id));
  const resourceKeys = RESOURCE_ORDER;
  if (
    !sectorIds.has(save.startingSector) ||
    !sectorIds.has(save.currentSector) ||
    save.people < 1 ||
    save.day < 1 ||
    !Number.isInteger(save.lastFieldworkDay) ||
    save.lastFieldworkDay! < 0 ||
    save.lastFieldworkDay! > save.day ||
    save.unlockedSectors.some((id) => !Number.isInteger(id) || !sectorIds.has(id)) ||
    !save.unlockedSectors.includes(save.startingSector) ||
    !save.unlockedSectors.includes(save.currentSector) ||
    resourceKeys.some((key) => {
      const amount = resources[key];
      return typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0;
    })
  ) {
    throw new Error('Save data contains invalid colony values.');
  }

  for (const [sectorId, buildings] of Object.entries(save.buildings)) {
    if (
      !sectorIds.has(Number(sectorId)) ||
      !Array.isArray(buildings) ||
      buildings.some((id) => !BUILDINGS.some((building) => building.id === id))
    ) {
      throw new Error('Save data contains invalid buildings.');
    }
  }
  for (const [sectorId, placements] of Object.entries(save.buildingPlacements)) {
    const sectorBuildings = save.buildings[Number(sectorId)] ?? [];
    if (
      !sectorIds.has(Number(sectorId)) ||
      !Array.isArray(placements)
    ) {
      throw new Error('Save data contains invalid building placements.');
    }
    for (const placement of placements) {
      if (
        !placement ||
        typeof placement !== 'object' ||
        !BUILDINGS.some((building) => building.id === placement.buildingId) ||
        placement.buildingId === 'habitat' ||
        !sectorBuildings.includes(placement.buildingId) ||
        !Number.isFinite(placement.x) ||
        !Number.isFinite(placement.y) ||
        placement.x < 0 ||
        placement.x > 1 ||
        placement.y < 0 ||
        placement.y > 1
      ) {
        throw new Error('Save data contains invalid building placements.');
      }
    }
    const remainingBuildingCounts = new Map<BuildingId, number>();
    for (const buildingId of sectorBuildings) {
      if (buildingId !== 'habitat') {
        remainingBuildingCounts.set(
          buildingId,
          (remainingBuildingCounts.get(buildingId) ?? 0) + 1,
        );
      }
    }
    for (const { buildingId } of placements) {
      remainingBuildingCounts.set(buildingId, (remainingBuildingCounts.get(buildingId) ?? 0) - 1);
    }
    if ([...remainingBuildingCounts.values()].some((count) => count !== 0)) {
      throw new Error('Save data is missing a facility location.');
    }
  }
  for (const [sectorId, buildings] of Object.entries(save.buildings)) {
    const placements = save.buildingPlacements[Number(sectorId)] ?? [];
    if (placements.length !== buildings.filter((id) => id !== 'habitat').length) {
      throw new Error('Save data is missing a facility location.');
    }
  }
  if (
    !Number.isFinite(save.elapsedMs) ||
    save.elapsedMs! < 0 ||
    save.elapsedMs! >= DAY_LENGTH_MS
  ) {
    throw new Error('Save data contains an invalid day timer.');
  }

  return save as ColonySave;
}

function migrateBuildingPlacements(
  buildings: ColonySave['buildings'] | undefined,
  previousPlacements?: unknown,
  preserveExisting = false,
): ColonySave['buildingPlacements'] {
  if (!buildings || typeof buildings !== 'object' || Array.isArray(buildings)) return {};

  let oldPlacementsBySector: Record<string, unknown> = {};
  if (preserveExisting) {
    if (
      !previousPlacements ||
      typeof previousPlacements !== 'object' ||
      Array.isArray(previousPlacements)
    ) {
      throw new Error('Save data contains invalid building placements.');
    }
    oldPlacementsBySector = previousPlacements as Record<string, unknown>;
  }

  const placements: ColonySave['buildingPlacements'] = {};
  for (const [sectorId, buildingIds] of Object.entries(buildings)) {
    if (!Array.isArray(buildingIds)) continue;
    const facilityIds = buildingIds.filter((buildingId) => buildingId !== 'habitat');
    const oldSectorPlacements = oldPlacementsBySector[sectorId];
    if (
      preserveExisting &&
      oldSectorPlacements !== undefined &&
      (!oldSectorPlacements || typeof oldSectorPlacements !== 'object' || Array.isArray(oldSectorPlacements))
    ) {
      throw new Error('Save data contains invalid building placements.');
    }
    if (preserveExisting && new Set(facilityIds).size !== facilityIds.length) {
      throw new Error('Save data contains invalid buildings.');
    }
    const oldPlacementRecord =
      oldSectorPlacements && typeof oldSectorPlacements === 'object'
        ? (oldSectorPlacements as Record<string, unknown>)
        : {};
    if (
      preserveExisting &&
      Object.keys(oldPlacementRecord).some(
        (buildingId) => !facilityIds.some((placedId) => placedId === buildingId),
      )
    ) {
      throw new Error('Save data contains invalid building placements.');
    }

    const sectorPlacements: PlacedBuilding[] = [];
    let facilityIndex = 0;
    for (const buildingId of buildingIds) {
      if (buildingId === 'habitat') continue;
      const oldPlacement = oldPlacementRecord[buildingId];
      if (preserveExisting && oldPlacement === undefined) {
        throw new Error('Save data is missing a facility location.');
      }
      let location: BuildingPlacement;
      if (oldPlacement === undefined) {
        location = DEFAULT_BUILDING_PLACEMENTS[facilityIndex % DEFAULT_BUILDING_PLACEMENTS.length];
      } else {
        if (!oldPlacement || typeof oldPlacement !== 'object' || Array.isArray(oldPlacement)) {
          throw new Error('Save data contains invalid building placements.');
        }
        const oldCoordinates = oldPlacement as Record<string, unknown>;
        if (typeof oldCoordinates.x !== 'number' || typeof oldCoordinates.y !== 'number') {
          throw new Error('Save data contains invalid building placements.');
        }
        location = { x: oldCoordinates.x, y: oldCoordinates.y };
      }
      sectorPlacements.push({ buildingId, ...location });
      facilityIndex += 1;
    }
    placements[Number(sectorId)] = sectorPlacements;
  }
  return placements;
}

export function loadColony(): { colony: ColonySave | null; error: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { colony: null, error: null };
    const parsed: unknown = JSON.parse(raw);
    const colony = validateSave(parsed);
    const storedVersion =
      typeof parsed === 'object' && parsed !== null && 'version' in parsed
        ? parsed.version
        : undefined;
    if (storedVersion !== colony.version) {
      const saveError = saveColony(colony);
      if (saveError) {
        return {
          colony,
          error: `The mission was loaded and upgraded, but the updated save could not be stored: ${saveError}`,
        };
      }
    }
    return { colony, error: null };
  } catch (error) {
    return {
      colony: null,
      error:
        error instanceof Error
          ? error.message
          : 'The saved colony could not be read from this browser.',
    };
  }
}

export function saveColony(colony: ColonySave): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colony));
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : 'The colony could not be saved in this browser.';
  }
}
