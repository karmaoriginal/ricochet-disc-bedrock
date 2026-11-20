import { world, system, ItemStack, GameMode } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { CONFIG } from "./config.js";

const GUIDE_ID = CONFIG.ids.guide;
const PAGES = CONFIG.guide.pages;

function bar(player, msg) {
  if (CONFIG.pvp.actionbar) player.onScreenDisplay.setActionBar(msg);
}

async function show(form, player) {
  let r = await form.show(player);
  if (r.canceled && r.cancelationReason === FormCancelationReason.UserBusy) {
    await new Promise((res) => system.runTimeout(res, 8));
    r = await form.show(player);
  }
  return r;
}

async function openPage(player, index) {
  const p = PAGES[index];
  const form = new ActionFormData()
    .title(p.title)
    .body(p.lines.join("\n"));
  form.button("Atrás");
  form.button("Cerrar");
  const r = await show(form, player);
  if (r.canceled || r.selection === undefined || r.selection === 1) return;
  return openGuide(player);
}

export async function openGuide(player) {
  const form = new ActionFormData()
    .title(CONFIG.guide.title)
    .body("Elige una sección:");
  for (const p of PAGES) form.button(p.title);
  form.button("Cerrar");
  const r = await show(form, player);
  if (r.canceled || r.selection === undefined || r.selection === PAGES.length) {
    return;
  }
  return openPage(player, r.selection);
}

function hasGuide(player) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return false;
  for (let i = 0; i < inv.size; i++) {
    if (inv.getItem(i)?.typeId === GUIDE_ID) return true;
  }
  return false;
}

export function giveGuide(player) {
  if (player.getGameMode() === GameMode.Creative && hasGuide(player)) return;
  if (hasGuide(player)) return;
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;
  const item = new ItemStack(GUIDE_ID, 1);
  item.setLore([
    "§7Cómo fabricarlo, usarlo y qué hace.",
    "§8Úsala en la mano para abrirla.",
  ]);
  if (inv.emptySlotsCount < 1) {
    try {
      player.dimension.spawnItem(item, player.location);
    } catch {
      /* sin espacio */
    }
    return;
  }
  inv.addItem(item);
  bar(player, "§eGuía del Disco añadida");
}

// Abrir la guía con el item en la mano.
world.beforeEvents.itemUse.subscribe((ev) => {
  if (ev.itemStack?.typeId !== GUIDE_ID) return;
  ev.cancel = true;
  const player = ev.source;
  system.run(() => openGuide(player));
});

// Entrega única al entrar al mundo.
world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn || !CONFIG.guide.giveOnFirstJoin) return;
  const player = ev.player;
  system.runTimeout(() => {
    if (!player.isValid) return;
    giveGuide(player);
    if (CONFIG.guide.openOnFirstJoin) {
      system.runTimeout(() => {
        if (player.isValid) openGuide(player);
      }, 20);
    }
  }, 40);
});
