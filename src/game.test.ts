import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  SECTORS,
  advanceDay,
  buildStructure,
  canPerformFieldwork,
  canUnlock,
  createColony,
  isValidBuildingPlacement,
  performFieldwork,
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
    expect(colony.resources).toEqual({
      water: 70,
      food: 70,
      energy: 80,
      oxygen: 70,
      metal: 110,
      regolith: 120,
    });
  });

  it('charges construction costs and prevents duplicate facilities per sector', () => {
    const colony = createColony(4);
    const built = buildStructure(colony, 'ice-extractor');

    expect(built.resources.metal).toBe(90);
    expect(built.resources.regolith).toBe(108);
    expect(built.buildings[4]).toContain('ice-extractor');
    expect(() => buildStructure(built, 'ice-extractor')).toThrow('already built');
    expect(BUILDINGS.find((building) => building.id === 'ice-extractor')?.metal).toBe(20);
  });

  it('saves a chosen facility location and rejects blocked or out-of-map spots', () => {
    const colony = createColony(4);
    const placement = { x: 0.15, y: 0.8 };

    expect(isValidBuildingPlacement(colony, placement)).toBe(true);
    const built = buildStructure(colony, 'solar-panels', placement);
    expect(built.buildingPlacements[4]['solar-panels']).toEqual(placement);
    expect(() => buildStructure(colony, 'solar-panels', { x: 0.5, y: 85 / 160 })).toThrow(
      'open map location',
    );
    expect(() => buildStructure(built, 'medical-bay', placement)).toThrow('open map location');
    expect(isValidBuildingPlacement(colony, { x: 0, y: 0.5 })).toBe(false);
  });

  it('builds living quarters without changing the colony population', () => {
    const colony = createColony(4);
    const built = buildStructure(colony, 'living-quarters');

    expect(built.resources.metal).toBe(90);
    expect(built.resources.regolith).toBe(104);
    expect(built.buildings[4]).toContain('living-quarters');
    expect(built.people).toBe(7);
  });

  it('builds each new facility as a separate option', () => {
    const newBuildings = [
      'solar-panels',
      'nuclear-power',
      'medical-bay',
      'oxygen-plant',
      'water-plant',
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
    for (const buildingId of ['solar-panels', 'nuclear-power', 'oxygen-plant', 'water-plant'] as const) {
      colony = buildStructure(colony, buildingId);
    }

    const nextDay = advanceDay(colony);
    expect(nextDay.resources).toMatchObject({
      energy: 115,
      water: 78,
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
    const { buildingPlacements: _buildingPlacements, ...versionTwoSave } = createColony(4);
    const restored = validateSave({
      ...versionTwoSave,
      version: 2,
      buildings: { 4: ['habitat', 'solar-array', 'hydroponics'] },
    });

    expect(restored.version).toBe(3);
    expect(restored.buildingPlacements[4]['solar-array']).toEqual({ x: 70 / 250, y: 46 / 160 });
    expect(restored.buildingPlacements[4].hydroponics).toEqual({ x: 98 / 250, y: 46 / 160 });
    expect(restored.people).toBe(7);
  });

  it('migrates existing version-one saves without losing the colony', () => {
    const {
      lastFieldworkDay: _lastFieldworkDay,
      buildingPlacements: _buildingPlacements,
      ...versionOneSave
    } = createColony(4);
    const restored = validateSave({ ...versionOneSave, version: 1 });

    expect(restored.version).toBe(3);
    expect(restored.lastFieldworkDay).toBe(0);
    expect(restored.people).toBe(7);
    expect(restored.buildings[4]).toEqual(['habitat']);
  });
});
