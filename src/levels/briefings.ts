// Per-level briefing copy shown in the world-map hover tooltip once an
// outpost is unlocked. The arc tracks three threads in step:
//   1. The fall-back across biomes (forest → snow → desert → wasteland
//      → lava → alien), each band a zone the line could not hold.
//   2. The escalating roster — when a new mechanic debuts in-game
//      (shielded specimens at L11, healing at L13, regen at L14, the
//      first elite at L15, multi-lane coordination at L19, the
//      matriarch's appearances at L5 / L10 / L15 / L30) the field
//      report acknowledges it.
//   3. The hardware-integration thread. Kairos Corp ran a de-extinction
//      revival programme; the specimens absorbed the revival hardware
//      and are now reshaping the planet to suit them. References stay
//      oblique — "scaffolding", "integument", "conditioning network",
//      "our frequencies", "the programme", "the reserve". Never "alien"
//      or "substrate" — there are no aliens in this story.
// Voice is the on-station operator: terse, after-action, sleep-deprived,
// no flourish. Lines should fit one tooltip without scrolling — keep
// them under ~140 characters. See docs/STORY.md for the full bible.
export const LEVEL_BRIEFING: Record<number, string> = {
  // Forest — the reserve perimeter. First contact. World still recognisable.
  1: "Reserve perimeter breached east of the river. Wildlife counts off by four hundred percent. The programme is in containment review.",
  2: "Pack behaviour cleaner than instinct. Flanking the line on the second wave. The biologists will not put it on the record.",
  3: "Lost two forward outposts overnight. Silhouettes on the thermals larger than anything that came out of our tanks.",
  4: "Containment line failed at the marsh. The fall-back is now official. Buying time, no longer holding ground.",
  5: "Smoke north of the ridge. Something the size of a building moves through it and is not afraid of fire. Designate her Matriarch.",

  // Snow — first fall-back. Climate is not a buffer.
  6: "Forced north. The cold should slow them. It has not. The reserve is no longer a place on the map.",
  7: "Tracks across the snow are wrong. Too heavy. Too many. The line of advance is too straight to be a migration.",
  8: "Two corridors out of the pass and both compromised. The herd splits itself to flank us — coordinated, on signal.",
  9: "Specimens recovered from the tar are decades-old normals. What is hunting us now did not come out of the same tanks.",
  10: "Larger frame, denser bone. They are bigger between encounters than they should be. Matriarch sighted again — she brought a herd.",

  // Desert — integration. Hardware shows up in tissue. Shields, healing, regen, first elite.
  11: "Integument now deflects kinetic rounds at range. Recovered samples show our scaffolding alloy threaded through the dermal layers.",
  12: "Confirmed: the larger specimens arrive plated. Both lane entries breached. The fall-back continues into the dunes.",
  13: "Smaller specimens are healing the larger ones in the field. That is conditioning-network behaviour, not biology.",
  14: "Wounds open and close again before the next volley. Regenerating under fire. The revival tanks did this for us once.",
  15: "Dossier 14-A: a single specimen leads them. She does not run. The pack does not run while she is present. The Matriarch returns.",

  // Wasteland — civilisation past tense. Multi-lane coordination on captured frequencies.
  16: "Past the last city. There has not been a city for some time. The maps in the operator pack are no longer accurate.",
  17: "Operator: count the silhouettes on the ridge before you report how many we are killing. The gap between those numbers is the war.",
  18: "The fortified specimens we are calling reefs. They do not break. They only stop. Each one costs us a position.",
  19: "Three vectors at once, synchronised on our own comm frequencies. They are no longer pretending not to coordinate.",
  20: "All civilian comms dark nine days. The Extinction Protocol is the only standing directive. The revival licence is suspended retroactively.",

  // Lava — geothermal restructuring. They walk through magma; their integument does not burn.
  21: "The continent is venting along their migration corridors. They walk through the magma. The integument does not burn.",
  22: "Forward observers report the larger specimens are actively hunting us. We were not the prey in any of the original studies.",
  23: "Ground readings inconsistent with biology. Something the size of a building was here this morning. It is not here now.",
  24: "Each wave is heavier than the last by an order we cannot graph. Recommended evacuation. Evacuation denied — there is no rear line.",
  25: "Last ridge before the basin. If this falls there is no further ridge. The line ends in the new biome.",

  // Alien biome — terraform output. Not somewhere else: our world rewritten by the herd.
  26: "The ground is no longer ours. Instruments do not parse the chemistry underfoot. The herds are at home in it.",
  27: "They no longer bleed the right colour. We are still required to file casualty paperwork on their behalf.",
  28: "Counts are no longer meaningful. New phenotypes between every wave. Hold the line. Hold the line. Hold the line.",
  29: "Quiet for nine minutes. The new biome is still spreading. We are not optimistic about what comes next.",
  30: "The Matriarch is here. She is what the programme made when it would not stop. The Protocol was always for her. Engage.",
};

// Longer SITREP-style framing copy shown only on the first play of each
// biome-opener level. Sits below the per-level briefing in LevelIntro
// and explains the macro picture: why the line keeps falling back even
// though the player is winning every emplacement.
//
// Voice is a command memo, not the on-station operator — half a step
// less terse than LEVEL_BRIEFING. Each block is one paragraph of
// 4–6 sentences, framed as a situation report from above.
//
// The thread the SITREPs are carrying:
//   - The player wins every engagement because they're the ones
//     holding outposts. Off-screen the war is geographic, not tactical.
//   - The herd reproduces and adapts faster than emplacements can
//     attrit it. The revival hardware is still running inside the
//     reserve; the conditioning network selects against every round
//     the player fires.
//   - Each "win" is a rear-guard action covering an evacuation column
//     that is itself falling further back. Holding ground is not the
//     same as advancing.
//   - By the late game the herd is reshaping the continent, not just
//     occupying it. There is no terrain to retake.
export const LEVEL_INTERSTITIAL: Record<number, string> = {
  // Forest opener — establish the premise. Why we're here. Why we
  // can't just shut the revival rigs down. What "winning" looks like.
  1: "SITREP, day one. Kairos Corp has been running the revival programme at industrial scale for nine years. Seventy-two hours ago the reserve perimeter failed — cause unclear, cloning vats inside the wall still active. Shutdown of the rigs requires a corporate signature nobody has produced. Operator role: hold the outpost ring while local population evacuates east. Every emplacement that holds is hours bought for the convoy. We are not retaking ground.",

  // Snow opener — first biome fall-back. Why winning fights hasn't
  // helped: the line moves backward whether we hold the ridge or not.
  6: "SITREP. Coastal cordon fell on day six. Climate gradient was projected as a hard ceiling on specimen movement — it has not been. Recovered samples show our scaffolding alloy laminated into the integument; thermoregulation is no longer biological. Civilian convoy is now north of the treeline and moving. Every ridge we hold buys time for the column to dig in at the next ridge. The line is not advancing. The line is buying hours.",

  // Desert opener — name the adaptation loop. Why every win is
  // making the next wave harder. Player learns they're training the herd.
  11: "SITREP. Northern fall-back terminated at the mountains. Convoy diverted south through the high-desert corridor. Specimen morphology on the leading edge no longer matches the catalogue — shielded integument is now the dominant phenotype. Internal review concludes the revival hardware never stopped iterating: every kill seeds the next wave, because the conditioning network selects against the round that killed the last one. We have been training the herd. The corridor must hold until the column clears.",

  // Wasteland opener — civilisation is gone. Acknowledge it openly.
  // First time the Protocol is named in a SITREP, not just a briefing.
  16: "SITREP. Coastal cordon is gone. So is the coast. The remaining civilian population is dispersed across uncatalogued terrain; comms reach roughly forty percent of them on a good day. The herd is now coordinating across our own comm net — directional bands, repeater nodes, the protocol stack we built for them inside the reserve. We could shut the net down. We have not, because the operator outposts need it more than the herd does. The Extinction Protocol is the only standing directive. Tactical-yield ordnance authorised from this point.",

  // Lava opener — terraforming begins. Why the ground is changing.
  21: "SITREP. Continental interior is no longer recognisable on satellite. Geothermal venting follows herd migration corridors precisely. Atmospheric chemistry is drifting where the densest grazing pressure has been longest. Surveyors are no longer describing this as damage to the landscape. The herd is changing the landscape into a state it metabolises better; revival hardware in apex specimens appears capable of catalysing the change. Every emplacement that still holds is one square kilometre that does not become the new biome.",

  // Alien opener — the planet is functionally lost. Final framing.
  26: "SITREP. The new biome covers approximately one hundred and thirty thousand square kilometres and is still spreading. Ground biology does not match anything in the planetary catalogue. Atmospheric readings inside the zone are off the reference scale. Command considers the planet lost — there is no plan past this directive. Operator role: locate and engage the apex specimen at the original revival site. The Extinction Protocol has not been countermanded because there is nobody left with the authority to countermand it.",
};
