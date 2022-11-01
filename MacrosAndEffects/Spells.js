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
        if(args.label === summon.name && args.parent.name === assignedActor.name) {
           let token = canvas.scene.tokens.getName(`${args.label}(${args.parent.name})`)
           await warpgate.dismiss(token.id, canvas.scene.id);
           Hooks.off("deleteActiveEffect", onEndSpell );
        }
    }

    Hooks.on("deleteActiveEffect", onEndSpell );

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