# Disco de Rebote — Bedrock 1.26.62

Disco tipo **frisbee**: se lanza, rebota en paredes como pelota, sube de daño con cada rebote y **vuelve solo a la mano**. Seis materiales con daño y durabilidad propios, aspecto personalizable y guía integrada para cada jugador.

- Solo APIs **estables**: `@minecraft/server` 2.11.0 y `@minecraft/server-ui` 2.3.0 (sin experimentos).
- Un único `system.runInterval` global en `scripts/main.js`.
- Todo lo ajustable vive en `behavior_pack/scripts/config.js`.

## Materiales

| Disco | Daño base → tope | Durabilidad | Restitución | Receta |
|---|---|---|---|---|
| Madera | 3 → 9 | 90 | 0.76 | 4 tablones (anillo) |
| Piedra | 4 → 12 | 160 | 0.78 | 4 piedra lisa |
| Hierro | 5 → 15 | 320 | 0.82 | 4 lingotes de hierro |
| Oro | 4 → 12 | 120 | 0.88 | 4 lingotes de oro |
| Diamante | 6 → 18 | 780 | 0.84 | 4 diamantes |
| Netherite | 7 → 21 | 1200 | 0.86 | 4 lingotes de netherite + 1 oro |

Patrón de crafteo (anillo, centro vacío):

```
. M .
M . M
. M .
```

## Mecánicas

- **Vuelo frisbee**: rebote por reflexión de normal; vuelve al dueño tras 3 rebotes (menos con *Retorno*), al agotar la velocidad o al TTL. Captura a 1.8 bloques con sonido.
- **Daño por rebote**: `daño del material × 1.25^rebotes` con techo por material; se suma *Filo* y la penetración reduce armadura.
- **Durabilidad**: 1 punto por lanzamiento y 1 más por cada 3 rebotes. Al llegar al máximo, el disco se rompe. Se repara con el material en el yunque.
- **Lava**: el disco de netherite vuelve; los demás se pierden.
- **Aspecto**: tinte libre en **caldero** (componente `minecraft:dyeable`, como la armadura de cuero) y 6 acabados en el menú (Pulido, Dorado, Óxido, Fuego, Hielo, Neón) que cambian el color del nombre y la partícula del disco.
- **Encantamientos** (9 simulados con lore + propiedades dinámicas): Rebote, Impulso, Filo, Penetración, Veneno, Llama, Marchito, Retorno, Succión. Coste: 1 frasco de XP (gratis en creativo). Máx. 5 por disco, máximo 1 "único".
- **PvP**: cooldown, anti-spam, combos por ventana de ticks, equipos por scoreboard `rd_team`, anti-clip al golpear.

## Guía

Cada jugador recibe **Guía del Disco** al entrar por primera vez (se abre sola). También se abre agachándose con un disco en la mano, desde el menú del disco o usando la guía. Cinco secciones: qué es, cómo fabricarlo, cómo usarlo, durabilidad y aspecto, PvP y equipos.

## Estructura

```
behavior_pack/  manifest, 6 items, 6 recetas, entidad, scripts (config, disc, bounce, enchants, ui, pvp, guide, main)
resource_pack/  manifest, 13 texturas 16x16, modelo, render controller, animación, textos
```

## Empaquetar en Termux

```bash
pkg install zip -y
cd ~/ricochet-disc-bedrock
rm -f DiscoRebote.mcaddon
zip -r DiscoRebote.mcaddon behavior_pack resource_pack \
  -x "*.git*" -x "*/__pycache__/*" -x "*.DS_Store"
unzip -l DiscoRebote.mcaddon | head -30
```

## Prueba

1. `/scoreboard objectives add rd_team dummy` (solo si usarás equipos).
2. Activa **BP + RP**, experimentos **desactivados**.
3. Craftea un disco de hierro y otro de netherite; compara daño y rebotes.
4. Lanza contra una pared: debe rebotar varias veces, subir el daño y volver a tu mano.
5. Comprueba la durabilidad tras 3–4 lanzamientos (`F3 + H` o el lore del item).
6. Tíñelo en un caldero y cambia el acabado desde el menú.
7. Deja entrar a un jugador nuevo: debe recibir la guía y verla abierta.
8. Rompe el disco a media trayectoria y revisa que no queden entidades huérfanas: `/kill @e[type=rd:ricochet_disc]`.

## Checklist Content Log (GUI)

Ajustes → Creador → Content Log ON, dentro del mundo:

- [ ] Sin `Failed to load` de ningún pack.
- [ ] Sin `[Scripting] [error]` al iniciar (resuelven `pvp.js`, `ui.js`, `guide.js`, `enchants.js`).
- [ ] Sin `Unknown item` de los 6 discos ni de `rd:disc_guide`.
- [ ] Sin errores de receta (el tag `minecraft:planks` carga sin queja).
- [ ] Sin errores de textura ni de `geometry.rd_ricochet_disc`.
- [ ] Sin avisos de versión de módulo (`2.11.0` / `2.3.0`).
- [ ] Content Log History limpio al lanzar, rebotar, golpear, abrir menús y romper el disco.

## Licencia

MIT — ver `LICENSE`.
