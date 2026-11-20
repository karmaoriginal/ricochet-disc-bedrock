import { system } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { tickDiscs } from "./disc.js";
import { tickBounce } from "./bounce.js";
import { tickEnchants } from "./enchants.js";
import { tickPvp } from "./pvp.js";
import "./ui.js";
import "./guide.js";

// Un solo intervalo global (2–4 ticks).
system.runInterval(() => {
  const t = system.currentTick;
  tickDiscs(t);
  tickBounce(t);
  tickEnchants(t);
  tickPvp(t);
}, CONFIG.limits.tickEvery);
