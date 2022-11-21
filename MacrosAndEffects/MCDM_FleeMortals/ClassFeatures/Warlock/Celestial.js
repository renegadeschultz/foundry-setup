// Item Macro - Return a Damage Bonus
const healingLight = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);

    const item = workflow.item;
    const options = Array.fromRange(Math.min(Math.max(workflow.actor.system.abilities.cha.mod, 1), item.system.uses.value + 1)).reduce((acc, e) => {
        return acc + `<option value="${e + 1}">${e + 1}</option>`;
    }, "");
    const numDice = await new Promise((resolve) => {
        new Dialog({
            title: "How many dice?",
            content: ` <p>Add <strong>${item.system.damage.parts[0][0]} ${workflow.defaultDamageType}</strong> per die</p>
            <form> <div class="form-group">
            <label>Healing Light Dice:</label>
            <div class="form-fields">
            <select>${options}</select>
            </div></div></form>`,
            buttons: {
                healingLight: {
                    label: "Healing Light",
                    callback: (html) => { resolve(html[0].querySelector("select").value); }
                },
            },
            close: () => { resolve(false); }
        }).render(true);
    });
    if (!numDice || numDice < 2) return;
    const value = Number(numDice) - 1;
    await item.update({ "system.uses.value": item.system.uses.value - value });
    let healingRoll = new Roll(item.system.damage.parts[0][0]);
    healingRoll.alter(value);

    return { damageRoll: healingRoll.formula, flavor: `Using ${value + 1} dice` };
}

//ItemMacro - passive effect flags.midi-qol.onUseMacroName CUSTOM ItemMacro.Radiant Soul,postActiveEffects
const radiantSoul = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    if (!["spell"].some(value => workflow.item.type.includes(value))) return;
    if (!["fire", "radiant"].some(value => workflow.damageDetail.find(i => i.type.includes(value)))) return;

    let damaged = workflow.damageList.filter(target => {
        return target.appliedDamage > 0 && target.newHP > 0;
    })

    if (damaged.length === 0) return;

    const damageType = workflow.damageDetail.find(i => ["fire", "radiant"].includes(i.type)).type;

    let tokenId;
    if (damaged.length > 1) {
        const options = damaged.sort((a, b) => {
            if (a.newHP > b.newHP) {
                return 1;
            }
            if (a.newHP < b.newHP) {
                return -1;
            }

            return 0;
        }).reduce((acc, e) => {
            return acc + `<option value="${e.tokenId}">${canvas.tokens.get(e.tokenId).document.name} ${e.newHP}</option>`;
        }, "");
        tokenId = await new Promise((resolve) => {
            new Dialog({
                title: `Radiant Soul`,
                content: `<p>You used a ${damageType} damage dealing spell</p>
                <p>Targets are listed from lowest HP to highest HP</p>
            <form> <div class="form-group">
            <label>Radiant Soul Target:</label>
            <div class="form-fields">
            <select>${options}</select>
            </div></div></form>`,
                buttons: {
                    one: {
                        icon: '<i class="fas fa-check"></i>',
                        label: "Confirm",
                        callback: async (html) => {
                            resolve(html[0].querySelector("select").value);
                        }
                    },
                    two: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Cancel",
                        callback: () => { resolve(false) }
                    }
                },
                default: "true",
                close: () => { resolve(false) }
            }).render(true);
        });

        if (!tokenId) {
            tokenId = damaged[0].tokenId;
        }
    }
    else {
        tokenId = damaged[0].tokenId;
    }
    const extraDamage = workflow.actor.system.abilities.cha.mod;
    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: workflow.actor }),
        rollMode: game.settings.get('core', 'rollMode'),
        flavor: "Radiant Soul Damage",
        content: `${extraDamage} ${damageType} extra damage`
    });
    await MidiQOL.applyTokenDamage(
        [{ type: `${damageType}`, damage: extraDamage }],
        extraDamage,
        new Set([canvas.tokens.get(tokenId)]),
        workflow.item, new Set(), { existingDamage: damaged, workflow: workflow });
}