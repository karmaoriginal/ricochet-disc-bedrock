// Ajuste único del add-on. No pongas magia en otros archivos.

export const CONFIG = {
  ids: {
    entity: "rd:ricochet_disc",
    guide: "rd:disc_guide",
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
    material: "rd:material",
    look: "rd:look",
    dye: "rd:dye",
    hits: "rd:hits",
    inflight: "rd:inflight",
    wear: "rd:wear",
  },

  // Materiales: cada uno es un item propio con daño y durabilidad propios.
  // damage = daño base al primer impacto; maxHit = techo por rebotes.
  materials: {
    wood: {
      item: "rd:disc_wood",
      name: "Madera",
      damage: 3,
      maxHit: 9,
      durability: 90,
      restitution: 0.76,
      heatproof: false,
      color: "#8b6a3f",
      recipeHint: "4 tablones de cualquier madera",
    },
    stone: {
      item: "rd:disc_stone",
      name: "Piedra",
      damage: 4,
      maxHit: 12,
      durability: 160,
      restitution: 0.78,
      heatproof: false,
      color: "#8f9499",
      recipeHint: "4 piedra lisa (no adoquín)",
    },
    iron: {
      item: "rd:disc_iron",
      name: "Hierro",
      damage: 5,
      maxHit: 15,
      durability: 320,
      restitution: 0.82,
      heatproof: false,
      color: "#d6d6d6",
      recipeHint: "4 lingotes de hierro",
    },
    gold: {
      item: "rd:disc_gold",
      name: "Oro",
      damage: 4,
      maxHit: 12,
      durability: 120,
      restitution: 0.88, // el oro rebota más y dura menos
      heatproof: false,
      color: "#f2ce4b",
      recipeHint: "4 lingotes de oro",
    },
    diamond: {
      item: "rd:disc_diamond",
      name: "Diamante",
      damage: 6,
      maxHit: 18,
      durability: 780,
      restitution: 0.84,
      heatproof: false,
      color: "#5ee0d4",
      recipeHint: "4 diamantes",
    },
    netherite: {
      item: "rd:disc_netherite",
      name: "Netherite",
      damage: 7,
      maxHit: 21,
      durability: 1200,
      restitution: 0.86,
      heatproof: true, // no se destruye en lava
      color: "#6a5a5f",
      recipeHint: "4 lingotes de netherite + 1 de oro",
    },
  },

  defaultMaterial: "iron",

  // Frisbee: vuelve solo al dueño. Sin rebotes no vuelve: cae donde toque.
  return: {
    enabled: true,
    afterBounces: 3, // a partir de este rebote inicia el regreso
    ttlTicks: 160, // o por tiempo agotado
    maxReturnTicks: 100,
    stepSpeed: 0.9, // bloques por tick del tramo de regreso
    catchRange: 1.8,
    overshoot: 12, // si se pasa de este radio, abandona el regreso
  },

  durability: {
    perThrow: 1,
    bouncesPerWear: 3, // 1 punto extra cada 3 rebotes
    breakSound: "random.break",
    minBeforeBreak: 1, // con 1 punto restante sigue usable
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

  // Daño por rebote: se suma sobre el daño base del material.
  damage: {
    perBounceMul: 1.25,
    bounceMulCap: 2.5,
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
    catchSound: "random.orb",
  },

  // Aspecto: dos vías. Caldero (dyeable vanilla) y acabados del menú.
  look: {
    dyeEnabled: true, // tinte libre con caldero, como armadura de cuero
    presets: {
      pulido: {
        name: "Pulido",
        tint: "§f",
        color: "#d9dee6",
        particle: "minecraft:critical_hit_emitter",
      },
      dorado: {
        name: "Dorado",
        tint: "§e",
        color: "#f2ce4b",
        particle: "minecraft:totem_particle",
      },
      oxido: {
        name: "Óxido",
        tint: "§6",
        color: "#8a5a34",
        particle: "minecraft:basic_smoke_particle",
      },
      fuego: {
        name: "Fuego",
        tint: "§c",
        color: "#e2603a",
        particle: "minecraft:basic_flame_particle",
      },
      hielo: {
        name: "Hielo",
        tint: "§b",
        color: "#9fd8ee",
        particle: "minecraft:snowflake_particle",
      },
      neon: {
        name: "Neón",
        tint: "§d",
        color: "#b06cf0",
        particle: "minecraft:electric_spark_particle",
      },
    },
    defaultPreset: "pulido",
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
  // retorno ahora acelera el regreso; el disco ya vuelve de serie.
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
        perLevel: { returnSpeed: 0.25, earlyBounce: 1 },
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
    lookTitle: "Aspecto del disco",
  },

  // Guía entregada al entrar por primera vez (server-ui, no libro vanilla).
  guide: {
    title: "Guía del Disco de Rebote",
    giveOnFirstJoin: true,
    openOnFirstJoin: true,
    itemName: "Guía del Disco",
    pages: [
      {
        title: "Qué es",
        lines: [
          "Un disco tipo frisbee: lo lanzas, rebota en paredes",
          "y vuelve a tu mano.",
          "Cada rebote hace más daño.",
          "El daño y la durabilidad dependen del material.",
        ],
      },
      {
        title: "Cómo fabricarlo",
        lines: [
          "Mesa de crafteo, patrón en anillo:",
          "  . M .",
          "  M . M",
          "  . M .",
          "4 del material + nada en el centro.",
          "Madera: 4 tablones · Piedra: 4 piedra lisa",
          "Hierro: 4 lingotes · Oro: 4 lingotes",
          "Diamante: 4 diamantes · Netherite: 4 lingotes",
        ],
      },
      {
        title: "Cómo usarlo",
        lines: [
          "Mantén pulsado para cargar y suelta para lanzar.",
          "Apunta a una pared para que rebote y suba el daño.",
          "El disco vuelve solo tras 3 rebotes o al agotarse.",
          "Agáchate y usa el disco para abrir el menú.",
          "Ahí encantas, cambias el aspecto y ves la durabilidad.",
        ],
      },
      {
        title: "Durabilidad y aspecto",
        lines: [
          "Cada lanzamiento gasta 1 punto.",
          "Cada 3 rebotes gasta 1 punto extra.",
          "Al llegar a 0 el disco se rompe.",
          "Repara con el material del disco en el yunque.",
          "Aspecto: caldero con tinte (como armadura de cuero)",
          "o acabados del menú (Pulido, Dorado, Óxido, Fuego, Hielo, Neón).",
        ],
      },
      {
        title: "PvP y equipos",
        lines: [
          "/scoreboard objectives add rd_team dummy",
          "/scoreboard players set <jugador> rd_team 1",
          "Mismo número = mismo equipo: no se dañan.",
          "Rebotes encadenados = bonus de combo.",
          "Penetración reduce la armadura del objetivo.",
        ],
      },
    ],
  },
};
