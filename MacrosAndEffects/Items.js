// Figurine of Wondrous Power (Silver Raven) - ItemMacro - After Active Effects
const figurineOfWondrousPowerRaven = async () => {
    const actorName = "Raven";
    const owner = canvas.tokens.controlled[0];
    let position = await warpgate.crosshairs.show({
        size: 1,
        tag: randomID(),
        drawOutline: true,
        drawIcon: true
    }, {})

    let tokenId = await warpgate.spawnAt(
        { x: position.x, y: position.y },
        actorName,
        { token: { alpha: 0 } }
    );
    const raven = canvas.tokens.get(tokenId[0]);
    new Sequence()
        .animation()
        .on(raven)
        .opacity(0)
        .effect()
        .atLocation(owner)
        .stretchTo(raven)
        .file("jb2a.boulder.toss.01.60ft")
        .scale(0.2)
        .wait(2000)
        .animation()
        .on(raven)
        .opacity(1.0)
        .play();
}

// Razored Edge Shield - ItemMacro - After Active Effects
const razoredEdgeShield = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    if (workflow.isFumble) {
        const damage = await new Roll(`${workflow.item.system.damage.parts[0][0]} + ${workflow.actor.system.abilities[workflow.item.system.ability].mod}[${workflow.item.system.damage.parts[0][1]}]`).roll();
        await workflow.actor.applyDamage(damage.total);
        await damage.toMessage({ speaker: ChatMessage.getSpeaker({ actor: workflow.actor }), flavor: "CRITICAL FUMBLE: Razored Edge Shield slashes its wielder!" });
    }
}


// Lightning Rod Charges(Ammunition) - ItemMacro - Before Save
const lightningRodGainCharges = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    console.log(workflow)
    await Dialog.prompt({
        content: `
              <div class="form-group">
                  <label for="damage">Total Lightning Damage?</label>
                  <input type="number" name="damage" value="1">
              </div>`,
        callback: async (html) => {
            let damage = parseInt(html.find('[name="damage"]').val());
            const saveDC = Math.max(Math.floor(damage / 2), 10);
            const charges = Math.max(Math.floor(damage / 10), 1);
            console.log(`DC: ${saveDC}, Charges: ${charges}`)
            workflow.item.system.save.dc = saveDC;
            workflow.item.system.save.ability = 'wis';
            let item = workflow.actor.items.get(workflow.item.id);
            workflow.actor.updateEmbeddedDocuments("Item", [{ _id: workflow.item.id, system: { quantity: item.system.quantity + charges } }]);
        }
    });
}

// Lightning Rod Blast - ItemMacro - Before Attack
const lightningRodBlast = async (args) => {
    console.log(args[0].macroPass);
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    console.log(workflow);
    const totalCharges = workflow.ammo.system.quantity;
    if (args[0].macroPass === "preItemRoll") {
        await Dialog.prompt({
            content: `
            <div class="form-group">
            <label for="charges">How many charges to use(max ${totalCharges})?</label>
            <input type="number" name="charges" value="${totalCharges}">
        </div>`,
            callback: async (html) => {
                let charges = parseInt(html.find('[name="charges"]').val());
                workflow.charges = charges;
                workflow.item.system.consume.amount = charges;
            }
        });
    }
    else if (args[0].macroPass === "postDamageRoll") {
        //make sure, we have a hit Target
        if (workflow.hitTargets.size) {
            const [target] = workflow.hitTargets;
            const save = await new Roll(`1d20 + ${target.actor.system.abilities.str.save} + ${target.actor.system.abilities.str.saveBonus}`).roll();
            if (save.total < 10 + workflow.charges) {
                await save.toMessage({ speaker: ChatMessage.getSpeaker({ actor: target.actor }), flavor: `Blasted back ${workflow.charges * 5} ft` });
                await game.macros.getName('Knockback').execute(canvas.tokens.controlled[0], [target], workflow.charges);
            }
            else {
                await save.toMessage({ speaker: ChatMessage.getSpeaker({ actor: workflow.actor }), flavor: `Resists being blasted back` });
            }
        }
        workflow = await game.macros.getName('Adjust Damage').execute({ workflow, newDamage: `${workflow.charges}d8` });
    }
}

// Item Macro - Return a Damage Bonus
// Item Macro - After Active Effects
const wandOfFireballs = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);

    const item = workflow.item;
    if (args[0].macroPass === "DamageBonus" && item.system.uses.value > 0) {
        const options = Array.fromRange(item.system.uses.value).reduce((acc, e) => {
            return acc + `<option value="${e + 1}">${e + 1} extra </option>`;
        }, "");
        const extraCharges = await new Promise((resolve) => {
            new Dialog({
                title: "Consume Extra Charges?",
                content: ` <p>Add <strong>${item.system.formula} ${workflow.defaultDamageType}</strong> damage per extra charge</p>
            <form> <div class="form-group">
            <label>Charges:</label>
            <div class="form-fields">
            <select>${options}</select>
            </div></div></form>`,
                buttons: {
                    extra: {
                        label: "Add Extra Charges",
                        callback: (html) => { resolve(html[0].querySelector("select").value); }
                    },
                    noExtra: {
                        label: "None",
                        callback: () => { resolve(false); }
                    }
                },
                default: "None",
                close: () => { resolve(false); }
            }).render(true);
        });
        if (!extraCharges) return;
        const value = Number(extraCharges);
        await item.update({ "system.uses.value": item.system.uses.value - value });
        let extraDamageRoll = new Roll(item.system.formula);
        extraDamageRoll.alter(value);

        return { damageRoll: extraDamageRoll.formula, flavor: `Using ${value} extra charges` };
    }
    else if (args[0].macroPass === "postActiveEffects") {
        if (item.system.uses.value === 0) {
            let destroyRoll = await new Roll("1d20").roll();
            await destroyRoll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: workflow.actor }), flavor: `Last Charge Expended` });
            if (destroyRoll.total === 1) {
                await ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor: workflow.actor }),
                    rollMode: game.settings.get('core', 'rollMode'),
                    flavor: "Wand Overloaded",
                    content: "Wand Crumbles into ashes and is destroyed!"
                });
                await workflow.actor.deleteEmbeddedDocuments('Item', [item.id]);
            }
            else {
                await ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor: workflow.actor }),
                    rollMode: game.settings.get('core', 'rollMode'),
                    flavor: "Wand Overloaded",
                    content: "Wand saves against destruction!"
                });
            }
        }
        await game.macros.getName('Delete All Templates').execute();
    }
}