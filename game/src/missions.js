// Velora Bay — missions (vanilla JS).
// 3 acts, 8 fixed missions. Each mission is a stage machine: stages have
// an objective, a target point, a condition, and a reward. The game loop
// calls updateMissions(G, dt) and the mission reads live game state
// (player pos, enemies left, vehicle, gold bars) through G.
export const MISSIONS = [
  {
    id: 1, name: 'Ashes', act: 1, payout: 300, rep: 40,
    intro: 'Hale\u2019s men torched the workshop. Save the tool crate before it\u2019s gone.',
    unlock: 'NEXT: Pistol',
    stages: [
      { text: 'Grab the tool crate by the yard gate', target: { x: -168, z: -88 }, radius: 4, dialogue: ['TOMMY', 'Eli! The fire\u2019s spreading — grab the crate by the gate!'] },
      { text: 'Escape the burning workshop', target: { x: -150, z: -82 }, radius: 5, dialogue: ['ELI', 'That\u2019s everything Dad built. Hale will pay for this.'] },
    ],
  },
  {
    id: 2, name: 'Reclaim the Pier', act: 1, payout: 500, rep: 60,
    intro: 'Take Pier 9 back from Hale\u2019s men. Tommy has your back.',
    unlock: 'NEXT: Garage',
    stages: [
      { text: 'Reach Pier 9', target: { x: -185, z: 95 }, radius: 6, dialogue: ['ROSA', 'Hale\u2019s men hold the pier. I counted three of them — be careful.'] },
      { text: 'Run Hale\u2019s men off Pier 9', target: { x: -185, z: 95 }, radius: 10, need: 'clear', dialogue: ['TOMMY', 'That\u2019s how you reclaim a pier!'] },
    ],
  },
  {
    id: 3, name: 'Timber Run', act: 2, payout: 800, rep: 80,
    intro: 'Smuggle the lumber past the checkpoint — don\u2019t stop.',
    unlock: 'NEXT: Gold paint',
    stages: [
      { text: 'Get in the truck at the Lumber Yard', target: { x: -60, z: 95 }, radius: 5, dialogue: ['DINA', 'Truck\u2019s loaded. I\u2019ll drive point — you follow the route.'] },
      { text: 'Smuggle the lumber past the checkpoint', target: { x: 150, z: 128 }, radius: 8, need: 'drive', dialogue: ['DINA', 'Checkpoint ahead — steady now. Don\u2019t stop for anyone.'] },
    ],
  },
  {
    id: 4, name: 'Crane Down', act: 2, payout: 1200, rep: 120,
    intro: 'Cut the crane cable — bring it down on Hale\u2019s site.',
    unlock: 'NEXT: Rifle',
    stages: [
      { text: 'Reach the construction site', target: { x: 20, z: 55 }, radius: 6, dialogue: ['ROSA', 'The crane feeds the whole site. Cut the cable and it all stops.'] },
      { text: 'Cut the crane cable', target: { x: 20, z: 62 }, radius: 4, need: 'interact', dialogue: ['ELI', 'Timber!'] },
    ],
  },
  {
    id: 5, name: 'Paper Trail', act: 2, payout: 1500, rep: 140,
    intro: 'Steal the bribe ledger from Hale Tower. Stay quiet.',
    unlock: 'NEXT: Safehouse',
    stages: [
      { text: 'Steal the bribe ledger (stay quiet)', target: { x: 120, z: -40 }, radius: 5, need: 'interact', dialogue: ['ROSA', 'The ledger is in Hale\u2019s office. That book ends Vance.'] },
      { text: 'Escape Hale Tower', target: { x: 150, z: -82 }, radius: 6, dialogue: ['ELI', 'Got it. The whole city is about to know.'] },
    ],
  },
  {
    id: 6, name: 'Rally the Bay', act: 3, payout: 2500, rep: 200,
    intro: 'Win the streets — rally 3 districts before sundown.',
    unlock: 'NEXT: Crew — Dina',
    stages: [
      { text: 'Rally Portside (0/3)', target: { x: -150, z: -20 }, radius: 8, need: 'rally', dialogue: ['NADIA', 'Three districts before sundown. Start at Portside — they know you.'] },
      { text: 'Rally Velora Center (1/3)', target: { x: 0, z: -20 }, radius: 8, need: 'rally', dialogue: ['BIG MARV', 'The union\u2019s with you, Eli. Center\u2019s next.'] },
      { text: 'Rally Velora Beach (2/3)', target: { x: 0, z: 128 }, radius: 8, need: 'rally', dialogue: ['OLD MAN KOFI', 'The fishermen are listening, son. Finish it on the beach.'] },
    ],
  },
  {
    id: 7, name: 'Debate Night', act: 3, payout: 4000, rep: 300,
    intro: 'Win the debate — then lose the cops on the coastal highway.',
    unlock: 'NEXT: Armored truck',
    stages: [
      { text: 'Reach the Debate Hall', target: { x: 20, z: -45 }, radius: 5, dialogue: ['NADIA', 'Hale\u2019s men are coming down the steps — hold them off, Eli!'] },
      { text: 'Lose the cops — drive Beach Blvd east', target: { x: 170, z: 128 }, radius: 10, need: 'chase', dialogue: ['TOMMY', 'They\u2019re on us! Stay on Beach Blvd — lose them at the marina!'] },
      { text: 'Reach the Marina Safehouse', target: { x: 170, z: 14 }, radius: 6, dialogue: ['DINA', 'You did it. The whole city watched that debate.'] },
    ],
  },
  {
    id: 8, name: 'Election Night', act: 3, payout: 8888, rep: 500,
    intro: 'Guard the ballot boxes — Portside to Center to Marina.',
    unlock: 'NEXT: City Hall',
    stages: [
      { text: 'Guard the ballot box — Portside', target: { x: -150, z: -20 }, radius: 8, need: 'defend', dialogue: ['TOMMY', 'Ballot box one. Nobody touches it.'] },
      { text: 'Guard the ballot box — Center', target: { x: 0, z: -20 }, radius: 8, need: 'defend', dialogue: ['NADIA', 'Center\u2019s box is next. The coalition is with you.'] },
      { text: 'Guard the ballot box — Marina', target: { x: 150, z: -20 }, radius: 8, need: 'defend', dialogue: ['BIG MARV', 'Last box. Then you\u2019re mayor, Eli.'] },
    ],
  },
];

export const CREW = [
  { name: 'Tommy Reyes', role: 'COMBAT · BACKUP DRIVER', initial: 'T', missions: [2, 8] },
  { name: 'Rosa Delgado', role: 'INTELLIGENCE · SCOUTING', initial: 'R', missions: [4, 5] },
  { name: 'Nadia Kline', role: 'CAMPAIGN MANAGER', initial: 'N', missions: [6, 7] },
  { name: 'Big Marv Okafor', role: 'UNION LEADER · MUSCLE', initial: 'B', missions: [6, 8] },
  { name: 'Dina Santos', role: 'ESCAPE DRIVER', initial: 'D', missions: [3, 7] },
  { name: 'Old Man Kofi', role: 'FISHING · HARBOR EXPERT', initial: 'O', missions: [2, 8] },
];

export const SKILLS = [
  { id: 'driving', name: 'DRIVING', desc: '+top speed, +handling' },
  { id: 'stamina', name: 'STAMINA', desc: '+run speed, +jump' },
  { id: 'influence', name: 'INFLUENCE', desc: '+REP per job' },
  { id: 'shooting', name: 'SHOOTING', desc: '+damage, +accuracy' },
  { id: 'stealth', name: 'STEALTH', desc: 'slower detection' },
  { id: 'street', name: 'STREET SENSE', desc: '+gold bar sense' },
];

// Mission runtime state lives on G.mission = { index, stage, timer, ... }
export function startMission(G, i) {
  const m = MISSIONS[i];
  G.mission = { index: i, stage: 0, timer: 0, startedAt: G.time, rally: 0, defend: 0 };
  G.currentMission = i;
  G.dialogue = { name: m.stages[0].dialogue[0], text: m.stages[0].dialogue[1], until: G.time + 5 };
  G.toast(m.name + ' — ' + m.intro);
  G.save();
}

export function completeMission(G) {
  const m = MISSIONS[G.mission.index];
  G.money += m.payout;
  G.rep += m.rep;
  G.completed.push(m.id);
  G.rating[m.id] = G.mission.timer < 180 ? 'gold' : G.mission.timer < 300 ? 'silver' : 'bronze';
  G.toast('MISSION COMPLETE: ' + m.name + ' +$' + m.payout.toLocaleString() + '  +' + m.rep + ' REP');
  G.sfx('complete');
  G.mission = null;
  G.currentMission = -1;
  // unlock next mission
  if (G.completed.length < MISSIONS.length) startMission(G, G.completed.length);
  else G.win = true;
  G.save();
}

// Advance the active mission. G provides: player {x,z,inCar}, enemiesLeft,
// interactPressed, rallyCount, defendCount, chaseDone, time.
export function updateMissions(G, dt) {
  if (!G.mission) return;
  const m = MISSIONS[G.mission.index];
  const st = m.stages[G.mission.stage];
  G.mission.timer += dt;
  const px = G.player.x, pz = G.player.z;
  const d = Math.hypot(px - st.target.x, pz - st.target.z);
  G.objective = { text: st.text, dist: Math.round(d), stage: G.mission.stage + 1, total: m.stages.length, target: st.target };
  let done = false;
  if (st.need === 'clear') done = G.enemiesLeft <= 0 && d < st.radius * 1.5;
  else if (st.need === 'interact') done = G.interactPressed && d < st.radius;
  else if (st.need === 'drive') done = G.player.inCar && d < st.radius;
  else if (st.need === 'rally') done = d < st.radius && G.rallyPressed;
  else if (st.need === 'defend') done = G.enemiesLeft <= 0 && d < st.radius;
  else if (st.need === 'chase') done = G.chaseDone || (G.player.inCar && d < st.radius && G.police.wanted >= 2);
  else done = d < st.radius;
  if (done) {
    G.mission.stage++;
    G.interactPressed = false; G.rallyPressed = false;
    if (G.mission.stage >= m.stages.length) { completeMission(G); return; }
    const ns = m.stages[G.mission.stage];
    G.dialogue = { name: ns.dialogue[0], text: ns.dialogue[1], until: G.time + 5 };
    G.sfx('stage');
  }
}
