import { MoonScene } from './moon-scene';
import {
  BUILDINGS,
  DAY_LENGTH_MS,
  FIELDWORK,
  RESOURCE_INFO,
  RESOURCE_ORDER,
  SECTORS,
  advanceDay,
  buildStructure,
  canPerformFieldwork,
  canUnlock,
  createColony,
  getSector,
  loadColony,
  performFieldwork,
  saveColony,
  unlockSector,
  type BuildingId,
  type ColonySave,
  type ResourceKey,
  type Sector,
} from './game';

type Screen = 'atlas' | 'sector';

const loadResult = loadColony();
let colony: ColonySave | null = loadResult.colony;
let screen: Screen = 'atlas';
let inspectedSectorId = colony?.currentSector ?? 0;
let moonScene: MoonScene | null = null;
let saveMessage = loadResult.error;
let toastMessage = '';
let toastTimeout = 0;

const resourceRate = (resource: ResourceKey): number => {
  if (!colony) return 0;
  const activeColony = colony;
  const buildingIds = Object.values(activeColony.buildings).flat();
  const production = buildingIds.reduce(
    (total, id) => total + (BUILDINGS.find((building) => building.id === id)?.production[resource] ?? 0),
    0,
  );
  const buildingUse = buildingIds.reduce(
    (total, id) => total + (BUILDINGS.find((building) => building.id === id)?.consumption[resource] ?? 0),
    0,
  );
  const crewUse =
    resource === 'water' || resource === 'food' || resource === 'oxygen'
      ? activeColony.people
      : resource === 'energy'
        ? Math.ceil(activeColony.people / 2)
        : 0;
  return production - buildingUse - crewUse;
};

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function resourceMarkup(): string {
  if (!colony) return '';
  const activeColony = colony;
  return RESOURCE_ORDER.map((resource) => {
    const info = RESOURCE_INFO[resource];
    const rate = resourceRate(resource);
    const rateText = `${rate >= 0 ? '+' : ''}${rate}/day`;
    const alertClass =
      (resource === 'water' || resource === 'food' || resource === 'oxygen') &&
      activeColony.resources[resource] < activeColony.people * 2
        ? ' resource-low'
        : '';
    return `<div class="resource-chip${alertClass}" title="${info.label}: ${rateText}">
      <span class="resource-glyph" style="--resource-color:${info.color}">${info.icon}</span>
      <span class="resource-value">${Math.floor(activeColony.resources[resource])}</span>
      <span class="resource-name">${info.label}</span>
      <span class="resource-rate ${rate < 0 ? 'rate-negative' : 'rate-positive'}">${rateText}</span>
    </div>`;
  }).join('');
}

function hudMarkup(): string {
  if (!colony) {
    return `<div class="header-actions">
      <span class="save-state"><i class="live-dot"></i> LOCAL MISSION</span>
    </div>`;
  }
  return `<div class="header-meta">
      <div class="day-badge"><span class="day-symbol">◷</span><span>DAY <strong>${colony.day}</strong></span></div>
      <div class="crew-badge"><span class="crew-symbol">♟</span><span><strong>${colony.people}</strong> CREW</span></div>
      <button class="pause-button ${colony.paused ? 'is-paused' : ''}" data-action="toggle-pause" aria-label="${colony.paused ? 'Resume simulation' : 'Pause simulation'}">
        <span>${colony.paused ? '▶' : 'Ⅱ'}</span>${colony.paused ? 'RESUME' : 'PAUSE'}
      </button>
    </div>`;
}

function appShell(content: string): string {
  const activeSector = colony ? getSector(colony.currentSector) : null;
  return `<div class="app-shell ${screen === 'sector' ? 'sector-mode' : ''}">
    <header class="topbar">
      <a class="brand" href="#" data-action="home" aria-label="Lunar Frontier home">
        <span class="brand-mark"><span></span><span></span><span></span></span>
        <span class="brand-copy"><strong>LUNAR FRONTIER</strong><small>MISSION CONTROL</small></span>
      </a>
      <div class="mission-heading">
        <span class="eyebrow">LUNAR SETTLEMENT SIMULATOR</span>
        <span class="mission-location">${activeSector ? esc(activeSector.name) : 'MISSION PLANNING'}</span>
      </div>
      ${hudMarkup()}
    </header>
    ${colony ? `<section class="resource-bar" aria-label="Colony resources">${resourceMarkup()}</section>` : ''}
    ${saveMessage ? `<div class="notice notice-warning" role="status"><span>!</span><div><strong>Save notice</strong><p>${esc(saveMessage)}${hasSavedData() ? ' Your original save remains in this browser; starting a new colony will replace it.' : ''}</p></div><button data-action="dismiss-notice" aria-label="Dismiss notice">×</button></div>` : ''}
    ${toastMessage ? `<div class="toast" role="status">${esc(toastMessage)}</div>` : ''}
    ${colony?.failed ? `<div class="mission-over" role="alert">
      <div class="mission-over-card"><span class="eyebrow">MISSION REPORT · DAY ${colony.day}</span><h2>Outpost lost</h2><p>${esc(colony.failureReason)}</p><p class="muted">Your crew survived ${Math.max(0, colony.day - 1)} full days. Try a different landing site or build life-support systems sooner.</p><button class="button button-primary" data-action="new-colony">PLAN A NEW MISSION <span>↗</span></button></div>
    </div>` : ''}
    ${content}
    <footer class="footer-note"><span>✦</span> A learning simulation. Resource rates and terrain are simplified for play.</footer>
  </div>`;
}

function sectorListMarkup(): string {
  return SECTORS.map((sector) => {
    const unlocked = colony?.unlockedSectors.includes(sector.id) ?? false;
    const selected = sector.id === inspectedSectorId;
    return `<button class="sector-row ${selected ? 'is-selected' : ''} ${unlocked ? 'is-unlocked' : 'is-locked'}"
      data-action="inspect-sector" data-sector="${sector.id}" aria-pressed="${selected}">
      <span class="sector-index">${String(sector.id + 1).padStart(2, '0')}</span>
      <span class="sector-row-copy"><strong>${esc(sector.name)}</strong><small>${unlocked ? 'OUTPOST ACTIVE' : 'UNEXPLORED'}</small></span>
      <span class="sector-state">${unlocked ? '●' : '⌑'}</span>
    </button>`;
  }).join('');
}

function requirementLine(
  icon: string,
  label: string,
  required: number,
  available: number,
  meets: boolean,
): string {
  return `<div class="requirement ${meets ? 'requirement-met' : ''}">
    <span class="requirement-icon">${icon}</span><span>${label}</span>
    <strong>${available} <small>/ ${required}</small></strong><span class="requirement-check">${meets ? '✓' : '·'}</span>
  </div>`;
}

function sectorInspectorMarkup(sector: Sector): string {
  const unlocked = colony?.unlockedSectors.includes(sector.id) ?? false;
  const isStarting = colony?.startingSector === sector.id;
  const canEnter = unlocked && Boolean(colony);
  const afford = colony ? canUnlock(colony, sector) : false;
  return `<div class="inspector-top">
      <span class="eyebrow">${String(sector.id + 1).padStart(2, '0')} / 15 · ${esc(sector.terrain.toUpperCase())}</span>
      <span class="status-pill ${unlocked ? 'status-open' : 'status-locked'}">${unlocked ? (isStarting ? 'HOME SECTOR' : 'UNLOCKED') : 'LOCKED'}</span>
    </div>
    <h2>${esc(sector.name)}</h2>
    <p class="sector-description">${esc(sector.description)}</p>
    <div class="inspector-divider"></div>
    ${!colony
      ? `<div class="landing-hint"><span class="hint-icon">⌖</span><p>Choose this sector for your first outpost. You’ll land with <strong>7 crew</strong> and a basic habitat.</p></div>
         <button class="button button-primary button-wide" data-action="start-colony" data-sector="${sector.id}">LAND HERE <span>↗</span></button>`
      : unlocked
        ? `<div class="sector-facts"><div><span>STATUS</span><strong>${isStarting ? 'LANDING SITE' : 'EXPEDITION OUTPOST'}</strong></div><div><span>CREW</span><strong>SHARED COLONY</strong></div></div>
           <button class="button button-primary button-wide" data-action="enter-sector" data-sector="${sector.id}">OPEN SECTOR <span>↗</span></button>`
        : `<div class="requirements-title"><span>EXPEDITION REQUIREMENTS</span><span>ONE-TIME COST</span></div>
           ${requirementLine('⬡', 'Metal', sector.unlockMetal, Math.floor(colony.resources.metal), colony.resources.metal >= sector.unlockMetal)}
           ${requirementLine('◇', 'Lunar regolith', sector.unlockRegolith, Math.floor(colony.resources.regolith), colony.resources.regolith >= sector.unlockRegolith)}
           ${requirementLine('♟', 'Crew available', sector.crewRequired, colony.people, colony.people >= sector.crewRequired)}
           <p class="requirements-footnote">Crew is a minimum team-size check and is not consumed. Materials are spent when you deploy.</p>
           <button class="button ${afford ? 'button-primary' : 'button-muted'} button-wide" data-action="unlock-sector" data-sector="${sector.id}" ${afford ? '' : 'disabled'}>
             ${afford ? 'DEPLOY EXPEDITION' : 'REQUIREMENTS NOT MET'} <span>↗</span>
           </button>`
    }`;
}

function globeScreenMarkup(): string {
  const currentSector = colony ? getSector(colony.currentSector) : null;
  return appShell(`<main class="atlas-layout">
    <aside class="atlas-sidebar panel">
      <div class="panel-heading">
        <div><span class="eyebrow">MISSION MAP</span><h1>${colony ? 'Explore the Moon' : 'Choose your landing site'}</h1></div>
        <span class="sector-count">${colony ? `${colony.unlockedSectors.length} / 15` : '15 ZONES'}</span>
      </div>
      <p class="sidebar-copy">${colony ? 'Select an unlocked outpost to manage it, or inspect a locked sector to plan an expedition.' : 'Select a hex sector to inspect the terrain and establish your first lunar outpost.'}</p>
      <div class="sector-list" aria-label="Lunar sectors">${sectorListMarkup()}</div>
      <div class="atlas-legend"><span><i class="legend-dot dot-home"></i> Outpost</span><span><i class="legend-dot dot-locked"></i> Unexplored</span></div>
      ${colony ? `<button class="text-button new-colony-link" data-action="new-colony">＋ Start a new colony</button>` : ''}
    </aside>
    <section class="globe-stage" aria-label="Three-dimensional lunar atlas">
      <div class="stage-label"><span class="live-dot"></span> LUNAR SURFACE · 15 SECTORS</div>
      <div class="globe-hint"><span>↔</span> DRAG TO ROTATE</div>
      <div class="moon-mount" id="moon-mount"></div>
      <div class="globe-orbit orbit-one"></div><div class="globe-orbit orbit-two"></div>
      <div class="globe-caption"><span class="caption-line"></span><span>MOON · 1:1 SCALE MODEL</span></div>
    </section>
    <aside class="sector-inspector panel" aria-live="polite">
      ${sectorInspectorMarkup(getSector(inspectedSectorId))}
      ${currentSector ? `<div class="current-sector-label"><span class="live-dot"></span> CURRENT OUTPOST <strong>${esc(currentSector.name)}</strong></div>` : ''}
    </aside>
  </main>`);
}

function dailyFlowMarkup(): string {
  if (!colony) return '';
  const remaining = Math.max(0, DAY_LENGTH_MS - colony.elapsedMs);
  const progress = Math.min(100, (colony.elapsedMs / DAY_LENGTH_MS) * 100);
  return `<div class="day-flow">
    <div><span class="eyebrow">NEXT LUNAR DAY</span><strong class="time-left">${formatTime(remaining)}</strong><span class="flow-caption">Automatic day transition</span></div>
    <div class="flow-progress"><div class="flow-track"><i style="width:${progress}%"></i></div><span class="progress-label day-progress">${Math.floor(progress)}%</span></div>
    <button class="button button-secondary" data-action="advance-day" ${colony.paused || colony.failed ? 'disabled' : ''}>END SHIFT EARLY <span>↗</span></button>
  </div>`;
}

function buildingCardMarkup(buildingId: BuildingId): string {
  const building = BUILDINGS.find((item) => item.id === buildingId)!;
  const placed = colony?.buildings[colony.currentSector] ?? [];
  const built = placed.includes(building.id);
  const affordable = colony
    ? colony.resources.metal >= building.metal &&
      colony.resources.regolith >= building.regolith
    : false;
  const rates = Object.entries(building.production)
    .map(([resource, amount]) => `+${amount} ${RESOURCE_INFO[resource as ResourceKey].label}/day`)
    .join(' · ');
  const costs =
    building.metal || building.regolith
      ? `<span class="${colony && colony.resources.metal >= building.metal ? 'cost-met' : 'cost-missing'}">${building.metal} Metal</span><span class="${colony && colony.resources.regolith >= building.regolith ? 'cost-met' : 'cost-missing'}">${building.regolith} Regolith</span>`
      : 'Included with your landing';
  const purpose: Record<BuildingId, string> = {
    habitat: 'Keeps the crew sheltered.',
    'living-quarters': 'Adds a local sheltered module without increasing crew.',
    'solar-array': 'Adds power for more systems.',
    hydroponics: 'Turns water and power into food.',
    'ice-extractor': 'Uses power to replenish water.',
    'oxygen-recycler': 'Supports breathable air.',
    'regolith-mine': 'Replenishes materials for expansion.',
  };
  const icon = building.id === 'living-quarters'
    ? '⌂'
    : building.id === 'hydroponics'
      ? '✳'
      : building.id === 'solar-array'
        ? 'ϟ'
        : building.id === 'ice-extractor'
          ? '◉'
          : building.id === 'oxygen-recycler'
            ? '◌'
            : '⬡';
  return `<article class="building-card ${built ? 'building-built' : ''}">
    <div class="building-icon icon-${building.id}">${icon}</div>
    <div class="building-copy"><div class="building-title-row"><h3>${esc(building.name)}</h3>${built ? '<span class="built-label">BUILT</span>' : ''}</div>
      <p>${esc(purpose[building.id])} ${esc(building.description)}</p>
      <div class="building-yield">${rates || 'Crew shelter'}${Object.keys(building.consumption).length ? ` · uses ${Object.entries(building.consumption).map(([key, amount]) => `${amount} ${RESOURCE_INFO[key as ResourceKey].label}/day`).join(', ')}` : ''}</div>
      <div class="building-cost">${costs}</div>
    </div>
    <button class="build-button ${built ? 'is-built' : affordable ? '' : 'is-unaffordable'}" data-action="build" data-building="${building.id}" ${built || !affordable ? 'disabled' : ''} aria-label="${built ? 'Already built' : `Build ${building.name}`}">${built ? 'BUILT' : affordable ? 'BUILD' : 'NEED'}</button>
  </article>`;
}

function sectorResourceMarkup(): string {
  if (!colony) return '';
  return RESOURCE_ORDER.map((resource) => {
    const info = RESOURCE_INFO[resource];
    const amount = Math.floor(colony!.resources[resource]);
    const rate = resourceRate(resource);
    const rateLabel = `${rate > 0 ? '+' : ''}${rate}/day`;
    const urgent =
      (resource === 'water' || resource === 'food' || resource === 'oxygen') &&
      amount < colony!.people * 3;
    return `<div class="resource-mini ${urgent ? 'resource-alert' : ''}" title="${info.label}: ${rateLabel} colony-wide">
      <i style="--resource-color:${info.color}">${info.icon}</i>
      <span class="resource-mini-copy"><strong>${amount}</strong><small>${info.label}</small></span>
      <em class="${rate < 0 ? 'rate-negative' : ''}">${rateLabel}</em>
    </div>`;
  }).join('');
}

function habitatMarkup(crew: number): string {
  return `<g class="colony-structure habitat-structure" transform="translate(500 342)" role="img" aria-label="Basic habitat with attached living quarters">
    <title>Basic habitat and crew living quarters</title>
    <ellipse class="structure-shadow" cx="0" cy="27" rx="151" ry="38"/>
    <path class="landing-pad" d="M-163 29 L-127 8 L119 8 L163 29 L127 50 L-127 50 Z"/>
    <path class="habitat-dome" d="M-68 12 C-67 -38 -39 -73 0 -81 C39 -73 67 -38 68 12 Z"/>
    <path class="habitat-window" d="M-22 -13 Q0 -42 22 -13 L22 2 L-22 2 Z"/>
    <path class="habitat-door" d="M-8 12 L-8 -7 Q0 -17 8 -7 L8 12 Z"/>
    <rect class="quarter-module" x="83" y="-25" width="56" height="37" rx="6"/>
    <path class="quarter-roof" d="M79 -25 L111 -45 L143 -25 Z"/>
    <rect class="quarter-window" x="93" y="-12" width="10" height="9" rx="2"/>
    <rect class="quarter-window" x="119" y="-12" width="10" height="9" rx="2"/>
    <path class="habitat-tunnel" d="M62 -2 L84 -2"/>
    <rect class="quarter-module" x="-142" y="-13" width="48" height="31" rx="6"/>
    <path class="quarter-roof" d="M-147 -13 L-118 -31 L-89 -13 Z"/>
    <rect class="quarter-window" x="-131" y="-3" width="9" height="8" rx="2"/>
    <rect class="quarter-window" x="-111" y="-3" width="9" height="8" rx="2"/>
    <path class="habitat-tunnel" d="M-93 1 L-68 1"/>
    <circle class="habitat-beacon" cx="0" cy="-84" r="4"/>
    <text class="structure-label" x="0" y="71">HABITAT + LIVING QUARTERS · ${crew} CREW</text>
  </g>`;
}

function facilityStructureMarkup(buildingId: BuildingId, index: number): string {
  const positions = [
    { x: 255, y: 198 },
    { x: 750, y: 191 },
    { x: 788, y: 407 },
    { x: 228, y: 425 },
    { x: 510, y: 515 },
    { x: 505, y: 119 },
  ];
  const { x, y } = positions[index % positions.length];
  const definition = BUILDINGS.find((building) => building.id === buildingId);
  if (!definition) throw new Error(`Unknown facility on sector map: ${buildingId}.`);
  const structure = buildingId === 'living-quarters'
    ? `<ellipse class="structure-shadow" cx="0" cy="20" rx="63" ry="16"/>
       <path class="habitat-dome small-dome" d="M-32 9 C-31 -18 -18 -34 0 -39 C18 -34 31 -18 32 9 Z"/>
       <rect class="quarter-module" x="35" y="-8" width="30" height="18" rx="4"/>
       <path class="quarter-roof" d="M32 -8 L50 -20 L68 -8 Z"/>
       <path class="habitat-tunnel" d="M29 2 L36 2"/>
       <text class="structure-label" x="0" y="37">LIVING QUARTERS</text>`
    : buildingId === 'solar-array'
      ? `<ellipse class="structure-shadow" cx="0" cy="18" rx="77" ry="14"/>
         <path class="solar-frame" d="M-12 6 L-4 -9 L4 -9 L12 6 M0 -9 L0 -30"/>
         <path class="solar-panel" d="M-69 -38 L-12 -30 L-14 -7 L-71 -18 Z"/>
         <path class="solar-panel" d="M12 -30 L69 -38 L71 -18 L14 -7 Z"/>
         <path class="solar-cell-line" d="M-51 -35 L-53 -15 M-32 -33 L-34 -11 M-15 -30 L-17 -8 M15 -30 L17 -8 M32 -33 L34 -11 M51 -35 L53 -15"/>
         <text class="structure-label" x="0" y="36">SOLAR ARRAY</text>`
      : buildingId === 'hydroponics'
        ? `<ellipse class="structure-shadow" cx="0" cy="18" rx="59" ry="14"/>
           <path class="greenhouse-shell" d="M-47 10 L-37 -24 Q0 -51 37 -24 L47 10 Z"/>
           <path class="greenhouse-rib" d="M-24 -5 Q-20 -32 0 -42 Q20 -32 24 -5 M0 -42 L0 10 M-37 -24 L37 -24"/>
           <path class="facility-door" d="M-9 10 L-9 -6 Q0 -18 9 -6 L9 10 Z"/>
           <text class="structure-label" x="0" y="36">HYDROPONICS</text>`
        : buildingId === 'ice-extractor'
          ? `<ellipse class="structure-shadow" cx="0" cy="18" rx="52" ry="13"/>
             <path class="rig-frame" d="M-25 10 L0 -49 L25 10 M-17 -8 L17 -8 M-11 -24 L11 -24 M-6 -38 L6 -38 M0 -49 L0 14"/>
             <rect class="rig-housing" x="-34" y="5" width="68" height="12" rx="3"/>
             <text class="structure-label" x="0" y="36">ICE EXTRACTOR</text>`
          : buildingId === 'oxygen-recycler'
            ? `<ellipse class="structure-shadow" cx="0" cy="18" rx="53" ry="13"/>
               <rect class="recycler-tank" x="-34" y="-22" width="24" height="34" rx="10"/>
               <rect class="recycler-tank tank-secondary" x="7" y="-30" width="27" height="42" rx="12"/>
               <path class="recycler-pipe" d="M-10 -7 L7 -7 M-22 -23 L-22 -31 L20 -31"/>
               <text class="structure-label" x="0" y="36">OXYGEN RECYCLER</text>`
            : `<ellipse class="structure-shadow" cx="0" cy="18" rx="57" ry="13"/>
               <path class="mine-hill" d="M-50 12 Q-24 -14 0 -22 Q24 -14 50 12 Z"/>
               <path class="mine-track" d="M-44 12 L-17 1 L-3 8 L18 -9 L43 12 M-24 -5 L-18 -14 L-4 -14"/>
               <circle class="mine-ore" cx="28" cy="-12" r="5"/>
               <text class="structure-label" x="0" y="36">SURFACE MINE</text>`;
  return `<g class="colony-structure facility-structure ${buildingId}" transform="translate(${x} ${y})" role="img" aria-label="${esc(definition.name)}">
    <title>${esc(definition.name)}</title>${structure}
  </g>`;
}

function sectorSurfaceMarkup(sector: Sector): string {
  const isPolar = sector.latitude > 45 || sector.latitude < -45;
  const buildings = colony?.buildings[sector.id] ?? [];
  const hasHabitat = buildings.includes('habitat');
  const fieldworkComplete = colony?.lastFieldworkDay === colony?.day;
  const prospectingAvailable = colony ? canPerformFieldwork(colony, 'prospecting') : false;
  const iceCoreAvailable = colony ? canPerformFieldwork(colony, 'ice-core') : false;
  const iceStatus = !sector.iceDeposits
    ? 'NO ICE DEPOSIT'
    : fieldworkComplete
      ? 'SHIFT COMPLETE'
      : colony?.paused
        ? 'SIMULATION PAUSED'
        : (colony?.resources.energy ?? 0) < FIELDWORK.find((task) => task.id === 'ice-core')!.energyCost
          ? 'LOW ENERGY'
          : 'READY';
  const prospectStatus = fieldworkComplete
    ? 'SHIFT COMPLETE'
    : colony?.paused
      ? 'SIMULATION PAUSED'
      : prospectingAvailable
        ? 'READY'
        : 'LOW ENERGY';
  return `<div class="surface-panel ${isPolar ? 'surface-polar' : ''}">
    <div class="surface-sky"><span class="sky-star star-a"></span><span class="sky-star star-b"></span><span class="sky-star star-c"></span>
      <div class="surface-moonlet"></div><div class="surface-ridge ridge-back"></div><div class="surface-ridge ridge-front"></div>
      <div class="surface-label"><span class="eyebrow">SECTOR ${String(sector.id + 1).padStart(2, '0')}</span><h2>${esc(sector.name)}</h2><p>${esc(sector.terrain)} · SURFACE OPERATIONS</p></div>
      <span class="surface-coordinate">LUNAR DAY ${colony?.day}</span>
    </div>
    <div class="surface-grid" aria-label="Sector outpost map">
      <svg class="surface-illustration" viewBox="0 0 1000 640" role="img" aria-label="${esc(sector.name)} terrain and constructed colony buildings">
        <path class="map-ridge distant-ridge" d="M0 204 L80 144 L150 180 L239 110 L328 195 L414 133 L509 195 L603 116 L700 179 L803 100 L887 164 L1000 122 L1000 312 L0 312 Z"/>
        <path class="map-ground" d="M0 248 Q120 216 238 251 T470 246 T704 252 T1000 230 L1000 640 L0 640 Z"/>
        <ellipse class="map-crater crater-one" cx="137" cy="370" rx="83" ry="41"/>
        <ellipse class="map-crater-inner crater-one-inner" cx="137" cy="368" rx="63" ry="25"/>
        <ellipse class="map-crater crater-two" cx="862" cy="302" rx="66" ry="32"/>
        <ellipse class="map-crater-inner crater-two-inner" cx="862" cy="300" rx="48" ry="19"/>
        <ellipse class="map-crater crater-three" cx="825" cy="529" rx="118" ry="54"/>
        <ellipse class="map-crater-inner crater-three-inner" cx="825" cy="526" rx="88" ry="35"/>
        <path class="map-route" d="M500 364 Q414 396 337 361 T188 389 M500 364 Q604 391 711 349 T854 312 M501 376 Q502 438 518 493"/>
        <path class="map-survey-line" d="M56 500 Q253 442 440 505 T942 487"/>
        <g class="landing-site" transform="translate(500 365)">
          <ellipse cx="0" cy="15" rx="64" ry="23"/><circle cx="0" cy="-10" r="8"/><path d="M0 -2 V10 M-44 12 H44"/>
          <text x="0" y="48">${hasHabitat ? 'COLONY LANDING PAD' : 'EXPEDITION LANDING SITE'}</text>
        </g>
        ${hasHabitat ? habitatMarkup(colony?.people ?? 0) : ''}
        ${buildings.filter((id) => id !== 'habitat').map((id, index) => facilityStructureMarkup(id, index)).join('')}
        <g class="map-resource-site" transform="translate(420 465)"><circle r="16"/><path d="M-6 3 L-1 -5 L4 1 L9 -7"/><text y="34">MINERAL RIDGE</text></g>
        ${sector.iceDeposits ? '<g class="map-resource-site ice-resource-site" transform="translate(847 288)"><circle r="16"/><path d="M0 -9 V9 M-8 -4 L8 4 M8 -4 L-8 4"/><text y="34">SHADOWED ICE</text></g>' : ''}
      </svg>
      <button class="worksite-marker prospect-site ${prospectingAvailable ? 'worksite-ready' : ''}" data-action="fieldwork" data-fieldwork="prospecting" ${prospectingAvailable ? '' : 'disabled'} aria-label="Prospect mineral ridge: spend 4 energy to collect 2 metal and 5 lunar regolith. ${prospectStatus}">
        <span class="worksite-icon">⌕</span><strong>MINERAL RIDGE</strong><small>−4 ENERGY · +2 METAL · +5 REGOLITH</small><em>${prospectStatus}</em>
      </button>
      <button class="worksite-marker ice-site ${iceCoreAvailable ? 'worksite-ready' : ''}" data-action="fieldwork" data-fieldwork="ice-core" ${iceCoreAvailable ? '' : 'disabled'} aria-label="Drill an ice core: spend 5 energy to collect 8 water. ${iceStatus}">
        <span class="worksite-icon">◉</span><strong>ICE PROSPECT</strong><small>−5 ENERGY · +8 WATER</small><em>${iceStatus}</em>
      </button>
      <span class="map-scale">SURFACE SURVEY · 1 OPERATION PER DAY</span>
    </div>
    <div class="surface-bottom"><span><i class="live-dot"></i> SURFACE LINK STABLE</span><span>FIELD TEAM · ${colony?.people} CREW</span><span>OPERATIONS ${fieldworkComplete ? 'COMPLETE' : colony?.paused ? 'PAUSED' : 'READY'}</span></div>
  </div>`;
}

function sectorScreenMarkup(): string {
  if (!colony) return globeScreenMarkup();
  const sector = getSector(colony.currentSector);
  const hasHabitat = colony.buildings[sector.id]?.includes('habitat') ?? false;
  const terrainLesson = sector.iceDeposits
    ? 'Permanent shadow can preserve water ice. Samples can provide water, but work crews still spend power to reach and study deposits.'
    : 'This region is known for exposed rock and impact-shaped terrain. Prospecting can recover useful materials, while water must come from colony stores or a new expedition.';
  return appShell(`<main class="sector-layout">
    <div class="sector-toolbar">
      <button class="back-button" data-action="back-to-globe"><span>←</span> LUNAR ATLAS</button>
      <div class="sector-toolbar-title"><span class="eyebrow">SECTOR ${String(sector.id + 1).padStart(2, '0')} / 15</span><strong>${esc(sector.name)}</strong></div>
      <span class="surface-chip"><i class="live-dot"></i> OUTPOST ONLINE</span>
    </div>
    <section class="sector-resource-rail" aria-label="Colony resources">${sectorResourceMarkup()}</section>
    <div class="sector-command-layout">
      <section class="sector-map-column">
        <div class="map-heading"><div><span class="eyebrow">SURFACE OPERATIONS · SECTOR ${String(sector.id + 1).padStart(2, '0')}</span><h1>${esc(sector.name)}</h1></div><span class="map-coordinate">LOCAL TERRAIN MAP</span></div>
        ${sectorSurfaceMarkup(sector)}
        <div class="map-instructions"><span>SELECT A MARKER TO DEPLOY THE CREW</span><span>ONE FIELD OPERATION PER LUNAR DAY</span></div>
        <div class="sector-map-footer">
          <section class="field-guide-compact"><span class="eyebrow">FIELD GUIDE · ${esc(sector.terrain.toUpperCase())}</span><p>${esc(terrainLesson)}</p></section>
          <section class="day-flow-panel panel">${dailyFlowMarkup()}</section>
        </div>
      </section>
      <aside class="management-panel panel">
        <div class="management-heading"><div><span class="eyebrow">COLONY DEVELOPMENT</span><h1>Build facilities</h1></div><span class="system-count">${(colony.buildings[sector.id] ?? []).filter((id) => id !== 'habitat').length} / ${BUILDINGS.length - 1}</span></div>
        <p class="management-copy">Choose what this outpost needs. Costs are paid once; production and power use apply every lunar day across the colony.</p>
        <div class="habitat-status ${hasHabitat ? '' : 'habitat-unavailable'}"><span class="habitat-icon">⌂</span><span><strong>${hasHabitat ? 'Habitat & living quarters online' : 'Expedition site · no habitat'}</strong><small>${hasHabitat ? 'Shelter and crew quarters shown on the surface map' : 'Build living quarters to add shelter at this outpost'}</small></span><span class="status-pill ${hasHabitat ? 'status-open' : 'status-locked'}">${hasHabitat ? 'ONLINE' : 'SITE'}</span></div>
        <div class="building-list">${BUILDINGS.filter((building) => building.id !== 'habitat').map((building) => buildingCardMarkup(building.id)).join('')}</div>
        <div class="field-note"><span>ⓘ</span><p>Only one of each facility can be built per sector. Review daily energy use before construction.</p></div>
      </aside>
    </div>
    <div class="colony-status-strip">
      <span><i class="live-dot"></i> MISSION STATUS <strong>${colony.failed ? 'FAILED' : colony.paused ? 'PAUSED' : 'OPERATIONAL'}</strong></span>
      <span>COLONY DAYS <strong>${Math.max(0, colony.day - 1)} SURVIVED</strong></span>
      <button class="text-button" data-action="back-to-globe">View lunar atlas <span>↗</span></button>
    </div>
  </main>`);
}

function formatTime(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1000);
  return `00:${String(seconds).padStart(2, '0')}`;
}

function hasSavedData(): boolean {
  try {
    return Boolean(localStorage.getItem('lunar-frontier-save'));
  } catch {
    return false;
  }
}

function renderInspector(): void {
  const target = document.querySelector<HTMLElement>('.sector-inspector');
  if (!target) return;
  const sector = getSector(inspectedSectorId);
  const current = colony ? getSector(colony.currentSector) : null;
  target.innerHTML = `${sectorInspectorMarkup(sector)}${current ? `<div class="current-sector-label"><span class="live-dot"></span> CURRENT OUTPOST <strong>${esc(current.name)}</strong></div>` : ''}`;
}

function inspectSector(sectorId: number): void {
  inspectedSectorId = sectorId;
  document.querySelectorAll<HTMLElement>('.sector-row').forEach((row) => {
    const selected = Number(row.dataset.sector) === sectorId;
    row.classList.toggle('is-selected', selected);
    row.setAttribute('aria-pressed', String(selected));
  });
  renderInspector();
  moonScene?.update(colony, inspectedSectorId);
}

function persist(): void {
  if (!colony) return;
  saveMessage = saveColony(colony);
}

function updateColony(next: ColonySave, rerender = true): void {
  colony = next;
  persist();
  if (rerender) render();
}

function showToast(message: string): void {
  toastMessage = message;
  window.clearTimeout(toastTimeout);
  render();
  toastTimeout = window.setTimeout(() => {
    toastMessage = '';
    render();
  }, 3500);
}

function beginColony(sectorId: number): void {
  if (colony || hasSavedData()) {
    const confirmed = window.confirm(
      'Starting a new colony will replace your saved Lunar Frontier mission in this browser. Continue?',
    );
    if (!confirmed) return;
  }
  colony = createColony(sectorId);
  screen = 'sector';
  inspectedSectorId = sectorId;
  saveMessage = null;
  persist();
  render();
}

function tryUnlock(sectorId: number): void {
  if (!colony) return;
  const sector = getSector(sectorId);
  if (!canUnlock(colony, sector)) {
    showToast('More crew or exploration materials are needed.');
    return;
  }
  const confirmed = window.confirm(
    `Deploy to ${sector.name}?\n\nThis expedition spends ${sector.unlockMetal} metal and ${sector.unlockRegolith} lunar regolith. The crew requirement is not consumed.`,
  );
  if (!confirmed) return;
  const next = unlockSector(colony, sectorId);
  inspectedSectorId = sectorId;
  screen = 'sector';
  updateColony(next);
}

function handleAction(button: HTMLElement): void {
  const action = button.dataset.action;
  const sectorId = Number(button.dataset.sector);

  switch (action) {
    case 'inspect-sector':
      inspectSector(sectorId);
      break;
    case 'start-colony':
      beginColony(sectorId);
      break;
    case 'enter-sector':
      if (colony?.unlockedSectors.includes(sectorId)) {
        colony = { ...colony, currentSector: sectorId };
        inspectedSectorId = sectorId;
        screen = 'sector';
        updateColony(colony);
      }
      break;
    case 'unlock-sector':
      tryUnlock(sectorId);
      break;
    case 'toggle-pause':
      if (colony && !colony.failed) {
        colony = { ...colony, paused: !colony.paused };
        updateColony(colony);
      }
      break;
    case 'advance-day':
      if (colony && !colony.paused && !colony.failed) {
        updateColony(advanceDay(colony));
      }
      break;
    case 'back-to-globe':
    case 'home':
      screen = 'atlas';
      if (colony) inspectedSectorId = colony.currentSector;
      render();
      break;
    case 'new-colony':
      screen = 'atlas';
      colony = null;
      inspectedSectorId = 0;
      render();
      break;
    case 'build': {
      if (!colony) break;
      try {
        updateColony(buildStructure(colony, button.dataset.building as BuildingId));
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not build that facility.');
      }
      break;
    }
    case 'fieldwork': {
      if (!colony) break;
      const fieldworkId = button.dataset.fieldwork;
      if (fieldworkId !== 'prospecting' && fieldworkId !== 'ice-core') break;
      try {
        const operation = FIELDWORK.find((item) => item.id === fieldworkId)!;
        const next = performFieldwork(colony, fieldworkId);
        const output = Object.entries(operation.production)
          .map(([resource, amount]) => `+${amount} ${RESOURCE_INFO[resource as ResourceKey].label}`)
          .join(', ');
        updateColony(next, false);
        showToast(`${operation.name} complete: ${output}. −${operation.energyCost} energy.`);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Fieldwork could not be completed.');
      }
      break;
    }
    case 'dismiss-notice':
      saveMessage = null;
      render();
      break;
  }
}

function render(): void {
  moonScene?.dispose();
  moonScene = null;
  document.querySelector<HTMLDivElement>('#app')!.innerHTML =
    screen === 'atlas' ? globeScreenMarkup() : sectorScreenMarkup();
  if (screen === 'atlas') {
    const mount = document.querySelector<HTMLElement>('#moon-mount');
    if (mount) {
      try {
        moonScene = new MoonScene(
          mount,
          colony,
          inspectedSectorId,
          (sectorId) => {
            inspectedSectorId = sectorId;
            render();
          },
          (sectorId) => {
            if (sectorId !== null) {
              inspectedSectorId = sectorId;
              renderInspector();
            }
          },
        );
      } catch {
        mount.innerHTML = '<div class="scene-error"><span>⚠</span><strong>3D atlas unavailable</strong><p>Try a WebGL-enabled browser to explore the lunar globe. Use the sector list to continue.</p></div>';
      }
    }
  }
}

export function startApplication(root: HTMLDivElement): void {
  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>('[data-action]');
    if (button && !button.hasAttribute('disabled')) handleAction(button);
  });

  root.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>('[data-action="inspect-sector"]');
    if (!button) return;
    const id = Number(button.dataset.sector);
    if (!Number.isNaN(id) && id !== inspectedSectorId) inspectSector(id);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && colony && !colony.paused && !colony.failed) {
      persist();
    }
  });

  render();
  window.setInterval(() => {
    if (!colony || colony.paused || colony.failed || document.visibilityState !== 'visible') return;
    const elapsedMs = colony.elapsedMs + 1000;
    if (elapsedMs >= DAY_LENGTH_MS) {
      updateColony(advanceDay(colony));
      return;
    }
    colony = { ...colony, elapsedMs };
    const remaining = DAY_LENGTH_MS - elapsedMs;
    const timeLabel = document.querySelector<HTMLElement>('.time-left');
    const progressLabel = document.querySelector<HTMLElement>('.day-progress');
    const progressBar = document.querySelector<HTMLElement>('.flow-track i');
    if (timeLabel) timeLabel.textContent = formatTime(remaining);
    const progress = Math.min(100, (elapsedMs / DAY_LENGTH_MS) * 100);
    if (progressLabel) progressLabel.textContent = `${Math.floor(progress)}%`;
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (elapsedMs % 5000 === 0) persist();
  }, 1000);
}
