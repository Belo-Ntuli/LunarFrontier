# Lunar Frontier — Game Specification

**Status:** Initial playable MVP
**Audience:** Product, design, engineering, art, and education
**Implementation status:** The browser MVP implements the 3D lunar atlas, starting colony, 2D sector management, resource simulation, facility construction, exploration, pausing, local saves, and repairable environment and maintenance hazards. Product and economy values are initial balancing defaults.

## 1. Game concept

Lunar Frontier is a student-facing lunar civilization builder. Players establish an outpost on the Moon, manage its people and life-support resources, and gradually explore and develop additional lunar sectors. The game makes mission trade-offs tangible: choices about life support, energy, materials, and exploration affect how long the crew can survive and what the colony can accomplish.

The experience combines:

- A **3D overview** of a spherical Moon divided into 15 selectable, naturally contoured terrain regions.
- A **2D management view** for playing and developing the selected sector.

## 2. Product goals

1. Make lunar settlement systems and resource trade-offs understandable through play.
2. Let a player choose where their colony begins and give them a clear path to explore more of the Moon.
3. Keep the world legible: players can see sector status, resource levels, crew count, and survival day.
4. Support a pause-and-resume play style suitable for learners.
5. Save progress locally in the browser without requiring an account, server, or database.

## 3. Core play loop

1. Start a new colony and choose one of the 15 sectors as the landing site.
2. Establish the initial habitat and crew in that sector.
3. Review the current day, people, and resource stores.
4. Manage the colony in the 2D sector view.
5. Inspect other sectors in the 3D overview. Locked sectors show their exploration requirements.
6. Gather the required materials and crew capacity, then unlock a sector for exploration and development.
7. Continue balancing colony needs and expansion to extend the outpost's survival.

The initial resource rates, building actions, exploration costs, and survival/failure rules are defined in Sections 5–9. They are playable balancing defaults, not lunar mission-design recommendations.

## 4. World and sector overview

### 4.1 Lunar map

- Represent the Moon as a round 3D planet.
- Divide the globe into 15 individually selectable sectors that cover the surface.
- Render sector boundaries as softly blended, irregular terrain transitions in the Moon's surface texture, with very dark, depressed troughs and subtle walls that resemble natural ravines. Do not draw polygon tiles, vector outlines, or a visible grid on the Moon.
- Add slightly more pronounced, raised 3D terrain details to each sector that reflect its short terrain description, such as crater rims, ridges, volcanic domes, rilles, and basin rings. Keep the relief restrained and fade it to zero at existing sector edges; do not change sector assignments, centers, or shapes.
- Animate sunlight around the Moon's local axis over each 45-second in-game day. Keep the light attached to the globe so the day/night pattern stays aligned with its terrain when dragged or refocused, independent of the camera. The cycle advances only while the simulation is running and visible, and pauses with the simulation.
- Show visible, softly twinkling star dots in the space background; keep them static when reduced-motion is requested.
- Display a numbered name bubble slightly above each sector on the 3D globe, with a leader line ending in a surface dot. Labels follow the globe's orientation and are occluded on its far side.
- After a landing sector is chosen, show a green home symbol on each unlocked sector and a black lock symbol on each locked sector. Hide these status symbols before the player chooses a landing sector.
- Keep all sector landmasses the same base lunar color; use a clear surface tint to distinguish an unlocked, hovered, or selected region.
- Preserve the existing sector centers and boundary shapes when changing terrain appearance.
- Selecting a sector from the adjacent list must remain available as an alternative to interacting with the globe.
- Selecting or keyboard-focusing a sector in the mission map smoothly rotates the globe to bring that sector into view; respect reduced-motion preferences.
- Set the 3D globe's default zoom to 80 percent and allow zoom changes only through accessible on-screen plus and minus buttons.
- The sector details panel can be collapsed and reopened with an accessible arrow control; the mission map remains visible.
- Leave sector details blank until a sector is explicitly selected; hovering or focusing a sector must not change the details.
- From 901px and wider, keep the mission map, globe, and sector details in three columns, with compact sidebars around 160–205px wide and controls contained within their panels. At narrower widths, the details panel may stack below the map and globe.
- Tint unlocked or landed surface regions green even when selected, and keep selected locked regions blue; show unlocked status in green in the sector list.
- Dragging rotates the Moon. The sector list remains an accessible alternative to pointer-based globe selection.
- Show which sector is selected, unlocked, or locked with visually distinct states.
- A sector should remain identifiable in both the globe overview and the 2D gameplay view.

### 4.2 Sector roster

Preserve these names and their numbering in the game and project data:

| # | Sector |
|---:|---|
| 1 | South Pole |
| 2 | Southern polar field |
| 3 | North Pole |
| 4 | Northern ice fields |
| 5 | Basalt Plains |
| 6 | Wrinkle Ridges |
| 7 | Volcanic Domes |
| 8 | Sinuous Rilles |
| 9 | Procellarum Terrane |
| 10 | Northern poles |
| 11 | Lunar Highlands |
| 12 | Basin Blankets |
| 13 | Impact Basin |
| 14 | Massif concentric mountain |
| 15 | Deep shadowed crater |

Names are reproduced as supplied. Do not merge similarly named areas (for example, North Pole, Northern poles, and Northern ice fields) without an approved design change.

### 4.3 Sector interaction

- **Hover/focus:** Hovering highlights the sector and slightly raises its interior while keeping the ravine boundary low; it does not change the details panel. Keyboard focus may rotate the globe but does not change details.
- **Locked sector details:** Show that the sector is locked and state the required materials and people needed to explore it.
- **Unlocked sector details:** Show its status and provide a way to enter it.
- **Select/click:** Selecting a sector updates its details. Selecting the starting sector begins the colony there; selecting an unlocked sector enters its 2D gameplay view. Keyboard activation and touch selection have the same behavior.
- Selecting a sector directly on the globe updates its details without recreating the scene; keep the camera focused on that sector.
- **Accessibility:** Sector details must be available through click, touch, or keyboard activation; essential information cannot be hover-only.
- **Motion:** Sector lift and camera transitions should be brief and should not be required to understand state. Respect reduced-motion preferences.

## 5. New colony and starting state

- A new player chooses one starting sector from the 15-sector roster.
- The chosen sector becomes the colony's starting/active sector.
- The remaining 14 sectors begin locked.
- The colony begins with **7 people**.
- Create a **basic habitat** in the starting sector.
- Display the initial counter as **Day 1**.
- Starting inventory:

  | Resource | Starting amount |
  |---|---:|
  | Water | 70 |
  | Food | 70 |
  | Energy | 80 |
  | Oxygen | 70 |
  | Metal | 110 |
  | Lunar regolith | 120 |

- These are initial playable balancing values, not real mission-design recommendations.

## 6. 2D sector gameplay

- Entering an unlocked sector transitions from the 3D Moon overview to a 2D view of that sector.
- The 2D view is the management/play space for the sector, not a separate save or separate colony.
- The selected sector and colony-wide status (day, people, and resources) remain clear while managing the sector.
- Arrange the 2D gameplay view as a map-first workspace: a compact colony resource rail spans the top, the broad surface map sits beside a construction bay, and the field guide and day controls remain secondary below it. The map is the main play area, not a small illustration beside a large timer or build list.
- Keep sector resource amounts and colony-wide daily rates readable alongside the map. Show what each facility helps with, its production, recurring operating use, and one-time build cost.
- Include a short terrain field guide that connects the selected lunar environment to exploration and survival choices. Keep this educational context visible without obscuring construction controls.
- The starting sector contains the basic habitat.
- Show the habitat and attached crew living modules as substantial, recognizable structures in the starting sector's 2D map. Constructed facilities also appear on the map in their own locations.
- Newly unlocked sectors initially show an expedition site without a habitat; facilities can be constructed there after unlocking.
- Players can develop or use additional sectors only after unlocking them.
- The sector management view includes a prominent 2D surface map, operational status, facility construction controls, resource readouts, a terrain field guide, and a next-day timer. Gameplay panels use crisp opaque surfaces and do not blur the map or building information.
- Render the 2D sector environment in a simple, crisp pixelated style rather than smooth vector artwork. Zoom toward the colony, use cool blue-gray tiled regolith and scattered terrain detail, and depict compact buildings with stepped pixel silhouettes, layered ring-like roof bands, and blocky lit details. Let players zoom the map in or out around the base and reset to the default view; keep fieldwork locations aligned and accessible.
- Show one distinct pixel-art crew character for every person in the colony. Characters wander between built structures and nearby field sites in the active sector; their movement stops while the simulation is paused or the mission has ended, and respects reduced-motion preferences.
- The surface map shows constructed facilities and interactive fieldwork locations. Players can perform one field operation each lunar day from their current sector.
- Facility construction starts a placement mode; players choose an open position on the surface map before costs are paid. Existing structures, the habitat/expedition site, and fieldwork locations cannot be overlapped. Arrow keys move the placement preview, Enter places it, and Escape cancels.
- After placement confirmation, the nearest crew member walks to the chosen site and visibly constructs the facility. Distance adds travel time; the crew must work at the site for at least 3.5 seconds before the building appears and its costs are paid. Pausing stops construction. With reduced motion enabled, the worker remains still and construction completes after the 3.5-second work period. Reloading before completion cancels this uncommitted placement without spending resources.
- Facility locations persist in the colony save and remain attached to their sector when players zoom or reload.
- Facility types can be built multiple times in each unlocked sector. Every instance has its own location and independently contributes its daily production and operating use. Facilities do not require a separate habitat to be present in that sector.
- The first colony-wide Crew homes, Solar panels, Soil farm, and Ice drill placements are free; later instances use the normal listed costs. Show a one-time tutorial the first time a sector is opened in an unseen save, and remember when it is dismissed.
- Facility production and consumption are colony-wide, and materials are shared between unlocked sectors.
- Provide a clear route back to the 3D overview without losing the current colony state.

### 6.1 Facilities

The first colony-wide placement of Crew homes, Solar panels, Soil farm, and Ice drill is free. Further placements use the listed construction costs. Production and operating consumption apply for every instance on each day transition. Players may build any facility type multiple times in a sector when they can afford it and find clear map space.
Construction costs are spent once when the crew finishes construction; an in-progress placement does not spend resources. Production and operating consumption apply on each day transition. Facilities are unique per sector.

| Facility | Metal | Lunar regolith | Daily output | Daily operating use |
|---|---:|---:|---|---|
| Starter shelter (starting sector only) | Included | Included | +1 Water, +2 Food, +14 Energy, +2 Oxygen | None |
| Crew homes | 20 | 16 | None; provides visible sheltered space only | None |
| Indoor farm | 18 | 18 | +10 Food | 2 Water, 2 Energy |
| Ice drill | 20 | 12 | +10 Water | 3 Energy |
| Air recycler | 14 | 8 | +10 Oxygen | 2 Energy |
| Solar panels | 8 | 6 | +8 Energy | None |
| Nuclear power | 32 | 28 | +24 Energy | None; reactor fuel is not modeled separately |
| Medical clinic | 18 | 14 | Clinic service; health outcomes are not simulated | 1 Energy |
| Oxygen maker | 22 | 16 | +14 Oxygen | 3 Energy |
| Soil farm | 16 | 14 | +5 Food | 1 Water, 1 Energy |
| Water-grown farm | 24 | 22 | +14 Food | 4 Water, 3 Energy |
| Bug food maker | 22 | 18 | +8 Food | 3 Food, 2 Energy |
| Moon dust collector | 12 | 10 | +10 Lunar regolith | 2 Energy |
| Deep mine | 32 | 26 | +8 Metal, +4 Lunar regolith | 8 Energy |

The requested Living Quarters option is already represented by the existing Crew homes facility and is not duplicated. New facility rates are balancing choices scaled against crew upkeep (1 Water, Food, and Oxygen per crew member per day, and 1 Energy per two crew members rounded up). The Soil farm uses less water and produces less food than the Water-grown farm. The Bug food maker uses food to make a larger amount of food.
Listed daily outputs are base facility rates before sector modifiers; facility cards show the effective output in the current sector.

### 6.2 Surface fieldwork

Fieldwork is an immediate, crew-led action on the 2D sector map. The colony may complete one field operation per lunar day. Energy is spent when the operation begins; the resulting materials are added immediately. Ending a shift or waiting for the next day makes another operation available. Pausing disables fieldwork.

| Operation | Availability | Energy cost | Immediate result |
|---|---|---:|---|
| Prospect mineral ridge | Any unlocked sector | 4 | +2 Metal, +5 Lunar regolith |
| Drill an ice core | Sectors with modeled polar, icy, or permanently shadowed deposits | 5 | +8 Water |

Ice-core operations are available in South Pole, Southern polar field, North Pole, Northern ice fields, Northern poles, and Deep shadowed crater. The operation represents a simplified survey/sample return, not a real mission yield estimate. If the crew lacks the energy for an operation, the map disables it and identifies the energy constraint. Pausing or ending the mission also disables fieldwork.

### 6.3 Environment and maintenance hazards

Hazards are generated at day transitions, persist in the local save, and are shown in the shared hazard board on both the atlas and sector screens. Repairs spend the displayed resources immediately and are unavailable while paused or after mission failure. An unrepaired building is offline: it provides no production or operating consumption from the next daily resource calculation. Resource shortages continue to use the normal mission-failure rules.

Environmental hazards:

- The first environmental event is scheduled after a random 10–15 sector-days. Each unlocked sector adds one sector-day of hazard pressure per lunar day, shortening the interval linearly; no more than one environmental event may be active at a time.
- **Meteorite impact:** damages one intact structure, taking it offline until repaired for 2 Metal and 4 Lunar regolith.
- **Dust storm:** can occur whether or not the colony has Solar panels. Drifting surface visuals last one real-time minute. When panels exist, their output is reduced to 50% until repaired for 1 Metal and 1 Lunar regolith, including after the visuals end; without panels, the storm is visual-only, has no production effect, and clears after its visuals end.
- A warning sign appears over any building with an active targeted maintenance or meteorite-damage event and disappears when that event is repaired. An alert symbol appears beside the name of each affected sector on the 3D globe; global dust storms mark every sector. The accessible sector list announces the active hazard names as well.
- Any building-targeted maintenance or meteorite-damage event left unresolved through two lunar-day transitions after it appears causes mission failure and crew death. For a dust storm affecting built Solar panels, that two-day deadline starts after the one-minute visual phase ends. Pausing suspends these gameplay deadlines; dust storms without Solar panels are visual-only and do not start a deadline.
- When a meteorite impact first appears in its affected sector, a clearly visible, roughly 3.3-second meteorite-fall and impact-flash sequence plays with a continuous trajectory. The crater and debris remain beside the damaged structure until repaired; users who prefer reduced motion still see the static impact marker. An active dust storm appears as drifting dust over the sector surface map, fading out after one minute even if the player pauses or leaves the view.
- **Solar flare:** intentionally has no active event behavior yet. The future handler is reserved for NASA DONKI solar-flare data ([NASA APIs](https://api.nasa.gov/) and [CCMC DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/)); the current game makes no NASA API requests and does not model radiation treatment. Future health effects may consult [NASA's Open Science Data Repository](https://osdr.nasa.gov/bio/repo/search?q=radiation%20on%20moon&data_source=cgene,alsda,esa&data_type=study), but are not simulated yet.

Maintenance hazards:

- Each built, currently operational structure has a 20% daily maintenance chance per unlocked sector, capped at 100%. A structure can have only one active maintenance or damage event at a time; separate structures can accumulate issues.
- **Solar panel maintenance:** Solar arrays or Solar panels become unavailable until repaired for 1 Metal and 1 Lunar regolith.
- **Structural decay:** the affected structure becomes unavailable until repaired for 2 Metal and 2 Lunar regolith.
- Facility maintenance can occur on these structures:

  | Facility | Repair cost |
  |---|---|
  | Nuclear power | 2 Metal, 3 Lunar regolith |
  | Oxygen plant | 2 Metal |
  | Soil farm | 2 Water |
  | Hydroponic farm | 1 Metal, 3 Water |

Maintenance hazards can stack with each other and with an environmental hazard. A repaired environmental hazard allows a later environmental event to occur; a second one never overlaps it. Hazard scheduling uses a saved random seed so that reloads do not reset event state. These frequencies and outcomes are initial game-balancing values, not forecasts or engineering claims.

## 7. People and resources

### 7.1 People

- Starting population: **7 people**.
- Crew consumes 1 Water, 1 Food, and 1 Oxygen per person each day.
- Crew consumes Energy at a rate of 1 unit per 2 people per day, rounded up.
- People are part of a locked sector's displayed exploration requirement. This is a minimum team-size check; people are not spent when the player unlocks a sector.
- A fieldwork operation uses the available crew but does not remove people from the colony or change daily crew consumption.

### 7.2 Resource roster

Use the following six resource names consistently in UI, saved data, and game logic:

1. Water
2. Food
3. Energy
4. Oxygen
5. Metal
6. Lunar regolith

There is no inventory capacity limit in the current playable version. The starting habitat and facilities above are the complete initial resource economy; do not silently introduce additional core resources or costs.

### 7.3 Sector building-production modifiers

Each sector adjusts the amount of each resource produced by buildings located there. Apply the listed percentage to each building's base daily output in that sector, then add the resulting building outputs across the colony. Modifiers affect newly produced amounts only; they do not compound against stored resources or across days. They do not change crew consumption, building operating use, construction costs, or fieldwork yields. Fractional resource amounts are retained to two decimal places.

| Sector | Building-production modifiers |
|---|---|
| South Pole | +25% Water, -20% Metal |
| Southern polar field | +20% Water, +25% Oxygen |
| North Pole | +40% Water, -40% Lunar regolith |
| Northern ice fields | +15% Water |
| Basalt Plains | +40% Metal, -40% Lunar regolith |
| Wrinkle Ridges | +45% Metal, -40% Water |
| Volcanic Domes | +25% Food, +10% Metal |
| Sinuous Rilles | +50% Energy, -50% Lunar regolith |
| Procellarum Terrane | +55% Metal, -50% Oxygen |
| Northern poles | +20% Water |
| Lunar Highlands | +15% Lunar regolith, +20% Oxygen, -35% Water |
| Basin Blankets | +25% Metal, +20% Lunar regolith |
| Impact Basin | +30% Metal, +20% Lunar regolith, -35% Energy |
| Massif concentric mountain | +55% Lunar regolith, +50% Metal, -45% Oxygen, -45% Water |
| Deep shadowed crater | +45% Water, +40% Metal, -65% Energy |

## 8. Sector unlocking and expansion

- Only the selected starting sector is initially unlocked; the other 14 are locked.
- Hovering, keyboard-focusing, or selecting a locked sector for inspection shows its exploration requirements.
- Requirements include Metal, Lunar regolith, and a minimum number of people.
- Do not allow a locked sector to enter 2D gameplay or be developed before it is unlocked.
- Once the exploration requirements are met and the player confirms the action, spend the materials, mark the sector unlocked, and enter its 2D surface view. The crew requirement is not consumed.
- Unlocking takes no additional in-game time in this version.
- A sector's locked/unlocked state must persist across reloads.

| Sector | Metal | Lunar regolith | Minimum crew |
|---|---:|---:|---:|
| South Pole | 24 | 18 | 3 |
| Southern polar field | 28 | 22 | 4 |
| North Pole | 25 | 20 | 3 |
| Northern ice fields | 30 | 24 | 4 |
| Basalt Plains | 26 | 20 | 3 |
| Wrinkle Ridges | 28 | 22 | 4 |
| Volcanic Domes | 30 | 24 | 4 |
| Sinuous Rilles | 32 | 26 | 5 |
| Procellarum Terrane | 30 | 24 | 4 |
| Northern poles | 34 | 28 | 5 |
| Lunar Highlands | 32 | 26 | 4 |
| Basin Blankets | 34 | 28 | 5 |
| Impact Basin | 36 | 30 | 5 |
| Massif concentric mountain | 38 | 32 | 5 |
| Deep shadowed crater | 40 | 34 | 6 |

## 9. Time and pause

- Show a day counter for colony survival duration.
- Include a visible pause button in the gameplay interface.
- One in-game day takes **45 seconds** while the page is visible and the simulation is unpaused. Players can also end the current shift early to advance one day immediately.
- Pausing stops the in-game clock and all time-based simulation, including resource production/consumption and any timed exploration or construction.
- While paused, players can still inspect the interface, review sector information, and save or load progress. Actions that advance or consume in-game time must not progress the simulation until unpaused.
- The page does not accrue elapsed play time while hidden.
- At each day transition, calculate facility output and operating use together with crew needs. If Water, Food, Oxygen, or Energy would fall below zero, the mission ends, pauses, and reports which need could not be met.
- Hazard rolls and their daily simulation effects run only on unpaused day transitions. Repairing a hazard is an immediate resource-consuming action and is disabled while paused.

## 10. Persistence and save behavior

- Use browser local storage for colony progress; no database, account, or remote service is required.
- Save at least: selected starting sector, current sector, unlocked sectors, population, resource quantities, day, pause-independent simulation state, and completed/active progression state needed to resume.
- Persist after colony creation, building, unlocking, day transitions, pause changes, and periodically during the day timer.
- Store the game state in the browser under the versioned `lunar-frontier-save` local-storage key.
- Include a save schema version so future game updates can identify and migrate prior saves. The current schema is version 8 and migrates version-1 through version-7 colonies, preserving progress and facility locations, preserving existing hazard state when present, and initializing hazard state for older saves. Dust-storm visual end times and post-visual failure deadlines are persisted.
- Handle unavailable storage, invalid JSON, and incompatible save versions explicitly. Do not silently overwrite a player's unreadable save with a new colony.
- The game should provide a deliberate new-game/reset action with confirmation before replacing saved progress.

## 11. Learning and UX requirements

- Present resource needs and exploration gates in understandable language, with daily production/use and one-time costs shown in the interface.
- Use gameplay feedback to help learners connect decisions with consequences (for example, explain which need a resource supports and why a requirement is unmet).
- Avoid presenting uncertain or simplified lunar engineering claims as precise real-world facts. Label game abstractions and include age-appropriate explanations for STEM concepts.
- Make sector status, selection, and key quantities perceivable without relying on color alone.
- Keep critical status visible in both 3D and 2D views.

## 12. Decisions needed

The initial playable values above should be play-tested with students before they are treated as final balance. These product decisions remain open:

- What is the target age range, platform, and intended session length?
- What constitutes a successful survival milestone or end state besides a life-support failure?
- Should players be able to increase the crew beyond the initial seven people?
- Which STEM topics and learning outcomes must be explicitly taught or assessed?
- Should saves sync or export between devices? (Current behavior is local browser storage only.)

## 13. Acceptance criteria

The initial implementation is ready for review when all of the following are true:

1. The 3D overview presents a spherical Moon with 15 individually selectable, naturally contoured landmasses in one shared lunar tone, separated by very dark, depressed ravine-like troughs, with no visible polygon grid or vector outlines.
2. All 15 sectors appear with the exact roster names and can be individually inspected.
3. Hovering a sector highlights and slightly raises its surface while revealing its details; touch users can access the same details by selection.
4. A new colony lets the player choose any one of the 15 sectors as the starting location.
5. Starting a colony creates a basic habitat in the selected sector, sets the population to 7, and leaves every other sector locked.
6. A locked sector's inspection state clearly identifies it as locked and displays its material and people requirements.
7. A locked sector cannot be entered or developed; after its requirements are satisfied and the player confirms, it becomes unlocked and enterable.
8. Selecting an unlocked sector opens its 2D gameplay view, and returning to the globe preserves the same colony state.
9. The UI displays the survival day, population, and all six named resources.
10. The pause button stops the day clock and every time-based simulation process; unpausing resumes them.
11. Reloading the game restores the saved colony from local storage, including selected/unlocked sectors, people, resources, and day.
12. Invalid, outdated, or unavailable local storage is handled with a clear user-facing message and without silently destroying existing progress.
13. Players can perform one field operation per day; mineral prospecting is available in every unlocked sector, while ice-core drilling is limited to sectors marked with ice deposits.
14. Fieldwork immediately spends the displayed Energy cost, yields the displayed resources, cannot be repeated in the same day, and becomes available again on the next day.
15. Version-1 through version-7 local saves migrate to the current schema without losing colony progress.
16. The 2D sector screen presents the lunar surface map as its dominant play area, with a compact resource rail above it and construction controls beside it; the field guide and day timer are secondary.
17. Sector gameplay panels use readable opaque surfaces; no backdrop blur obscures the map, resource values, or facility details.
18. Facility cards explain their colony purpose, construction costs, daily output, and recurring resource use, and the field guide explains a relevant terrain and mission trade-off.
19. The starting shelter and Crew homes, along with each constructed facility, are visibly represented on the 2D sector surface. The first Crew homes placement is free; subsequent placements cost 20 Metal and 16 Lunar regolith and do not increase population.
20. Players can choose a clear map location for each new facility; blocked locations are rejected, and chosen positions persist after reloading.
21. The active sector map shows one distinct pixel-art character per crew member; characters wander among buildings and nearby sites, stop when paused or the mission ends, and remain still for reduced-motion preferences. Players can build multiple instances of a facility in one sector; each instance has its own location, costs, and daily resource effects.
22. Opening the first sector in an unseen save shows a dismissible tutorial about the four free first placements; dismissal persists, and each eligible first placement spends no construction materials.
23. Regolith & metal mine, Solar array, and Water plant are no longer buildable; loading an existing save removes these facilities and their saved locations.
24. The sector details panel can be collapsed and reopened with an accessible arrow control, while the mission map remains visible; the selected sector is highlighted blue in the list and 3D globe.
25. Selecting a sector in the mission map rotates the globe to show it; this transition respects reduced-motion preferences.
26. Selecting a sector on the globe updates the selection and details without resetting the camera away from that sector.
27. Each sector has visible 3D surface details that correspond to its terrain description, while existing sector shapes and ravine boundaries remain unchanged.
28. Sunlight moves around the Moon's local axis over a 45-second in-game day, remains aligned with the globe's terrain when the globe is manipulated, and stops while the simulation is paused or the page is hidden.
29. Background stars twinkle independently at a gentle, staggered pace and remain static for users who prefer reduced motion.
30. Each visible sector on the 3D globe has a raised bubble showing its two-digit number and larger name, without a "Sector" prefix, connected to the sector by a line and surface dot; labels follow globe rotation and do not prevent sector selection. A visible alert symbol appears beside a sector name while a targeted hazard affects it or a global dust storm is active, and the accessible sector list identifies active hazards.
31. From 901px and wider, the atlas keeps the mission map, globe, and sector details in three columns, with compact sidebars around 160–205px wide and controls contained within them; narrower layouts can stack sector details beneath the map and globe.
32. Environment events occur after randomized 10–15 sector-day intervals, accelerated linearly by unlocked sectors; a meteorite damages infrastructure and visibly animates falling onto it for roughly 3.3 seconds on a continuous trajectory, while a dust storm reduces solar output to 50%. No two environment events overlap, and reduced-motion preferences suppress the meteorite animation.
33. Each built structure has a 20% daily maintenance chance per unlocked sector, capped at 100%; separate structures can accumulate issues, and the specified repairs spend the correct resources and restore their facilities.
34. A damaged or maintained structure is excluded from daily production and operating use until repaired; the hazard board shows active issues and repair costs on both screens.
35. Solar-flare generation remains an empty placeholder for future NASA DONKI integration; no NASA request or radiation-treatment behavior is active in this version.
36. Version-1 through version-7 saves migrate to version 8 without losing colony progress; existing hazard state and schedules are preserved, older saves receive initialized hazard state, and prior dust storms are treated as visually expired.
37. An unresolved building-targeted maintenance or meteorite-damage event causes mission failure at the second lunar-day transition after it appears. A dust storm affecting built Solar panels starts its two-day failure deadline only after its one-minute visuals end; the 50% production penalty persists until repair, while visual-only storms expire without triggering failure. The mission report identifies the unresolved hazard.
21. Environment events occur after randomized 10–15 sector-day intervals, accelerated linearly by unlocked sectors; a meteorite damages infrastructure and a dust storm reduces solar output to 50%. No two environment events overlap.
22. Each built structure has a 20% daily maintenance chance per unlocked sector, capped at 100%; separate structures can accumulate issues, and the specified repairs spend the correct resources and restore their facilities.
23. A damaged or maintained structure is excluded from daily production and operating use until repaired; the hazard board shows active issues and repair costs on both screens.
24. Solar-flare generation remains an empty placeholder for future NASA DONKI integration; no NASA request or radiation-treatment behavior is active in this version.
25. Version-1, version-2, and version-3 saves migrate to version 4 without losing colony progress; active version-4 hazards and the hazard schedule survive reloads.
32. The 3D globe starts at 80 percent zoom and can be zoomed only with accessible on-screen plus and minus buttons; the controls stop at the supported minimum and maximum.
33. The sector details content starts blank and changes only after explicit sector selection by click, touch, or keyboard activation; hovering or keyboard focus alone never changes the details.
34. Selecting any sector displays its building-production modifiers prominently in readable text in the sector details column. Each modifier applies to that sector's building output each day only; it does not compound across turns or affect fieldwork, costs, operating use, or crew consumption.
35. Once a landing sector is chosen, unlocked or landed sectors have a green highlight and green home symbol on the globe, and locked sectors have a black lock symbol. Neither status symbol appears before landing is chosen.

The economy, day length, exploration costs, and hazard frequencies are initial balancing values and should be adjusted only with corresponding UI, tests, and documentation updates.
21. The active sector map shows one distinct pixel-art character per crew member; characters wander among buildings and nearby sites, stop when paused or the mission ends, and remain still for reduced-motion preferences.
22. After placement confirmation, a crew member walks to the marked site and works visibly for at least 3.5 seconds before the facility appears and costs are charged; longer travel distances add time, and pausing suspends the work.

The economy, day length, and exploration costs are implemented as the initial values in this specification and should be adjusted only with corresponding UI, tests, and documentation updates.
