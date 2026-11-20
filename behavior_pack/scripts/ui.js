import { system, GameMode, EquipmentSlot } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { CONFIG } from "./config.js";
import {
  onSneakUse,
  fillDiscItem,
  isDiscItem,
  materialOf,
  materialByKey,
  applyLook,
} from "./disc.js";
import { parseEnchants, canApply } from "./enchants.js";
import { openGuide } from "./guide.js";

const LIST = CONFIG.enchants.list;
const ROMAN = ["", "I", "II", "III", "IV", "V"];
const busy = new Set();

function bar(player, msg) {
  if (CONFIG.pvp.actionbar) player.onScreenDisplay.setActionBar(msg);
}

function getHeld(player) {
  const eq = player.getComponent("minecraft:equippable");
  const item = eq?.getEquipment(EquipmentSlot.Mainhand);
  if (!isDiscItem(item)) return { eq: undefined, item: undefined };
  return { eq, item };
}

function putHeld(eq, item) {
  eq.setEquipment(EquipmentSlot.Mainhand, item);
}

function currentMap(item) {
  return { ...parseEnchants(item.getDynamicProperty(CONFIG.dp.enchants)) };
}

function durText(item) {
  const c = item.getComponent("minecraft:durability");
  if (!c) return "?";
  return `${c.maxDurability - c.damage}/${c.maxDurability}`;
}

function headOf(item) {
  const mat = materialByKey(materialOf(item.typeId));
  return `${mat.name} · §7dur §f${durText(item)}§7 · daño §f${mat.damage}–${mat.maxHit}`;
}

function enchText(map) {
  const keys = Object.keys(map);
  if (!keys.length) return "§8Sin encantamientos";
  return keys
    .map((id) => `§7${LIST[id]?.name ?? id} ${ROMAN[map[id]] ?? map[id]}`)
    .join("§8, ");
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

function write(eq, item, map, look) {
  fillDiscItem(item, {
    enchants: JSON.stringify(map),
    serial: item.getDynamicProperty(CONFIG.dp.serial),
    look,
  });
  putHeld(eq, item);
}

// ---- aspecto ----

async function openLook(player) {
  const { item } = getHeld(player);
  if (!item) return;
  const ids = Object.keys(CONFIG.look.presets);
  const cur = item.getDynamicProperty(CONFIG.dp.look);
  const form = new ActionFormData()
    .title(CONFIG.ui.lookTitle)
    .body(
      CONFIG.look.dyeEnabled
        ? "§8También puedes teñir el disco en un caldero con tinte."
        : "§8Acabados del menú."
    );
  for (const id of ids) {
    const p = CONFIG.look.presets[id];
    form.button(`${p.tint}${p.name}${id === cur ? " §8(actual)" : ""}`);
  }
  form.button("Atrás");
  const r = await showForm(form, player);
  if (r.canceled || r.selection === undefined || r.selection === ids.length) {
    openMain(player);
    return;
  }
  const { eq, item: held } = getHeld(player);
  if (!held) return;
  const pick = ids[r.selection];
  applyLook(held, pick);
  write(eq, held, currentMap(held), pick);
  bar(player, `Aspecto: ${CONFIG.look.presets[pick].name}`);
  openMain(player);
}

// ---- encantamientos ----

async function openLevels(player, id) {
  const d = LIST[id];
  if (!d) return;
  const { item } = getHeld(player);
  if (!item) return;
  const map = currentMap(item);
  const form = new ActionFormData()
    .title(d.name)
    .body(
      `Máximo ${ROMAN[d.max]}. Grupo: ${d.group}${
        d.unique ? " §6(único)" : ""
      }\n${headOf(item)}`
    );
  const levels = [];
  for (let lv = 1; lv <= d.max; lv++) {
    const chk = canApply(map, id, lv);
    form.button(chk.ok ? `${d.name} ${ROMAN[lv]}` : `§8${d.name} ${ROMAN[lv]}`);
    levels.push({ lv, chk });
  }
  form.button("Atrás");
  const r = await showForm(form, player);
  if (r.canceled || r.selection === undefined || r.selection === levels.length) {
    openMain(player);
    return;
  }
  const pick = levels[r.selection];
  if (!pick.chk.ok) {
    bar(player, pick.chk.reason);
    openMain(player);
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
  write(eq2, item2, next, item2.getDynamicProperty(CONFIG.dp.look));
  bar(player, `${d.name} ${ROMAN[pick.lv]}`);
  openMain(player);
}

async function openRemove(player) {
  const { item } = getHeld(player);
  if (!item) return;
  const map = currentMap(item);
  const keys = Object.keys(map);
  if (keys.length === 0) {
    bar(player, "Nada que quitar");
    openMain(player);
    return;
  }
  const form = new ActionFormData().title("Quitar").body("Elige uno.");
  for (const id of keys) {
    form.button(`${LIST[id]?.name ?? id} ${ROMAN[map[id]] ?? ""}`);
  }
  form.button("Atrás");
  const r = await showForm(form, player);
  if (r.canceled || r.selection === undefined || r.selection === keys.length) {
    openMain(player);
    return;
  }
  const { eq: eq2, item: item2 } = getHeld(player);
  if (!item2) return;
  const next = currentMap(item2);
  delete next[keys[r.selection]];
  write(eq2, item2, next, item2.getDynamicProperty(CONFIG.dp.look));
  bar(player, "Encantamiento quitado");
  openMain(player);
}

async function openEnchantList(player) {
  const { item } = getHeld(player);
  if (!item) {
    bar(player, "Sostén el disco");
    return;
  }
  const map = currentMap(item);
  const form = new ActionFormData()
    .title(CONFIG.ui.title)
    .body(`${headOf(item)}\n\n${enchText(map)}\n§8Cuesta ${
      CONFIG.ui.applyCost
    } frasco de XP.`);
  const ids = Object.keys(LIST);
  for (const id of ids) {
    const d = LIST[id];
    const have = map[id] ?? 0;
    const tag = have ? ` ${ROMAN[have]}` : "";
    const extra = d.unique ? " §6★" : "";
    form.button(`${d.name}${tag}${extra}`);
  }
  form.button("Quitar");
  form.button("Atrás");
  const r = await showForm(form, player);
  if (r.canceled || r.selection === undefined) return;
  if (r.selection === ids.length) {
    await openRemove(player);
    return;
  }
  if (r.selection === ids.length + 1) {
    openMain(player);
    return;
  }
  await openLevels(player, ids[r.selection]);
}

// ---- menú principal ----

export async function openMain(player) {
  if (busy.has(player.id)) return;
  busy.add(player.id);
  try {
    const { item } = getHeld(player);
    if (!item) {
      bar(player, "Sostén el disco");
      return;
    }
    const lookId = item.getDynamicProperty(CONFIG.dp.look);
    const look = CONFIG.look.presets[lookId] ?? CONFIG.look.presets[CONFIG.look.defaultPreset];
    const map = currentMap(item);
    const form = new ActionFormData()
      .title(CONFIG.ui.title)
      .body(
        `${headOf(item)}\n§7Aspecto: §f${look.name}\n${enchText(map)}`
      );
    form.button("Encantar");
    form.button("Aspecto");
    form.button("Guía");
    form.button("Cerrar");
    const r = await showForm(form, player);
    if (r.canceled || r.selection === undefined || r.selection === 3) return;
    if (r.selection === 0) {
      busy.delete(player.id);
      await openEnchantList(player);
      return;
    }
    if (r.selection === 1) {
      busy.delete(player.id);
      await openLook(player);
      return;
    }
    if (r.selection === 2) {
      busy.delete(player.id);
      await openGuide(player);
    }
  } catch {
    bar(player, "UI no disponible");
  } finally {
    busy.delete(player.id);
  }
}

// Compatibilidad: quien llame openEnchantUi obtiene el menú principal.
export const openEnchantUi = openMain;

onSneakUse((player) => {
  openMain(player);
});
