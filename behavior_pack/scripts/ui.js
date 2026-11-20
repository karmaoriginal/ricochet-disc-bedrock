import { system, GameMode, EquipmentSlot } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { CONFIG } from "./config.js";
import { onSneakUse, fillDiscItem } from "./disc.js";
import { parseEnchants, canApply } from "./enchants.js";

const ITEM = CONFIG.ids.item;
const LIST = CONFIG.enchants.list;
const ROMAN = ["", "I", "II", "III", "IV", "V"];
const busy = new Set();

function bar(player, msg) {
  if (CONFIG.pvp.actionbar) player.onScreenDisplay.setActionBar(msg);
}

function getHeld(player) {
  const eq = player.getComponent("minecraft:equippable");
  const item = eq?.getEquipment(EquipmentSlot.Mainhand);
  if (!item || item.typeId !== ITEM) return { eq: undefined, item: undefined };
  return { eq, item };
}

function putHeld(eq, item) {
  eq.setEquipment(EquipmentSlot.Mainhand, item);
}

function currentMap(item) {
  return { ...parseEnchants(item.getDynamicProperty(CONFIG.dp.enchants)) };
}

function bodyOf(map) {
  const keys = Object.keys(map);
  if (keys.length === 0) return "Sin encantamientos.\nCuesta 1 frasco de XP.";
  const lines = ["Actual:"];
  for (const id of keys) {
    const d = LIST[id];
    if (!d) continue;
    lines.push(`§7${d.name} ${ROMAN[map[id]] ?? map[id]}`);
  }
  lines.push("§8Cuesta 1 frasco de XP.");
  return lines.join("\n");
}

async function showForm(form, player) {
  let r = await form.show(player);
  if (r.canceled && r.cancelationReason === FormCancelationReason.UserBusy) {
    await new Promise((res) => system.runTimeout(res, 8));
    r = await form.show(player);
  }
  return r;
}

function takeCost(player) {
  if (player.getGameMode() === GameMode.Creative) return true;
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return false;
  const need = CONFIG.ui.applyCost;
  const id = CONFIG.ui.applyItem;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (!it || it.typeId !== id) continue;
    if (it.amount > need) {
      it.amount -= need;
      inv.setItem(i, it);
      return true;
    }
    if (it.amount === need) {
      inv.setItem(i, undefined);
      return true;
    }
  }
  return false;
}

function write(eq, item, map) {
  fillDiscItem(item, JSON.stringify(map), item.getDynamicProperty(CONFIG.dp.serial));
  putHeld(eq, item);
}

async function openLevels(player, id) {
  const d = LIST[id];
  if (!d) return;
  const { eq, item } = getHeld(player);
  if (!item) return;
  const map = currentMap(item);
  const form = new ActionFormData()
    .title(d.name)
    .body(`Máximo ${ROMAN[d.max]}. Grupo: ${d.group}${d.unique ? " §6(único)" : ""}`);
  const levels = [];
  for (let lv = 1; lv <= d.max; lv++) {
    const chk = canApply(map, id, lv);
    form.button(chk.ok ? `${d.name} ${ROMAN[lv]}` : `§8${d.name} ${ROMAN[lv]}`);
    levels.push({ lv, chk });
  }
  form.button("Atrás");
  const r = await showForm(form, player);
  if (r.canceled || r.selection === undefined || r.selection === levels.length) {
    openEnchantUi(player);
    return;
  }
  const pick = levels[r.selection];
  if (!pick.chk.ok) {
    bar(player, pick.chk.reason);
    openEnchantUi(player);
    return;
  }
  if (!takeCost(player)) {
    bar(player, "Necesitas frasco de XP");
    return;
  }
  const { eq: eq2, item: item2 } = getHeld(player);
  if (!item2) return;
  const next = currentMap(item2);
  const chk2 = canApply(next, id, pick.lv);
  if (!chk2.ok) {
    bar(player, chk2.reason);
    return;
  }
  next[id] = pick.lv;
  write(eq2, item2, next);
  bar(player, `${d.name} ${ROMAN[pick.lv]}`);
}

async function openRemove(player) {
  const { eq, item } = getHeld(player);
  if (!item) return;
  const map = currentMap(item);
  const keys = Object.keys(map);
  if (keys.length === 0) {
    bar(player, "Nada que quitar");
    openEnchantUi(player);
    return;
  }
  const form = new ActionFormData().title("Quitar").body("Elige uno.");
  for (const id of keys) {
    form.button(`${LIST[id]?.name ?? id} ${ROMAN[map[id]] ?? ""}`);
  }
  form.button("Atrás");
  const r = await showForm(form, player);
  if (r.canceled || r.selection === undefined || r.selection === keys.length) {
    openEnchantUi(player);
    return;
  }
  const { eq: eq2, item: item2 } = getHeld(player);
  if (!item2) return;
  const next = currentMap(item2);
  delete next[keys[r.selection]];
  write(eq2, item2, next);
  bar(player, "Encantamiento quitado");
}

export async function openEnchantUi(player) {
  if (busy.has(player.id)) return;
  busy.add(player.id);
  try {
    const { item } = getHeld(player);
    if (!item) {
      bar(player, "Sostén el disco");
      return;
    }
    const map = currentMap(item);
    const form = new ActionFormData().title(CONFIG.ui.title).body(bodyOf(map));
    const ids = Object.keys(LIST);
    for (const id of ids) {
      const d = LIST[id];
      const have = map[id] ?? 0;
      const tag = have ? ` ${ROMAN[have]}` : "";
      const extra = d.unique ? " §6★" : "";
      form.button(`${d.name}${tag}${extra}`);
    }
    form.button("Quitar");
    form.button("Cerrar");
    const r = await showForm(form, player);
    if (r.canceled || r.selection === undefined) return;
    if (r.selection === ids.length) {
      await openRemove(player);
      return;
    }
    if (r.selection === ids.length + 1) return;
    await openLevels(player, ids[r.selection]);
  } catch {
    bar(player, "UI no disponible");
  } finally {
    busy.delete(player.id);
  }
}

onSneakUse((player) => {
  openEnchantUi(player);
});
