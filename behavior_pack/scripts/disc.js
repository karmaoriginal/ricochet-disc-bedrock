import {
  world,
  system,
  ItemStack,
  GameMode,
  EquipmentSlot,
} from "@minecraft/server";
import { CONFIG } from "./config.js";
import { throwOnCooldown, markThrow } from "./pvp.js";

const ENT = CONFIG.ids.entity;
const DP = CONFIG.dp;
const MATS = CONFIG.materials;

// item id -> clave de material
const ITEM_TO_MAT = {};
for (const [key, m] of Object.entries(MATS)) ITEM_TO_MAT[m.item] = key;

/** @type {Map<string, any>} */
export const discs = new Map();

/** @type {Map<string, any>} */
const pending = new Map();

const ROMAN = ["", "I", "II", "III", "IV", "V"];
let sneakHandler = undefined;

export function onSneakUse(fn) {
  sneakHandler = fn;
}

export function materialByKey(key) {
  return MATS[key] ?? MATS[CONFIG.defaultMaterial];
}

export function materialOf(typeId) {
  return ITEM_TO_MAT[typeId];
}

export function isDiscItem(item) {
  return !!item && ITEM_TO_MAT[item.typeId] !== undefined;
}

function tickNow() {
  return system.currentTick;
}

function bar(player, msg) {
  if (CONFIG.pvp.actionbar) {
    try {
      player.onScreenDisplay.setActionBar(msg);
    } catch {
      /* sin UI */
    }
  }
}

// ---- aspecto ----

function presetOf(id) {
  return CONFIG.look.presets[id] ?? CONFIG.look.presets[CONFIG.look.defaultPreset];
}

export function applyLook(item, presetId) {
  const p = presetOf(presetId);
  if (!item) return p;
  try {
    item.setDynamicProperty(DP.look, presetId);
  } catch {
    /* DP */
  }
  return p;
}

// ---- lore ----

export function fillDiscItem(item, opts = {}) {
  if (!item) return item;
  const matKey = materialOf(item.typeId) ?? opts.material;
  const mat = materialByKey(matKey);
  try {
    if (opts.enchants !== undefined) {
      item.setDynamicProperty(DP.enchants, opts.enchants);
    }
    if (opts.serial !== undefined) {
      item.setDynamicProperty(DP.serial, opts.serial);
    }
    if (opts.look !== undefined) {
      item.setDynamicProperty(DP.look, opts.look);
    }
  } catch {
    /* DP */
  }

  let map = {};
  try {
    map = JSON.parse(
      opts.enchants ?? item.getDynamicProperty(DP.enchants) ?? "{}"
    ) || {};
  } catch {
    map = {};
  }

  const lines = [`§8${mat.name}${mat.heatproof ? " §7(ignífugo)" : ""}`];
  let dur = "?";
  const comp = item.getComponent("minecraft:durability");
  if (comp) dur = `${comp.maxDurability - comp.damage}/${comp.maxDurability}`;
  lines.push(`§7Durabilidad §f${dur}`);
  lines.push(`§7Daño base §f${mat.damage} §8· max §f${mat.maxHit}`);

  const ids = Object.keys(map);
  if (ids.length) {
    lines.push("§6Encantamientos");
    for (const id of ids) {
      const d = CONFIG.enchants.list[id];
      if (!d) continue;
      lines.push(`§7${d.name} ${ROMAN[map[id]] ?? map[id]}`);
    }
  }
  const lookId = opts.look ?? item.getDynamicProperty(DP.look);
  if (lookId) lines.push(`§8Aspecto: ${presetOf(lookId).name}`);

  item.setLore(lines.slice(0, 20));
  return item;
}

// ---- durabilidad ----

function addWear(item, points) {
  const comp = item.getComponent("minecraft:durability");
  if (!comp) return false;
  comp.damage = Math.min(comp.maxDurability, comp.damage + points);
  return comp.damage >= comp.maxDurability;
}

function mainhandSlot(player) {
  return player
    .getComponent("minecraft:equippable")
    ?.getEquipmentSlot(EquipmentSlot.Mainhand);
}

/** Desgasta el disco en la mano. Devuelve true si se rompió. */
export function wearHand(player, points) {
  if (player.getGameMode() === GameMode.Creative) return false;
  const slot = mainhandSlot(player);
  const item = slot?.getItem();
  if (!isDiscItem(item)) return false;
  if (addWear(item, points)) {
    slot.setItem(undefined);
    try {
      player.playSound(CONFIG.durability.breakSound);
    } catch {
      /* sonido */
    }
    bar(player, "§cEl disco se rompió");
    return true;
  }
  slot.setItem(item);
  return false;
}

// ---- inventario ----

function hasSerial(container, serial) {
  if (!serial) return undefined;
  for (let i = 0; i < container.size; i++) {
    const it = container.getItem(i);
    if (!it || !isDiscItem(it)) continue;
    if (it.getDynamicProperty(DP.serial) === serial) return { item: it, slot: i };
  }
  return undefined;
}

// ---- captura ----

export function recoverDisc(player, e) {
  if (!e?.isValid) return false;
  const owner = e.getDynamicProperty(DP.owner);
  if (CONFIG.antiExploit.ownerOnlyPickup && owner && owner !== player.id) {
    bar(player, "Disco ajeno");
    return false;
  }

  const matKey = e.getDynamicProperty(DP.material) ?? CONFIG.defaultMaterial;
  const ench = e.getDynamicProperty(DP.enchants) ?? "{}";
  const serial = e.getDynamicProperty(DP.serial);
  const look = e.getDynamicProperty(DP.look);
  const bounces = e.getDynamicProperty(DP.bounces) ?? 0;
  const extra = Math.floor(bounces / CONFIG.durability.bouncesPerWear);

  const creative = player.getGameMode() === GameMode.Creative;
  const inv = player.getComponent("minecraft:inventory")?.container;

  // El item puede seguir en la mano (el proyectil no lo consume) o haberse perdido.
  let target;
  if (!creative && inv) {
    const hit = hasSerial(inv, serial);
    if (hit) {
      target = hit.item;
      const slot = inv.getSlot(hit.slot);
      if (addWear(target, extra)) {
        slot.setItem(undefined);
        try {
          player.playSound(CONFIG.durability.breakSound);
        } catch {
          /* sonido */
        }
        e.remove();
        return true;
      }
      slot.setItem(target);
      try {
        target.setDynamicProperty(DP.inflight, false);
      } catch {
        /* DP */
      }
      e.remove();
      return true;
    }
    if (inv.emptySlotsCount < 1) {
      bar(player, "Inventario lleno");
      return false;
    }
  }

  if (!creative) {
    const item = new ItemStack(materialByKey(matKey).item, 1);
    fillDiscItem(item, { material: matKey, enchants: ench, serial, look });
    if (extra > 0 && addWear(item, extra)) {
      e.remove();
      try {
        player.playSound(CONFIG.durability.breakSound);
      } catch {
        /* sonido */
      }
      return true;
    }
    inv.addItem(item);
  }
  e.remove();
  return true;
}

function countMine(pid) {
  let n = 0;
  for (const d of discs.values()) if (d.owner === pid) n++;
  return n;
}

function killSerial(serial, keepId) {
  if (!serial || CONFIG.antiExploit.maxAlivePerSerial < 1) return;
  for (const [id, info] of discs) {
    if (id === keepId || info.serial !== serial) continue;
    const e = world.getEntity(id);
    if (e?.isValid) e.remove();
    else discs.delete(id);
  }
}

// ---- regreso tipo frisbee ----

export function startReturn(e, info) {
  if (!e?.isValid || info.returning) return;
  info.returning = true;
  try {
    e.setDynamicProperty(DP.returning, true);
    e.setDynamicProperty(DP.bounces, info.bounces);
  } catch {
    /* DP */
  }
}

// ---- lanzamiento ----

world.beforeEvents.itemUse.subscribe((ev) => {
  const item = ev.itemStack;
  if (!isDiscItem(item)) return;

  const player = ev.source;
  if (player.isSneaking && CONFIG.throw.sneakOpensUi) {
    ev.cancel = true;
    system.run(() => sneakHandler?.(player));
    return;
  }

  const t = tickNow();
  const pid = player.id;
  const matKey = materialOf(item.typeId);

  const comp = item.getComponent("minecraft:durability");
  if (comp && comp.damage >= comp.maxDurability) {
    ev.cancel = true;
    return;
  }
  if (throwOnCooldown(player, t)) {
    ev.cancel = true;
    return;
  }
  if (countMine(pid) >= CONFIG.limits.perPlayer) {
    ev.cancel = true;
    bar(player, "Límite de discos");
    return;
  }
  if (discs.size >= CONFIG.limits.global) {
    ev.cancel = true;
    bar(player, "Demasiados discos");
    return;
  }

  markThrow(player, t);
  const serial = item.getDynamicProperty(DP.serial) ?? `${pid}:${t}`;
  pending.set(pid, {
    material: matKey,
    enchants: item.getDynamicProperty(DP.enchants) ?? "{}",
    look: item.getDynamicProperty(DP.look) ?? CONFIG.look.defaultPreset,
    serial,
    thrownAt: t,
  });

  // 1 punto por lanzamiento (fuera del evento, el inventario es de solo lectura aquí)
  system.run(() => wearHand(player, CONFIG.durability.perThrow));
});

world.afterEvents.entitySpawn.subscribe((ev) => {
  const e = ev.entity;
  if (e.typeId !== ENT) return;

  const proj = e.getComponent("minecraft:projectile");
  const owner = proj?.owner;
  const pid = owner?.id ?? "";
  const data = pid ? pending.get(pid) : undefined;
  if (pid) pending.delete(pid);

  const matKey = data?.material ?? CONFIG.defaultMaterial;
  const serial = data?.serial ?? e.id;
  try {
    e.setDynamicProperty(DP.owner, pid);
    e.setDynamicProperty(DP.bounces, 0);
    e.setDynamicProperty(DP.enchants, data?.enchants ?? "{}");
    e.setDynamicProperty(DP.thrownAt, data?.thrownAt ?? tickNow());
    e.setDynamicProperty(DP.serial, serial);
    e.setDynamicProperty(DP.returning, false);
    e.setDynamicProperty(DP.material, matKey);
    e.setDynamicProperty(DP.look, data?.look ?? CONFIG.look.defaultPreset);
  } catch {
    return;
  }

  killSerial(serial, e.id);
  discs.set(e.id, {
    owner: pid,
    born: data?.thrownAt ?? tickNow(),
    serial,
    bounces: 0,
    material: matKey,
    look: data?.look ?? CONFIG.look.defaultPreset,
    returning: false,
  });
});

world.afterEvents.entityRemove.subscribe((ev) => {
  discs.delete(ev.removedEntityId);
});

world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
  const e = ev.target;
  if (e.typeId !== ENT) return;
  const born = e.getDynamicProperty(DP.thrownAt) ?? 0;
  if (tickNow() - born < CONFIG.antiExploit.pickupLockTicks) return;
  recoverDisc(ev.player, e);
});

// ---- tick: TTL, regreso, captura ----

export function tickDiscs(now) {
  const ttl = CONFIG.return.ttlTicks || CONFIG.limits.ttlTicks;
  const voidY = CONFIG.antiExploit.voidY;
  const step = CONFIG.return.stepSpeed * CONFIG.limits.tickEvery;
  const catchR = CONFIG.return.catchRange;

  for (const [id, info] of discs) {
    const e = world.getEntity(id);
    if (!e?.isValid) {
      discs.delete(id);
      continue;
    }
    const loc = e.location;
    if (loc.y < voidY) {
      e.remove();
      continue;
    }

    const owner = info.owner ? world.getEntity(info.owner) : undefined;
    const alive = owner?.isValid && owner.getComponent("minecraft:health");

    if (!info.returning && (now - info.born >= ttl || info.speed === 0)) {
      if (alive) startReturn(e, info);
      else if (now - info.born >= ttl) e.remove();
    }

    if (!info.returning) continue;

    if (!alive) {
      e.remove();
      continue;
    }

    const target = owner.getHeadLocation?.() ?? owner.location;
    const dx = target.x - loc.x;
    const dy = target.y - loc.y;
    const dz = target.z - loc.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist <= catchR + 0.5) {
      try {
        owner.playSound(CONFIG.fx.catchSound);
      } catch {
        /* sonido */
      }
      recoverDisc(owner, e);
      continue;
    }

    const s = Math.min(step, dist - catchR * 0.5);
    const next = {
      x: loc.x + (dx / dist) * s,
      y: loc.y + (dy / dist) * s,
      z: loc.z + (dz / dist) * s,
    };
    try {
      e.teleport(next, { keepVelocity: false });
    } catch {
      /* queda donde está */
    }
    try {
      e.setDynamicProperty(DP.returning, true);
    } catch {
      /* DP */
    }
  }
}
