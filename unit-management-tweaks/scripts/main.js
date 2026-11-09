// Unit Management Tweaks: "same speed" - units commanded together move at the pace of the slowest one.
//
// The game already puts units commanded together into one UnitGroup (CommandAI.group) for formations.
// While a group is on the move, every member gets slowed to the base speed of the slowest moving member,
// using the game's own dynamic status effect (the same one unit.statusSpeed() / world processors use).

let sameSpeed = Core.settings.getBool("umt-same-speed", true);
let slowed = new IntSet(); // ids of units this mod slowed down
let next = new IntSet();
const mins = new ObjectFloatMap(); // UnitGroup -> slowest base speed among its moving members

function moving(u){
    const ai = u.controller();
    return u.isValid() && ai instanceof CommandAI && (ai.targetPos != null || ai.attackTarget != null);
}

function setPace(u, mul){
    // multiplies with slow/wet/etc. from other status effects, so those still apply on top
    if(mul < 1 || u.hasEffect(StatusEffects.dynamic)) u.applyDynamicStatus().speedMultiplier = mul;
}

function resetAll(){
    slowed.each(id => {
        const u = Groups.unit.getByID(id);
        if(u != null) setPace(u, 1);
    });
    slowed.clear();
}

Events.run(Trigger.update, () => {
    // as a client the server owns unit speed; this only works in singleplayer or when you host
    if(Vars.headless || !Vars.state.isGame() || Vars.net.client()) return;
    if(!sameSpeed){
        if(slowed.size > 0) resetAll();
        return;
    }

    mins.clear();
    next.clear();
    Vars.player.team().data().units.each(u => {
        if(!moving(u)) return;
        const g = u.controller().group;
        if(g == null || g.units.size < 2) return;

        if(!mins.containsKey(g)){
            let min = u.type.speed;
            // members re-commanded elsewhere have a different group now, skip them
            g.units.each(o => {
                if(moving(o) && o.controller().group == g) min = Math.min(min, o.type.speed);
            });
            mins.put(g, min);
        }

        const mul = mins.get(g, u.type.speed) / u.type.speed;
        if(mul < 0.999){
            setPace(u, mul);
            next.add(u.id);
        }
    });

    // arrived / re-commanded units get their normal speed back
    slowed.each(id => {
        if(next.contains(id)) return;
        const u = Groups.unit.getByID(id);
        if(u != null) setPace(u, 1);
    });
    const t = slowed; slowed = next; next = t;
});

// never write the slowdown into a save: reset before writing, the next tick re-applies it
Events.on(SaveWriteEvent, () => resetAll());
// ids from the previous map mean nothing in the new one
Events.on(WorldLoadEvent, () => slowed.clear());

// ---- Control groups: the game's own groups (Ctrl+1..9 / 1..9, saved with the map), made visible and editable ----

// the controlGroups array is replaced when a save loads, so never cache it
const input = () => Vars.control.input;
let lastClick = -1, lastClickAt = 0;

function selectedIds(){
    const ids = new IntSeq();
    input().selectedUnits.each(u => ids.add(u.id));
    return ids;
}

function hasSelection(){
    return input().selectedUnits.size > 0;
}

function anyGroup(){
    const gs = input().controlGroups;
    for(let i = 0; i < gs.length; i++) if(gs[i] != null && !gs[i].isEmpty()) return true;
    return false;
}

function addTo(i){
    const ids = selectedIds(), gs = input().controlGroups;
    if(ids.isEmpty()) return;
    // same rule as the game's Ctrl+number: a unit sits in one group only (unless that setting is off)
    if(Core.settings.getBool("distinctcontrolgroups", true)){
        for(let j = 0; j < gs.length; j++) if(gs[j] != null) gs[j].removeAll(ids);
    }
    if(gs[i] == null) gs[i] = new IntSeq();
    for(let j = 0; j < ids.size; j++) if(!gs[i].contains(ids.get(j))) gs[i].add(ids.get(j));
}

function removeFrom(i){
    const g = input().controlGroups[i];
    if(g != null) g.removeAll(selectedIds());
}

function disband(i){
    input().controlGroups[i] = null;
}

function newGroup(){
    const gs = input().controlGroups;
    for(let i = 0; i < gs.length; i++){
        if(gs[i] == null || gs[i].isEmpty()){
            addTo(i);
            return;
        }
    }
}

function select(i){
    const inp = input(), g = inp.controlGroups[i];
    if(g == null || g.isEmpty()) return;
    inp.selectedUnits.clear();
    inp.commandBuildings.clear();
    g.each(id => {
        const u = Groups.unit.getByID(id);
        if(u != null) inp.selectedUnits.add(u);
    });
    // with "hold for command mode" (default) the game resets this every frame: hold Shift to give orders
    if(!Core.settings.getBool("commandmodehold", true)) inp.commandMode = true;

    // double click centers the camera, like double-tapping the number key
    if(lastClick == i && Time.timeSinceMillis(lastClickAt) < 400){
        let x = 0, y = 0;
        inp.selectedUnits.each(u => { x += u.x; y += u.y; });
        if(inp.panning !== undefined) inp.panning = true; // desktop only: stop following the player unit
        Core.camera.position.set(x / inp.selectedUnits.size, y / inp.selectedUnits.size);
    }
    lastClick = i;
    lastClickAt = Time.millis();
}

function isSelected(i){
    const g = input().controlGroups[i], sel = input().selectedUnits;
    if(g == null || g.isEmpty() || sel.size != g.size) return false;
    for(let j = 0; j < sel.size; j++) if(!g.contains(sel.get(j).id)) return false;
    return true;
}

// the game only drops dead units from a group when you press its key; do it every tick so the UI stays right
Events.run(Trigger.update, () => {
    if(Vars.headless || !Vars.state.isGame()) return;
    const gs = input().controlGroups;
    for(let i = 0; i < gs.length; i++){
        const g = gs[i];
        if(g == null) continue;
        for(let j = g.size - 1; j >= 0; j--){
            const u = Groups.unit.getByID(g.get(j));
            if(u == null || !u.isValid() || !u.isCommandable()) g.removeIndex(j);
        }
    }
});

// group number above every grouped unit
Events.run(Trigger.draw, () => {
    if(!Vars.state.isGame() || !Vars.ui.hudfrag.shown) return;
    const gs = input().controlGroups, labels = {};
    for(let i = 0; i < gs.length; i++){
        if(gs[i] != null) gs[i].each(id => labels[id] = (labels[id] ? labels[id] + "," : "") + (i + 1));
    }

    Core.camera.bounds(Tmp.r1);
    Draw.z(Layer.playerName);
    const z = Drawf.text();
    for(const id in labels){
        const u = Groups.unit.getByID(parseInt(id));
        if(u == null || !Tmp.r1.contains(u.x, u.y)) continue;
        Drawf.text(labels[id], u.x, u.y + u.hitSize / 2 + 4, Pal.accent, 0.9);
    }
    Draw.z(z);
});

// ---- UI: HOI4-style bar in the bottom-left corner ----

// one card per group: [number + unit icons x count], below it [add selected][remove selected][disband]
function card(bar, i){
    const counts = {}, types = {};
    input().controlGroups[i].each(id => {
        const u = Groups.unit.getByID(id);
        if(u == null) return;
        counts[u.type.name] = (counts[u.type.name] || 0) + 1;
        types[u.type.name] = u.type;
    });

    bar.table(Styles.black6, cons(c => {
        c.margin(2);
        c.button(cons(b => {
            b.left();
            b.add("[accent]" + (i + 1)).style(Styles.outlineLabel).padLeft(6).padRight(6);
            for(const name in counts){
                b.image(types[name].uiIcon).size(24);
                b.add("" + counts[name]).style(Styles.outlineLabel).padRight(6);
            }
        }), Styles.clearNoneTogglei, () => select(i)).checked(b => isSelected(i)).height(36).growX()
            .tooltip("Select group " + (i + 1) + " (double click: go to it)");
        c.row();
        c.table(cons(r => {
            r.left();
            r.defaults().size(30);
            r.button(Icon.addSmall, Styles.clearNonei, () => addTo(i)).disabled(b => !hasSelection())
                .tooltip("Add selected units to group " + (i + 1));
            r.button(Icon.cancelSmall, Styles.clearNonei, () => removeFrom(i)).disabled(b => !hasSelection())
                .tooltip("Remove selected units from group " + (i + 1));
            r.button(Icon.trashSmall, Styles.clearNonei, () => disband(i)).tooltip("Disband group " + (i + 1));
        })).growX();
    })).bottom().padRight(4);
}

function buildBar(bar){
    bar.clearChildren();
    const gs = input().controlGroups;
    for(let i = 0; i < gs.length; i++) if(gs[i] != null && !gs[i].isEmpty()) card(bar, i);

    bar.table(Styles.black6, cons(c => {
        c.margin(2);
        c.button(Icon.addSmall, Styles.clearNonei, () => newGroup()).size(36).disabled(b => !hasSelection())
            .tooltip("New group from selected units");
        c.row();
        c.button("Same speed", Styles.clearTogglet, () => {
            sameSpeed = !sameSpeed;
            Core.settings.put("umt-same-speed", sameSpeed);
        }).size(110, 30).checked(b => sameSpeed)
            .tooltip("Units commanded together move at the pace of the slowest one");
    })).bottom();
}

Events.on(ClientLoadEvent, () => {
    Vars.ui.hudGroup.fill(cons(root => {
        // not root.visible(...): in JS that name resolves to the boolean field, not the method
        root.visibility = boolp(() => Vars.ui.hudfrag.shown && (anyGroup() || Vars.control.input.commandMode));
        root.bottom().left().margin(8);

        let sig = null;
        root.table(cons(bar => {
            // rebuild only when group contents change
            bar.update(() => {
                const gs = input().controlGroups;
                let s = "";
                for(let i = 0; i < gs.length; i++) s += (gs[i] == null ? "" : gs[i].toString()) + ";";
                if(s != sig){
                    sig = s;
                    buildBar(bar);
                }
            });
        }));
    }));
});
