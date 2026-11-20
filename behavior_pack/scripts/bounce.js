import { world, system, Direction, EntityDamageCause } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { discs } from "./disc.js";
import {
  parseEnchants,
  extraBounces,
  restBonus,
  bonusDamage,
  armorPenStat,
  applyHitEnchants,
  hasRetorno,
} from "./enchants.js";
import {
  canDamage,
  applyArmor,
  noteCombo,
  clippedHit,
} from "./pvp.js";

const ENT = CONFIG.ids.entity;
const DP = CONFIG.dp;

const NORMAL = {
  [Direction.Up]: { x: 0, y: 1, z: 0 },
  [Direction.Down]: { x: 0, y: -1, z: 0 },
  [Direction.North]: { x: 0, y: 0, z: -1 },
  [Direction.South]: { x: 0, y: 0, z: 1 },
  [Direction.West]: { x: -1, y: 0, z: 0 },
  [Direction.East]: { x: 1, y: 0, z: 0 },
};

/** @type {Map<string, number>} */
const iframes = new Map();
let fxTick = -1;
let fxParts = 0;
let fxSounds = 0;

function len(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function add(a, b, s = 1) {
  return { x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s };
}

function norm(v) {
  const l = len(v);
  if (l < 1e-6) return { x: 0, y: 1, z: 0 };
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function reflect(v, n) {
  const dot = v.x * n.x + v.y * n.y + v.z * n.z;
  return {
    x: v.x - 2 * dot * n.x,
    y: v.y - 2 * dot * n.y,
    z: v.z - 2 * dot * n.z,
  };
}

function resetFx(now) {
  if (fxTick === now) return;
  fxTick = now;
  fxParts = 0;
  fxSounds = 0;
}

function fxParticle(dim, id, loc) {
  resetFx(system.currentTick);
  if (fxParts >= CONFIG.fx.maxParticlesTick) return;
  fxParts++;
  try {
    dim.spawnParticle(id, loc);
  } catch {
    /* partícula no disponible */
  }
}

function fxSound(dim, id, loc) {
  resetFx(system.currentTick);
  if (fxSounds >= CONFIG.fx.maxSoundsTick) return;
  fxSounds++;
  try {
    dim.playSound(id, loc, { volume: 0.35, pitch: 1.15 });
  } catch {
    /* sonido no disponible */
  }
}

function faceNormal(face) {
  return NORMAL[face] ?? NORMAL[String(face)];
}

function passable(block) {
  if (!block) return true;
  try {
    return block.isAir || block.isLiquid;
  } catch {
    return true;
  }
}

function nudgeOut(dim, loc, n) {
  const step = CONFIG.bounce.faceNudge;
  let p = add(loc, n, step);
  if (!CONFIG.antiExploit.blockClipCheck) return p;
  const max = CONFIG.antiExploit.clipMaxSteps;
  for (let i = 0; i < max; i++) {
    let block;
    try {
      block = dim.getBlock(p);
    } catch {
      return p;
    }
    if (passable(block)) return p;
    p = add(p, n, step);
  }
  return p;
}

function captureSpeed(proj, info) {
  let speed = info.speed ?? CONFIG.throw.power;
  try {
    const l = len(proj.getVelocity());
    if (l > 0.05) speed = l;
  } catch {
    /* velocidad ya nula al impactar */
  }
  return speed;
}

function shootAt(e, vel) {
  const proj = e.getComponent("minecraft:projectile");
  if (!proj) return false;
  proj.shoot(vel);
  return true;
}

function relaunch(old, dim, loc, vel, info) {
  if (old.isValid) {
    try {
      old.tryTeleport(loc, { keepVelocity: false });
      if (shootAt(old, vel)) return old;
    } catch {
      /* cae a respawn */
    }
  }
  const neu = dim.spawnEntity(ENT, loc);
  try {
    neu.setDynamicProperty(DP.owner, info.owner);
    neu.setDynamicProperty(DP.bounces, info.bounces);
    neu.setDynamicProperty(DP.enchants, old.isValid ? old.getDynamicProperty(DP.enchants) ?? "{}" : "{}");
    neu.setDynamicProperty(DP.thrownAt, info.born);
    neu.setDynamicProperty(DP.serial, info.serial);
    neu.setDynamicProperty(DP.returning, false);
  } catch {
    /* DP opcional */
  }
  discs.set(neu.id, info);
  try {
    shootAt(neu, vel);
  } catch {
    /* sin shoot */
  }
  if (old.isValid) {
    try {
      old.remove();
    } catch {
      /* ya inválido */
    }
  }
  return neu;
}

function enchOf(e, info) {
  try {
    return parseEnchants(e?.getDynamicProperty?.(DP.enchants) ?? info?.ench);
  } catch {
    return {};
  }
}

export function calcDamage(bounces, ench = {}) {
  const mul = Math.min(
    CONFIG.damage.bounceMulCap,
    Math.pow(CONFIG.damage.perBounceMul, bounces)
  );
  let dmg = CONFIG.damage.base * mul + bonusDamage(ench);
  dmg *= 1 + armorPenStat(ench);
  return Math.min(CONFIG.damage.maxHit, dmg);
}

function maxBounces(ench) {
  return CONFIG.bounce.max + extraBounces(ench);
}

world.afterEvents.projectileHitBlock.subscribe((ev) => {
  const proj = ev.projectile;
  if (proj.typeId !== ENT) return;
  const info = discs.get(proj.id);
  if (!info || info.returning) return;

  const now = system.currentTick;
  if (now - (info.lastBounce ?? 0) < CONFIG.bounce.cooldownTicks) return;

  let hit;
  try {
    hit = ev.getBlockHit();
  } catch {
    return;
  }
  const n = faceNormal(hit.face);
  if (!n) return;

  const speed = captureSpeed(proj, info);
  const loc = { x: ev.location.x, y: ev.location.y, z: ev.location.z };
  const hv = ev.hitVector ?? { x: -n.x, y: -n.y, z: -n.z };
  const dim = ev.dimension;
  const id = proj.id;

  system.run(() => {
    const e = world.getEntity(id);
    const live = discs.get(id);
    if (!live) return;
    live.lastBounce = system.currentTick;

    const dest = nudgeOut(dim, loc, n);
    const ench = enchOf(e, live);
    const next = live.bounces + 1;
    const nextSpeed = speed * (CONFIG.bounce.restitution + restBonus(ench));

    if (next > maxBounces(ench) || nextSpeed < CONFIG.bounce.minSpeed) {
      live.speed = 0;
      if (hasRetorno(ench)) live.returning = true;
      if (e?.isValid) {
        try {
          e.tryTeleport(dest, { keepVelocity: false });
        } catch {
          /* queda donde está */
        }
      }
      return;
    }

    live.bounces = next;
    live.speed = nextSpeed;
    const incoming = len(hv) > 0.001 ? hv : { x: -n.x, y: -n.y, z: -n.z };
    const vel = scale(norm(reflect(incoming, n)), nextSpeed);
    const body = e?.isValid ? e : proj;
    relaunch(body, dim, dest, vel, live);
    try {
      if (body.isValid) body.setDynamicProperty(DP.bounces, next);
    } catch {
      /* DP */
    }
    fxParticle(dim, CONFIG.fx.bounceParticle, dest);
    fxSound(dim, CONFIG.fx.bounceSound, dest);
  });
});

world.afterEvents.projectileHitEntity.subscribe((ev) => {
  const proj = ev.projectile;
  if (proj.typeId !== ENT) return;
  const info = discs.get(proj.id);
  if (!info || info.returning) return;

  let target;
  try {
    target = ev.getEntityHit()?.entity;
  } catch {
    return;
  }
  if (!target?.isValid || target.id === proj.id) return;
  if (target.typeId === ENT) return;

  const now = system.currentTick;
  if (target.id === info.owner && now - info.born < CONFIG.pvp.selfHitGraceTicks) {
    return;
  }

  const ikey = `${proj.id}:${target.id}`;
  if (now - (iframes.get(ikey) ?? 0) < CONFIG.pvp.hitIframesTicks) return;
  iframes.set(ikey, now);

  const attacker = ev.source?.isValid
    ? ev.source
    : world.getEntity(info.owner);
  if (!canDamage(attacker, target)) {
    if (attacker && CONFIG.pvp.actionbar) {
      try {
        attacker.onScreenDisplay.setActionBar("Aliado / PvP off");
      } catch {
        /* no UI */
      }
    }
    return;
  }

  const hvPre = ev.hitVector ?? { x: 0, y: 0, z: 1 };
  if (clippedHit(ev.dimension, ev.location, hvPre)) return;

  const ench = enchOf(proj, info);
  const pen = CONFIG.pvp.armorPenBase + armorPenStat(ench);
  let dmg = applyArmor(target, calcDamage(info.bounces, ench), pen);
  if (attacker) dmg *= noteCombo(attacker.id, now);
  const cause =
    EntityDamageCause[CONFIG.damage.cause] ?? EntityDamageCause.entityAttack;
  try {
    target.applyDamage(dmg, {
      cause,
      damagingEntity: attacker,
      damagingProjectile: proj,
    });
  } catch {
    try {
      target.applyDamage(dmg);
    } catch {
      return;
    }
  }

  const hv = ev.hitVector ?? { x: 0, y: 0, z: 1 };
  const kb = CONFIG.damage.knockback;
  if (kb > 0) {
    try {
      target.applyImpulse(scale(norm(hv), kb));
    } catch {
      /* sin knockback */
    }
  }

  applyHitEnchants(target, attacker, ench);

  const dim = ev.dimension;
  fxParticle(dim, CONFIG.fx.hitParticle, ev.location);
  fxSound(dim, CONFIG.fx.hitSound, ev.location);
  if (attacker && CONFIG.pvp.actionbar) {
    try {
      attacker.onScreenDisplay.setActionBar(
        `Rebote ${info.bounces}  Daño ${dmg.toFixed(1)}`
      );
    } catch {
      /* no player */
    }
  }

  const speed = Math.max(captureSpeed(proj, info), CONFIG.bounce.minSpeed);
  const fwd = scale(norm(hv), Math.max(CONFIG.bounce.faceNudge * 2, 0.2));
  const dest = add(ev.location, fwd);
  system.run(() => {
    const e = world.getEntity(proj.id);
    if (!e?.isValid || !discs.has(proj.id)) return;
    try {
      e.tryTeleport(dest, { keepVelocity: false });
      shootAt(e, scale(norm(hv), speed));
    } catch {
      /* se detuvo */
    }
  });
});

export function tickBounce(now) {
  if (iframes.size < 32) return;
  const keep = CONFIG.pvp.hitIframesTicks * 4;
  for (const [k, t] of iframes) {
    if (now - t > keep) iframes.delete(k);
  }
}
