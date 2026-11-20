import { world, EquipmentSlot } from "@minecraft/server";
import { CONFIG } from "./config.js";

const PLAYER = "minecraft:player";

const ARMOR_PTS = {
  "minecraft:leather_helmet": 1,
  "minecraft:leather_chestplate": 3,
  "minecraft:leather_leggings": 2,
  "minecraft:leather_boots": 1,
  "minecraft:golden_helmet": 2,
  "minecraft:golden_chestplate": 5,
  "minecraft:golden_leggings": 3,
  "minecraft:golden_boots": 1,
  "minecraft:chainmail_helmet": 2,
  "minecraft:chainmail_chestplate": 5,
  "minecraft:chainmail_leggings": 4,
  "minecraft:chainmail_boots": 1,
  "minecraft:iron_helmet": 2,
  "minecraft:iron_chestplate": 6,
  "minecraft:iron_leggings": 5,
  "minecraft:iron_boots": 2,
  "minecraft:diamond_helmet": 3,
  "minecraft:diamond_chestplate": 8,
  "minecraft:diamond_leggings": 6,
  "minecraft:diamond_boots": 3,
  "minecraft:netherite_helmet": 3,
  "minecraft:netherite_chestplate": 8,
  "minecraft:netherite_leggings": 6,
  "minecraft:netherite_boots": 3,
  "minecraft:turtle_helmet": 2,
  "minecraft:copper_helmet": 2,
  "minecraft:copper_chestplate": 4,
  "minecraft:copper_leggings": 3,
  "minecraft:copper_boots": 1,
};

const SLOTS = [
  EquipmentSlot.Head,
  EquipmentSlot.Chest,
  EquipmentSlot.Legs,
  EquipmentSlot.Feet,
];

/** @type {Map<string, number>} */
const lastThrow = new Map();
/** @type {Map<string, { count: number, last: number }>} */
const combos = new Map();

function bar(player, msg) {
  if (CONFIG.pvp.actionbar) {
    try {
      player.onScreenDisplay.setActionBar(msg);
    } catch {
      /* no UI */
    }
  }
}

export function throwOnCooldown(player, now) {
  const wait = Math.max(CONFIG.pvp.antiSpamTicks, CONFIG.pvp.cooldownTicks);
  const left = wait - (now - (lastThrow.get(player.id) ?? 0));
  if (left > 0) {
    bar(player, `Cooldown ${left}t`);
    return true;
  }
  return false;
}

export function markThrow(player, now) {
  lastThrow.set(player.id, now);
}

function teamOf(entity) {
  if (!CONFIG.pvp.teams.useScoreboard || !entity) return undefined;
  const obj = world.scoreboard.getObjective(CONFIG.pvp.teams.objective);
  if (!obj) return undefined;
  try {
    return obj.getScore(entity);
  } catch {
    return undefined;
  }
}

export function isFriendly(a, b) {
  if (CONFIG.pvp.friendlyFire) return false;
  if (!a || !b || a.id === b.id) return false;
  const ta = teamOf(a);
  const tb = teamOf(b);
  if (ta === undefined || tb === undefined) return false;
  return ta === tb;
}

export function canDamage(attacker, target) {
  if (!target?.isValid) return false;
  if (target.typeId !== PLAYER) return true;
  if (!CONFIG.pvp.enabled) return false;
  if (attacker?.typeId === PLAYER && isFriendly(attacker, target)) return false;
  return true;
}

function protLevel(item) {
  const enc = item.getComponent("minecraft:enchantable");
  if (!enc) return 0;
  try {
    const e =
      enc.getEnchantment("protection") ??
      enc.getEnchantment("minecraft:protection");
    return e?.level ?? 0;
  } catch {
    return 0;
  }
}

export function armorPoints(entity) {
  const eq = entity.getComponent("minecraft:equippable");
  if (!eq) return 0;
  let pts = 0;
  for (const slot of SLOTS) {
    let it;
    try {
      it = eq.getEquipment(slot);
    } catch {
      continue;
    }
    if (!it) continue;
    pts += ARMOR_PTS[it.typeId] ?? 0;
    pts += protLevel(it) * 0.5;
  }
  return pts;
}

export function applyArmor(target, raw, pen) {
  const p = Math.min(0.9, Math.max(0, pen));
  const pts = armorPoints(target) * (1 - p);
  const factor = 1 - Math.min(20, pts) / 25;
  return Math.max(0.2, raw * factor);
}

export function comboMul(pid, now) {
  const c = combos.get(pid);
  if (!c || now - c.last > CONFIG.pvp.comboWindowTicks) return 1;
  return 1 + Math.min(CONFIG.pvp.comboCap, c.count * CONFIG.pvp.comboBonusPer);
}

export function noteCombo(pid, now) {
  const c = combos.get(pid);
  if (!c || now - c.last > CONFIG.pvp.comboWindowTicks) {
    combos.set(pid, { count: 1, last: now });
    return 1;
  }
  c.count++;
  c.last = now;
  return comboMul(pid, now);
}

export function clippedHit(dim, location, hitVector) {
  if (!CONFIG.antiExploit.blockClipCheck) return false;
  const b = {
    x: location.x - hitVector.x * 0.45,
    y: location.y - hitVector.y * 0.45,
    z: location.z - hitVector.z * 0.45,
  };
  try {
    const block = dim.getBlock(b);
    if (!block) return false;
    if (block.isAir || block.isLiquid) return false;
    if (typeof block.isSolid === "boolean") return block.isSolid;
    return true;
  } catch {
    return false;
  }
}

export function tickPvp(now) {
  const keep = CONFIG.pvp.comboWindowTicks * 4;
  if (combos.size > 24) {
    for (const [k, c] of combos) if (now - c.last > keep) combos.delete(k);
  }
  if (lastThrow.size > 40) {
    const w = Math.max(CONFIG.pvp.antiSpamTicks, CONFIG.pvp.cooldownTicks) * 8;
    for (const [k, t] of lastThrow) if (now - t > w) lastThrow.delete(k);
  }
}
