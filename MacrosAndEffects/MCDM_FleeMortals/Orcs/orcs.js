// Dohma Raskovar - Reinforcements
const reinforcements = async () => {
    const source = canvas.tokens.controlled[0];
    const boundaries = {
        xZero: canvas.dimensions.sceneRect.x + canvas.grid.grid.w,
        yZero: canvas.dimensions.sceneRect.y + canvas.grid.grid.w,
        xMax: canvas.dimensions.sceneRect.x + canvas.dimensions.sceneRect.width - (2 * canvas.grid.grid.w),
        yMax: canvas.dimensions.sceneRect.y + canvas.dimensions.sceneRect.height - (2 * canvas.grid.grid.w)
    }

    const actorName = "Orc Blitzer";
    const count = { total: 10 };
    let promises = [];
    for (i = 0; i < count.total; i++) {
        let promise = new Promise(async resolve => {
            const xoffsetRoll = await new Roll("1d13-7").roll();
            const yoffsetRoll = await new Roll("1d13-7").roll();

            let xoffset = xoffsetRoll.total;
            let yoffset = yoffsetRoll.total;
            if (source.document.x + (xoffset * canvas.grid.grid.w) < boundaries.xZero || source.document.x + (xoffset * canvas.grid.grid.w) > boundaries.xMax) {
                xoffset = 0;
            }
            if (source.document.y + (yoffset * canvas.grid.grid.w) < boundaries.yZero || source.document.y + (yoffset * canvas.grid.grid.w) > boundaries.yMax) {
                yoffset = 0;
            }
            const shift = xoffset === 0 && yoffset === 0 ? 1 : 0;


            let tokenId = await warpgate.spawnAt(
                { x: source.document.x + ((xoffset + shift) * canvas.grid.grid.w) + (canvas.grid.grid.w / 2), y: source.document.y + (yoffset * canvas.grid.grid.w) + (canvas.grid.grid.w / 2) },
                actorName,
                { token: { alpha: 0 } }
            );
            const spawned = canvas.tokens.get(tokenId[0]);

            new Sequence()
                .animation()
                .on(spawned)
                .opacity(0)
                .effect()
                .atLocation(spawned)
                .file("jb2a.thunderwave.center.dark_red")
                .scale(0.5)
                .wait(1000)
                .animation()
                .on(spawned)
                .opacity(1)
                .play();
            return;
        });
        promises.push(promise)
    }
    await Promise.all(promises);
}

// Orc Bloodrunner - Spiked Shield
const spikedShield = async () => {
    function getDialogOutput() {
        return new Promise((resolve) => {
            const dialog = new Dialog({
                title: "Bloodrunnner Spiked Shield",
                content: "What would you like to do?",
                buttons: {
                    shove: { label: "Shove 10ft", callback: () => { resolve('shove') } },
                    prone: { label: "Knock Prone", callback: () => { resolve('prone') } },
                },
                close: () => { resolve() }
            });

            dialog.render(true);
        });
    }

    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    if (workflow.hitTargets.size > 0) {
        const dialogOutput = await getDialogOutput();
        console.log(dialogOutput);
        if (dialogOutput === 'shove') {
            await game.macros.getName('Knockback').execute(canvas.tokens.controlled[0], [[...game.user.targets][0]], 2);
        }
        else if (dialogOutput === 'prone') {
            const [target] = game.user.targets;
            const hasEffectApplied = await game.dfreds.effectInterface.hasEffectApplied('Prone', target.actor.uuid);
            if (!hasEffectApplied) {
                game.dfreds.effectInterface.addEffect({ effectName: 'Prone', uuid: target.actor.uuid });
            }
        }
    }
}

// Orc Blitzer(Minion) Group Attack
const groupAttack = async () => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    if (workflow.minions === undefined) {
        await Dialog.prompt({
            content: `
                <div class="form-group">
                    <label for="minions">How many minions?</label>
                    <input type="number" name="minions" value="4">
                </div>`,
            callback: async (html) => {
                let minions = html.find('[name="minions"]').val();
                console.log('minionattack', workflow.minions);
                workflow.attackRoll = await new Roll(`1d20+4+${minions - 1}`);
                workflow.attackTotal = workflow.attackRoll.total;
                workflow.attackRollHTML = await workflow.attackRoll.render();
                workflow.minions = minions;
            }
        });
    }
    else {
        workflow = await game.macros.getName('Adjust_Damage').execute(workflow, `${workflow.minions}`, `${workflow.minions}`);
    }
}

// Orc Conduit - Choose Affinity
const chooseAffinity = async () => {
    const effectName = 'Affinity';

    const iconMap = {
        'lightning': 'icons/magic/lightning/bolt-blue.webp',
        'cold': 'icons/magic/water/snowflake-ice-blue-white.webp',
        'fire': 'icons/magic/fire/flame-burning-campfire-rocks.webp'
    }

    canvas.tokens.controlled.forEach(async (token) => {
        const uuid = token.actor.uuid;
        const hasEffectApplied = await game.dfreds.effectInterface.hasEffectApplied(effectName, uuid);

        if (!hasEffectApplied) {
            let roll = await game.tables.find(t => t.name === "Conduit Damage Resistance").draw();
            let resistance = roll.results[0].text;

            const effectData = {
                name: effectName, icon: iconMap[resistance],
                changes: [
                    { key: 'system.traits.dr.value', value: resistance, mode: 2, priority: 20 }
                ]
            }
            await game.dfreds.effectInterface.addEffectWith({ effectData, uuid });
        }
    });
}

// Orc Fury - Haymaker Greataxe
const haymakerGreataxe = async () => {
    const [target] = game.user.targets;
    const hasEffectApplied = await game.dfreds.effectInterface.hasEffectApplied('Prone', target.actor.uuid);

    if (hasEffectApplied) {
        let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
        workflow = await game.macros.getName('Adjust_Damage').execute(workflow, "1d12+6", "2d12+6");
    }
}

// Orc Garroter - Strangle
const strangle = async () => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    if (workflow.attackRoll.options.advantageMode === 1 && workflow.hitTargets.size > 0) {
        const [target] = game.user.targets;
        const saveMod = target.actor.system.abilities.con.save;
        const save = await new Roll(`1d20+${saveMod}`).roll();
        await save.toMessage({ speaker: ChatMessage.getSpeaker({ actor: target.actor }), flavor: "Constitution Saving Throw" });
        if (save.total < 12) {
            if (game.dfreds.effectInterface.hasEffectApplied('Unconscious', target.actor.uuid)) {
                await game.dfreds.effectInterface.removeEffect({ effectName: 'Unconscious', uuid: target.actor.uuid });
            }
            let unconsciousEffect = game.dfreds.effectInterface.findEffectByName('Unconscious');
            unconsciousEffect.rounds = 10;
            await game.dfreds.effectInterface.addEffectWith(
                {
                    effectData: unconsciousEffect,
                    uuid: target.actor.uuid,
                }
            );
        }
    }
}

// Orc Godcaller - Song of the Gods
const songOfTheGods = async () => {
    const [...targets] = game.user.targets;
    var orcAllies = [];
    targets.forEach(async (token) => {
        if (token.document.disposition < 1) {
            orcAllies.push(token.id);
        }
    });
    await game.user.updateTokenTargets(orcAllies);
}

// Orc Terranova - Unearth Mohlers
const unearthMohlers = async () => {
    const terranova = canvas.tokens.controlled[0];
    const boundaries = {
        xZero: canvas.dimensions.sceneRect.x + canvas.grid.grid.w,
        yZero: canvas.dimensions.sceneRect.y + canvas.grid.grid.w,
        xMax: canvas.dimensions.sceneRect.x + canvas.dimensions.sceneRect.width - (2 * canvas.grid.grid.w),
        yMax: canvas.dimensions.sceneRect.y + canvas.dimensions.sceneRect.height - (2 * canvas.grid.grid.w)
    }

    const actorName = "Mohler";
    const count = await new Roll("1d3+1").roll();

    for (i = 0; i < count.total; i++) {
        const xoffsetRoll = await new Roll("1d13-7").roll();
        const yoffsetRoll = await new Roll("1d13-7").roll();

        let xoffset = xoffsetRoll.total;
        let yoffset = yoffsetRoll.total;
        if (terranova.document.x + (xoffset * canvas.grid.grid.w) < boundaries.xZero || terranova.document.x + (xoffset * canvas.grid.grid.w) > boundaries.xMax) {
            xoffset = 0;
        }
        if (terranova.document.y + (yoffset * canvas.grid.grid.w) < boundaries.yZero || terranova.document.y + (yoffset * canvas.grid.grid.w) > boundaries.yMax) {
            yoffset = 0;
        }
        const shift = xoffset === 0 && yoffset === 0 ? 1 : 0;


        let tokenId = await warpgate.spawnAt(
            { x: terranova.document.x + ((xoffset + shift) * canvas.grid.grid.w) + (canvas.grid.grid.w / 2), y: terranova.document.y + (yoffset * canvas.grid.grid.w) + (canvas.grid.grid.w / 2) },
            actorName,
            { token: { alpha: 0 } }
        );
        const mohler = canvas.tokens.get(tokenId[0]);

        new Sequence()
            .animation()
                .on(mohler)
                .opacity(0)
            .effect()
                .atLocation(terranova)
                .stretchTo(mohler)
                .file("jb2a.boulder.toss.02.05ft")
                .scale(0.5)
            .wait(2000)
            .animation()
                .on(mohler)
                .opacity(1.0)
            .play();

    }
}

export {
    reinforcements,
    groupAttack,
    spikedShield,
    chooseAffinity,
    haymakerGreataxe,
    strangle,
    songOfTheGods,
    unearthMohlers
}