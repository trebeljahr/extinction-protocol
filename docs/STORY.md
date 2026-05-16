# Extinction Protocol — Story Bible

Reference doc for the in-game narrative. Voice for all in-game copy:
terse, observational, scientist or operator. Past or present-perfect.
No exposition dumps. No anthropomorphizing. Shown, not told.

There are no aliens in this story. Every strange thing the player sees
is something humans built or something dinosaurs built out of what
humans left behind.

## Setting

A remote field station run by **Ricos Labs**, a private biotech outfit
licensed to operate a **de-extinction revival programme** in an
isolated reserve. Cloning vats, neural scaffolding rigs, growth tanks,
behavioural-conditioning hardware. They bring extinct species back.
The reserve is large enough that the revived population can pass for
wild.

Something went wrong in the revival process. Specimens started
integrating the revival hardware into themselves — not symbolically.
Physiologically. Bone laced with the scaffolding alloys. Neural tissue
patched into the conditioning network. Pack coordination through
comm-band frequencies that should only carry our telemetry.

Containment failed. The reserve walls fell. The revival hardware kept
working, because it was never designed to fail safe — it was designed
to keep specimens alive. They are very alive now, and they are no
longer ours.

## Core arc (5 beats)

1. **Breach (L1–L5, forest).** The reserve perimeter is gone. Wildlife
   counts off by 400%. Pack behaviour cleaner than instinct — wrong
   for the species. First **Matriarch** sighted at L5, larger than
   anything that came out of a tank, unafraid of fire.

2. **Fall-back (L6–L10, snow).** Line pushed north. Cold doesn't slow
   them. Specimens recovered from tar are decades-old normals — but
   what is hunting us now didn't exist last quarter. Second Matriarch
   at L10 — bringing reinforcements she didn't grow alone.

3. **Integration (L11–L15, desert).** Phenotype divergence.
   Integument deflects kinetic rounds (shielded — recovered samples
   show our scaffolding alloy threaded through dermal layers).
   Smaller specimens heal the larger ones in the field (heal-aura —
   conditioning-network behaviour, not biology). Wounds close under
   fire (regen — the revival tanks did this; the specimens now do it
   themselves). Third Matriarch at L15. She leads. The herd doesn't
   run while she's present.

4. **Collapse (L16–L20, wasteland).** Past the last city. There has
   not been a city for some time. Multi-vector coordination — three
   approach lanes at once, synchronised, on frequencies we recognise.
   They are using our comm net against us. All civilian channels
   dark for nine days. The **Extinction Protocol** becomes the only
   standing directive.

5. **Terraforming (L21–L30, lava → alien).** They are restructuring
   the crust. Geothermal vents opened along migration corridors —
   they walk through the magma; their integument doesn't burn.
   Atmospheric chemistry shifting where the densest herds graze.
   By L26 the ground is no longer ours: violet biocrust, crystallised
   discharge from their hardware-laced metabolism, plant life we did
   not seed. They are turning the planet into the environment they
   prefer. We are the invasive species now. L30: the final Matriarch
   at the core of the new biome. The Protocol was always for her.

## Factions

### Ricos Labs (the player)
A revival biotech operator turned wartime defender. The hardware that
caused this is the same hardware the operators understand best, so
they're the ones still running emplacements. Field-report voice —
terse, after-action, sleep-deprived. No pride left in the work.

### The Matriarchs
Apex specimens. The most heavily integrated — bone-grafted scaffolding,
conditioning-network nodes, comm-band hooks they were never meant to
have. Five canonical appearances at L5 / L10 / L15 / L30, with
biome-themed mini-bosses across the late game. Each one denser and
less recognisable as the species she started as.

Not a faction with goals in the political sense. They lead because the
revival programme conditioned a hierarchy and the apex specimens
absorbed the conditioning hardware. They are what the herd becomes.

### The hardware
Not a character. The revival rigs, scaffolding alloys, conditioning
nodes, comm relays — all of it human-built, all of it now grown into
the dinosaurs. Referenced obliquely in field reports: "scaffolding",
"integument", "the conditioning network", "our frequencies". Never
explained directly. The player infers the symbiosis from:
- Crashed rovers and abandoned tank rigs in forest/snow world props
- Wreckage of generator stations and satellite dishes in wasteland
- Tissue / sample lines in desert briefings
- The alien biome itself — clearly *grown*, not natural

## Biomes — narrative role

| Biome | Levels | Role |
|---|---|---|
| Forest | L1–L5 | The reserve perimeter. First contact. The world still recognisable. |
| Snow | L6–L10 | First fall-back. Climate isn't a buffer. |
| Desert | L11–L15 | Phenotype divergence. Hardware showing up in tissue. |
| Wasteland | L16–L20 | Post-civilisation. They use our comm net. |
| Lava | L21–L25 | Geothermal restructuring. They walk through magma. |
| Alien | L26–L30 | Their terraform output. Not somewhere else — our world, rewritten. |

The alien biome is **not an alien world**. It's what our planet
becomes when an apex herd with hardware-grade metabolism reshapes the
local biology for hundreds of square kilometres. Origin = endpoint:
the final Matriarch is at the centre of the new biome, where the herd
has been densest longest, where the terraform is most complete.

Existing biome order = arc order. No level reordering required.

## Heroes — role only

Heroes stay mechanically what they are. Blurbs stay mechanical (no
backstory in the UI). Tactical voice is the right voice for the
operator running the emplacement, not a war diary.

| Hero | Callsign | Role |
|---|---|---|
| George | Vanguard | Balanced kinetic sniper. Midrange suppression. |
| Leela | Strider | Fast electric skirmisher. Strips shields, marks targets. |
| Mike | Pyre | Close-range flame. Per-shot splash, area-clear ultimate. |
| Stan | Mauler | Heavy explosive artillery. Slow, tanky, every shell detonates. |

Hero-arc fit is carried by the *world*, not by hero text: rovers,
generators, comm dishes, lab debris, hardware-laced specimen
silhouettes. Shown, not told.

## Field-report voice — rules

- Under ~140 chars per briefing.
- After-action, not pre-mission. Past or present-perfect.
- No exclamation marks. No second person. No "we will" / "we must".
- No anthropomorphizing the specimens. They don't "hate" or "want".
  We describe what they do; behaviour speaks for itself.
- Each beat acknowledges at least one of: biome fall-back, roster
  mechanic debut, Matriarch sighting, hardware integration.
- The revival hardware is referenced obliquely. Vocabulary:
  scaffolding, integument, alloy, conditioning, the network, our
  frequencies, the reserve, the programme, the tanks. Never
  "alien", "substrate", "artifact".
- A briefing is the operator typing into a log five minutes after the
  wave. Sleep-deprived. No flourish.

## What changes in the code

1. **`docs/STORY.md`** (this file) — the bible.
2. **`src/levels/briefings.ts`** — full 30-line pass. Re-author every
   briefing against the rules above. Keep the existing tracker —
   biome fall-back at the band boundary, mechanic debut at L11/L13/
   L14/L15, Matriarch at L5/L10/L15/L30. Add hardware-integration
   thread starting subtle (L1) and resolving at L30.
3. **`src/sim/heroVariants.ts`** — no changes.

## What does not change

- Hero stats, abilities, costs, blurbs.
- Level node positions, wave content, difficulty curves.
- Biome boundaries (y-bands).
- World map layout.
- Matriarch model / VFX (separate task — see notes file).
