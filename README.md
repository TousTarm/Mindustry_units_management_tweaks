# Unit Management Tweaks

A small client-side Mindustry mod that makes commanding mixed armies less painful.

## Features

### Control groups, HOI4 style

- **Group bar** in the bottom-left corner: one card per group with its number and unit composition
  (icon × count). Visible whenever you have a group or are in command mode.
  - Click a card to select the group, double-click to jump the camera to it.
  - **+** adds the selected units to that group, **×** removes them from it, **trash** disbands it.
  - The **+** on the right creates a new group from the selected units.
  - Moving units to another group: select them, click **+** on the target group. They leave their old group
    automatically (game setting *Distinct control groups*, on by default).
- **Group number above every grouped unit**, so you always see who belongs where.
- Built on the game's own control groups, so the hotkeys keep working and groups are saved with your game:
  in command mode (`Shift`), `Ctrl` + `1`–`9` creates a group, `1`–`9` selects it.
  Keys can be changed in **Settings → Controls** (`Create Control Group`, `Block Select 01`–`10`).

To give orders to a selected group, hold `Shift` (command mode) and right-click as usual.

### Same speed

- Units you command together move at the pace of the slowest one, so a fast
  unit no longer runs ahead and dies alone before the slow ones arrive.
  - Works on every group order (move or attack), the same groups the game uses for formations.
  - Slowdown lasts only while the group is on the move; units get their normal speed back when they
    arrive or get a new order.
  - Toggle with the **Same speed** button in the group bar. On by default, remembered between games.
  - Never written into save files.

Client-side only (`hidden: true`): adds no content, other players don't need it.

## Installation

Requires Mindustry v8 (build 147 or newer).

**Option A: import as zip**

1. Zip the *contents* of the `unit-management-tweaks` folder so `mod.hjson` sits at the zip root:
   ```sh
   cd unit-management-tweaks && python3 -c "import zipfile; z = zipfile.ZipFile('../unit-management-tweaks.zip', 'w'); [z.write(f) for f in ('mod.hjson', 'scripts/main.js')]"
   ```
2. In game: **Mods → Import Mod → Import File** and choose the zip.
3. Restart the game.

**Option B: copy the folder**

Copy the `unit-management-tweaks` folder into your Mindustry mods directory and restart:

| OS      | Mods directory                                     |
|---------|----------------------------------------------------|
| Windows | `%AppData%\Mindustry\mods\`                        |
| Linux   | `~/.local/share/Mindustry/mods/`                   |
| macOS   | `~/Library/Application Support/Mindustry/mods/`    |
| Steam   | `<Steam>/steamapps/common/Mindustry/saves/mods/`   |

## How it works

The group bar and the numbers read and edit `control.input.controlGroups`, the same list the hotkeys use.

When you order several units at once, the game puts them into one `UnitGroup` to build a formation.
Every tick the mod finds the slowest moving member of each group (by the unit type's base speed)
and slows the others down to match, using the game's own dynamic status effect (the one behind
`unit.statusSpeed()`). Other speed effects (wet, slowed, overdrive, floor) still apply on top.

## Limitations

- Same speed works in singleplayer and when hosting only. As a client on someone else's server, the server controls unit speed.
- Matches base speed: a slow unit stuck in shallow water or slowed by a status effect is not waited for.
- Units arrive at the same pace, not at the same moment: a unit that starts further away still arrives later.

## License

MIT
