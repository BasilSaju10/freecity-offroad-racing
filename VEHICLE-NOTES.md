# FreeCity Â· AWD vehicles

The FreeCity offroad map is now 920 × 920 metres, with fifteen drivable vehicles. The garage includes XUV, Lange Rovar, both Befendars, Tamm TRX, gortuner, Geap Gladiator, DMC Sierra, Bercedez G 63, Gord F-150 Raptor R and Gord Everest. All share the SUV driving tune with model-specific wheel stations, collision hulls, steering wheels and cockpit positions. The HUD contains a speedometer, vehicle picker and nearest-track reset button.

## Start

With Node.js installed, double-click `start.cmd` or run `npm start` in this folder. Open http://127.0.0.1:5173. No package installation or build is required. Keep the server terminal open while playing.

## Controls

- WASD / arrows: accelerate, brake/reverse, steer.
- Space: handbrake. Hold Space + W at low speed for a rear-tyre burnout and mud-coloured dust.
- V: cycle through all fifteen vehicles.
- F: driver-seat camera.
- C: cycle chase, orbit, and driver-seat cameras.
- Click the scene: mouse look; Escape releases it. The embedded preview uses a fallback because it blocks pointer lock. Right-drag also orbits.
- Mouse wheel: chase-camera distance.
- R / Reset to track: return to the nearest track centre.

## Map integration

`assets/map/freecity.glb` is the supplied static map, with its terrain, trails, forests, rocks, fences, logs and water surfaces. The visual map was retained. START/FINISH text labels are restored because the archive's README says their browser-generated textures are absent from the static model.

Collision heights were compiled from the map generator's `driveHeight` function into a 0.5-meter grid across the 460-meter terrain. Fence rails and posts match the generator's dimensions. Tree trunks and scaled scenery-rock hulls now use the generator's geometry, and both route arches have collisions. Terrain heights and narrow features still use an approximate grid. A spatial grid and sparse contact matrix keep distant static scenery from slowing the physics. Surface grip and rolling resistance vary over dirt, mud, rock and shallow water. Water is a shallow crossing effect, not a full fluid simulation.

The SUV collision hull has beveled bumpers and a raised skid section to avoid beaching on the opening logs. Suspension springs/dampers are retuned, engine force follows a power-limited curve, and rolling resistance no longer overwhelms acceleration. Forward speed is governed at 158 km/h and reverse at 40 km/h; terrain, slopes and drag reduce attainable speed. Physics uses explicit 120 Hz steps without discarding simulation time when rendering takes longer. All vehicles keep spring/damper suspension, rolling wheels, non-spinning calipers, animated steering, cabin camera and live speed display. A low-speed automatic holding brake prevents it rolling away while idle on slopes. Handling is a tuned simulation rather than manufacturer-calibrated vehicle data.

## Files

- `main.js`: SUV, controls, camera, scene lighting.
- `freecity-world.js`: map loading, terrain collisions, surface physics.
- `assets/map/freecity.glb`: supplied map model.
- `assets/map/heights.bin`, `assets/map/physics.json`: compiled terrain and obstacle data.
- `assets/vehicle.glb`, `assets/vehicle-editable.blend`: SUV model and editable source.
- `assets/range-rover.glb`, `assets/range-rover-editable.blend`: imported Range Rover with four independent wheels and steering wheel. Its wheel stations and tyre radius are aligned to the shared SUV physics.
- `range-rover-validation.json`: shared tuning and imported wheel geometry checks.
- `assets/defender-90.glb`, `assets/defender-grasmere.glb`, `assets/ram-trx.glb`: added vehicles, with editable Blender files alongside them. The Grasmere model uses converted PBR materials and a simple added cabin.
- `fleet-validation.json`, `validate-fleet.mjs`: per-model wheel alignment, shared driving tune, spawn contact, log traversal, upright stability and ground collision checks.
- `assets/range-rover.glb`, `assets/range-rover-editable.blend`: imported Range Rover with four independent wheels and steering wheel. Its wheel stations and tyre radius are aligned to the shared SUV physics.
- `range-rover-validation.json`: shared tuning and imported wheel geometry checks.
- `assets/defender-90.glb`, `assets/defender-grasmere.glb`, `assets/ram-trx.glb`: added vehicles, with editable Blender files alongside them. The Grasmere model uses converted PBR materials and a simple added cabin.
- `fleet-validation.json`, `validate-fleet.mjs`: per-model wheel alignment, shared driving tune, spawn contact, log traversal, upright stability and ground collision checks.
- `map-validation.json`, `wheel-validation.json`: acceleration, braking, reverse, steering, opening-log traversal, fence collision, spatial-query coverage, shallow-water and wheel-animation checks.
- `map-broadphase.js`, `terrain-contacts.js`: static collision lookup and terrain contact culling.
- `validate-physics.mjs`, `validate-wheels.mjs`: run `npm test` to repeat these checks without a browser.
- `vendor/`: PlayCanvas from the supplied engine archive, Cannon ES and fflate, with license notices.

The original supplied archives were left unchanged. Map and vehicle usage remains subject to their original rights and licenses. Optional web fonts use the network; engine, physics, map and SUV assets are local.

To open a particular vehicle directly, add `?vehicle=defender-90`, `?vehicle=defender-grasmere`, or `?vehicle=ram-trx` to the preview URL.

## Vehicle size and dirt

All fifteen vehicles are enlarged by 12% at runtime, including body models, wheel radius and spacing, suspension mounts and travel, collision hulls, cabin instruments and driver camera positions. Original imported GLB assets remain at their base size; `vehicleScale` in `main.js` controls the shared size multiplier.

Driving on dirt builds a dry dust layer and emits dust puffs. Contact with mud coats tyres and lower exterior panels, grows small attached mud clumps, and throws clods behind the tyres. The coating and clumps rotate with each wheel, persist after stopping or resetting position, and stay with their vehicle when switching cars. Shallow water progressively rinses the dirt away. Wet mud darkens the coating and dries over time. These are real-time visual effects; they do not deform the map terrain.

`driving-soil.js` handles coatings and bounded particle pools; `soil-state.js` handles distance-based pickup, drying and washing. `validate-soil.mjs` verifies frame-rate independence, persistence, dirt/mud differences and water rinsing. The fleet test now checks the enlarged geometry and opening-log traversal for all fifteen cars.

## Ram interior and minimal HUD

The driving HUD shows a speedometer and the top More vehicles button. Suspension travel, gear, terrain labels and the controls strip are removed; the simulation and keyboard shortcuts remain active.

The Ram interior now uses its correct primary texture coordinates after normalizing the FBX's `map1` and `UV0` layer names before combining meshes. The original custom normals are transformed with the geometry and retained. Leather/plastic use matte, non-metallic materials. Packed AOSO texture alpha is no longer interpreted as transparency on solid surfaces, preventing the see-through dashboard and steering wheel. Windows remain transparent. `validate-ram-interior.mjs` checks exported primary UV spread, opacity and material properties.

## More vehicles

Click More vehicles at the top to open the garage, then choose a vehicle. Escape or the close button dismisses the menu. Driving pauses while the garage is open. The selection is saved in the URL for refreshes; V also cycles the fleet.

Vehicle changes keep the current road position, heading, slope orientation and velocity. A small vertical adjustment accommodates differences in ride height; changing vehicles no longer resets to the map start. R still resets deliberately. `validate-vehicle-switch.mjs` checks all 225 vehicle pairings.

The default camera is now inside the driver seat, with a 68-degree field of view and a slight downward glance that frames the windshield, dashboard and steering wheel. Each vehicle has its own calibrated `cockpitEye` position, including the right-hand-drive Fortuner. Mouse look remains available, F returns to the forward driver view, and C cycles cameras. The camera mode and look direction stay unchanged when switching vehicles.

Exterior chase and orbit views stop at a minimum elevation of 4.6 degrees. The camera follows vehicle heading without inheriting chassis pitch or roll, stays at least 0.65 m above terrain, and shortens its distance when a hill blocks the camera boom. The same terrain check runs after camera smoothing so transitions cannot dip under the map. Driver-seat mouse look stays unchanged. `validate-camera.mjs` checks 360 combinations of slopes, vehicle tilt, orbit angle and zoom, plus cockpit behavior.

The four additions appear as Toyoda Fortuner, Jeap Gladiator, GMC Siera AT4X and Mercedez G 63. Existing imported vehicles have similarly altered menu names. These display labels do not modify baked model badges or textures. Each model uses the same AWD driving tune, with its own centered wheel assemblies, straightened rolling axes, wheelbase, tyre radius, body collider and driver camera. Mud and dust work on the additions too.

The latest garage labels change the first letter of every previous name: XUV, Lange Rovar, Befendar 90, Befendar Grasmere, Tamm 1500 TRX, gortuner, Geap Gladiator, DMC Siera AT4X and Bercedez G 63. Vehicle URL identifiers stay the same.

All fifteen cabin steering wheels now have independent meshes and calibrated column pivots. Steering input turns the wheel in the cockpit and releasing it returns it to center. The original Grasmere wheel replaces the duplicate placeholder. The Range wheel uses opaque leather and satin trim, and its column axis is corrected. Editable Blender sources and per-vehicle steering reports are included. `validate-steering.mjs` checks independent wheel geometry, rotation about the column and the first-letter name changes.

Fences use a continuous contact envelope up to the visible post height, covering gaps between rails and post edges. A low-friction vehicle/fence contact material lets glancing impacts slide along the fence while head-on impacts stop the car. `validate-fence-slide.mjs` checks 36 impacts across all nine vehicles at 43 and 144 km/h.

## Solid wheel surfaces

Tyres, rims, brakes and rear spare-wheel covers use opaque, two-sided materials with depth writing. Packed texture alpha is ignored on these solid surfaces, fixing the Defender's see-through tyre/spare cover and the Range Rover's wheel materials. All nine GLB files and editable Blender sources are checked and corrected; `wheel-surfaces.js` also enforces the settings during loading before dirt/mud shaders are attached. Wheel colour textures and geometry remain intact, including real gaps between spokes, while cabin windows remain transparent. `validate-wheel-surfaces.mjs` checks all 36 road-wheel assemblies, spare-cover materials, runtime settings and unchanged geometry/texture bytes.

New assets are `fortuner.glb`, `gladiator.glb`, `sierra.glb` and `g63.glb`, with editable Blender files and conversion reports alongside them. Direct links support `?vehicle=fortuner`, `?vehicle=gladiator`, `?vehicle=sierra` and `?vehicle=g63`. Fleet validation covers all nine vehicles.


The Reset to track button (R) returns the current vehicle to the closest point on the track centre line, aligns its heading with travel direction and stops its motion. Vehicle switching still preserves the current driving position.

All nine vehicles have a seated driver with a red peaked motocross helmet, clear eye port, face, articulated arms and fingered gloves. Hands grip the steering rim and follow its rotation. Seat height limits keep the helmet beneath the roof; the driver head is hidden in first person to prevent camera clipping.

Vehicle badges, dedicated lettering and printed plate graphics have been removed or blanked, with plain steering hubs, wheel centres and tyre sidewalls. Additional corrections remove the Bercedez grille emblem, DMC grille letters and gortuner front/rear emblems. The XUV has matte black paint. Gortuner rims and hardware now belong to their rotating wheel assemblies instead of the stationary body mesh. Editable Blender assets and per-vehicle reports are included.


## Enlarged map and additional vehicles

Map width and length are doubled from 460 to 920 metres. Height stays unchanged, giving longer and wider trails without larger vertical obstacles. The visual model, heightfield spacing, fence and scenery colliders, water crossings, banners, spawn, reset route and driving bounds are expanded together. The terrain now uses one-metre sample spacing; the original height samples are preserved. `validate-expansion.mjs` checks terrain collisions in the new outer areas and matching visual/collision scale.

The two new supplied models are available under the altered names Gord F-150 Raptor R (`?vehicle=raptor`) and Gord Everest (`?vehicle=everest`). They include full rotating tyre/rim assemblies, native animated steering wheels, calibrated first-person cameras, helmeted drivers, mud/dust, same-place switching and AWD physics. Branding is removed or covered with plain surfaces. Original archives are unchanged; editable Blender files and conversion reports are included.

XUV white grille and trim materials now use reflective chrome (metalness 1, roughness 0.13); its body remains matte black.


## Dynamic water splashes

All eleven vehicles emit tyre splashes in the three existing water crossings. Entering water creates a burst of curved spray and droplets; driving through it throws water outward from the wheels and leaves thin expanding foam ripples. Speed, tyre immersion and downward landing velocity control the effect. Dry, airborne and stationary wheels do not continuously spray. Droplets arc under gravity, foam and spray fade, reset clears the effects, and vehicle switching does not create a false entry burst.

The effect uses fixed pools of 160 droplets, 20 curved sheets and 40 ripple rings. It adds visual water interaction without changing the existing water resistance, traction or vehicle physics. `validate-water-splashes.mjs` checks all fifteen vehicles, entry/landing bursts, speed response, emission rates across frame rates, stationary and airborne suppression, fading and bounded allocations.


## Dynamic exhaust smoke

All fifteen vehicles have individually calibrated exhaust emitters. `exhaust-outlets.js` contains 34 vehicle-local outlet positions and directions, measured against the imported geometry: single, paired and quad rear outlets, four angled side outlets on the Bercedez, the Defender 90 side outlet and the Everest downward outlet. DMC emitters sit beneath the lower rear bumper corners for its concealed outlets. Geometry references and calibration notes are in `assets/exhaust-calibration.json`. Emitters follow the vehicle's position, pitch, roll, rotation and 1.12 visual scale.

Idle produces a faint light-grey haze. Pressing the accelerator creates a short, denser dark-grey burst; sustained throttle and uphill load increase density, emission rate and darkness. Uphill load uses terrain slope and chassis pitch in the travel direction, including reversing uphill. Braking and coasting return to light smoke. Exhaust drifts, expands, rises and fades after leaving the pipe. Submerged outlets suppress airborne smoke. Reset clears old smoke; the fixed pool contains at most 256 puffs. This visual response does not alter vehicle physics.

`validate-exhaust.mjs` checks all 34 outlets across fifteen vehicles, model references, scaled/rotated placement, side/downward layouts, acceleration and hill responses, braking, frame rates, submerged outlets and particle bounds.


## Additional routes and latest four vehicles

The garage now includes Missan Super Safari, Koyoda Hilux, Vrus Absolut and Bamborghini Huracan Sterrato. Each has independent complete tyre/rim assemblies, an animated steering wheel, helmeted driver with hands, a fitted cockpit, shared AWD physics, mud, water splashes and load-responsive exhaust smoke. Safari and Urus use simple added cabins where the supplied models lack usable interiors. Safari and Hilux use concealed rear exhaust positions because the supplied geometry has no separate exhaust tips; the other two use measured native outlets.

Two dirt links bypass and cross between the log sections. Broken stone loop and Boulder ladder add two rock-covered routes with 208 embedded rocks. Terrain, rock hulls and visuals are rebuilt together. Reset to track recognises all branch routes.

Airborne dust shares the mud particle colour. Holding Space and accelerating at low speed brakes the front wheels while the rear tyre and rim assemblies spin together and throw dust and clods. Releasing acceleration restores the handbrake. Dust and mud use bounded pools of 64 puffs and 32 clods.

Only three vehicle models stay resident in graphics memory at once. Evicted vehicles reload when selected, retaining their dirt levels. The current position, heading and momentum stay intact on vehicle changes.

Run npm test for all fleet, collision, camera, steering, dirt, water, exhaust, burnout and route checks.


## Rebuilt Vrus cockpit

The Vrus now has a fitted leather dashboard, instrument binnacle with illuminated dial marks, centre screen, air vents, climate controls, centre tunnel, door trim and a three-spoke steering wheel. The old flat placeholder and occluding cabin faces are removed. The camera sits farther behind the wheel; hand grips and the column use the new pivot. This is a custom unbranded interior built for the supplied exterior model. `validate-vrus-interior.mjs` checks that the dashboard does not block the wheel grips, and checks camera and helmet clearance.
