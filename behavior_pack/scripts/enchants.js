import { world, system } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { discs, recoverDisc } from "./disc.js";

const ENT = CONFIG.ids.entity;
const DP = CONFIG.dp;
const LIST = CONFIG.enchants.list;
const EMPTY = Object.freeze({});

export function parseEnchants(raw) {
  if (!raw || raw === "{}") return EMPTY;
  if (typeof raw === "object") return raw;
  try {
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : EMPTY;
  } catch {
    return EMPTY;
  }
}

function def(id) {
  return LIST[id];
}

export function stat(ench, key) {
  let n = 0;
  for (const [id, lv] of Object.entries(ench)) {
    const v = def(id)?.perLevel?.[key];
    if (typeof v === "number") n += v * lv;
  }
  return n;
}

export function extraBounces(ench) {
  return stat(ench, "extraBounces");
}

export function restBonus(ench) {
  return stat(ench, "restitution");
}

export function powerBonus(ench) {
  return stat(ench, "power");
}

export function bonusDamage(ench) {
  return stat(ench, "damage");
}

export function armorPenStat(ench) {
  return stat(ench, "armorPen");
}

export function hasRetorno(ench) {
  return (ench.retorno ?? 0) > 0;
}

export function canApply(current, id, level) {
  const d = def(id);
  if (!d) return { ok: false, reason: "Desconocido" };
  if (level < 1 || level > d.max) return { ok: false, reason: "Nivel inválido" };

  const have = current[id] ?? 0;
  const keys = Object.keys(current);
  if (have === 0 && keys.length >= CONFIG.enchants.maxOnDisc) {
    return { ok: false, reason: "Máximo de encants" };
  }

  if (d.unique) {
    let uniques = 0;
    for (const k of keys) if (k !== id && def(k)?.unique) uniques++;
    if (uniques >= CONFIG.enchants.uniqueMax) {
      return { ok: false, reason: "Ya hay un único" };
    }
  }

  for (const ex of d.exclude) {
    if (current[ex]) return { ok: false, reason: `Incompatible con ${def(ex)?.name ?? ex}` };
  }
  for (const k of keys) {
    if (k !== id && def(k)?.exclude?.includes(id)) {
      return { ok: false, reason: `Incompatible con ${def(k).name}` };
    }
  }
  return { ok: true, reason: "" };
}

export function applyHitEnchants(target, attacker, ench) {
  if (!target?.isValid) return;

  const ven = ench.veneno ?? 0;
  if (ven > 0) {
    const pl = LIST.veneno.perLevel;
    try {
      target.addEffect("minecraft:poison", Math.floor(pl.seconds * 20 * ven), {
        amplifier: (pl.amp ?? 0) + ven - 1,
        showParticles: false,
      });
    } catch {
      /* efecto no aplica */
    }
  }

  const mar = ench.marchito ?? 0;
  if (mar > 0) {
    const pl = LIST.marchito.perLevel;
    try {
      target.addEffect("minecraft:wither", Math.floor(pl.seconds * 20 * mar), {
        amplifier: (pl.amp ?? 0) + mar - 1,
        showParticles: false,
      });
    } catch {
      /* efecto no aplica */
    }
  }

  const fire = ench.llama ?? 0;
  if (fire > 0) {
    try {
      target.setOnFire(LIST.llama.perLevel.fireSeconds * fire, true);
    } catch {
      /* inmune al fuego */
    }
  }

  const suc = ench.succion ?? 0;
  if (suc > 0 && attacker?.isValid) {
    const heal = LIST.succion.perLevel.heal * suc;
    try {
      const h = attacker.getComponent("minecraft:health");
      if (h) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + heal));
    } catch {
      /* sin vida */
    }
  }
}

world.afterEvents.entitySpawn.subscribe((ev) => {
  const e = ev.entity;
  if (e.typeId !== ENT) return;
  const info = discs.get(e.id);
  if (!info) return;
  let ench;
  try {
    ench = parseEnchants(e.getDynamicProperty(DP.enchants));
  } catch {
    return;
  }
  const bonus = powerBonus(ench);
  if (bonus <= 0) return;
  const proj = e.getComponent("minecraft:projectile");
  const owner = proj?.owner;
  if (!owner?.isValid) return;
  let dir;
  try {
    dir = owner.getViewDirection();
  } catch {
    return;
  }
  const speed = CONFIG.throw.power + bonus;
  info.speed = speed;
  system.run(() => {
    if (!e.isValid) return;
    try {
      proj.shoot({ x: dir.x * speed, y: dir.y * speed, z: dir.z * speed });
    } catch {
      /* ya disparado */
    }
  });
});

export function tickEnchants(now) {
  const range = CONFIG.limits.pickupRange;
  const range2 = range * range;
  for (const [id, info] of discs) {
    const e = world.getEntity(id);
    if (!e?.isValid) continue;
    let ench;
    try {
      ench = parseEnchants(e.getDynamicProperty(DP.enchants));
    } catch {
      continue;
    }
    const rs = stat(ench, "returnSpeed");
    if (rs <= 0) continue;
    const late = now - info.born > CONFIG.limits.ttlTicks - 40;
    if (!info.returning && info.speed !== 0 && !late) continue;
    info.returning = true;
    try {
      e.setDynamicProperty(DP.returning, true);
    } catch {
      /* DP */
    }
    const owner = world.getEntity(info.owner);
    if (!owner?.isValid) continue;
    const p = e.location;
    const o = owner.location;
    const dx = o.x - p.x;
    const dy = o.y + 1.1 - p.y;
    const dz = o.z - p.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 <= range2) {
      recoverDisc(owner, e);
      continue;
    }
    const d = Math.sqrt(d2);
    try {
      e.getComponent("minecraft:projectile")?.shoot({
        x: (dx / d) * rs,
        y: (dy / d) * rs,
        z: (dz / d) * rs,
      });
    } catch {
      /* sin shoot */
    }
  }
}
