import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  SECTORS,
  advanceDay,
  buildStructure,
  canPerformFieldwork,
  canUnlock,
  createColony,
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

  it('builds living quarters without changing the colony population', () => {
    const colony = createColony(4);
    const built = buildStructure(colony, 'living-quarters');

    expect(built.resources.metal).toBe(90);
    expect(built.resources.regolith).toBe(104);
    expect(built.buildings[4]).toContain('living-quarters');
    expect(built.people).toBe(7);
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

  it('migrates existing version-one saves without losing the colony', () => {
    const { lastFieldworkDay: _lastFieldworkDay, ...versionOneSave } = createColony(4);
    const restored = validateSave({ ...versionOneSave, version: 1 });

    expect(restored.version).toBe(2);
    expect(restored.lastFieldworkDay).toBe(0);
    expect(restored.people).toBe(7);
    expect(restored.buildings[4]).toEqual(['habitat']);
  });
});
