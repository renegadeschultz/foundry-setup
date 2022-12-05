// ItemMacro - After Active Effects
const sacrificialBargain = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    if(workflow.actor.system.spells.pact.value < workflow.actor.system.spells.pact.max && workflow.actor.classes.warlock.system.levels - workflow.actor.classes.warlock.system.hitDiceUsed >= workflow.actor.system.spells.pact.level) {
        workflow.actor.update({ 
            [`system.spells.pact.value`]: workflow.actor.system.spells.pact.value + 1,
        });
        workflow.actor.classes.warlock.update({
            [`system.hitDiceUsed`]: workflow.actor.classes.warlock.system.hitDiceUsed + workflow.actor.system.spells.pact.level
        })
    }
    else{
        ui.notifications.warn(`Conditions for Sacrificial Bargain not met!`);
        await workflow.item.update({ "system.uses.value": 1 });
    }
}