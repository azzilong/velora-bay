// VELORA BAY — PLAYER CONTROLLER
// Third-person on-foot control: WASD relative to camera, run, jump,
// collision against building AABBs (circle vs rect, axis-separated),
// melee + hitscan combat, weapon switching, vehicle entry/exit,
// carjacking. The camera is owned by main.js; this module reads
// cameraYaw from the game object and writes the player's facing.
import * as THREE from '../vendor/three.module.min.js';
import { makeEli, animateWalk } from './characters.js';

const WORLD = { minX: -198, maxX: 198, minZ: -148, maxZ: 148 };

function collideCircle(pos, r, colliders) {
  // returns corrected {x, z} after pushing the circle out of every AABB
  let { x, z } = pos;
  for (const c of colliders) {
    const cx = Math.max(c.x0, Math.min(x, c.x1));
    const cz = Math.max(c.z0, Math.min(z, c.z1));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // centre inside the box: push out along the smallest penetration
        const pl = x - c.x0 + r, pr = c.x1 - x + r, pt = z - c.z0 + r, pb = c.z1 - z + r;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.x0 - r; else if (m === pr) x = c.x1 + r;
        else if (m === pt) z = c.z0 - r; else z = c.z1 + r;
      }
    }
  }
  return { x, z };
}

export function createPlayer(scene, world, G) {
  const fig = makeEli();
  fig.group.position.set(G.spawn.x, 0, G.spawn.z);
  fig.group.rotation.y = G.spawn.rotY;
  scene.add(fig.group);

  const P = {
    fig,
    pos: new THREE.Vector3(G.spawn.x, 0, G.spawn.z),
    vel: new THREE.Vector3(),
    yaw: G.spawn.rotY,          // facing (radians, 0 = +z)
    camYaw: G.spawn.rotY,       // camera orbit yaw
    camPitch: 0.32,
    camDist: 7.5,
    walkPhase: 0,
    speed: 0,
    vy: 0,
    onGround: true,
    vehicle: null,              // driving wrapper or null
    weapon: 'hammer',
    ammo: { pistol: 0, rifle: 0 },
    reserve: { pistol: 48, rifle: 90 },
    reloading: 0,
    swing: 0,                   // melee swing timer
    shootCd: 0,
    hp: 100,
    armor: 0,
    hurtCd: 0,
    dead: false,
  };

  function setWeapon(w) {
    if (w === 'pistol' && !G.weapons.pistol.unlocked) return false;
    if (w === 'rifle' && !G.weapons.rifle.unlocked) return false;
    P.weapon = w;
    fig.setWeapon(w === 'fists' ? 'fists' : w);
    G.hud.refreshWeapons();
    return true;
  }

  function damage(amount, fromX, fromZ) {
    if (P.hurtCd > 0 || P.dead) return;
    P.hurtCd = 0.5;
    let rest = amount;
    if (P.armor > 0) { const absorbed = Math.min(P.armor, rest); P.armor -= absorbed; rest -= absorbed; }
    P.hp -= rest;
    G.hud.flashDamage();
    if (P.hp <= 0) {
      P.hp = 0; P.dead = true;
      G.onPlayerDown();
    }
  }

  function update(dt, input, enemies) {
    if (P.dead) return;
    P.hurtCd = Math.max(0, P.hurtCd - dt);
    P.swing = Math.max(0, P.swing - dt);
    P.shootCd = Math.max(0, P.shootCd - dt);
    P.reloading = Math.max(0, P.reloading - dt);

    // camera orbit from mouse
    P.camYaw -= input.mouseDX * 0.0032;
    P.camPitch = Math.max(0.08, Math.min(0.9, P.camPitch + input.mouseDY * 0.0022));
    input.mouseDX = 0; input.mouseDY = 0;

    // movement (camera-relative)
    const fwd = new THREE.Vector3(-Math.sin(P.camYaw), 0, -Math.cos(P.camYaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    let mx = 0, mz = 0;
    if (input.keys['KeyW']) { mx += fwd.x; mz += fwd.z; }
    if (input.keys['KeyS']) { mx -= fwd.x; mz -= fwd.z; }
    if (input.keys['KeyA']) { mx -= right.x; mz -= right.z; }
    if (input.keys['KeyD']) { mx += right.x; mz += right.z; }
    const moving = mx !== 0 || mz !== 0;
    const run = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
    const targetSpeed = moving ? (run ? 7.6 : 4.2) : 0;
    P.speed += (targetSpeed - P.speed) * Math.min(1, dt * 10);
    if (moving) {
      const len = Math.hypot(mx, mz);
      const nx = mx / len, nz = mz / len;
      const targetYaw = Math.atan2(nx, nz);
      let dy = targetYaw - P.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      P.yaw += dy * Math.min(1, dt * 12);
      const step = P.speed * dt;
      const nx2 = P.pos.x + nx * step;
      const nz2 = P.pos.z + nz * step;
      const c1 = collideCircle({ x: nx2, z: P.pos.z }, 0.5, world.colliders);
      const c2 = collideCircle({ x: c1.x, z: nz2 }, 0.5, world.colliders);
      P.pos.x = Math.max(WORLD.minX, Math.min(WORLD.maxX, c2.x));
      P.pos.z = Math.max(WORLD.minZ, Math.min(WORLD.maxZ, c2.z));
      P.walkPhase += dt * P.speed * 1.9;
      animateWalk(fig, P.walkPhase, Math.min(1, P.speed / 5));
      fig.group.position.set(P.pos.x, P.pos.y, P.pos.z);
      fig.group.rotation.y = P.yaw;
    } else {
      fig.legL.rotation.x *= 0.8; fig.legR.rotation.x *= 0.8;
      fig.armL.pivot.rotation.x *= 0.8; fig.armR.pivot.rotation.x *= 0.8;
      fig.group.position.set(P.pos.x, P.pos.y, P.pos.z);
    }
    // jump / gravity
    if (input.keys['Space'] && P.onGround) { P.vy = 6.2; P.onGround = false; G.stats.jumps++; }
    if (!P.onGround) {
      P.vy -= 18 * dt;
      P.pos.y += P.vy * dt;
      if (P.pos.y <= 0) { P.pos.y = 0; P.vy = 0; P.onGround = true; }
      fig.group.position.y = P.pos.y;
    }
    // swing animation
    if (P.swing > 0) {
      const k = 1 - P.swing / 0.32;
      fig.armR.pivot.rotation.x = -1.9 * Math.sin(k * Math.PI);
    } else if (!moving) {
      fig.armR.pivot.rotation.x *= 0.85;
    }
    // attack
    if (input.attack) {
      input.attack = false;
      attack(enemies);
    }
    if (input.reload && P.reloading <= 0) {
      input.reload = false;
      reload();
    }
    // weapon keys
    if (input.weaponKey) {
      const w = input.weaponKey; input.weaponKey = null;
      setWeapon(w);
    }
  }

  function attack(enemies) {
    if (P.swing > 0 || P.shootCd > 0 || P.reloading > 0) return;
    if (P.weapon === 'fists' || P.weapon === 'hammer') {
      P.swing = 0.32;
      G.audio.swing();
      const dmg = P.weapon === 'fists' ? 22 : 35;
      const range = P.weapon === 'fists' ? 2.1 : 2.4;
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > range) continue;
        const ang = Math.atan2(dx, dz);
        let da = ang - P.yaw;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) > 1.2) continue;
        e.hp -= dmg;
        e.flash = 0.15;
        G.audio.hit();
        G.hud.damageNumber(e.pos, `-${dmg}`);
        if (e.hp <= 0) G.onEnemyDown(e);
        else { e.pos.x += (dx / d) * 0.8; e.pos.z += (dz / d) * 0.8; }
      }
    } else {
      // hitscan shot
      if (P.ammo[P.weapon] <= 0) { G.audio.click(); reload(); return; }
      P.ammo[P.weapon]--;
      P.shootCd = P.weapon === 'pistol' ? 0.28 : 0.12;
      G.audio.shot(P.weapon);
      G.hud.muzzle();
      const dir = new THREE.Vector3(-Math.sin(P.camYaw), 0.02, -Math.cos(P.camYaw));
      let best = null, bestD = 60;
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 60) continue;
        const dot = (dx * dir.x + dz * dir.z) / (d || 1);
        if (dot < 0.94) continue;
        if (d < bestD) { best = e; bestD = d; }
      }
      if (best) {
        const dmg = P.weapon === 'pistol' ? 34 : 55;
        best.hp -= dmg;
        best.flash = 0.15;
        G.audio.hit();
        G.hud.damageNumber(best.pos, `-${dmg}`);
        if (best.hp <= 0) G.onEnemyDown(best);
      }
      G.hud.refreshWeapons();
    }
  }

  function reload() {
    if (P.weapon !== 'pistol' && P.weapon !== 'rifle') return;
    const mag = P.weapon === 'pistol' ? 12 : 30;
    if (P.ammo[P.weapon] >= mag || P.reserve[P.weapon] <= 0) return;
    P.reloading = 1.1;
    G.audio.reload();
    setTimeout(() => {
      const need = mag - P.ammo[P.weapon];
      const take = Math.min(need, P.reserve[P.weapon]);
      P.ammo[P.weapon] += take;
      P.reserve[P.weapon] -= take;
      G.hud.refreshWeapons();
    }, 1000);
  }

  return { P, setWeapon, damage, update, collideCircle };
}
