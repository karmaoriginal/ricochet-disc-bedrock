# Disco de Rebote — Bedrock 1.26.62

Add-on de disco lanzable con rebote real (reflexión por normal de cara en script), 9 encantamientos simulados (lore + propiedades dinámicas + `server-ui`) y PvP con equipos, combos y penetración de armadura.

- Solo APIs **estables**: `@minecraft/server` 2.11.0 y `@minecraft/server-ui` 2.3.0 (sin experimentos).
- Un único `system.runInterval` global en `scripts/main.js`.
- Todo lo ajustable vive en `behavior_pack/scripts/config.js`.

## Estructura

```
behavior_pack/   manifiesto, item, entidad, scripts (disc, bounce, enchants, ui, pvp, config, main)
resource_pack/   manifiesto, texturas 16x16, modelo, controlador de render, animación, textos
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

Copia el `.mcaddon` a la carpeta de descargas y ábrelo con Minecraft (importa BP + RP y activa ambos en el mundo).

## Prueba rápida

1. `/scoreboard objectives add rd_team dummy` (solo si usas equipos).
2. Crea el mundo, activa **ambos** packs, experimentos **desactivados**.
3. `/give @s rd:ricochet_disc`.
4. Lanza contra una pared: debe reflejarse hasta 6 veces (más con *Rebote*), subir daño por rebote y frenar por restitución.
5. Agáchate + usa el disco: menú de encantamientos; cuesta 1 botella de experiencia (creativo gratis).
6. Golpea un mob y comprueba lore + efecto (veneno / fuego / marchito), *Filo* y *Penetración*.
7. PvP: dos jugadores, mismo score en `rd_team` → no se dañan; distinto equipo → sí.
8. Rompe el disco a mitad de vuelo, sal del mundo y vuelve: no debe quedar entidad huérfana (`/kill @e[type=rd:ricochet_disc]` si hiciera falta).

## Checklist Content Log (GUI)

Abre **Ajustes → Creador → Content Log: activado** y revisa la consola en el mundo:

- [ ] Sin `Failed to load` de `behavior_pack` ni `resource_pack`.
- [ ] Sin `[Scripting] [error]` al iniciar (imports de `pvp.js`, `ui.js`, `enchants.js` resueltos).
- [ ] Sin `Unknown item` / `Unknown entity` en el log al dar el disco.
- [ ] Sin errores de textura ni de geometría (`geometry.rd_ricochet_disc`).
- [ ] Sin advertencias de versión de módulo (`2.11.0` / `2.3.0`).
- [ ] `Content Log History` sin `TypeError` al lanzar, rebotar, golpear y abrir el menú.

## Licencia

MIT — ver `LICENSE`.
