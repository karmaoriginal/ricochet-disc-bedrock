// Ajuste único del add-on. No pongas magia en otros archivos.

export const CONFIG = {
  ids: {
    item: "rd:ricochet_disc",
    entity: "rd:ricochet_disc",
    namespace: "rd",
  },

  dp: {
    owner: "rd:owner",
    bounces: "rd:bounces",
    enchants: "rd:enchants",
    thrownAt: "rd:thrown_at",
    lastHit: "rd:last_hit",
    returning: "rd:returning",
    serial: "rd:serial",
  },

  throw: {
    power: 1.65,
    gravity: 0.04,
    inertia: 0.99,
    offsetY: 1.4,
    offsetForward: 0.4,
    sneakOpensUi: true,
  },

  bounce: {
    max: 6,
    restitution: 0.82,
    minSpeed: 0.18,
    faceNudge: 0.08,
    cooldownTicks: 2,
  },

  damage: {
    base: 4,
    perBounceMul: 1.25,
    bounceMulCap: 2.5,
    maxHit: 18,
    cause: "entityAttack",
    knockback: 0.35,
  },

  limits: {
    perPlayer: 2,
    global: 12,
    ttlTicks: 160,
    tickEvery: 4,
    pickupRange: 1.35,
    pickupScanEvery: 4,
  },

  fx: {
    maxParticlesTick: 8,
    maxSoundsTick: 4,
    bounceParticle: "minecraft:critical_hit_emitter",
    hitParticle: "minecraft:explosion_particle",
    throwSound: "random.bow",
    bounceSound: "random.anvil_land",
    hitSound: "random.hurt",
    pickupSound: "random.pop",
  },

  pvp: {
    enabled: true,
    friendlyFire: false,
    teams: {
      useScoreboard: true,
      objective: "rd_team",
    },
    cooldownTicks: 16,
    antiSpamTicks: 8,
    comboWindowTicks: 40,
    comboBonusPer: 0.12,
    comboCap: 0.6,
    armorPenBase: 0.15,
    actionbar: true,
    hitIframesTicks: 8,
    selfHitGraceTicks: 8,
  },

  antiExploit: {
    blockClipCheck: true,
    clipMaxSteps: 4,
    ownerOnlyPickup: true,
    pickupLockTicks: 6,
    maxAlivePerSerial: 1,
    voidY: -64,
  },

  // 9 encants simulados (Bedrock no registra tipos custom).
  enchants: {
    maxOnDisc: 5,
    uniqueMax: 1,
    list: {
      rebote: {
        name: "Rebote",
        max: 3,
        group: "motion",
        unique: false,
        exclude: [],
        perLevel: { extraBounces: 1, restitution: 0.03 },
      },
      impulso: {
        name: "Impulso",
        max: 3,
        group: "motion",
        unique: false,
        exclude: [],
        perLevel: { power: 0.18 },
      },
      filo: {
        name: "Filo",
        max: 5,
        group: "daño",
        unique: false,
        exclude: [],
        perLevel: { damage: 0.8 },
      },
      penetracion: {
        name: "Penetración",
        max: 3,
        group: "daño",
        unique: false,
        exclude: [],
        perLevel: { armorPen: 0.12 },
      },
      veneno: {
        name: "Veneno",
        max: 2,
        group: "elemental",
        unique: false,
        exclude: ["llama", "marchito"],
        perLevel: { effect: "poison", seconds: 4, amp: 0 },
      },
      llama: {
        name: "Llama",
        max: 2,
        group: "elemental",
        unique: false,
        exclude: ["veneno", "marchito"],
        perLevel: { fireSeconds: 3 },
      },
      marchito: {
        name: "Marchito",
        max: 2,
        group: "elemental",
        unique: false,
        exclude: ["veneno", "llama"],
        perLevel: { effect: "wither", seconds: 3, amp: 0 },
      },
      retorno: {
        name: "Retorno",
        max: 3,
        group: "recover",
        unique: false,
        exclude: [],
        perLevel: { returnSpeed: 0.35 },
      },
      succion: {
        name: "Succión",
        max: 2,
        group: "unico",
        unique: true,
        exclude: [],
        perLevel: { heal: 1 },
      },
    },
  },

  ui: {
    title: "Encantar disco",
    applyItem: "minecraft:experience_bottle",
    applyCost: 1,
  },
};
