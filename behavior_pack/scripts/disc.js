import { world, system, ItemStack, GameMode } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { throwOnCooldown, markThrow } from "./pvp.js";

const ITEM = CONFIG.ids.item;
const ENT = CONFIG.ids.entity;
const DP = CONFIG.dp;

/** @type {Map<string, { owner: string, born: number, serial: string, bounces: number }>} */
export const discs = new Map();

/** @type {Map<string, { enchants: string, serial: string, thrownAt: number }>} */
const pending = new Map();

const ROMAN = ["", "I", "II", "III", "IV", "V"];
let sneakHandler = undefined;

export function onSneakUse(fn) {
  sneakHandler = fn;
}

function tickNow() {
  return system.currentTick;
}

function bar(player, msg) {
  if (CONFIG.pvp.actionbar) player.onScreenDisplay.setActionBar(msg);
}

export function fillDiscItem(item, enchStr, serial) {
  if (enchStr !== undefined) item.setDynamicProperty(DP.enchants, enchStr);
  if (serial !== undefined) item.setDynamicProperty(DP.serial, serial);
  let map = {};
  try {
    map = JSON.parse(enchStr || "{}") || {};
  } catch {
    map = {};
  }
  const lines = ["§6Encantamientos"];
  for (const id of Object.keys(map)) {
    const d = CONFIG.enchants.list[id];
    if (!d) continue;
    lines.push(`§7${d.name} ${ROMAN[map[id]] ?? map[id]}`);
  }
  if (lines.length > 1) item.setLore(lines);
  else item.setLore(undefined);
}

export function recoverDisc(player, e) {
  if (!e?.isValid) return false;
  const owner = e.getDynamicProperty(DP.owner);
  if (CONFIG.antiExploit.ownerOnlyPickup && owner && owner !== player.id) {
    bar(player, "Disco ajeno");
    return false;
  }
  if (player.getGameMode() !== GameMode.Creative) {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return false;
    if (inv.emptySlotsCount < 1) {
      bar(player, "Inventario lleno");
      return false;
    }
    const item = new ItemStack(ITEM, 1);
    fillDiscItem(
      item,
      e.getDynamicProperty(DP.enchants),
      e.getDynamicProperty(DP.serial)
    );
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

world.beforeEvents.itemUse.subscribe((ev) => {
  const item = ev.itemStack;
  if (!item || item.typeId !== ITEM) return;

  const player = ev.source;
  if (player.isSneaking && CONFIG.throw.sneakOpensUi) {
    ev.cancel = true;
    system.run(() => sneakHandler?.(player));
    return;
  }

  const t = tickNow();
  const pid = player.id;
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
  const serial =
    item.getDynamicProperty(DP.serial) ?? `${pid}:${t}`;
  pending.set(pid, {
    enchants: item.getDynamicProperty(DP.enchants) ?? "{}",
    serial,
    thrownAt: t,
  });
});

world.afterEvents.entitySpawn.subscribe((ev) => {
  const e = ev.entity;
  if (e.typeId !== ENT) return;

  const proj = e.getComponent("minecraft:projectile");
  const owner = proj?.owner;
  const pid = owner?.id ?? "";
  const data = pid ? pending.get(pid) : undefined;
  if (pid) pending.delete(pid);

  const serial = data?.serial ?? e.id;
  try {
    e.setDynamicProperty(DP.owner, pid);
    e.setDynamicProperty(DP.bounces, 0);
    e.setDynamicProperty(DP.enchants, data?.enchants ?? "{}");
    e.setDynamicProperty(DP.thrownAt, data?.thrownAt ?? tickNow());
    e.setDynamicProperty(DP.serial, serial);
    e.setDynamicProperty(DP.returning, false);
  } catch {
    return;
  }

  killSerial(serial, e.id);
  discs.set(e.id, {
    owner: pid,
    born: data?.thrownAt ?? tickNow(),
    serial,
    bounces: 0,
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

export function tickDiscs(now) {
  const ttl = CONFIG.limits.ttlTicks;
  const voidY = CONFIG.antiExploit.voidY;
  for (const [id, info] of discs) {
    const e = world.getEntity(id);
    if (!e?.isValid) {
      discs.delete(id);
      continue;
    }
    const loc = e.location;
    if (now - info.born >= ttl || loc.y < voidY) e.remove();
  }
}
