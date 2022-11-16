// Item Macro - call before the item is rolled
const vigiantBlessing = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    for (const a of game.actors) {
        const ids = a.effects.filter(e => e.label === 'Vigilant Blessing' && e.origin === workflow.item.uuid).map(e => e.id);
        await a.deleteEmbeddedDocuments("ActiveEffect", ids);
    }
}

// Call from flag - flags.midi-qol.optional.DivineStrike.macroToCall
const divineStrike = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    if (workflow.isCritical) {
        workflow = await game.macros.getName('Adjust Damage').execute({workflow, newDamage: workflow.damageRoll.formula});
    }
}