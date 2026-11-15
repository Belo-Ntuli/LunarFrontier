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
    <ellipse class="structure-shadow" cx="0" cy="27" rx="139" ry="76"/>
    <rect class="landing-pad" x="-133" y="-57" width="266" height="116" rx="4"/>
    <path class="habitat-tunnel" d="M-49 0 H-77 M49 0 H77"/>
    <rect class="habitat-dome" x="-48" y="-43" width="96" height="86" rx="3"/>
    <rect class="building-room room-left" x="-38" y="-33" width="35" height="29" rx="1"/>
    <rect class="building-room room-right" x="4" y="-33" width="34" height="29" rx="1"/>
    <rect class="building-room room-lower" x="-38" y="5" width="76" height="28" rx="1"/>
    <path class="building-wall" d="M0 -43 V-4 M-48 0 H48 M-38 -4 H38 M-38 5 H38"/>
    <path class="warm-window" d="M-31 -28 H-18 M10 -28 H25 M-28 11 H-14 M17 11 H30"/>
    <rect class="habitat-door" x="-8" y="-4" width="16" height="15" rx="1"/>
    <rect class="quarter-module" x="-121" y="-26" width="42" height="52" rx="2"/>
    <rect class="quarter-window" x="-113" y="-17" width="26" height="15" rx="1"/>
    <rect class="quarter-window" x="-113" y="6" width="26" height="12" rx="1"/>
    <rect class="quarter-module" x="79" y="-26" width="42" height="52" rx="2"/>
    <rect class="quarter-window" x="87" y="-17" width="26" height="15" rx="1"/>
    <rect class="quarter-window" x="87" y="6" width="26" height="12" rx="1"/>
    <circle class="habitat-beacon" cx="0" cy="-50" r="4"/>
    <text class="structure-label" x="0" y="80">HABITAT + QUARTERS · ${crew} CREW</text>
  </g>`;
}

function facilityStructureMarkup(buildingId: BuildingId, index: number): string {
  const positions = [
    { x: 366, y: 249 },
    { x: 500, y: 236 },
    { x: 634, y: 249 },
    { x: 366, y: 435 },
    { x: 634, y: 435 },
    { x: 500, y: 456 },
  ];
  const { x, y } = positions[index % positions.length];
  const definition = BUILDINGS.find((building) => building.id === buildingId);
  if (!definition) throw new Error(`Unknown facility on sector map: ${buildingId}.`);
  const shell = `<rect class="facility-shell" x="-49" y="-34" width="98" height="68" rx="2"/>
    <rect class="facility-floor" x="-42" y="-27" width="84" height="54" rx="1"/>`;
  const structure = buildingId === 'living-quarters'
    ? `${shell}<path class="building-wall" d="M0 -27 V27 M-42 0 H42"/>
       <path class="warm-window" d="M-32 -19 H-15 M11 -19 H30 M-31 10 H-14 M13 10 H31"/>
       <rect class="habitat-door" x="-7" y="-7" width="14" height="14" rx="1"/>
       <text class="structure-label" x="0" y="37">LIVING QUARTERS</text>`
    : buildingId === 'solar-array'
      ? `<rect class="solar-panel" x="-58" y="-29" width="44" height="58" rx="1"/>
         <rect class="solar-panel" x="14" y="-29" width="44" height="58" rx="1"/>
         <path class="solar-cell-line" d="M-43 -29 V29 M-28 -29 V29 M-58 -10 H-14 M-58 9 H-14 M29 -29 V29 M44 -29 V29 M14 -10 H58 M14 9 H58"/>
         <path class="solar-frame" d="M-8 -24 V24 M8 -24 V24 M-8 0 H8"/>
         <text class="structure-label" x="0" y="36">SOLAR ARRAY</text>`
      : buildingId === 'hydroponics'
        ? `${shell}<rect class="greenhouse-shell" x="-38" y="-23" width="76" height="46" rx="1"/>
           <path class="greenhouse-rib" d="M-24 -18 V18 M-8 -18 V18 M8 -18 V18 M24 -18 V18 M-33 0 H33"/>
           <text class="structure-label" x="0" y="36">HYDROPONICS</text>`
        : buildingId === 'ice-extractor'
          ? `${shell}<circle class="rig-housing" cx="0" cy="0" r="19"/>
             <circle class="rig-frame" cx="0" cy="0" r="8"/>
             <path class="rig-frame" d="M-30 0 H30 M0 -25 V25"/>
             <path class="warm-window" d="M-38 -23 H-27 M27 23 H38"/>
             <text class="structure-label" x="0" y="36">ICE EXTRACTOR</text>`
          : buildingId === 'oxygen-recycler'
            ? `${shell}<rect class="recycler-tank" x="-30" y="-19" width="23" height="38" rx="2"/>
               <rect class="recycler-tank tank-secondary" x="7" y="-19" width="23" height="38" rx="2"/>
               <path class="recycler-pipe" d="M-7 0 H7 M-18 -10 H18"/>
               <text class="structure-label" x="0" y="36">OXYGEN RECYCLER</text>`
            : `${shell}<rect class="mine-hill" x="-31" y="-20" width="62" height="40" rx="1"/>
               <path class="mine-track" d="M-22 0 H22 M0 -14 V14"/>
               <circle class="mine-ore" cx="0" cy="0" r="7"/>
               <path class="warm-window" d="M-38 -23 H-27 M27 23 H38"/>
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
    <div class="surface-sky">
      <div class="surface-label"><span class="eyebrow">SECTOR ${String(sector.id + 1).padStart(2, '0')}</span><h2>${esc(sector.name)}</h2><p>${esc(sector.terrain)} · SURFACE OPERATIONS</p></div>
      <span class="surface-coordinate">DAY ${colony?.day} · ${colony?.paused ? 'PAUSED' : 'LIVE'}</span>
    </div>
    <div class="surface-grid" aria-label="Sector outpost map">
      <svg class="surface-illustration" viewBox="0 0 1000 640" role="img" aria-label="${esc(sector.name)} terrain and constructed colony buildings">
        <defs>
          <pattern id="map-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0 H0 V20" fill="none" stroke="#607986" stroke-width="1"/>
          </pattern>
          <pattern id="map-frost" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M5 10v4m3-2H5m16 21v5m3-3h-3m18-22v3m-2-2h3m12 34v4m-3-3h4m-5-42v3m-2-2h4" fill="none" stroke="#344a55" stroke-width="1.5"/>
            <circle cx="31" cy="9" r="1.5" fill="#455b66"/>
            <circle cx="11" cy="48" r="1" fill="#344a55"/>
            <circle cx="57" cy="27" r="1.3" fill="#536976"/>
          </pattern>
        </defs>
        <rect class="map-ground" width="1000" height="640"/>
        <rect class="map-frost" width="1000" height="640"/>
        <rect class="map-grid" width="1000" height="640"/>
        <path class="map-contour" d="M-20 142 Q154 84 279 150 T531 138 T793 155 T1030 105 M-20 174 Q154 116 279 182 T531 170 T793 187 T1030 137"/>
        <path class="map-contour" d="M-20 496 Q133 444 272 508 T548 486 T814 510 T1030 460 M-20 526 Q133 474 272 538 T548 516 T814 540 T1030 490"/>
        <path class="map-dark-ground" d="M-20 39 L63 48 L76 86 L48 113 L30 154 L-20 145 Z M-20 420 L74 402 L116 439 L101 491 L47 511 L-20 491 Z M858 43 L909 62 L931 102 L1009 109 L1020 152 L950 164 L916 134 L874 129 Z M832 526 L890 501 L932 512 L952 557 L1008 570 L1015 654 L814 654 L817 601 Z"/>
        <ellipse class="map-crater" cx="146" cy="255" rx="91" ry="47"/>
        <ellipse class="map-crater-inner" cx="146" cy="255" rx="69" ry="30"/>
        <ellipse class="map-crater" cx="847" cy="421" rx="111" ry="58"/>
        <ellipse class="map-crater-inner" cx="847" cy="421" rx="84" ry="37"/>
        <g class="map-rocks" aria-hidden="true">
          <path d="M90 367 l11 -8 12 5 4 11 -9 8 -15 -3z M288 138 l9 -6 9 4 3 8 -8 7 -12 -3z M716 236 l12 -9 12 6 1 11 -10 8 -14 -5z M921 176 l8 -7 11 3 5 9 -9 8 -12 -4z M650 544 l13 -8 10 5 2 10 -11 8 -13 -4z M352 529 l9 -8 11 4 2 8 -8 7 -12 -3z"/>
          <circle cx="127" cy="465" r="7"/><circle cx="755" cy="342" r="9"/><circle cx="535" cy="116" r="6"/>
          <circle cx="388" cy="198" r="5"/><circle cx="961" cy="536" r="7"/><circle cx="76" cy="166" r="5"/>
        </g>
        <ellipse class="base-clearing" cx="500" cy="345" rx="174" ry="122"/>
        <path class="map-route" d="M500 342 Q422 326 358 285 T226 254 M500 342 Q592 354 681 402 T824 431 M500 342 Q494 420 501 502"/>
        <path class="map-survey-line" d="M69 582 Q253 545 431 573 T931 571"/>
        ${hasHabitat ? '' : `<g class="landing-site" transform="translate(500 365)">
          <ellipse cx="0" cy="0" rx="47" ry="29"/><circle cx="0" cy="0" r="8"/><path d="M-31 -19 L31 19 M31 -19 L-31 19"/>
          <text x="0" y="48">EXPEDITION SITE</text>
        </g>`}
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

function renderPixelatedSurfaceMap(): void {
  const svg = document.querySelector<SVGSVGElement>('.surface-illustration');
  if (!svg || svg.dataset.pixelated === 'true') return;
  const contextElement = svg.parentElement;
  if (!contextElement) throw new Error('Surface map is missing its drawing container.');

  const canvas = document.createElement('canvas');
  canvas.className = 'pixelated-map';
  canvas.width = 500;
  canvas.height = 320;
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create the pixelated surface map.');
  context.imageSmoothingEnabled = false;

  const width = 250;
  const height = 160;
  const pixelScale = 2;
  context.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  context.fillStyle = '#9bb3b9';
  context.fillRect(0, 0, width, height);

  const zoom = 1.35;
  const cameraX = 125;
  const cameraY = 85;
  context.setTransform(
    pixelScale * zoom,
    0,
    0,
    pixelScale * zoom,
    pixelScale * (width / 2 - cameraX * zoom),
    pixelScale * (height / 2 - cameraY * zoom),
  );

  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const shade = (x * 17 + y * 31 + Math.floor((x * y) / 7)) % 19;
      if (shade < 6) {
        context.fillStyle = shade % 2 ? '#a8bec1' : '#8fa9b0';
        context.fillRect(x, y, 3, 3);
      }
    }
  }

  context.fillStyle = 'rgba(42, 59, 65, .82)';
  const groundPatches = [
    [[0, 5], [13, 7], [18, 12], [15, 20], [8, 24], [0, 22]],
    [[0, 102], [14, 99], [22, 107], [19, 119], [9, 124], [0, 121]],
    [[217, 8], [228, 11], [235, 17], [250, 18], [250, 31], [236, 30], [226, 23]],
    [[204, 132], [218, 125], [231, 128], [237, 139], [250, 143], [250, 160], [202, 160]],
    [[75, 135], [82, 130], [91, 131], [96, 138], [89, 143], [78, 142]],
    [[167, 112], [176, 108], [182, 112], [180, 119], [171, 120]],
  ];
  for (const patch of groundPatches) {
    context.beginPath();
    patch.forEach(([x, y], index) => {
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.closePath();
    context.fill();
  }

  context.fillStyle = '#50666d';
  context.beginPath();
  context.arc(37, 63, 23, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#7f999f';
  context.beginPath();
  context.arc(37, 63, 17, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(211, 108, 27, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#718990';
  context.beginPath();
  context.arc(211, 108, 20, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#435960';
  for (let y = 1; y < height; y += 2) {
    for (let x = 1; x < width; x += 2) {
      const fleck = (x * 23 + y * 19 + Math.floor((x * y) / 5)) % 29;
      if (fleck < 4) {
        context.fillRect(x, y, fleck % 3 === 0 ? 1.5 : 1, fleck % 2 === 0 ? 1.5 : 1);
      }
    }
  }

  context.strokeStyle = 'rgba(62, 82, 89, .22)';
  context.lineWidth = 0.25;
  for (let x = 3; x < width; x += 3) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 3; y < height; y += 3) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  context.fillStyle = 'rgba(202, 220, 217, .34)';
  context.beginPath();
  context.ellipse(125, 86, 45, 31, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = 'rgba(48, 65, 70, .52)';
  context.lineWidth = 2;
  context.setLineDash([2, 4]);
  context.beginPath();
  context.moveTo(125, 85);
  context.lineTo(91, 62);
  context.moveTo(125, 85);
  context.lineTo(212, 72);
  context.moveTo(125, 85);
  context.lineTo(125, 126);
  context.stroke();
  context.setLineDash([]);

  const colors: Record<string, string> = {
    habitat: '#f0b968',
    'living-quarters': '#e8b66d',
    'solar-array': '#8ec6d0',
    hydroponics: '#a8c987',
    'ice-extractor': '#a5d6dc',
    'oxygen-recycler': '#c5b3d5',
    'regolith-mine': '#d5a45f',
  };
  const drawRingBuilding = (x: number, y: number, radius: number, light: string): void => {
    const px = Math.round(x);
    const py = Math.round(y);
    context.fillStyle = '#1c292e';
    context.beginPath();
    context.arc(px, py, radius + 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e3dce8';
    context.beginPath();
    context.arc(px, py, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#796d89';
    context.beginPath();
    context.arc(px, py, Math.max(2, radius - 2), 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#272a35';
    context.beginPath();
    context.arc(px, py, Math.max(1, radius - 5), 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f2edf3';
    context.fillRect(px - 1, py - 1, 2, 2);
    context.fillStyle = light;
    context.fillRect(px - radius + 3, py - 1, 2, 1);
    context.fillRect(px + radius - 4, py, 2, 1);
  };

  const toCanvasPoint = (element: Element): { x: number; y: number } | null => {
    const match = element.getAttribute('transform')?.match(/translate\(([\d.]+)\s+([\d.]+)\)/);
    return match
      ? { x: Number(match[1]) * width / 1000, y: Number(match[2]) * height / 640 }
      : null;
  };

  if (svg.querySelector('.habitat-structure')) {
    drawRingBuilding(125, 85, 13, colors.habitat);
    drawRingBuilding(103, 85, 7, colors['living-quarters']);
    drawRingBuilding(147, 85, 7, colors['living-quarters']);
  }
  svg.querySelectorAll<SVGGElement>('.facility-structure').forEach((building) => {
    const point = toCanvasPoint(building);
    if (!point) return;
    const buildingType = Object.keys(colors).find((type) => building.classList.contains(type));
    drawRingBuilding(point.x, point.y, 9, colors[buildingType ?? 'regolith-mine']);
  });
  svg.querySelectorAll<SVGGElement>('.landing-site, .map-resource-site').forEach((site) => {
    const point = toCanvasPoint(site);
    if (point) drawRingBuilding(point.x, point.y, site.classList.contains('landing-site') ? 6 : 5, '#f2c56f');
  });

  contextElement.insertBefore(canvas, svg.nextSibling);
  svg.classList.add('pixelated-map-source');
  svg.dataset.pixelated = 'true';
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
  } else {
    renderPixelatedSurfaceMap();
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
