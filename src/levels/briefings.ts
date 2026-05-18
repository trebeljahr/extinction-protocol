// Per-level briefing copy shown in the world-map hover tooltip once an
// outpost is unlocked. The arc tracks three threads in step:
//   1. The fall-back across biomes (forest → snow → desert → wasteland
//      → lava → alien), each band a zone the line could not hold.
//   2. The escalating roster — when a new mechanic debuts in-game
//      (shielded specimens at L11, healing at L13, regen at L14, the
//      first desert Matriarch at L15, multi-lane coordination at L19,
//      the matriarch's appearances at L5 / L10 / L15 / L30) the field
//      report acknowledges it.
//   3. The hardware-integration thread. Kairos Corp ran a de-extinction
//      revival programme; the specimens absorbed the revival hardware
//      and the hardware is now evolving inside them faster than any
//      ordnance can adapt against, killing off the native biosphere
//      around them. References stay oblique — "scaffolding",
//      "integument", "conditioning network", "the lattice",
//      "the programme", "the reserve". Never "alien" or "substrate"
//      — there are no aliens in this story.
// Voice is the on-station operator: terse, after-action, sleep-deprived.
// Panic is allowed and accumulates as the arc collapses. Flourish is
// not. Lines should fit one tooltip without scrolling — keep them
// under ~180 characters. See docs/STORY.md for the full bible.
export const LEVEL_BRIEFING: Record<number, string> = {
  // Forest — the reserve perimeter. First contact. World still recognisable.
  1: "Reserve perimeter breached east of the river. Wildlife counts off by four hundred percent. Nothing inside the wall grew that fast on the catalogue. The biology team is not sleeping.",
  2: "Pack behaviour cleaner than instinct. They flanked the second wave the way the manual flanks them. Watching the lab tape on loop. Nobody on the team will sign off on the word coincidence.",
  3: "Lost two forward outposts overnight. Silhouettes on the thermals larger than anything that came out of our tanks. Three weeks ago they were that size on paper only. They are growing between encounters.",
  4: "Containment line failed at the marsh. The fall-back is now official. The animals on the other side of the river are not the species we revived nine years ago. We are still trying to call them by those names.",
  5: "Smoke north of the ridge. Something the size of a building moves through it and is not afraid of fire. Designate her Matriarch. The catalogue does not have an entry. We are writing one in pencil.",

  // Snow — first fall-back. Climate is not a buffer.
  6: "Forced north. The cold should slow them. It does not. The lab measured a corpse this morning — the integument has thickened in the time it took us to retreat. They are adapting between contact and contact.",
  7: "Tracks across the snow are wrong. Too heavy. Too many. The line of advance is too straight to be a migration. The thing that is doing this is not behaving like an animal and we have no word for the alternative.",
  8: "Two corridors out of the pass and both compromised. The herd splits itself to flank us, on time, without any signal we can intercept. Whatever is coordinating them is inside them now.",
  9: "Specimens recovered from the tar are decades-old normals. What is hunting us now grew last quarter. Same species on paper. Not the same animal. The lab cannot tell us what changed because the change is still happening.",
  10: "Larger frame, denser bone. They are bigger between encounters than they should be. Matriarch sighted again — she brought a herd that did not exist last month. The herd is making more of itself faster than we can count.",

  // Desert — integration. Hardware shows up in tissue. Shields, healing, regen, Matriarch return.
  11: "Integument now deflects kinetic rounds at range. Cross-section shows our scaffolding alloy threaded through the dermal layers. They are growing the metal into themselves. The metal is keeping pace.",
  12: "Confirmed: the larger specimens arrive plated. Both lane entries breached. Whatever round we ended last week with, next week's wave is wearing it. We are watching evolution happen on the firing line.",
  13: "Smaller specimens healing the larger ones mid-engagement. Wounds closing as we watch. The revival tanks did this for us once under sterile conditions. The animals are doing it to each other in the open. We did not design that.",
  14: "Wounds open and close again before the next volley. Regenerating in real time, on every casualty we inflict. We taught the tanks to do this. Nobody taught the animals. They learned it off our own equipment growing inside them.",
  15: "Dossier 14-A: a single specimen leads them. She does not run. The pack does not run while she is present. The Matriarch returns. The biology team has stopped going to bed. We have stopped pretending this stops.",

  // Wasteland — civilisation past tense. The biosphere fails around the outposts.
  16: "Past the last city. There has not been a city for some time. The maps in the operator pack are no longer accurate to the landscape they describe. The landscape has stopped being the landscape we surveyed.",
  17: "Operator: count the silhouettes on the ridge before you report how many we are killing. The difference between those numbers is the species we are losing to. The kills are not the war. The kills are how we are buying hours.",
  18: "The fortified specimens we are calling reefs. They do not break. They only stop. Each one we cannot remove is one approach lane the herd now owns. They are investing in geography. We are running out of geography.",
  19: "Three approach lanes synchronised this morning. No signal between them on any band we monitor. They are no longer transmitting because they no longer need to. Whatever the lattice grew into them is doing the talking.",
  20: "Ninth day with no civilian transmission on any frequency. Ground cover dying out to thirty kilometres around the cordon. Native fauna gone from the survey grid. The Extinction Protocol is the only directive still being repeated.",

  // Lava — geothermal restructuring. They walk through magma; their integument does not burn.
  21: "The continent is venting along their migration corridors. They walk through the magma. The integument does not burn. The vents were not there last quarter. The ground is changing to suit them, not us.",
  22: "Forward observers report the larger specimens are actively hunting us. Two scouts came back to the perimeter. Placed. We were not the prey in any of the original studies. The studies are no longer the studies they were.",
  23: "Ground readings inconsistent with biology. Something the size of a building stood here this morning long enough to dent the basalt. It is not here now. It is ahead of us, between us and the basin.",
  24: "Each wave is heavier than the last by an order we cannot graph. Recommended evacuation. Evacuation denied — there is no rear line. The ground behind us is no longer the ground we walked in on.",
  25: "Last ridge before the basin. South of this position the soil chemistry is no longer the soil chemistry of this planet. North of this position there is nothing left for the convoy to fall back to. The map ends here.",

  // Alien biome — terraform output. Not somewhere else: our world rewritten by the herd.
  26: "The ground is no longer ours. Instruments do not parse the chemistry underfoot. The plants are not plants. The herd metabolises what grows here. We do not. The air at the cordon is failing the reference scale.",
  27: "They no longer bleed the right colour. The casualty form still has a column for blood type. We have stopped filling it in. There is no equivalent on the chart for what comes out of these animals now.",
  28: "Counts are no longer meaningful. New phenotypes between every wave. The animal we killed this morning is not what arrives this evening. The catalogue is closed. The line still has to hold.",
  29: "Quiet for nine minutes. The biome is still spreading underneath us. Whatever the herd is assembling next, it does not need us to see it to finish. The silence is not peace. It is preparation.",
  30: "The Matriarch is here. She is what the programme made when it would not stop. The biosphere is hers. The Protocol was always for her. There is nothing else left to do. Engage.",
};

// Longer command-update framing copy shown only on the first play of
// each biome-opener level. Sits below the per-level briefing in
// LevelIntro and explains the macro picture: why the line keeps
// falling back even though the player is winning every emplacement.
//
// Voice is a command memo, not the on-station operator — half a step
// less terse than LEVEL_BRIEFING. Each block is one paragraph of
// 4–6 sentences, framed as a situation report from above.
//
// The thread the command updates are carrying:
//   - The player wins every engagement because they're the ones
//     holding outposts. Off-screen the war is geographic, not tactical.
//   - The herd reproduces and adapts faster than emplacements can
//     attrit it. The revival hardware is still running inside the
//     reserve; the conditioning lattice is now grown into the animals
//     themselves and selects against every round the player fires.
//   - Each "win" is a rear-guard action covering an evacuation column
//     that is itself falling further back. Holding ground is not the
//     same as advancing.
//   - By the late game the herd is reshaping the continent and killing
//     the native biosphere around the outposts. There is no terrain
//     to retake.
export const LEVEL_INTERSTITIAL: Record<number, string> = {
  // Forest opener — establish the premise. Why we're here. Why we
  // can't just shut the revival rigs down. What "winning" looks like.
  1: "Day one. Kairos Corp has been running the revival programme at industrial scale for nine years. Seventy-two hours ago the reserve perimeter failed and the specimens that walked out were larger, denser, and more coordinated than any catalogue entry the programme has ever produced. The cloning vats inside the wall are still running; shutdown of the rigs requires a corporate signature nobody has produced. Operator role: hold the outpost ring while local population evacuates east. Every emplacement that holds is hours bought for the convoy. We are not retaking ground.",

  // Snow opener — first biome fall-back. Why winning fights hasn't
  // helped: the line moves backward whether we hold the ridge or not.
  6: "Coastal cordon fell on day six. Climate gradient was projected as a hard ceiling on specimen movement — it has not been. Tissue samples from the leading edge show our scaffolding alloy laminated into the integument; the animals are not carrying the hardware, they are made of it, and the metal is keeping them warm. Civilian convoy is now north of the treeline and moving. Every ridge we hold buys time for the column to dig in at the next ridge. The line is not advancing. The line is buying hours.",

  // Desert opener — name the adaptation loop. Why every win is
  // making the next wave harder. Player learns they're training the herd.
  11: "Northern fall-back terminated at the mountains. Convoy diverted south through the high-desert corridor. Specimen morphology on the leading edge no longer matches the catalogue — shielded integument is now the dominant phenotype on inbound waves. Internal review concludes the revival hardware never stopped iterating: it is rewriting the animals between engagements, selecting against the round that killed the last wave faster than any natural species adapts in a generation. Every kill is data; every wave is the species that data produced. We have been training the herd that is eating the continent. The corridor must hold until the column clears.",

  // Wasteland opener — civilisation is gone. Acknowledge it openly.
  // First time the Protocol is named in a command update, not just a briefing.
  16: "Coastal cordon is gone. So is the coast. The remaining civilian population is dispersed across uncatalogued terrain; operators are reaching them by runner, not radio. The herd has stopped behaving like an ecology — they coordinate without signal, breed faster than the rigs ever did inside the wall, and adapt between waves in ways the biology team has stopped trying to predict. The native biosphere between outposts is failing: ground cover dying off, surface water turning, catalogued fauna gone from the survey grids around every emplacement still reporting. The Extinction Protocol is the only standing directive. Tactical-yield ordnance authorised from this point.",

  // Lava opener — terraforming begins. Why the ground is changing.
  21: "Continental interior is no longer recognisable on satellite. Geothermal venting follows herd migration corridors precisely. Atmospheric chemistry is drifting where the densest grazing pressure has been longest. Surveyors are no longer describing this as damage to the landscape. The hardware now grown into the apex specimens appears to be catalysing the change directly — what they walk through, the planet becomes; what they pass over, the native biosphere does not survive. Every emplacement that still holds is one square kilometre that does not become the new biome.",

  // Alien opener — the planet is functionally lost. Final framing.
  26: "The new biome covers approximately one hundred and thirty thousand square kilometres and is still spreading at nine kilometres per day. Ground biology does not match anything in the planetary catalogue. Atmospheric readings inside the zone are off the reference scale; the air at the cordon will not support our respiration much longer. Command considers the planet lost — there is no plan past this directive. Operator role: locate and engage the apex specimen at the original revival site. The Extinction Protocol has not been countermanded because there is nobody left with the authority to countermand it.",
};
