import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  DUST_STORM_VISUAL_DURATION_MS,
  SECTORS,
  advanceDay,
  buildStructure,
  canPerformFieldwork,
  canUnlock,
  createColony,
  isFirstBuildFree,
  createSolarFlareHazard,
  getDailyResourceRates,
  getHazardCost,
  getHazardsForSector,
  getMaintenanceChance,
  isValidBuildingPlacement,
  performFieldwork,
  repairHazard,
  unlockSector,
  validateSave,
} from './game';

describe('Lunar Frontier game rules', () => {
  it('starts with one habitat, seven crew, and the other sectors locked', () => {
    const colony = createColony(4);

    expect(SECTORS).toHaveLength(15);
    expect(colony.people).toBe(7);
    expect(colony.day).toBe(1);
    expect(colony.unlockedSectors).toEqual([4]);
    expect(colony.buildings[4]).toEqual(['habitat']);
    expect(colony.starterTutorialSeen).toBe(false);
    expect(colony.resources).toEqual({
      water: 70,
      food: 70,
      energy: 80,
      oxygen: 70,
      metal: 110,
      regolith: 120,
    });
  });

  it('uses the specified building-production modifiers for every sector', () => {
    expect(SECTORS.map(({ name, productionModifiers }) => [name, productionModifiers])).toEqual([
      ['South Pole', { water: 25, metal: -20 }],
      ['Southern polar field', { water: 20, oxygen: 25 }],
      ['North Pole', { water: 40, regolith: -40 }],
      ['Northern ice fields', { water: 15 }],
      ['Basalt Plains', { metal: 40, regolith: -40 }],
      ['Wrinkle Ridges', { metal: 45, water: -40 }],
      ['Volcanic Domes', { food: 25, metal: 10 }],
      ['Sinuous Rilles', { energy: 50, regolith: -50 }],
      ['Procellarum Terrane', { metal: 55, oxygen: -50 }],
      ['Northern poles', { water: 20 }],
      ['Lunar Highlands', { regolith: 15, oxygen: 20, water: -35 }],
      ['Basin Blankets', { metal: 25, regolith: 20 }],
      ['Impact Basin', { metal: 30, regolith: 20, energy: -35 }],
      ['Massif concentric mountain', { regolith: 55, metal: 50, oxygen: -45, water: -45 }],
      ['Deep shadowed crater', { water: 45, metal: 40, energy: -65 }],
    ]);
  });

  it('charges the listed cost for each repeat facility placement', () => {
    const colony = createColony(4);
    const first = buildStructure(colony, 'medical-bay');
    const built = buildStructure(first, 'medical-bay');

    expect(built.resources.metal).toBe(74);
    expect(built.resources.regolith).toBe(92);
    expect(built.buildings[4].filter((id) => id === 'medical-bay')).toHaveLength(2);
    expect(built.buildingPlacements[4]).toHaveLength(2);
    expect(built.buildingPlacements[4][0]).not.toEqual(built.buildingPlacements[4][1]);
    expect(BUILDINGS.find((building) => building.id === 'medical-bay')?.metal).toBe(18);
  });

  it('makes the first placement of each starter facility free and charges for repeats', () => {
    let colony = createColony(4);
    const starterBuildings = [
      'living-quarters',
      'solar-panels',
      'soil-farm',
      'ice-extractor',
    ] as const;

    for (const buildingId of starterBuildings) {
      expect(isFirstBuildFree(colony, buildingId)).toBe(true);
      const resourcesBefore = { ...colony.resources };
      const first = buildStructure(colony, buildingId);
      expect(first.resources).toEqual(resourcesBefore);
      expect(isFirstBuildFree(first, buildingId)).toBe(false);

      const definition = BUILDINGS.find((building) => building.id === buildingId)!;
      const repeat = buildStructure(first, buildingId);
      expect(repeat.resources.metal).toBe(first.resources.metal - definition.metal);
      expect(repeat.resources.regolith).toBe(first.resources.regolith - definition.regolith);
      colony = repeat;
    }

    expect(isFirstBuildFree(colony, 'nuclear-power')).toBe(false);
  });

  it('uses the starter-free allowance across the whole colony, not once per sector', () => {
    const first = buildStructure(createColony(4), 'solar-panels');
    const outpost = unlockSector(first, 0);
    const repeated = buildStructure(outpost, 'solar-panels');

    expect(repeated.resources.metal).toBe(outpost.resources.metal - 8);
    expect(repeated.resources.regolith).toBe(outpost.resources.regolith - 6);
  });

  it('saves a chosen facility location and rejects blocked or out-of-map spots', () => {
    const colony = createColony(4);
    const placement = { x: 0.15, y: 0.8 };

    expect(isValidBuildingPlacement(colony, placement)).toBe(true);
    const built = buildStructure(colony, 'solar-panels', placement);
    expect(built.buildingPlacements[4][0]).toMatchObject({
      buildingId: 'solar-panels',
      ...placement,
    });
    expect(() => buildStructure(colony, 'solar-panels', { x: 0.5, y: 85 / 160 })).toThrow(
      'open map location',
    );
    expect(() => buildStructure(built, 'medical-bay', placement)).toThrow('open map location');
    expect(isValidBuildingPlacement(colony, { x: 0, y: 0.5 })).toBe(false);
  });

  it('applies daily production for every instance of a facility type', () => {
    let colony = createColony(4);
    colony = buildStructure(colony, 'solar-panels');
    colony = buildStructure(colony, 'solar-panels');

    expect(advanceDay(colony).resources.energy).toBe(106);
    expect(validateSave(colony)).toEqual(colony);
  });

  it('applies sector modifiers to base building output each day without compounding', () => {
    let colony = { ...createColony(0), randomSeed: 3200 };
    colony = buildStructure(colony, 'ice-extractor');
    colony = buildStructure(colony, 'deep-rock-mining');

    const firstDay = advanceDay(colony);
    const secondDay = advanceDay(firstDay);

    expect(firstDay.resources).toMatchObject({
      water: 76.75,
      metal: 84.4,
    });
    expect(secondDay.resources).toMatchObject({
      water: 83.5,
      metal: 90.8,
    });
  });

  it('builds crew homes without changing the colony population', () => {
    const colony = createColony(4);
    const built = buildStructure(colony, 'living-quarters');

    expect(built.resources.metal).toBe(110);
    expect(built.resources.regolith).toBe(120);
    expect(built.buildings[4]).toContain('living-quarters');
    expect(built.people).toBe(7);
  });

  it('builds each new facility as a separate option', () => {
    const newBuildings = [
      'solar-panels',
      'nuclear-power',
      'medical-bay',
      'oxygen-plant',
      'soil-farm',
      'hydroponic-farm',
      'bug-protein-processor',
      'regolith-collector',
      'deep-rock-mining',
    ] as const;

    for (const buildingId of newBuildings) {
      const built = buildStructure(createColony(4), buildingId);
      expect(built.buildings[4]).toContain(buildingId);
    }
  });

  it('balances the two farms by water and applies the protein processor food cycle', () => {
    const soilFarm = BUILDINGS.find((building) => building.id === 'soil-farm')!;
    const hydroponicFarm = BUILDINGS.find((building) => building.id === 'hydroponic-farm')!;
    const proteinProcessor = BUILDINGS.find((building) => building.id === 'bug-protein-processor')!;

    expect(soilFarm.consumption.water).toBeLessThan(hydroponicFarm.consumption.water!);
    expect(soilFarm.production.food).toBeLessThan(hydroponicFarm.production.food!);
    expect(proteinProcessor.production.food).toBeGreaterThan(proteinProcessor.consumption.food!);

    const processed = advanceDay(buildStructure(createColony(4), 'bug-protein-processor'));
    expect(processed.resources.food).toBe(70);
  });

  it('applies new power and life-support production on day transition', () => {
    let colony = createColony(4);
    for (const buildingId of ['solar-panels', 'nuclear-power', 'oxygen-plant'] as const) {
      colony = buildStructure(colony, buildingId);
    }

    const nextDay = advanceDay(colony);
    expect(nextDay.resources).toMatchObject({
      energy: 119,
      water: 64,
      oxygen: 79,
    });
  });

  it('applies daily production and crew consumption', () => {
    let colony = createColony(4);
    for (const building of ['ice-extractor', 'hydroponics', 'oxygen-recycler'] as const) {
      colony = buildStructure(colony, building);
    }
    const nextDay = advanceDay(colony);

    expect(nextDay.day).toBe(2);
    expect(nextDay.resources).toMatchObject({
      water: 72,
      food: 75,
      energy: 83,
      oxygen: 75,
    });
    expect(nextDay.failed).toBe(false);
  });

  it('ends the mission when the crew cannot meet a life-support need', () => {
    const colony = createColony(4);
    colony.resources.water = 0;
    const nextDay = advanceDay(colony);

    expect(nextDay.failed).toBe(true);
    expect(nextDay.paused).toBe(true);
    expect(nextDay.failureReason).toContain('water');
  });

  it('ends the mission when a building hazard remains unresolved for two lunar days', () => {
    const colony = {
      ...createColony(4),
      hazardEvents: [
        {
          id: 1,
          kind: 'structural-decay' as const,
          day: 1,
          sectorId: 4,
          buildingId: 'habitat' as const,
        },
      ],
      nextHazardId: 2,
    };

    const afterOneDay = advanceDay(colony);
    expect(afterOneDay.day).toBe(2);
    expect(afterOneDay.failed).toBe(false);

    const overdue = advanceDay(afterOneDay);
    expect(overdue.day).toBe(3);
    expect(overdue.failed).toBe(true);
    expect(overdue.paused).toBe(true);
    expect(overdue.failureReason).toContain('2 lunar days');
  });

  it('does not treat a visual-only dust storm as an overdue structure hazard', () => {
    const now = 100_000;
    const colony = {
      ...createColony(4),
      hazardEvents: [
        {
          id: 1,
          kind: 'dust-storm' as const,
          day: 1,
          sectorId: null,
          buildingId: null,
          dustStormVisualEndsAt: now + DUST_STORM_VISUAL_DURATION_MS,
        },
      ],
      nextHazardId: 2,
    };

    const duringStorm = advanceDay(colony, now + 45_000);
    expect(duringStorm.hazardEvents).toHaveLength(1);
    const afterStorm = advanceDay(duringStorm, now + 90_000);
    expect(afterStorm.day).toBe(3);
    expect(afterStorm.hazardEvents.some((event) => event.kind === 'dust-storm')).toBe(false);
    expect(afterStorm.failed).toBe(false);
  });

  it('associates targeted and global hazards with globe sector warnings', () => {
    const built = buildStructure(createColony(4), 'solar-panels');
    const colony = {
      ...built,
      unlockedSectors: [4, 5],
      buildings: { ...built.buildings, 5: ['habitat' as const] },
      hazardEvents: [
        {
          id: 1,
          kind: 'structural-decay' as const,
          day: 1,
          sectorId: 4,
          buildingId: 'solar-panels' as const,
        },
        {
          id: 2,
          kind: 'meteorite-impact' as const,
          day: 1,
          sectorId: 5,
          buildingId: 'habitat' as const,
        },
        {
          id: 3,
          kind: 'dust-storm' as const,
          day: 1,
          sectorId: null,
          buildingId: null,
          dustStormVisualEndsAt: 60_000,
        },
      ],
      nextHazardId: 4,
    };

    expect(getHazardsForSector(colony, 4).map((event) => event.id)).toEqual([1, 3]);
    expect(getHazardsForSector(colony, 5).map((event) => event.id)).toEqual([2, 3]);
    expect(getHazardsForSector(colony, 6).map((event) => event.id)).toEqual([3]);
  });

  it('starts the solar-storm failure deadline after its visuals end', () => {
    const now = 100_000;
    const colony = {
      ...buildStructure(createColony(4), 'solar-panels'),
      hazardEvents: [
        {
          id: 1,
          kind: 'dust-storm' as const,
          day: 1,
          sectorId: null,
          buildingId: null,
          dustStormVisualEndsAt: now + DUST_STORM_VISUAL_DURATION_MS,
        },
      ],
      nextHazardId: 2,
      hazardInterval: 100,
      randomSeed: 0x8000_0000,
    };

    const duringStorm = advanceDay(colony, now + 45_000);
    expect(duringStorm.failed).toBe(false);
    expect(duringStorm.hazardEvents[0].dustStormFailureDeadlineDay).toBeUndefined();

    const firstPostStormDay = advanceDay(duringStorm, now + 90_000);
    expect(firstPostStormDay.day).toBe(3);
    expect(firstPostStormDay.failed).toBe(false);
    expect(firstPostStormDay.hazardEvents[0].dustStormFailureDeadlineDay).toBe(5);

    const onePostStormDay = advanceDay(firstPostStormDay, now + 135_000);
    expect(onePostStormDay.day).toBe(4);
    expect(onePostStormDay.failed).toBe(false);

    const overdue = advanceDay(onePostStormDay, now + 180_000);
    expect(overdue.day).toBe(5);
    expect(overdue.failed).toBe(true);
    expect(overdue.failureReason).toContain('dust storm');
  });

  it('scales maintenance risk linearly with unlocked sectors and caps it at certainty', () => {
    expect(getMaintenanceChance(1)).toBe(0.2);
    expect(getMaintenanceChance(3)).toBeCloseTo(0.6);
    expect(getMaintenanceChance(5)).toBe(1);
    expect(getMaintenanceChance(15)).toBe(1);
  });

  it('keeps solar-flare hazard generation disabled for the future DONKI integration', () => {
    expect(createSolarFlareHazard()).toBeNull();
  });

  it('can generate a visual-only dust storm without solar panels', () => {
    const colony = {
      ...createColony(4),
      hazardInterval: 10,
      hazardProgress: 9,
      randomSeed: 0x8000_0000,
    };

    expect(colony.buildings[4]).not.toContain('solar-panels');
    const now = 100_000;
    const nextDay = advanceDay(colony, now);
    expect(nextDay.hazardEvents).toContainEqual(
      expect.objectContaining({
        kind: 'dust-storm',
        day: 2,
        sectorId: null,
        buildingId: null,
        dustStormVisualEndsAt: now + DUST_STORM_VISUAL_DURATION_MS,
      }),
    );

    const withoutStorm = {
      ...nextDay,
      hazardEvents: nextDay.hazardEvents.filter((event) => event.kind !== 'dust-storm'),
    };
    expect(getDailyResourceRates(nextDay)).toEqual(getDailyResourceRates(withoutStorm));
  });

  it('reduces solar output during dust storms and restores it when repaired', () => {
    const built = buildStructure(createColony(4), 'solar-panels');
    const storm = {
      ...built,
      hazardEvents: [
        {
          id: 1,
          kind: 'dust-storm' as const,
          day: 1,
          sectorId: null,
          buildingId: null,
          dustStormVisualEndsAt: 0,
        },
      ],
      nextHazardId: 2,
    };

    expect(validateSave(storm)).toEqual(storm);
    expect(getDailyResourceRates(storm).energy).toBe(14);
    const repaired = repairHazard(storm, 1);
    expect(repaired.resources).toMatchObject({ metal: 109, regolith: 119 });
    expect(repaired.resources).toMatchObject({ metal: 109, regolith: 119 });
    expect(getDailyResourceRates(repaired).energy).toBe(18);
  });

  it('takes a damaged facility offline until its maintenance cost is paid', () => {
    const built = buildStructure(createColony(4), 'solar-panels');
    const damaged = {
      ...built,
      hazardEvents: [
        {
          id: 1,
          kind: 'solar-panel-maintenance' as const,
          day: 1,
          sectorId: 4,
          buildingId: 'solar-panels' as const,
        },
      ],
      nextHazardId: 2,
    };

    expect(getDailyResourceRates(damaged).energy).toBe(10);
    expect(getHazardCost(damaged.hazardEvents[0])).toEqual({ metal: 1, regolith: 1 });
    expect(() => repairHazard({ ...damaged, paused: true }, 1)).toThrow('Resume the simulation');
    expect(() =>
      repairHazard(
        { ...damaged, resources: { ...damaged.resources, metal: 0 } },
        1,
      ),
    ).toThrow('Not enough metal');
    expect(() =>
      repairHazard({ ...damaged, failed: true, paused: true }, 1),
    ).toThrow('mission has ended');
    const repaired = repairHazard(damaged, 1);
    expect(repaired.resources).toMatchObject({ metal: 109, regolith: 119 });
    expect(repaired.resources).toMatchObject({ metal: 109, regolith: 119 });
    expect(getDailyResourceRates(repaired).energy).toBe(18);
  });

  it('uses the supplied meteorite, structural, and facility repair costs', () => {
    expect(
      getHazardCost({
        id: 1,
        kind: 'meteorite-impact',
        day: 1,
        sectorId: 4,
        buildingId: 'habitat',
      }),
    ).toEqual({ metal: 2, regolith: 4 });
    expect(
      getHazardCost({
        id: 2,
        kind: 'structural-decay',
        day: 1,
        sectorId: 4,
        buildingId: 'habitat',
      }),
    ).toEqual({ metal: 2, regolith: 2 });
    expect(
      getHazardCost({
        id: 3,
        kind: 'facility-maintenance',
        day: 1,
        sectorId: 4,
        buildingId: 'nuclear-power',
      }),
    ).toEqual({ metal: 2, regolith: 3 });
    expect(
      getHazardCost({
        id: 4,
        kind: 'facility-maintenance',
        day: 1,
        sectorId: 4,
        buildingId: 'oxygen-plant',
      }),
    ).toEqual({ metal: 2 });
    expect(
      getHazardCost({
        id: 5,
        kind: 'facility-maintenance',
        day: 1,
        sectorId: 4,
        buildingId: 'soil-farm',
      }),
    ).toEqual({ water: 2 });
    expect(
      getHazardCost({
        id: 6,
        kind: 'facility-maintenance',
        day: 1,
        sectorId: 4,
        buildingId: 'hydroponic-farm',
      }),
    ).toEqual({ water: 3, metal: 1 });
  });

  it('generates one environmental hazard on its randomized sector-day interval', () => {
    const colony = {
      ...createColony(4),
      hazardInterval: 10,
      hazardProgress: 9,
      randomSeed: 1,
    };

    const nextDay = advanceDay(colony);
    const environmentalEvents = nextDay.hazardEvents.filter(
      (event) => event.kind === 'meteorite-impact' || event.kind === 'dust-storm',
    );

    expect(environmentalEvents).toHaveLength(1);
    expect(environmentalEvents[0].day).toBe(2);
    expect(nextDay.hazardProgress).toBe(0);
    expect(nextDay.hazardInterval).toBeGreaterThanOrEqual(10);
    expect(nextDay.hazardInterval).toBeLessThanOrEqual(15);
  });

  it('accelerates the environmental hazard interval as sectors unlock', () => {
    const colony = {
      ...createColony(4),
      unlockedSectors: [4, 0],
      hazardInterval: 10,
      hazardProgress: 8,
      randomSeed: 1,
    };

    const nextDay = advanceDay(colony);
    expect(
      nextDay.hazardEvents.some(
        (event) => event.kind === 'meteorite-impact' || event.kind === 'dust-storm',
      ),
    ).toBe(true);
    expect(nextDay.hazardProgress).toBe(0);
  });

  it('allows maintenance incidents to stack across built structures', () => {
    let colony = buildStructure(createColony(4), 'solar-panels');
    colony = {
      ...colony,
      unlockedSectors: [4, 0, 1, 2, 3],
      hazardInterval: 15,
    };

    const nextDay = advanceDay(colony);
    const maintenanceEvents = nextDay.hazardEvents.filter(
      (event) =>
        event.kind === 'solar-panel-maintenance' ||
        event.kind === 'structural-decay' ||
        event.kind === 'facility-maintenance',
    );

    expect(maintenanceEvents).toHaveLength(2);
    expect(new Set(maintenanceEvents.map((event) => event.buildingId)).size).toBe(2);
  });

  it('does not overlap natural disasters while one remains active', () => {
    const colony = {
      ...buildStructure(createColony(4), 'solar-panels'),
      hazardEvents: [
        { id: 1, kind: 'dust-storm' as const, day: 1, sectorId: null, buildingId: null },
      ],
      hazardProgress: 9,
      hazardInterval: 10,
      nextHazardId: 2,
      randomSeed: 1,
    };

    const nextDay = advanceDay(colony);
    expect(
      nextDay.hazardEvents.filter(
        (event) => event.kind === 'meteorite-impact' || event.kind === 'dust-storm',
      ),
    ).toHaveLength(1);
    expect(nextDay.hazardProgress).toBe(9);
  });

  it('does not advance while paused', () => {
    const colony = { ...createColony(4), paused: true };

    expect(advanceDay(colony)).toEqual(colony);
  });

  it('lets the crew prospect once per day and spends energy immediately', () => {
    const colony = createColony(4);
    expect(canPerformFieldwork(colony, 'prospecting')).toBe(true);

    const worked = performFieldwork(colony, 'prospecting');

    expect(worked.resources).toMatchObject({
      energy: 76,
      metal: 112,
      regolith: 125,
    });
    expect(worked.lastFieldworkDay).toBe(1);
    expect(canPerformFieldwork(worked, 'prospecting')).toBe(false);
    expect(() => performFieldwork(worked, 'ice-core')).toThrow('already completed fieldwork');
  });

  it('allows ice-core drilling only in sectors with ice deposits', () => {
    const colony = createColony(0);
    const sampled = performFieldwork(colony, 'ice-core');

    expect(sampled.resources.water).toBe(78);
    expect(sampled.resources.energy).toBe(75);

    const basaltColony = { ...createColony(4), currentSector: 4, unlockedSectors: [4] };
    expect(canPerformFieldwork(basaltColony, 'ice-core')).toBe(false);
    expect(() => performFieldwork(basaltColony, 'ice-core')).toThrow('no known ice deposits');
  });

  it('restores fieldwork after a day advances and rejects paused operations', () => {
    const worked = performFieldwork(createColony(4), 'prospecting');
    const nextDay = advanceDay(worked);
    expect(nextDay.day).toBe(2);
    expect(canPerformFieldwork(nextDay, 'prospecting')).toBe(true);

    const paused = { ...nextDay, paused: true };
    expect(canPerformFieldwork(paused, 'prospecting')).toBe(false);
    expect(() => performFieldwork(paused, 'prospecting')).toThrow('Resume the simulation');
  });

  it('spends exploration materials but only checks the crew requirement', () => {
    const colony = createColony(4);
    const destination = SECTORS[0];
    expect(canUnlock(colony, destination)).toBe(true);
    const expanded = unlockSector(colony, destination.id);

    expect(expanded.people).toBe(7);
    expect(expanded.resources.metal).toBe(110 - destination.unlockMetal);
    expect(expanded.resources.regolith).toBe(120 - destination.unlockRegolith);
    expect(expanded.unlockedSectors).toContain(destination.id);
    expect(expanded.currentSector).toBe(destination.id);
    expect(expanded.buildings[destination.id]).toEqual([]);
  });

  it('validates versioned saves and rejects incompatible versions', () => {
    const colony = createColony(4);

    expect(validateSave(colony)).toEqual(colony);
    expect(() => validateSave({ ...colony, version: 99 })).toThrow('Unsupported save version');
    expect(() => validateSave({ ...colony, people: -1 })).toThrow('invalid colony values');
  });

  it('migrates version-two facility saves and assigns their existing buildings map locations', () => {
    const {
      buildingPlacements: _buildingPlacements,
      hazardEvents: _hazardEvents,
      hazardProgress: _hazardProgress,
      hazardInterval: _hazardInterval,
      randomSeed: _randomSeed,
      nextHazardId: _nextHazardId,
      starterTutorialSeen: _starterTutorialSeen,
      ...versionTwoSave
    } = createColony(4);
    const restored = validateSave({
      ...versionTwoSave,
      version: 2,
      buildings: { 4: ['habitat', 'solar-array', 'regolith-mine', 'water-plant', 'hydroponics'] },
    });

    expect(restored.version).toBe(8);
    expect(restored.buildings[4]).toEqual(['habitat', 'hydroponics']);
    expect(restored.buildingPlacements[4]).toEqual([
      { buildingId: 'hydroponics', x: 70 / 250, y: 46 / 160 },
    ]);
    expect(restored.hazardEvents).toEqual([]);
    expect(restored.people).toBe(7);
  });

  it('migrates version-three facility placements without moving the buildings', () => {
    const placed = buildStructure(createColony(4), 'solar-panels', { x: 0.15, y: 0.8 });
    const {
      buildingPlacements: _buildingPlacements,
      hazardEvents: _hazardEvents,
      hazardProgress: _hazardProgress,
      hazardInterval: _hazardInterval,
      randomSeed: _randomSeed,
      nextHazardId: _nextHazardId,
      starterTutorialSeen: _starterTutorialSeen,
      ...versionThreeSave
    } = placed;
    const restored = validateSave({
      ...versionThreeSave,
      version: 3,
      buildingPlacements: { 4: { 'solar-panels': { x: 0.15, y: 0.8 } } },
    });

    expect(restored.version).toBe(8);
    expect(restored.buildingPlacements[4]).toEqual([
      { buildingId: 'solar-panels', x: 0.15, y: 0.8 },
    ]);
    expect(restored.hazardInterval).toBe(14);
  });

  it('migrates version-four hazard saves and preserves their facility placements and schedule', () => {
    const placed = buildStructure(createColony(4), 'medical-bay', { x: 0.15, y: 0.8 });
    const versionFourSave = {
      ...placed,
      version: 4,
      hazardEvents: [
        {
          id: 1,
          kind: 'structural-decay' as const,
          day: 1,
          sectorId: 4,
          buildingId: 'medical-bay' as const,
        },
      ],
      nextHazardId: 2,
    };
    const { starterTutorialSeen: _starterTutorialSeen, ...legacyVersionFourSave } =
      versionFourSave;
    const restored = validateSave(legacyVersionFourSave);

    expect(restored.version).toBe(8);
    expect(restored.starterTutorialSeen).toBe(false);
    expect(restored.buildingPlacements[4]).toEqual([
      { buildingId: 'medical-bay', x: 0.15, y: 0.8 },
    ]);
    expect(restored.hazardEvents).toEqual(versionFourSave.hazardEvents);
    expect(restored.nextHazardId).toBe(2);
  });

  it('removes discontinued facilities from version-five saves and their placements', () => {
    const {
      hazardEvents: _hazardEvents,
      hazardProgress: _hazardProgress,
      hazardInterval: _hazardInterval,
      randomSeed: _randomSeed,
      nextHazardId: _nextHazardId,
      ...versionFiveColony
    } = createColony(4);
    const restored = validateSave({
      ...versionFiveColony,
      version: 5,
      starterTutorialSeen: true,
      buildings: { 4: ['habitat', 'solar-array', 'regolith-mine', 'water-plant', 'solar-panels'] },
      buildingPlacements: {
        4: [
          { buildingId: 'solar-array', x: 0.15, y: 0.8 },
          { buildingId: 'regolith-mine', x: 0.25, y: 0.8 },
          { buildingId: 'water-plant', x: 0.35, y: 0.8 },
          { buildingId: 'solar-panels', x: 0.45, y: 0.8 },
        ],
      },
    });

    expect(restored.version).toBe(8);
    expect(restored.starterTutorialSeen).toBe(true);
    expect(restored.buildings[4]).toEqual(['habitat', 'solar-panels']);
    expect(restored.buildingPlacements[4]).toEqual([
      { buildingId: 'solar-panels', x: 0.45, y: 0.8 },
    ]);
    expect(restored.hazardEvents).toEqual([]);
  });

  it('migrates version-six saves without hazards and keeps their tutorial progress', () => {
    const {
      hazardEvents: _hazardEvents,
      hazardProgress: _hazardProgress,
      hazardInterval: _hazardInterval,
      randomSeed: _randomSeed,
      nextHazardId: _nextHazardId,
      ...versionSixColony
    } = createColony(4);
    const restored = validateSave({
      ...versionSixColony,
      version: 6,
      starterTutorialSeen: true,
    });

    expect(restored.version).toBe(8);
    expect(restored.hazardEvents).toEqual([]);
    expect(restored.starterTutorialSeen).toBe(true);
  });

  it('migrates version-seven storms as already visually expired', () => {
    const restored = validateSave({
      ...createColony(4),
      version: 7,
      hazardEvents: [
        { id: 1, kind: 'dust-storm', day: 1, sectorId: null, buildingId: null },
      ],
      nextHazardId: 2,
    });

    expect(restored.version).toBe(8);
    expect(restored.hazardEvents[0]).toMatchObject({
      kind: 'dust-storm',
      dustStormVisualEndsAt: 0,
    });
  });

  it('migrates existing version-one saves without losing the colony', () => {
    const {
      lastFieldworkDay: _lastFieldworkDay,
      buildingPlacements: _buildingPlacements,
      hazardEvents: _hazardEvents,
      hazardProgress: _hazardProgress,
      hazardInterval: _hazardInterval,
      randomSeed: _randomSeed,
      nextHazardId: _nextHazardId,
      starterTutorialSeen: _starterTutorialSeen,
      ...versionOneSave
    } = createColony(4);
    const restored = validateSave({ ...versionOneSave, version: 1 });

    expect(restored.version).toBe(8);
    expect(restored.version).toBe(6);
    expect(restored.lastFieldworkDay).toBe(0);
    expect(restored.people).toBe(7);
    expect(restored.buildings[4]).toEqual(['habitat']);
  });

  it('migrates version-three colonies to persistent hazard state', () => {
    const {
      hazardEvents: _hazardEvents,
      hazardProgress: _hazardProgress,
      hazardInterval: _hazardInterval,
      randomSeed: _randomSeed,
      nextHazardId: _nextHazardId,
      ...versionThreeSave
    } = createColony(4);
    const restored = validateSave({ ...versionThreeSave, version: 3 });

    expect(restored.version).toBe(8);
    expect(restored.version).toBe(6);
    expect(restored.hazardEvents).toEqual([]);
    expect(restored.hazardProgress).toBe(0);
    expect(restored.hazardInterval).toBe(14);
    expect(restored.nextHazardId).toBe(1);
  });

  it('preserves active hazards through save validation', () => {
    const built = buildStructure(createColony(4), 'solar-panels');
    const colony = {
      ...built,
      hazardEvents: [
        {
          id: 1,
          kind: 'solar-panel-maintenance' as const,
          day: 1,
          sectorId: 4,
          buildingId: 'solar-panels' as const,
        },
      ],
      nextHazardId: 2,
    };

    expect(validateSave(colony)).toEqual(colony);
  });

  it('rejects invalid hazard targets in saved colonies', () => {
    const colony = createColony(4);
    expect(() =>
      validateSave({
        ...colony,
        hazardEvents: [
          {
            id: 1,
            kind: 'solar-panel-maintenance',
            day: 1,
            sectorId: 4,
            buildingId: 'solar-panels',
          },
        ],
        nextHazardId: 2,
      }),
    ).toThrow('invalid hazard targets');
  });
});
