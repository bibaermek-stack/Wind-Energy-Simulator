# Renewable Energy Simulator

An interactive 3D renewable-energy laboratory for university physics teaching.
Three wind turbines of different types stand in one landscape at true relative
scale, and a two-axis solar tracker — cut from the supplied catalogue model —
shares the same site. A mode switch at the top of the app selects **wind**,
**solar**, or **hybrid**; the wind simulation is exactly the one that existed
before the solar work, and hybrid simply runs both at once.

Interface language is Kazakh, with the standard scientific vocabulary left in
English (HAWT, VAWT, Cp, RPM, m/s, kW, Betz, PV, DNI) so the readouts map
directly onto the textbook literature.

```
npm install
npm run models      # prepare the .glb models (only needed once)
npm run verify      # audit both power models
npm run dev         # http://localhost:5178
```

The project folder name contains a semicolon (`Desktop\;tk`). On Windows that
splits `PATH`, so the npm scripts call Vite through `node ./node_modules/vite/bin/vite.js`
rather than a bare `vite` binary.

---

## The three turbines

| | Type | Rotor | Rated | Source |
|---|---|---|---|---|
| 1 | **HAWT** — horizontal axis, 3 blades, upwind | Ø 66.40 m | 1.80 MW | supplied model |
| 2 | **VAWT** — Darrieus H-rotor, 3 straight blades | Ø 11.13 m × 9.09 m | 55 kW | supplied model |
| 3 | **Small-scale** — residential, tail-vane yawed | Ø 1.80 m | 800 W | generated, see below |

The two supplied models were identified from their geometry rather than their
filenames. `wind_generator.glb` is **not** a horizontal-axis machine: its three
`Plane_*` meshes are vertical blades held on horizontal arms around a vertical
shaft, with a small anemometer propeller on the mast head — a Darrieus H-rotor.
`wind_generator (1).glb` is the classical three-blade HAWT. Both keep their
original geometry exactly; nothing was remodelled.

The third turbine is generated from source by
`scripts/generate-small-turbine.mjs`, which lofts a genuine NACA 4412 aerofoil
along a tapered, twisted, swept span and exports a real `.glb` with the same
node hierarchy convention as the other two. It is 3D geometry, not a billboard.

---

## Scientific model

**This is a simplified educational model, and the interface says so.** It is
steady-state momentum theory with an empirical power-coefficient curve and a
conventional variable-speed control law. It is not a BEM or CFD simulation, and
it assumes uniform steady flow — no turbulence, wind shear, yaw error, tower
shadow, or wake interaction between the machines.

What it does model, in `src/physics/windPower.js`:

```
P_wind  = ½ · ρ · A · v³             kinetic power flux through the swept area
P_aero  = P_wind · Cp(λ)             extracted by the rotor,  Cp ≤ 16/27
P_mech  = P_aero · η_drivetrain      at the generator shaft
P_elec  = P_mech · η_generator       clipped at rated power
```

The dashboard reports all four separately, because conflating them is the most
common mistake in wind energy. The power-chain cascade draws them as four bars
scaled against the same denominator, so the losses are visible as length rather
than asserted as a percentage, with the Betz limit drawn as a tick on the first.

**Swept area.** `A = πR²` for the two horizontal-axis machines. For the H-rotor
VAWT the wind sees a rectangular projection, so `A = D × H` — rotor diameter
times blade height.

**Power coefficient.** `Cp(λ)` uses the Heier/Slootweg closed form at zero
pitch, rescaled on both axes to pass through each machine's own
`(λ_optimal, Cp_max)` while keeping the characteristic shape. `λ = ωR/v`.

**Control law.** Below cut-in the rotor is parked. Between cut-in and rated,
rotor speed tracks the wind to hold λ at its optimum, so Cp stays at maximum
(the MPPT region). Above rated, speed is capped and the blades pitch to spill
the surplus — which shows up as a *falling* Cp in the dashboard, exactly as on
a real machine. Above cut-out the rotor brakes to a stop.

**Rated wind speed is derived, not declared:** `v_rated = ∛(2P_rated / ρA·Cp·η)`.
It therefore cannot contradict the other parameters. Rated rotor speed follows
from λ_optimal at that wind speed.

**Rotor inertia.** Rotor speed eases toward its target with a first-order time
constant, integrated exactly over the frame step so it is frame-rate
independent. This is why the 66 m rotor visibly lags the 1.8 m one when you
move the wind slider.

### Parameters: what is measured and what is illustrative

Rotor dimensions are **measured from the actual `.glb` geometry**. Everything
else — rated power, Cp, tip-speed ratio, cut-in/cut-out, efficiencies — is an
**example parameter set**: representative published figures for commercial
machines of each size class, not the specification of any particular product.
The models arrived without datasheets. The interface states this wherever the
numbers appear.

### Verifying the physics

```
npm run verify:physics
npm run verify:solar
```

Prints the worked numbers for all three machines and asserts the invariants
across the whole 0–30 m/s range: Cp never exceeds Betz, output never exceeds
rated, electrical ≤ mechanical ≤ aerodynamic ≤ available, nothing generates
below cut-in or above cut-out, Cp peaks exactly at λ_optimal, and tip speeds
stay physically plausible.

---

## Solar mode

The solar side is an addition, not a rewrite. The wind code is untouched; a
mode layer sits above it. Switching to **Күн** hides the turbines and frames
the array; **Гибрид** shows both at true scale.

### The model

`solar pahels.glb` is a manufacturer's catalogue — ~18 mounting products on
one plot, 65 MB, no hierarchy, geometry batched by material. It cannot be
re-parented the way the HAWT rotor was. `scripts/segment-solar.mjs` rebuilds
assembly #1 from the triangles up:

```
SolarPanelRoot                 azimuth, rotates about Y
  SolarPanelBase               posts + footings, stay planted
  SolarPanelTrackingAssembly   tilt, origin on the torque axis
    SolarPanelSurface          module faces
    SolarPanelFrame            rails and clamps
```

Aperture **13.09 m²**, measured by projecting module faces onto the array
plane (triangle-area sums double-count coincident faces). Example operating
parameters (20 % efficient, 2.6 kW class) are labelled as such in the UI —
the model arrived without a datasheet.

### Scientific model

Simplified teaching chain, in `src/physics/solar/solarPower.js`:

```
sun position  →  panel orientation  →  incidence angle θ
              →  plane irradiance G  →  electrical power
```

```
P = G · A · η · cos θ · [1 + γ(T_cell − 25)] · η_inv · soiling
```

`cos θ` is clamped at 0. Below the horizon, P = 0. Cloud cover attenuates
the *total* resource first and then splits what remains into beam and
diffuse, so more cloud is always less energy. Two panels are integrated off
one set of inputs — one fixed, one tracking — so the comparison tab is
like-for-like.

The site is Astana (51.1°N) on the March equinox, so the time slider
06:00–18:00 is one complete solar day. Tracking gain at those conditions is
**+32.4 %** over a 35°/180° fixed array.

```
npm run verify:solar
```

---

## How the rotors are made to turn independently

All three models ship their rotor as a **separate node**, so no mesh surgery was
needed. They do not agree on where that node's origin sits, and
`src/components/scene/WindTurbine.jsx` handles both cases from data in
`turbineSpecs.js`:

| Model | Rotor node | Axis | Pivot |
|---|---|---|---|
| `small.glb` | `Rotor` | Z | already on the rotor axis |
| `vawt.glb` | `PlanesHolder_27` | Y | already at the rotor centre |
| `hawt.glb` | `Generator` | Z | **needs correction** |

The HAWT's rotor node has an identity transform with its blade vertices baked
in model coordinates. Rotating it would swing the whole rotor around the
model's origin at ground level instead of spinning it about the hub. The fix is
to insert an empty group at the hub and re-parent the rotor into it with
`Object3D.attach()`, which changes a node's parent while preserving its world
transform — the rotor does not move at all, it simply gains an ancestor whose
origin is the hub.

### If a model's rotor is *not* a separate node

If you add a turbine whose blades are welded into a single mesh with the tower,
the approach above cannot work and the model must be split first. In Blender:

1. Import the `.glb` (**File › Import › glTF 2.0**).
2. Select the turbine, enter Edit Mode (<kbd>Tab</kbd>), and hover over a blade
   with <kbd>L</kbd> to select its connected geometry. Repeat for each blade and
   the hub.
3. Press <kbd>P</kbd> › **Selection** to separate them into a new object.
4. **This step is the one people miss:** the new object's origin will still be
   wherever the original's was. Put the 3D cursor exactly on the rotor axis
   (select the hub's centre face, <kbd>Shift</kbd>+<kbd>S</kbd> ›
   *Cursor to Selected*), then in Object Mode use
   **Object › Set Origin › Origin to 3D Cursor**.
5. Rename the object to something stable, e.g. `Rotor`.
6. Export as glTF Binary with **+Y up**, and *uncheck* "Apply Modifiers" if it
   would flatten the hierarchy.
7. Add the turbine to `TURBINES` in `src/physics/turbineSpecs.js`, setting
   `scene.rotorNode` to the new name, `scene.rotorAxis` to the spin axis, and
   `scene.rotorPivot: null` (the origin is now correct).

If the rotor node is found but does not spin, the console names the node and
lists what *is* in the file.

---

## Model preparation

```
npm run models:optimize   # compress the two supplied wind models
npm run models:small      # generate the third turbine
npm run models:solar      # extract the tracker from the catalogue
```

`scripts/optimize-models.mjs` reads untouched copies from `models-source/` and
writes to `public/models/`. It runs `dedup`, `prune` and Draco compression and
**deliberately does no decimation** — the HAWT's 332k triangles sit on 663k
vertices because every face is flat-shaded with its own split vertices, so no
two adjacent triangles share an index and meshopt reads every edge as a
boundary (0.3% reduction even at ratio 0.3). Welding by position would fix that
only by recomputing normals, visibly changing the model's shading. Draco alone
does the job:

```
HAWT   28.64 MB -> 0.81 MB   (332,180 triangles, geometry unchanged)
VAWT    0.30 MB -> 0.09 MB   (  3,308 triangles, geometry unchanged)
small       n/a -> 0.08 MB   (  5,308 triangles, generated)
solar  65.65 MB -> 0.35 MB   (assembly #1 of 14, hierarchy rebuilt)
```

The Draco decoder is served from `public/draco/`, so the app needs no CDN.

### One source model is not in the repository

`models-source/solar_catalogue_original.glb` (the 65 MB catalogue) is
**gitignored**. GitHub warns above 50 MB for a single file and it would take
the repository from 32 MB to about 100 MB, for a file the app never loads —
only `npm run models:solar` reads it, and its 0.35 MB output *is* committed.

So the app runs fine from a fresh clone. Only re-extracting the tracker needs
the source: drop the original back at that path (or point `SOLAR_SOURCE` at
it) and re-run.

```
SOLAR_SOURCE="/path/to/solar pahels.glb" npm run models:solar
```

The two wind originals are small enough to commit and are in the repository.

### Inspecting the catalogue

Run the segmenter with no arguments to list what it finds — useful if you
ever want a different mounting product than assembly #1:

```
node scripts/segment-solar.mjs
```

---

## Project structure

```
scripts/
  generate-small-turbine.mjs   builds turbine 3 and exports it to .glb
  airfoil.mjs                  NACA 4-digit section generator
  optimize-models.mjs          Draco compression for the supplied models
  segment-solar.mjs            extracts the tracker from the catalogue GLB
  verify-physics.mjs           runnable audit of the wind power model
  verify-solar.mjs             runnable audit of the solar power model
src/
  modes/energyModes.js         WIND | SOLAR | HYBRID registry
  physics/
    constants.js               ρ, Betz limit, slider range
    windPower.js               the wind power model — pure functions
    turbineSpecs.js            the three machines, measured + example values
    SimulationEngine.js        time stepping, rotor inertia, energy, history
    solar/
      sunPosition.js           altitude / azimuth from time of day
      solarPower.js            P = G · A · η · cos θ, clamped ≥ 0
      solarSpecs.js            measured aperture + example PV parameters
      SolarEngine.js           mirrors SimulationEngine's contract
  state/simulationStore.js     UI state; the bridge from engines to React
  components/scene/
    WindTurbineScene.jsx       canvas, lighting, sky, clouds, fog
    WindTurbine.jsx            generic GLB loader + rotor rewiring
    SolarArray.jsx             GLB + two-axis tracking
    Sun.jsx                    glowing disc + directional light
    SunRays.jsx                animated beams sun → panel
    Landscape.jsx              terrain, mountains, installation pads
    WindParticles.jsx          instanced flow visualisation
    CameraRig.jsx              orbit control + scripted flights
    SimulationClock.jsx        steps both engines from the render loop
  components/ui/
    TurbineSelector.jsx  WindControls.jsx  EnergyDashboard.jsx
    TechnicalParameters.jsx  PowerChart.jsx  ChartPanel.jsx
    TurbineComparison.jsx  TheoryPanel.jsx  primitives.jsx
    SolarControls.jsx  SolarDashboard.jsx  SolarChart.jsx
    TrackingComparison.jsx  SolarTheory.jsx  EnergyFlow.jsx
  i18n/strings.js              all interface copy
  utils/format.js              Kazakh number formatting
```

**Why the engine is a module singleton rather than React state.** Rotor angles
change 60 times a second. Routing them through React would re-render the entire
dashboard on every frame for no benefit. Instead the engine is stepped once per
frame inside `useFrame`, the 3D scene reads its values directly, and it
publishes a snapshot to the store ten times a second for the UI to render. The
charts and readouts stay live; the scene stays smooth.

---

## Notes on presentation

- **The three machines stand at true relative scale.** The 1.8 m turbine really
  is a speck beside the 66 m one — the swept-area ratio is 1361:1. That
  contrast is the point, and the camera flies to frame whichever machine you
  select. Hybrid mode holds the 4 m solar array in the same frame, so a wind
  farm dwarfing one PV tracker is visible rather than asserted.
- **Chart colours** (`#1d4ed8`, `#0d9488`, `#b45309`) are fixed per turbine and
  never reassigned. They were checked for colour-vision separation and contrast
  against a white surface rather than chosen by eye.
- **Energy over time is drawn as small multiples** in comparison mode. The three
  outputs differ by three orders of magnitude, so one shared linear axis would
  pin two of the three flat against zero.
- **The wind's own kinetic power is absent from the power curve** for the same
  reason — it reaches 57 MW at 30 m/s on the HAWT, 32× its rated output. That
  comparison is made honestly in the power-chain cascade, at true proportion.

## Numbers at 8 m/s (the default)

| | HAWT | VAWT | Small |
|---|---|---|---|
| Swept area | 3462.8 m² | 101.2 m² | 2.5 m² |
| Power in the wind | 1.09 MW | 31.7 kW | 798 W |
| Electrical output | 455 kW | 10.5 kW | 226 W |
| Rotor speed | 15.6 RPM | 54.9 RPM | 551.7 RPM |
| Cp | 0.450 | 0.380 | 0.350 |
| Overall efficiency | 41.9 % | 33.2 % | 28.3 % |
