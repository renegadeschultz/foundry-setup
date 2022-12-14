//ItemMacro - After Active Effects
const gustOfWindTemplate = async (args) => {
    const gridSize = canvas.grid.h;
    const lineWidth = 10;
    const lineDistance = 60;
    const sourceSquare = (center, widthSquares, heightSquares) => {
        const h = gridSize * heightSquares;
        const w = gridSize * widthSquares;

        const bottom = center.y + h / 2;
        const left = center.x - w / 2;
        const top = center.y - h / 2;
        const right = center.x + w / 2;

        const rightSpots = [...new Array(heightSquares)].map((_, i) => ({
            direction: 0,
            x: right,
            y: top + gridSize / 2 + gridSize * i

        }));
        const bottomSpots = [...new Array(widthSquares)].map((_, i) => ({
            direction: 90,
            x: right - gridSize / 2 - gridSize * i,
            y: bottom
        }));
        const leftSpots = [...new Array(heightSquares)].map((_, i) => ({
            direction: 180,
            x: left,
            y: bottom - gridSize / 2 - gridSize * i
        }));
        const topSpots = [...new Array(widthSquares)].map((_, i) => ({
            direction: 270,
            x: left + gridSize / 2 + gridSize * i,
            y: top
        }));
        const allSpots = [
            ...rightSpots.slice(Math.floor(rightSpots.length / 2)),
            { direction: 45, x: right, y: bottom },
            ...bottomSpots,
            { direction: 135, x: left, y: bottom },
            ...leftSpots,
            { direction: 225, x: left, y: top },
            ...topSpots,
            { direction: 315, x: right, y: top },
            ...rightSpots.slice(0, Math.floor(rightSpots.length / 2)),
        ];

        return {
            x: left,
            y: top,
            center,
            top,
            bottom,
            left,
            right,
            h,
            w,
            heightSquares,
            widthSquares,
            allSpots,
        };
    };
    // cast from source token, if no source token, then select a square to originate the cone from.
    let square;
    if (typeof token === 'undefined') {
        const sourceConfig = {
            drawIcon: true,
            drawOutline: false,
            interval: -1,
            label: 'Ray Start',
        };

        const source = await warpgate.crosshairs.show(sourceConfig);
        if (source.cancelled) {
            return;
        }
        square = sourceSquare({ x: source.x, y: source.y }, 1, 1);
    }
    else {
        const width = Math.max(Math.round(token.document.width), 1);
        const height = Math.max(Math.round(token.document.height), 1);
        const offset = ((canvas.grid.size * (lineWidth / canvas.grid.grid.options.dimensions.distance)) / 2)
        square = sourceSquare(token.center, width, height, offset);
    }

    const templateData = {
        t: "ray",
        distance: lineDistance,
        width: lineWidth,
        fillColor: '#000000',
        angle: 0,
        ...square.allSpots[0],
        user: game.userId,
    }

    let template = (await canvas.scene.createEmbeddedDocuments('MeasuredTemplate', [templateData]))[0];

    const targetConfig = {
        drawIcon: false,
        drawOutline: false,
    }

    let currentSpotIndex = 0;
    const updateTemplateLocation = async (crosshairs) => {
        while (crosshairs.inFlight) {
            await warpgate.wait(100);

            const totalSpots = 4 + 2 * square.heightSquares + 2 * square.widthSquares;
            const radToNormalizedAngle = (rad) => {
                let angle = (rad * 180 / Math.PI) % 360;

                // offset the angle for even-sided tokens, because it's centered in the grid it's just wonky without the offset
                if (square.heightSquares % 2 === 0 && square.widthSquares % 2 === 0) {
                    angle -= (360 / totalSpots) / 2;
                }
                const normalizedAngle = Math.round(angle / (360 / totalSpots)) * (360 / totalSpots);
                return normalizedAngle < 0
                    ? normalizedAngle + 360
                    : normalizedAngle;
            }

            const ray = new Ray(square.center, crosshairs);
            const angle = radToNormalizedAngle(ray.angle);
            const spotIndex = Math.ceil(angle / 360 * totalSpots);

            if (spotIndex === currentSpotIndex) {
                continue;
            }

            currentSpotIndex = spotIndex;
            const spot = square.allSpots[currentSpotIndex];
            template = await template.update({ ...spot });

            const getCenterOfSquares = (t) => {
                const x1 = t.x + gridSize / 2;
                const y1 = t.y + gridSize / 2;
                const tokenSquaresWidth = t.document.width;
                const tokenSquaresHeight = t.document.height;
                const centers = [];
                for (let x = 0; x < tokenSquaresWidth; x++) {
                    for (let y = 0; y < tokenSquaresHeight; y++) {
                        centers.push({ id: t.id, center: { x: x1 + x * gridSize, y: y1 + y * gridSize } });
                    }
                }
                return centers;
            };
            const centers = canvas.tokens.placeables
                .map(t => t.document.width <= 4
                    ? { id: t.id, center: t.center }
                    : getCenterOfSquares(t))
                .flatMap(x => x);
            const tokenIdsToTarget = centers.filter(o => canvas.grid.getHighlightLayer('MeasuredTemplate.' + template.id).geometry.containsPoint(o.center)).map(x => x.id);
            game.user.updateTokenTargets(tokenIdsToTarget);
        }
    }

    const rotateCrosshairs = await warpgate.crosshairs.show(
        targetConfig,
        {
            show: updateTemplateLocation
        });
    if (rotateCrosshairs.cancelled) {
        await template.delete();
        game.user.updateTokenTargets();
        return;
    }

    const seq = new Sequence();
    seq.effect()
        .file('jb2a.gust_of_wind.veryfast')
        .atLocation(square.allSpots[currentSpotIndex])
        .attachTo(template)
        .fadeIn(300)
        .rotate(-square.allSpots[currentSpotIndex].direction)
        .anchor({
            x: 0,
            y: 0.5
        })
        .persist();
    tokenAttacher.attachElementToToken(canvas.templates.get(template.id), token, true);
    await seq.play();

    const onEndConcentration = async (args) => {
        if (args.label === "Concentrating" && args.parent.id === token.actor.id) {
            await template.delete();
            Hooks.off("deleteActiveEffect", onEndConcentration);
        }
    }

    Hooks.on("deleteActiveEffect", onEndConcentration);
}

// Call with caster selected after targeting a creature who should be affected
// ItemMacro - After Save
const gustOfWindPush = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    await game.macros.getName('Knockback').execute(canvas.tokens.controlled[0], workflow.failedSaves, 3);
}

// ItemMacro - Only called once a template is placed
const fogCloud = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    const spellLevel = workflow?.itemLevel ? workflow?.itemLevel : 1;

    const createHook = async (tile) => {
        if (spellLevel > 1) {
            await canvas.scene.updateEmbeddedDocuments("Tile", [{ _id: tile.id, height: tile.height * spellLevel, width: tile.width * spellLevel }]);
        }
        const flags = {
            "perfect-vision": {
                enabled: true,
                globalLight: { enabled: false },
                visionLimitation: { enabled: true, sight: 0, detection: { basicSight: 0, seeAll: 0 } }
            }
        };

        await game.macros.getName('DrawCircle').execute({
            shrink: spellLevel * 200,
            diameter: spellLevel * 40,
            x: tile.x,
            y: tile.y,
            text: tile.id,
            flags: flags
        });
        ui.notifications.info('Tiles have been setup');
    };

    Hooks.once("createTile", createHook);

    const deleteHook = async (tile) => {
        const drawing = [...canvas.scene.drawings].find(x => x.text === tile.id);
        if (drawing) {
            await canvas.scene.deleteEmbeddedDocuments("Drawing", [drawing.id]);
            Hooks.off("deleteTile", deleteHook);
        }
    }

    Hooks.on("deleteTile", deleteHook);
}

// Automated Evocation - Exact Macro Name Should be: AE_Companion_Macro(Mage Hand)
const mageHand = async (args) => {
    let { assignedActor, summon, spellLevel, duplicates } = args[0];

    const current = canvas.scene.tokens.getName(`${summon.name}(${assignedActor.name})`);

    if (current) {
        await warpgate.dismiss(current.id, canvas.scene.id);
    }

    return {
        token: {
            "name": `${summon.name}(${assignedActor.name})`
        }
    }
}

// Automated Evocation - Exact Macro Name Should be: AE_Companion_Macro(Spiritual Weapon)
const spiritualWeapon = async (args) => {
    let { assignedActor, summon, spellLevel, duplicates } = args[0];

    if (!assignedActor) {
        return;
    }

    const current = canvas.scene.tokens.getName(`${summon.name}(${assignedActor.name})`);

    if (current) {
        await warpgate.dismiss(current.id, canvas.scene.id);
    }

    // Delete spriritual weapon token when active effect is deleted
    const onEndSpell = async (args) => {
        if (args.label === summon.name && args.parent.name === assignedActor.name) {
            let token = canvas.scene.tokens.getName(`${args.label}(${args.parent.name})`)
            await warpgate.dismiss(token.id, canvas.scene.id);
            Hooks.off("deleteActiveEffect", onEndSpell);
        }
    }

    Hooks.on("deleteActiveEffect", onEndSpell);

    return {
        token: {
            "name": `${summon.name}(${assignedActor.name})`
        },
        embedded: {
            Item: {
                "Strike": {
                    "img": "icons/magic/fire/dagger-rune-enchant-flame-purple.webp",
                    "type": "weapon",
                    "system.weaponType": "natural",
                    "system.equipped": true,
                    "system.actionType": "msak",
                    "system.activation.type": 'special',
                    "system.activation.cost": 1,
                    "system.duration.units": "inst",
                    "system.range.value": 5,
                    "system.range.units": "ft",
                    "system.target.value": 1,
                    "system.target.type": "creature",
                    "system.attackBonus": assignedActor.system.attributes.prof + assignedActor.system.abilities[assignedActor.system.attributes.spellcasting].mod,
                    "system.damage.parts": [[`${Math.floor(spellLevel / 2)}d8+${assignedActor.system.abilities[assignedActor.system.attributes.spellcasting].mod}`, "force"]],
                }
            }
        }
    }
}

// ItemMacro - Call before the item is rolled
const silence = async () => {
    const createHook = async (tile) => {
        await tile.update({
            'flags.monks-active-tiles': {
                "active": true,
                "record": false,
                "restriction": "all",
                "controlled": "all",
                "trigger": "both",
                "allowpaused": false,
                "usealpha": false,
                "pointer": false,
                "pertoken": false,
                "minrequired": 0,
                "chance": 100,
                "fileindex": 0,
                "actions": [{
                    "action": "activeeffect",
                    "data": {
                        "entity": {
                            "id": "token",
                            "name": "Triggering Token"
                        },
                        "effectid": "Convenient Effect: Silence",
                        "addeffect": "toggle",
                        "altereffect": ""
                    },
                    "id": "kHnKLoozUVFMOamG"
                }],
                "files": []
            }
        });
    }

    Hooks.once("createTile", createHook);
}

// ItemMacro - Call before the item is rolled
const sleetStorm = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    const spellDC = workflow.actor.system.attributes.spelldc;
    const createHook = async (tile) => {
        await tile.update({
            'flags.monks-active-tiles': {
                "active": true,
                "record": false,
                "restriction": "all",
                "controlled": "all",
                "trigger": ["enter", "turn"],
                "allowpaused": true,
                "usealpha": true,
                "pointer": false,
                "pertoken": false,
                "minrequired": 0,
                "chance": 100,
                "fileindex": 0,
                "actions": [
                    {
                        "action": "delay",
                        "data": { "delay": "1" }, "id": "Zvn34rU955HmixUI"
                    },
                    {
                        "action": "distance",
                        "data": { "entity": "", "measure": "lt", "distance": { "value": 1, "var": "sq" }, "continue": "within" }, "id": "ikuc47nv4g8SYZsG"
                    },
                    {
                        "action": "runmacro",
                        "data": { "entity": { "id": "Macro.Rc8zqfbwRLbEjQDj", "name": "Mark Current Combatant" }, "args": "", "runasgm": "gm" }, "id": "7mIV1No36uYemwTI"
                    },
                    {
                        "action": "delay",
                        "data": { "delay": "1" }, "id": "Zun34rU955HmixUI"
                    },
                    {
                        "action": "dfreds-convenient-effects.dfreds-filter",
                        "data": { "entity": "", "effect": "Current Combatant", "filter": "yes", "continue": "any" }, "id": "d65xfgWApPZnvpxl"
                    },
                    {
                        "action": "monks-tokenbar.requestroll",
                        "data": { "entity": "", "request": "save:dex", "dc": spellDC, "flavor": "Trying to stay standing in Sleet Storm", "rollmode": "roll", "silent": true, "fastforward": true, "usetokens": "all", "continue": "always" }, "id": "pU8MP1zrzd6o77Zf"
                    },
                    {
                        "action": "monks-tokenbar.filterrequest",
                        "data": { "passed": "Concentrating", "failed": "Fallen", "resume": "" }, "id": "9bkmMa3mBGU6QIde"
                    },
                    {
                        "action": "anchor",
                        "data": { "tag": "Fallen", "stop": false }, "id": "j737yFyjKsnGof8o"
                    },
                    {
                        "action": "dfreds-convenient-effects.dfreds-add", "data": { "entity": "", "effect": "Prone", "state": "remove" }, "id": "AWCbPxjpJBSzwdwO"
                    },
                    {
                        "action": "dfreds-convenient-effects.dfreds-add", "data": { "entity": "", "effect": "Prone", "state": "add" }, "id": "wSlw3RxIQzfFcRVr"
                    },
                    {
                        "action": "anchor",
                        "data": { "tag": "Concentrating", "stop": false }, "id": "FN4ub2D8lBhwHwEK"
                    },
                    {
                        "action": "dfreds-convenient-effects.dfreds-filter",
                        "data": { "entity": "", "effect": "Concentrating", "filter": "yes", "continue": "any" }, "id": "uV3Lg7wn0r9suJxP"
                    },
                    {
                        "action": "monks-tokenbar.requestroll",
                        "data": { "entity": "", "request": "save:con", "dc": spellDC, "flavor": "Trying to maintain Concentration in Sleet Storm", "rollmode": "roll", "silent": true, "fastforward": true, "usetokens": "all", "continue": "always" }, "id": "W3ZY31C5hO8OqLBN"
                    },
                    {
                        "action": "monks-tokenbar.filterrequest",
                        "data": { "passed": "Maintain", "failed": "Broken", "resume": "" }, "id": "ysupPqT77HdoEhcI"
                    },
                    {
                        "action": "anchor",
                        "data": { "tag": "Broken", "stop": false }, "id": "4MmivFtK0vfZjaYi"
                    },
                    {
                        "action": "dfreds-convenient-effects.dfreds-add",
                        "data": { "entity": "", "effect": "Concentrating", "state": "remove" }, "id": "Co0i3MlBeyJY1vXT"
                    },
                    {
                        "action": "anchor",
                        "data": { "tag": "Maintain", "stop": false }, "id": "U08IRMKYnDzVjhYv"
                    }
                ],
                "files": []
            }
        });
    }
    Hooks.once("createTile", createHook);
}

// ItemMacro - Before Damage Roll
const destructiveWave = async (args) => {
    let item = await fromUuid(args[0].uuid);
    let damageType = await new Promise((resolve) => {
        new Dialog({
            title: item.name,
            content: `<form class="flexcol">
            <div class="form-group">
            <label for="damageSelect">Pick one:</label>
            <select id="damageSelect"><option value="necrotic">Necrotic</option><option value="radiant">Radiant</option></select>
            </div>
            </form>`,
            buttons: {
                use: {
                    label: "Select", callback: async (html) => {
                        resolve(html.find("#damageSelect")[0].value);
                    }
                }
            },
            default: "Select"
        }).render(true);
    });
    item.system.damage.parts[1][0] = `5d6[${damageType}]`;
    item.system.damage.parts[1][1] = damageType;
}

// ItemMacro - After Active Effects
const absorbElements = async (args) => {
    try {
        let tactor;
        let itemName = args[0].itemData.name;
        if (args[0].tokenUuid) tactor = (await fromUuid(args[0].tokenUuid)).actor;
        else tactor = game.actors.get(args[0].actorId);

        let dialog = new Promise((resolve, reject) => {
            new Dialog({
                title: 'Choose a damage type',
                content: `
            <form class="flexcol">
              <div class="form-group">
                <select id="element">
                  <option value="acid">Acid</option>
                  <option value="cold">Cold</option>
                  <option value="fire">Fire</option>
                  <option value="lightning">Lightning</option>
                  <option value="thunder">Thunder</option>
                </select>
              </div>
            </form>
          `,
                //select element type
                buttons: {
                    yes: {
                        icon: '<i class="fas fa-bolt"></i>',
                        label: 'Select',
                        callback: async (html) => {
                            let element = html.find('#element').val();
                            let effect = tactor.effects.find(i => i.label === itemName);
                            let changes = duplicate(effect.changes);
                            changes[0].value = `${args[0].spellLevel}d6[${element}]`;
                            changes[1].value = `${args[0].spellLevel}d6[${element}]`;
                            await effect.update({ changes });
                            effect = tactor.effects.find(i => i.label === `${itemName} Resistance`);
                            changes = duplicate(effect.changes);
                            changes[0].value = element;
                            await effect.update({ changes });

                            const casterToken = await fromUuid(args[0].tokenUuid);
                            let color = 'blue';
                            if (element === 'acid') {
                                color = 'green'
                            }
                            else if (element === 'fire') {
                                color = 'red'
                            }
                            else if (element === 'lightning') {
                                color = 'purple'
                            }
                            else if (element === 'thunder') {
                                color = 'yellow'
                            }

                            new Sequence()
                                .effect()
                                .file("jb2a.extras.tmfx.runes.circle.inpulse.abjuration")
                                .atLocation(casterToken)
                                .duration(4500)
                                .fadeIn(500)
                                .fadeOut(500)
                                .scaleToObject(2)
                                .opacity(0.3)
                                .filter("Glow", { color: 0xffffff })
                                .scaleIn(0, 500, { ease: "easeOutCubic", delay: 100 })
                                .effect()
                                .file("jb2a.extras.tmfx.border.circle.inpulse.02.normal")
                                .fadeIn(500)
                                .fadeOut(500)
                                .duration(4500)
                                .scaleToObject(2)
                                .atLocation(casterToken)
                                .belowTokens()
                                .effect()
                                .file(`jb2a.shield.01.outro_explode.${color}`)
                                .fadeIn(500)
                                .fadeOut(100)
                                .atLocation(casterToken)
                                .waitUntilFinished(-500)
                                .scaleToObject(2)
                                .play();
                            resolve();
                        },
                    },
                }
            }).render(true);
        })
        await dialog;
    } catch (err) {
        console.error(`${itemName} - Absorb Elements`, err);
    }
}

// ItemMacro - Called before the item is rolled
const heroism = (args) => {
    const onEndHeroism = async (args) => {
        if (args.label === "Heroism") {
            args.parent.system.attributes.hp.temp = null;
            Hooks.off("deleteActiveEffect", onEndHeroism);
        }
    }

    Hooks.on("deleteActiveEffect", onEndHeroism);
}

// ItemMacro - After Active Effects
const protectionFromEvilAndGood = (args) => {
    const ontargeting = async (args) => {
        try {
            // Check for targets
            if (args.targets.size < 1) return;

            if (!["mwak", "rwak", "msak", "rsak"].includes(args.item.system.actionType)) return {};

            let tActor = Array.from(args.targets)[0].actor;

            // If target has PFEG effect and the attacker is one of the specified types, make attack at disadvantage
            if (tActor.effects.contents.find(el => el.label == "Protection from Evil and Good" && !el.isSuppressed)) {
                let aActor = args.actor;
                if (aActor.type != "character" && ["aberration", "celestial", "elemental", "fey", "fiend", "undead"].includes(aActor.system.details.type.value)) {
                    args.disadvantage = true;
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Clean up hooks when spell ends
    const onEndPFEG = async (args) => {
        if (args.label === "Protection from Evil and Good") {
            console.log("Ending Effect");
            Hooks.off("midi-qol.preambleComplete", ontargeting);
            Hooks.off("deleteActiveEffect", onEndPFEG);
        }
    }

    Hooks.on("midi-qol.preambleComplete", ontargeting);
    Hooks.on("deleteActiveEffect", onEndPFEG);

}


// Item Macro - After Active Effects
// Setup - Remove Damage Formula and add Other Formula as 1d4+1
const magicMissile = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    let targets = [...workflow.targets]
    let mmCount = 2 + workflow.itemLevel;
    let targetRows = "";
    targets.forEach((target, index) => {
        const targetName = target.document.name;
        let row = `<tr>
                        <td>
                            <label for="target${index}">
                                ${targetName}
                            </label>
                        </td>
                        <td><input type="number" id="target${index}" />
                        </td>
                    </tr>`
        targetRows = `${targetRows}${row}`;
    })
    let totalCount = 0;
    let warning = "";
    let targetingData;
    while (totalCount != mmCount) {
        targetingData = await new Promise((resolve) => {
            new Dialog({
                title: "Magic Missile Targeting",
                content: `<p  style="color:red">${warning}</p>
            <p>You have <strong>${mmCount}</strong> Magic Missiles</p>
            <table>
                <form>
                    ${targetRows}
                </form>
            </table>`,
                buttons: {
                    smite: {
                        label: "Fire!",
                        callback: (html) => {
                            let targetting = targets.map((_, index) => {
                                let count = parseInt(html.find(`#target${index}`)[0].value);
                                return isNaN(count) ? 0 : count;
                            })
                            resolve(targetting);
                        }
                    }
                },
                default: "Fire!",
                close: () => { resolve(false); }
            }).render(true);
        });
        totalCount = 0;
        totalCount = targetingData.reduce(
            (previousValue, currentValue) => previousValue + currentValue,
            totalCount
        );
        if (totalCount !== mmCount) {
            warning = "Incorrect Missile Total!"
        }
    }
    await targets.forEach(async (target, index) => {
        let targetIsShielded = target.actor.effects.contents.find(el => el.label == "Shield" && !el.isSuppressed);
        let amountOnTarget = targetingData[index];
        new Sequence()
            .effect()
            .atLocation(workflow.token)
            .stretchTo(target)
            .file("jb2a.magic_missile")
            .repeats(amountOnTarget, 200, 300)
            .randomizeMirrorY()
            .play();
        for (let i = 0; i < amountOnTarget; i++) {
            let roll = new Roll(!targetIsShielded ? workflow.item.system.formula : "0");
            let damageTotal = await roll.roll().total;
            await new MidiQOL.DamageOnlyWorkflow(
                workflow.actor,
                workflow.token,
                damageTotal,
                "force",
                [target],
                roll,
                { flavor: `Magic Missile fired at ${target.document.name}${targetIsShielded ? " is block by Shield" : ""}!` }
            );
        }
    });
}

// ItemMacro - After Active Effects
const mirrorImage = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    let effect = workflow.actor.effects.contents.find(el => el.sourceName == "Mirror Image");

    const updateStacks = async (effect, stacks) => {
        await effect.setFlag("dae", "stacks", stacks);
        await effect.update({ label: `Mirror Image (${stacks})` });
    }

    const ontargeting = async (args) => {
        try {
            // Check for targets
            if (args.targets.size < 1) return;

            if (!["mwak", "rwak", "msak", "rsak"].includes(args.item.system.actionType)) return {};

            // Ignore Mirror Image if attacker is not relying on normal vision for attack
            let tActor = Array.from(args.targets)[0].actor;
            const cornerAdjust = 0.70710678118654750;
            const distanceToTarget = new Ray(args.token, Array.from(args.targets)[0]).distance;
            const approxFtToTarget = Math.floor(distanceToTarget * cornerAdjust / canvas.grid.size) * canvas.grid.grid.options.dimensions.distance;
            if (args.actor.system.attributes.senses.blindsight >= approxFtToTarget
                || args.actor.system.attributes.senses.tremorsense >= approxFtToTarget
                || args.actor.system.attributes.senses.truesight >= approxFtToTarget
                || args.actor.effects.contents.find(el => el.label == "Blinded")) {
                await ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor: tActor }),
                    rollMode: game.settings.get('core', 'rollMode'),
                    flavor: "Mirror Image Result",
                    content: "Attacker Does not rely on sight! Mirror Image has no effect!"
                });
                console.log("Attacker Does not rely on sight! Mirror Image has no effect!")
                return;
            }

            let effect = tActor.effects.contents.find(el => el.sourceName == "Mirror Image");
            if (effect) {
                let stacks = effect.flags.dae.stacks;
                let roll = await new Roll("1d20").roll();
                await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: tActor }), flavor: "Mirror Image" });
                if (stacks === 3) {
                    if (roll.total >= 6) {
                        await ChatMessage.create({
                            speaker: ChatMessage.getSpeaker({ actor: tActor }),
                            rollMode: game.settings.get('core', 'rollMode'),
                            flavor: "Mirror Image Result",
                            content: "Mirror Image Blocks Attack! 2 Mirror Images Left"
                        });
                        await updateStacks(effect, 2);
                        return false;
                    }
                }
                else if (stacks === 2) {
                    if (roll.total >= 8) {
                        await ChatMessage.create({
                            speaker: ChatMessage.getSpeaker({ actor: tActor }),
                            rollMode: game.settings.get('core', 'rollMode'),
                            flavor: "Mirror Image Result",
                            content: "Mirror Image Blocks Attack! 1 Mirror Image Left"
                        });
                        await updateStacks(effect, 1);
                        return false;
                    }
                }
                else if (stacks === 1) {
                    if (roll.total >= 11) {
                        await ChatMessage.create({
                            speaker: ChatMessage.getSpeaker({ actor: tActor }),
                            rollMode: game.settings.get('core', 'rollMode'),
                            flavor: "Mirror Image Result",
                            content: "Mirror Image Blocks Attack! Mirror Image Spell expended"
                        });
                        await effect.delete();
                        return false;
                    }
                }
                await ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor: tActor }),
                    rollMode: game.settings.get('core', 'rollMode'),
                    flavor: "Mirror Image Result",
                    content: "Mirror Image Fails to Block Attack!"
                });
            }
        } catch (err) {
            console.error(err);
        }
    }

    await updateStacks(effect, 3);

    // Clean up hooks when spell ends
    const onEndMirrorImage = async (args) => {
        if (args.sourceName === "Mirror Image") {
            console.log("Ending Effect");
            Hooks.off("midi-qol.preambleComplete", ontargeting);
            Hooks.off("deleteActiveEffect", onEndMirrorImage);
        }
    }

    Hooks.on("midi-qol.preambleComplete", ontargeting);
    Hooks.on("deleteActiveEffect", onEndMirrorImage);
}

// ItemMacro - Call before the item is rolled
const spikeGrowth = async () => {
    const createHook = async (tile) => {
        await tile.update({
            'flags.monks-active-tiles': {
                "active": true,
                "record": false,
                "restriction": "all",
                "controlled": "all",
                "trigger": "movement",
                "allowpaused": false,
                "usealpha": false,
                "pointer": false,
                "pertoken": false,
                "minrequired": 0,
                "chance": 100,
                "fileindex": 1,
                "actions": [{
                    "action": "hurtheal",
                    "data": {
                        "entity": {
                            "id": "token",
                            "name": "Triggering Token"
                        },
                        "value": "-[[2d4[piercing]]]",
                        "chatMessage": true,
                        "rollmode": "roll"
                    },
                    "id": "Ks75oFdvOXxuSExG"
                }],
                "files": []
            }
        });
    }

    Hooks.once("createTile", createHook);
}

// ItemMacro - After Active Effects
const sleep = (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    let sleepHp = workflow.damageTotal;
    const targets = Array.from(workflow.targets).sort((a, b) => {
        let aHealth = a.actor.system.attributes.hp.value + a.actor.system.attributes.hp.temp;
        let bHealth = b.actor.system.attributes.hp.value + b.actor.system.attributes.hp.temp;
        if (aHealth < bHealth) {
            return -1;
        }
        if (aHealth > bHealth) {
            return 1;
        }
        return 0;
    });
    targets.forEach(target => {
        if (target.actor.system.details.type?.value !== "undead" && !target.actor.system.traits.ci.value.includes("charmed")) {
            let targetHp = target.actor.system.attributes.hp.value + target.actor.system.attributes.hp.temp;
            sleepHp -= targetHp;
            if (sleepHp >= 0) {
                game.dfreds.effectInterface.addEffect({ effectName: 'Unconscious', uuid: target.actor.uuid });
            }
        }
    })
}

// ItemMacro - Call before the item is rolled
const web = (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    const spellDC = workflow.actor.system.attributes.spelldc;
    const createHook = async (tile) => {
        console.log(tile);
        await tile.update({
            'flags.monks-active-tiles': {
                "active": true,
                "record": false,
                "restriction": "all",
                "controlled": "all",
                "trigger": ["enter", "turn"],
                "allowpaused": true,
                "usealpha": false,
                "pointer": false,
                "pertoken": false,
                "minrequired": 0,
                "chance": 100,
                "fileindex": 0,
                "actions": [
                    {
                        "action": "distance",
                        "data": { "entity": "", "measure": "lt", "distance": { "value": 1, "var": "sq" }, "continue": "within" }, "id": "4RKrMZiLnv16EtBy"
                    },
                    {
                        "action": "runmacro",
                        "data": { "entity": { "id": "Macro.Rc8zqfbwRLbEjQDj", "name": "Mark Current Combatant" }, "args": "", "runasgm": "gm" }, "id": "cTITAwaPHuvkjNZO"
                    },
                    {
                        "action": "delay",
                        "data": { "delay": "1" }, "id": "ju95WxkcXRbvVxV3"
                    },
                    {
                        "action": "dfreds-convenient-effects.dfreds-filter",
                        "data": { "entity": "", "effect": "Current Combatant", "filter": "yes", "continue": "any" }, "id": "rtmzeJ8Cb7efyCSR"
                    },
                    {
                        "action": "dfreds-convenient-effects.dfreds-filter",
                        "data": { "entity": "", "effect": "Restrained", "filter": "no", "continue": "any" }, "id": "Emgl225z9d8B5ukJ"
                    },
                    {
                        "action": "monks-tokenbar.requestroll",
                        "data": { "entity": "", "request": "save:dex", "dc": spellDC, "flavor": "Trying to move through Web", "rollmode": "roll", "silent": true, "fastforward": true, "usetokens": "fail", "continue": "failed" }, "id": "uO5ZNvVsrnvlqW5c"
                    },
                    {
                        "action": "dfreds-convenient-effects.dfreds-add",
                        "data": { "entity": "", "effect": "Restrained", "state": "add" }, "id": "C7aDm1ZYaYb29TBd"
                    }
                ],
                "files": []
            }
        });
    }

    Hooks.once("createTile", createHook);
}

// ItemMacro - Call before the item is rolled
const zephyrStrike = () => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    const zephyrStrikeDamageBonus = async (args) => {
        let damageRoll = await new Roll(`${args.isCritical ? 2 : 1}d8`).roll();
        new MidiQOL.DamageOnlyWorkflow(args.actor, args.token, damageRoll.total, "force", Array.from(args.hitTargets), damageRoll, { flavor: "Zephyr Strike - Damage Roll (Force)", itemCardId: args.itemCardId })
    }

    const checkHit = async (args) => {
        if (args.hitTargets.size) {
            Hooks.once("midi-qol.preDamageRoll", zephyrStrikeDamageBonus);
        }
    }

    const optionalZephyrStrike = async (args) => {
        let effect = args.actor.effects.contents.find(el => el.label == "Zephyr Strike");
        if (effect) {
            let option = await new Promise((resolve) => {
                new Dialog({
                    title: "Use Zephyr Strike?",
                    buttons: {
                        yes: {
                            label: "Yes",
                            callback: () => { resolve(true); }
                        },
                        no: {
                            label: "No",
                            callback: () => { resolve(false); }
                        }
                    },
                    close: () => { resolve(false); }
                }).render(true);
            });

            if (!option) {
                return;
            }
            args.advantage = true;
            let effectData = game.dfreds.effectInterface.findEffectByName('Double Speed').convertToObject();
            effectData.turns = 1;
            game.dfreds.effectInterface.addEffectWith({ effectData, uuid: args.actor.uuid });
            Hooks.once("midi-qol.AttackRollComplete", checkHit);
            Hooks.off("midi-qol.preAttackRoll", optionalZephyrStrike);
            Hooks.off("deleteActiveEffect", onEndSpell);
        }
    }

    // Clean up hooks if concentration is lost before Attack is made
    const onEndSpell = async (args) => {
        if (args.label === "Zephyr Strike" && args.parent.name === workflow.actor.name) {
            console.log("deleting Zephyr Strike Hook")
            Hooks.off("midi-qol.preAttackRoll", optionalZephyrStrike);
            Hooks.off("deleteActiveEffect", onEndSpell);
        }
    }

    Hooks.on("deleteActiveEffect", onEndSpell);
    Hooks.on("midi-qol.preAttackRoll", optionalZephyrStrike);
}

// Automated Evocation - Exact Macro Name Should be: AE_Companion_Macro(Summon Beast)
const summonBeast = async (args) => {
    let { assignedActor, summon, spellLevel, duplicates } = args[0];

    let option = await new Promise((resolve) => {
        new Dialog({
            title: "Spirit Type",
            buttons: {
                land: {
                    label: "Land",
                    callback: () => { resolve("Land"); }
                },
                air: {
                    label: "Air",
                    callback: () => { resolve("Air"); }
                },
                water: {
                    label: "Water",
                    callback: () => { resolve("Water"); }
                }
            },
            close: () => { resolve(false); }
        }).render(true);
    });

    if (!option) {
        option = "Land";
    }

    // Delete bestial spirit token when active effect is deleted
    const onEndSpell = async (args) => {
        if (args.label === summon.name && args.parent.name === assignedActor.name) {
            let token = canvas.scene.tokens.getName(`${args.label}(${option})(${args.parent.name})`)
            await warpgate.dismiss(token.id, canvas.scene.id);
            Hooks.off("deleteActiveEffect", onEndSpell);
        }
    }

    Hooks.on("deleteActiveEffect", onEndSpell);
    console.log(summon);
    return {
        token: {
            "name": `${summon.name}(${option})(${assignedActor.name})`
        },
        actor: {
            "name": `${summon.name}(${option})`,
            "system": {
                "attributes": {
                    "ac": {
                        "flat": summon.system.attributes.ac.flat + spellLevel
                    },
                    "hp": {
                        "max": summon.system.attributes.hp.max + (option !== "Air" ? 10 : 0) + ((spellLevel - 2) * 5),
                        "value": summon.system.attributes.hp.max + (option !== "Air" ? 10 : 0) + ((spellLevel - 2) * 5)
                    },
                    "movement": {
                        "climb": option === "Land" ? 30 : 0,
                        "fly": option === "Air" ? 60 : 0,
                        "swim": option === "Water" ? 30 : 0,
                    }
                }
            }
        },
        embedded: {
            Item: {
                "Maul": {
                    "system.attackBonus": assignedActor.system.attributes.prof + assignedActor.system.abilities[assignedActor.system.attributes.spellcasting].mod - 2,
                    "system.damage.parts": [[`1d8+4+${spellLevel}`, "piercing"]],
                },
                "Multiattack": {
                    "system.description.value": `The beast makes ${Math.floor(spellLevel / 2)}  Maul attacks`,
                }
            }
        }
    }
}


// ItemMacro - Call before the item is rolled
const sanctuary = () => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);

    const canAttack = async (args) => {
        try {
            // Check for targets
            if (args.targets.size < 1) return;

            if (!["creature", "enemy", ""].includes(args.item.system.target.type)) {
                return;
            }

            let targets = Array.from(args.targets);
            let canAttack = true;

            await Promise.all(targets.map(async (target) => {
                if (target.actor.effects.contents.find(el => el.label == "Sanctuary" && el.origin === workflow.item.uuid)) {
                    let save = await new Roll(`1d20 + ${args.actor.system.abilities.wis.save} + ${args.actor.system.abilities.wis.saveBonus}`).roll();
                    await save.toMessage({ speaker: ChatMessage.getSpeaker({ actor: args.actor }), flavor: `Save against Sanctuary` });
                    if (save.total < workflow.actor.system.attributes.spelldc) {
                        canAttack = false;
                    }
                }
            }));
            if (!canAttack) {
                ui.notifications.warn(`Can't attack target with Sanctuary!`);
            }
            return canAttack;
        } catch (err) {
            console.log(err)
            Hooks.off("midi-qol.preItemRoll", canAttack);
            Hooks.off("deleteActiveEffect", onEndSpell);
        }
    }

    // Clean up hooks if concentration is lost before Attack is made
    const onEndSpell = async (args) => {
        console.log(args.origin, workflow.item.uuid);
        if (args.label === "Sanctuary" && args.origin === workflow.item.uuid) {
            console.log("deleting Sancuary Hook")
            Hooks.off("midi-qol.preItemRoll", canAttack);
            Hooks.off("deleteActiveEffect", onEndSpell);
        }
    }

    Hooks.on("deleteActiveEffect", onEndSpell);
    Hooks.on("midi-qol.preItemRoll", canAttack);
}

// ItemMacro - Call before the item is rolled
const hailOfThorns = () => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);

    const addThornBurst = async (args) => {
        try {
            // Check for targets
            if (args.targets.size < 1) return;

            if (args.item.system.actionType !== "rwak") return;

            if (!args.actor.effects.contents.find(el => el.label == "Hail of Thorns" && el.origin === workflow.item.uuid)) return;

            const [t] = args.hitTargets;
            let targets = [...MidiQOL.findNearby(null, t, 5), t];
            let saves = [];
            await Promise.all(targets.map(async (target) => {
                const saveDC = workflow.actor.system.attributes.spelldc;
                let save = await new Roll(`1d20 + ${target.actor.system.abilities.dex.save} + ${target.actor.system.abilities.dex.saveBonus}`).roll();
                const saved = save.total >= saveDC;
                await save.toMessage({ speaker: ChatMessage.getSpeaker({ actor: target.actor }), flavor: `Save Hail of Thorns ${saved ? 'succeeded' : 'failed'}` });
                if (saved) {
                    saves.push(target);
                }
            }));
            let damage = await new Roll(`${workflow.itemLevel}d10`).roll();
            await damage.toMessage({ speaker: ChatMessage.getSpeaker({ actor: args.actor }), flavor: `Hail of Thorns Damage` });
            await MidiQOL.applyTokenDamage(
                [{ type: "piercing", damage: damage.total }],
                damage.total,
                new Set(targets),
                args.item,
                new Set(saves),
                { workflow: args });

            new Sequence()
                .effect()
                .file('jb2a.explosion.shrapnel.bomb.01.green')
                .scaleToObject(4)
                .attachTo(t)
                .play();

            game.dfreds.effectInterface.removeEffect({ effectName: 'Concentrating', uuid: workflow.actor.uuid });
            Hooks.off("midi-qol.preDamageRoll", addThornBurst);
            Hooks.off("deleteActiveEffect", onEndSpell);
        } catch (err) {
            console.log(err)
            Hooks.off("midi-qol.preDamageRoll", addThornBurst);
            Hooks.off("deleteActiveEffect", onEndSpell);
        }
    }

    // Clean up hooks if concentration is lost before an attack hits
    const onEndSpell = async (args) => {
        console.log(args.origin, workflow.item.uuid);
        if (args.label === "Hail of Thorns" && args.origin === workflow.item.uuid) {
            console.log("deleting Hail of Thorns Hook")
            Hooks.off("midi-qol.preDamageRoll", addThornBurst);
            Hooks.off("deleteActiveEffect", onEndSpell);
        }
    }

    Hooks.on("deleteActiveEffect", onEndSpell);
    Hooks.on("midi-qol.preDamageRoll", addThornBurst);
}

// Automated Evocation - Exact Macro Name Should be: AE_Companion_Macro(Dancing Lights)
const dancingLights = async (args) => {
    let { assignedActor, summon, spellLevel, duplicates } = args[0];
    console.log("Here");
    for (let i = 1; i <= 4; i++) {
        const current = canvas.scene.tokens.getName(`${summon.name}(${assignedActor.name})`);

        if (current) {
            await warpgate.dismiss(current.id, canvas.scene.id);
        }
    }

    // Delete dancing light token when active effect is deleted
    const onEndSpell = async (args) => {
        if (args.label === summon.name && args.parent.name === assignedActor.name) {
            for (let i = 1; i <= 4; i++) {
                const current = canvas.scene.tokens.getName(`${args.label}(${args.parent.name})`);

                if (current) {
                    await warpgate.dismiss(current.id, canvas.scene.id);
                }
            }
            Hooks.off("deleteActiveEffect", onEndSpell);
        }
    }

    Hooks.on("deleteActiveEffect", onEndSpell);

    return {
        token: {
            "name": `${summon.name}(${assignedActor.name})`
        }
    }
}

// Automated Evocation - Exact Macro Name Should be: AE_Companion_Macro(Bestial Spirit)
const summonLightSpirit = async (args) => {
    let { assignedActor, summon, spellLevel, duplicates } = args[0];

    let option = await new Promise((resolve) => {
        new Dialog({
            title: "Spirit Type",
            buttons: {
                courage: {
                    label: "Courage",
                    callback: () => { resolve("Courage"); }
                },
                hope: {
                    label: "Hope",
                    callback: () => { resolve("Hope"); }
                },
                peace: {
                    label: "Peace",
                    callback: () => { resolve("Peace"); }
                }
            },
            close: () => { resolve(false); }
        }).render(true);
    });

    if (!option) {
        option = "Courage";
    }

    // Delete light spirit token when active effect is deleted
    const onEndSpell = async (args) => {
        if (args.label === summon.name && args.parent.name === assignedActor.name) {
            let token = canvas.scene.tokens.getName(`${args.label}(${option})(${args.parent.name})`)
            await warpgate.dismiss(token.id, canvas.scene.id);
            Hooks.off("deleteActiveEffect", onEndSpell);
        }
    }

    Hooks.on("deleteActiveEffect", onEndSpell);

    let lightColor;
    if (option === "Courage") {
        lightColor = "#ff9548"
    }
    else if (option === "Hope") {
        lightColor = "#fafae5"
    }
    else if (option === "Peace") {
        lightColor = "#6dffff";
    }

    return {
        token: {
            "name": `${summon.name}(${option})(${assignedActor.name})`,
            "light.color": lightColor,
            "texture.src": summon.prototypeToken.texture.src.replace("*", option)
        },
        actor: {
            "name": `${summon.name}(${option})`,
            "img": summon.img.replace("Courage", option),
            "system": {
                "attributes": {
                    "ac": {
                        "flat": summon.system.attributes.ac.flat + spellLevel
                    },
                    "hp": {
                        "max": summon.system.attributes.hp.max + ((spellLevel - 3) * 10) + assignedActor.system.abilities[assignedActor.system.attributes.spellcasting].mod,
                        "value": summon.system.attributes.hp.max + ((spellLevel - 3) * 10) + assignedActor.system.abilities[assignedActor.system.attributes.spellcasting].mod
                    }
                }
            }
        },
        embedded: {
            Item: {
                "Searing Radiance": {
                    "system.damage.parts": [[`1d8+3+${spellLevel}`, option === "Courage" ? "fire" : "radiant"]],
                },
                "Multiattack": {
                    "system.description.value": `The light spirit makes ${Math.floor(spellLevel / 2)}  Searing Radiance attacks`,
                },
                "Peaceful Aura(Peace Only)": option !== "Peace" ? warpgate.CONST.DELETE : {
                    "name": "Peaceful Aura",
                    "system.save.dc": assignedActor.system.attributes.spelldc
                },
                "Candle of Hope(Hope Only)": option !== "Hope" ? warpgate.CONST.DELETE : {
                    "name": "Candle of Hope"
                },
                "Fire Within(Courage Only)": option !== "Courage" ? warpgate.CONST.DELETE : {
                    "name": "Fire Within"
                }
            }
        }
    }
}

// Passive effect flags.midi-qol.onUseMacroName CUSTOM Candle of Hope,postActiveEffects
const lightSpritCandleOfHope = async (args) => {
    console.log("candle of hope", args)
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    if (workflow.damageDetail.find(i => ["healing"].includes(i.type))) {
        workflow.damageList.forEach(async target => {
            if (target.oldHP === 0) {
                let curTarget = [...workflow.targets].find(t => t.document.uuid === target.tokenUuid);
                if (curTarget.actor.effects.contents.find(el => el.label == "Candle of Hope")) {
                    await new Roll(`${workflow.damageRoll._formula}${workflow.bonusDamageRoll ? ` + ${workflow.bonusDamageRoll._formula}` : ""}`).evaluate({ maximize: true });
                    let bonusHeal = maxHeal.total - target.totalDamage;
                    await ChatMessage.create({
                        speaker: ChatMessage.getSpeaker({ actor: curTarget.actor }),
                        rollMode: game.settings.get('core', 'rollMode'),
                        flavor: "Candle of Hope Bonus Healing",
                        content: `${bonusHeal} extra healing`
                    });
                    await MidiQOL.applyTokenDamage(
                        [{ type: "healing", damage: bonusHeal }],
                        bonusHeal,
                        new Set([curTarget]),
                        workflow.item,
                        new Set(),
                        { workflow: workflow });
                }
            }
        })
    }
}

// Passive effect flags.midi-qol.onUseMacroName CUSTOM Candle of Hope,preItemRoll
const lightSpritPeacefulAura = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    if (workflow.item.system.damage.parts.length > 0 && workflow.item.system.damage.parts.find(d => !["healing", "midi-none", "temphp", ""].includes(d[1]))) {
        let peacefulAuraEffect = workflow.token.document.actorData.effects.find(el => el.label === "Peaceful Aura Immunity")
        if (!peacefulAuraEffect) {
            let saveDC = 15; // Update this to summoner's saveDC
            let save = await new Roll(`1d20 + ${workflow.actor.system.abilities.wis.save} + ${workflow.actor.system.abilities.wis.saveBonus}`).roll();
            await save.toMessage({ speaker: ChatMessage.getSpeaker({ actor: workflow.actor }), flavor: `Save against Peaceful Aura ${save.total < saveDC ? 'failed' : 'succeeded'}` });
            if (save.total < saveDC) {
                ui.notifications.info(`Peaceful Aura prevents ${workflow.actor.name} from attacking`);
                return false;
            }
            else {
                const effectData = {
                    name: "Peaceful Aura Immunity"
                }
                await game.dfreds.effectInterface.addEffectWith({ effectData, uuid: workflow.actor.uuid });
            }
        }
    }
}

// ItemMacro preCheckHist, DamageBonus, and postActiveEffects
const greenFlameBlade = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    const filteredWeapons = workflow.actor.items
        .filter((i) => i.type === "weapon" && i.system.actionType === "mwak");
    const weapons = (filteredWeapons.length > 0)
        ? filteredWeapons
        : workflow.actor.itemTypes.weapon;

    const weapon_content = weapons.map((w) => `<option value=${w.id}>${w.name}</option>`).join("");
    console.log(args[0].macroPass)
    if (args[0].macroPass === "preCheckHits") {
        const content = `
                <div class="form-group">
                <label>Weapons : </label>
                <select name="weapons">
                ${weapon_content}
                </select>
                </div>
                `;

        await new Promise((resolve) => {
            new Dialog({
                title: "Choose a weapon",
                content,
                buttons: {
                    Ok: {
                        label: "Ok",
                        callback: async (html) => {
                            const itemId = html.find("[name=weapons]")[0].value;
                            const weaponItem = actor.getEmbeddedDocument("Item", itemId);
                            workflow.weaponItem = weaponItem;
                            await ChatMessage.create({
                                content: weaponItem.name + " is empowered by Green Flame Blade",
                            });
                            let ability = weaponItem.system.ability && weaponItem.system.ability !== "" ? weaponItem.system.ability : "str";
                            let attackRollParts = workflow.attackRoll.formula.split(" ");
                            attackRollParts[attackRollParts.length - 3] = workflow.actor.system.abilities[ability].mod;
                            attackRollParts = attackRollParts.filter(part => part !== '-');
                            let attackRoll = await new Roll(`${attackRollParts.join(" ")}`).roll();
                            workflow.attackRoll = attackRoll;
                            workflow.attackTotal = attackRoll.total;
                            workflow.attackRollHTML = await workflow.attackRoll.render();
                            workflow.isCritical = attackRoll.result[0] === "2";
                            workflow.isFumble = attackRoll.result[0] === "1" && attackRoll.result[1] === " ";
                            resolve()
                        },
                    },
                    Cancel: {
                        label: `Cancel`,
                        callback: () => { resolve(false); }
                    },
                },
                close: () => { resolve(false); }
            }).render(true)
        });

    }

    if (args[0].macroPass === "DamageBonus") {
        let weaponItem = workflow.weaponItem;
        let ability = weaponItem.system.ability && weaponItem.system.ability !== "" ? weaponItem.system.ability : "str";
        let mod = workflow.actor.system.abilities[ability].mod;
        let formula = workflow.isVersatile ? weaponItem.system.damage.versatile : weaponItem.system.damage.parts[0][0];
        let damageRoll = new Roll(formula.replace("@mod", mod));
        if(workflow.isCritical){
            damageRoll.alter(2)
        }
        await damageRoll.roll();
        await damageRoll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: workflow.actor }), flavor: `${weaponItem.name} damage` });
        return { damageRoll: damageRoll.total, flavor: `Weapon Damage` };
    }

    if (args[0].macroPass === "postActiveEffects") {
        let [target] = workflow.hitTargets;
        let nextTo = MidiQOL.findNearby(1, target, 5);
        if (nextTo.length > 0) {
            const target_content = nextTo.map((w, index) => `<option value=${index}>${w.name}</option>`).join("");
            console.log(args[0].macroPass)
            const content = `
                <div class="form-group">
                <label>Targets : </label>
                <select name="targets">
                ${target_content}
                </select>
                </div>
                `;
            await new Promise((resolve) => {
                new Dialog({
                    title: "Choose a secondary target",
                    content,
                    buttons: {
                        Ok: {
                            label: "Ok",
                            callback: async (html) => {
                                const index = html.find("[name=targets]")[0].value;
                                const targetToken = nextTo[index];
                                const mod = workflow.actor.system.abilities[workflow.actor.system.attributes.spellcasting].mod;
                                let flameDamage = await new Roll(`${workflow.damageRoll._formula} + ${mod}`).roll();
                                await ChatMessage.create({
                                    speaker: ChatMessage.getSpeaker({ actor: targetToken.actor }),
                                    rollMode: game.settings.get('core', 'rollMode'),
                                    flavor: "Green Flame leaps to deal damage to second target",
                                    content: `${flameDamage.total} fire damage`
                                });
                                await MidiQOL.applyTokenDamage(
                                    [{ type: "fire", damage: flameDamage.total }],
                                    flameDamage.total,
                                    new Set([targetToken]),
                                    workflow.item,
                                    new Set(), { workflow:workflow});
                                new Sequence()
                                    .effect()
                                    .atLocation(target)
                                    .stretchTo(targetToken)
                                    .file("jb2a.fire_bolt.green02.05ft")
                                    .play();
                                resolve();
                            },
                        },
                        Cancel: {
                            label: `Cancel`,
                            callback: () => { resolve(false); }
                        },
                    },
                    close: () => { resolve(false); }
                }).render(true)
            });
        }
    }
}

// ItemMacro After Active Effects.
const dawnBlade = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    const spellLevel = workflow.itemLevel;
    if (workflow.itemLevel && workflow.itemLevel > 2) {
        const dawnBlade = actor.items.find((i) => i.type === "weapon" && i.name === "Dawn Blade");
        let weaponCopy = duplicate(dawnBlade);
        const extraDamageDice = Math.floor((spellLevel - 1) / 2);
        weaponCopy.system.damage.parts[0][0] = `${Math.min(extraDamageDice + 2, 5)}d8`;
        weaponCopy.system.description.value = weaponCopy.system.description.value.replace(
            "the caster can see 5ft through magical darkness",
            `the caster can see ${(extraDamageDice * 5) + 5}ft through magical darkness`
        ).replace("It deals 2d8 psychic damage", `It deals ${weaponCopy.system.damage.parts[0][0]} psychic damage`);
        await actor.updateEmbeddedDocuments("Item", [weaponCopy]);
    }
}

// ItemMacro After Active Effects.
const shadowBlade = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    const spellLevel = workflow.itemLevel;
    if (workflow.itemLevel && workflow.itemLevel > 2) {
        const shadowBlade = actor.items.find((i) => i.type === "weapon" && i.name === "Shadow Blade");
        let weaponCopy = duplicate(shadowBlade);
        const extraDamageDice = Math.floor((spellLevel - 1) / 2);
        weaponCopy.system.damage.parts[0][0] = `${Math.min(extraDamageDice + 2, 5)}d8`;
        weaponCopy.system.description.value = weaponCopy.system.description.value.replace("It deals 2d8 psychic damage", `It deals ${weaponCopy.system.damage.parts[0][0]} psychic damage`);
        await actor.updateEmbeddedDocuments("Item", [weaponCopy]);
    }
}

// ItemMacro - After Active Effects
const borrowedKnowledge = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    const nonProfSkills = Object.keys(workflow.actor.system.skills).filter(s => workflow.actor.system.skills[s].proficient === 0);
    console.log(nonProfSkills);
    const skill_content = nonProfSkills.map((s) => `<option value=${s}>${CONFIG.DND5E.skills[s].label}</option>`).join("");
    const content = `
                <div class="form-group">
                <label>Skills : </label>
                <select name="skills">
                ${skill_content}
                </select>
                </div>
                `;
    await new Promise((resolve) => {
        new Dialog({
            title: "Choose a skill",
            content,
            buttons: {
                Ok: {
                    label: "Ok",
                    callback: async (html) => {
                        const skill = html.find("[name=skills]")[0].value;
                        let effect = duplicate(workflow.actor.effects.contents.find(ae => ae.label === "Borrowed Knowledge"));
                        effect.changes[0].key = `system.skills.${skill}.value`;
                        await actor.updateEmbeddedDocuments("ActiveEffect", [effect]);
                    },
                }
            },
            close: () => { resolve(false); }
        }).render(true)
    });
}
