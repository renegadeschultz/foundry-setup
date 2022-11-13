// Divine Smite - Return a Damage Bonus
const divineSmite = async (args) => {
    //make sure we have a hit Target with a melee weapon attack and spells slots are available
    if (!args[0].hitTargets.length || args[0].item.system.actionType !== "mwak" ||
        (
            !args[0].actor.system.spells.spell1.slotsAvailable
            && !args[0].actor.system.spells.spell2.slotsAvailable
            && !args[0].actor.system.spells.spell3.slotsAvailable
            && !args[0].actor.system.spells.spell4.slotsAvailable
        )
    ) {
        return;
    }
    let smite = await new Promise((resolve) => {
        new Dialog({
            title: "Use Divine Smite?",
            content: `<form class="flexcol">
            <div class="form-group">
            <label for="spellLevel">Spell Level:</label>
            <select id="spellLevel">
                ${args[0].actor.system.spells.spell1.slotsAvailable ? "<option value=\"1\">1st</option>" : ""}
                ${args[0].actor.system.spells.spell2.slotsAvailable ? "<option value=\"2\">2nd</option>" : ""}
                ${args[0].actor.system.spells.spell3.slotsAvailable ? "<option value=\"3\">3rd</option>" : ""}
                ${args[0].actor.system.spells.spell4.slotsAvailable ? "<option value=\"4\">4th</option>" : ""}
            </select>
            </div>
            <div>
            <label for="consumeSlot">Consume Spell Slot?</label>
            <input type="checkbox" id="consumeSlot" name="consume" value="consumeSlot" checked>
            </div>
            </form>`,
            buttons: {
                smite: {
                    label: "Smite!",
                    callback: (html) => { resolve({ spellLevel: html.find("#spellLevel")[0].value, consume: html.find("#consumeSlot")[0].checked }); }
                },
                dontSmite: {
                    label: "Don't Smite",
                    callback: () => { resolve(false); }
                }
            },
            default: "Don't Smite",
            close: () => { resolve(false); }
        }).render(true);
    });

    if (!smite) {
        return;
    }
    let target = args[0].hitTargets[0];
    let spellLevelBonus = parseInt(smite.spellLevel) - 1;

    //check if it does bonus damage(fiends and undead)
    let targetType = target.actor.type === "character" ? target.actor.system.details.race : target.actor.system.details.type.value;
    let bonus = ["undead", "fiend"].some(i => targetType.toLowerCase().includes(i));

    let totalDice = (2 + spellLevelBonus + (bonus ? 1 : 0)) * (args[0].isCritical ? 2 : 1);

    // consume spell slot    
    if (smite.consume) {
        let currentSlots = args[0].actor.system.spells[`spell${smite.spellLevel}`].value;
        args[0].actor.update({ [`system.spells.spell${smite.spellLevel}.value`]: currentSlots - 1 });
    }

    return { damageRoll: `${totalDice}d8[radiant]`, flavor: "Divine Smite" };
}

// ItemMacro - After Active Effects
const harnessDivinePower = async (args) => {
    const maxSpellLevel = Math.ceil(args[0].actor.system.attributes.prof / 2);

    // Check if there are spell slots to recover
    if (!args[0].actor.system.spells.spell1.slotsAvailable
        && (maxSpellLevel < 2 || !args[0].actor.system.spells.spell2.slotsAvailable)
        && (maxSpellLevel < 3 || !args[0].actor.system.spells.spell2.slotsAvailable)
    ) {
        return;
    }

    let recover = await new Promise((resolve) => {
        new Dialog({
            title: "Spell Level to Recover",
            content: `<form class="flexcol">
            <div class="form-group">
            <label for="spellLevel">Spell Level:</label>
            <select id="spellLevel">
                ${args[0].actor.system.spells.spell1.value < args[0].actor.system.spells.spell1.max ? "<option value=\"1\">1st</option>" : ""}
                ${maxSpellLevel >= 2 && args[0].actor.system.spells.spell2.value < args[0].actor.system.spells.spell2.max ? "<option value=\"2\">2nd</option>" : ""}
                ${maxSpellLevel >= 3 && args[0].actor.system.spells.spell3.value < args[0].actor.system.spells.spell3.max ? "<option value=\"3\">3rd</option>" : ""}
            </select>
            </div>
            </form>`,
            buttons: {
                smite: {
                    label: "Recover",
                    callback: (html) => { resolve(html.find("#spellLevel")[0].value); }
                },
            },
            default: "Recover",
            close: () => { resolve(false); }
        }).render(true);
    });

    if (!recover) {
        return;
    }

    // Recover spell slot    
    let currentSlots = args[0].actor.system.spells[`spell${recover}`].value;
    args[0].actor.update({ [`system.spells.spell${recover}.value`]: currentSlots + 1 });
}