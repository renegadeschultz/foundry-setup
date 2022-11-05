// ItemMacro - Before Damage Roll
const wrathOfTheStorm = async (args) => {
    let item = await fromUuid(args[0].uuid);
    let damageType = await new Promise((resolve) => {
        new Dialog({
            title: item.name,
            content: `<form class="flexcol">
            <div class="form-group">
            <label for="damageSelect">Pick one:</label>
            <select id="damageSelect"><option value="lightning">Lightning</option><option value="thunder">Thunder</option></select>
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
    item.system.damage.parts[0][1] = damageType;
}

// Actor On Use Macros - After Active Effects
const thunderboltStrike = async (args) => {
    const eligibleSizes = ["tiny", "sm", "med", "lg"];
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    let eligibleTargets = workflow.hitTargets.filter(target => eligibleSizes.includes(target.actor.system.traits.size));
    if (eligibleTargets.size > 0 && workflow.damageDetail && workflow.damageDetail.some(damage => damage.type === 'lightning')) {
        let pushBack = await new Promise((resolve) => {
            new Dialog({
                title: 'Thunderbolt Strike',
                content: `<form class="flexcol">
            <div class="form-group">
            <label for="shoveDistance">Shove Distance:</label>
            <select id="shoveDistance"><option value="0">Don't Shove</option><option value="1">5 ft</option><option value="2">10 ft</option></select>
            </div>
            </form>`,
                buttons: {
                    use: {
                        label: "Select", callback: async (html) => {
                            resolve(parseInt(html.find("#shoveDistance")[0].value));
                        }
                    }
                },
                default: "Select"
            }).render(true);
        });
        if(pushBack) {
            await game.macros.getName('Knockback').execute(workflow.token,eligibleTargets, pushBack);
        }
    }
}