// Per-level briefing copy shown in the world-map hover tooltip once an
// outpost is unlocked. The arc tracks two things in step:
//   1. The fall-back across biomes (forest → snow → desert → wasteland
//      → lava → alien), each band a zone the line could not hold.
//   2. The escalating roster — when a new mechanic debuts in-game
//      (shielded specimens at L11, healing at L13, regen at L14, the
//      first elite at L15, three-lane coordination at L19, the
//      matriarch's appearances at L5 / L10 / L15 / L30) the field
//      report acknowledges it.
// Voice is the on-station operator: terse, after-action, sleep-deprived,
// no flourish. Lines should fit one tooltip without scrolling — keep
// them under ~140 characters.
export const LEVEL_BRIEFING: Record<number, string> = {
  // Forest — first contact. The world is still recognisable.
  1: "Wildlife counts are off by four hundred percent since last quarter. Holding the perimeter while command decides what we are looking at.",
  2: "They flank now. The biologists will not put it on the record but the pack behaviour is too clean to be instinct.",
  3: "Lost two forward outposts overnight. Larger silhouettes on the canyon thermals — bigger than anything in the field guide.",
  4: "Containment line failed at the marsh. We are no longer holding ground. We are buying time.",
  5: "Smoke north of the ridge. Something the size of a building moves through it and is not afraid of fire. Designate her Matriarch.",

  // Snow — first fall-back. Climate is wrong; armour starts showing.
  6: "We were forced north. The cold should slow them. It has not.",
  7: "Tracks across the snow are wrong. Too heavy. Too many. Too organised.",
  8: "Two corridors out of the pass and both compromised. The herd is splitting itself to flank us.",
  9: "Specimens recovered from the tar are decades old. Whatever is hunting us now did not exist then.",
  10: "Same genus, denser bone, larger frame. They are getting bigger between encounters. Matriarch sighted again — she has brought reinforcements.",

  // Desert — the world drying out. Shields, healing, regen, first elite.
  11: "Field report: integument on incoming specimens is deflecting kinetic rounds at range. We are calling it a shield until biology gives us a better word.",
  12: "Confirmed: the larger specimens now arrive plated. Both entries breached. The fall-back continues.",
  13: "The smaller ones are healing the larger ones in the field. We do not have a word for the kind of animal that does this.",
  14: "Wounds we open close again before the next volley. They are regenerating under fire. End of report.",
  15: "Dossier 14-A: a single specimen leads them now. She does not run. The pack does not run when she is present. The Matriarch returns.",

  // Wasteland — civilisation gone. Multi-path coordination begins.
  16: "We have been pushed past the last city. There is no city. There has not been a city for some time.",
  17: "Operator: count the silhouettes on the ridge before you tell me how many we are killing. The gap between those numbers is the war.",
  18: "We are calling the fortified ones reefs. They do not break. They only stop.",
  19: "Three approach vectors at once. They have stopped pretending they are not coordinating.",
  20: "All civilian comms dark for nine days. The Protocol is now the only standing directive.",

  // Lava — geological collapse. Titans, fierce, elites at scale.
  21: "The continent is venting. They are walking through it. We do not know if they feel it.",
  22: "Forward observers report the larger specimens are now actively hunting us. We were not the prey before.",
  23: "Ground readings inconsistent with biology. Something the size of a building was here this morning. It is not here now.",
  24: "Each wave is heavier than the last by an order we cannot graph. Recommended evacuation. Evacuation denied.",
  25: "Last ridge before the breach. If this falls there is no further ridge.",

  // Alien — no longer this world.
  26: "The substrate has changed. Our instruments do not recognise it. The specimens are at home in it.",
  27: "They no longer bleed the right colour. We are still required to file casualty paperwork on their behalf.",
  28: "Counts are no longer meaningful. Hold the line. Hold the line. Hold the line.",
  29: "Quiet for nine minutes. We are not optimistic about what comes next.",
  30: "The Matriarch is here. The Protocol was always for her. Engage.",
};
