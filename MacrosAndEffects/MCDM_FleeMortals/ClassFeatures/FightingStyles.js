// Add correct value to damage formula 1d10+prof. ItemMacro - After Damage Roll
const interception = async (args) => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    const messageDetails = game.messages.contents[game.messages.size - 2].flags?.midiqol?.undoDamage;
    const totalHpDamage = messageDetails.length > 0 ? messageDetails[0].damageItem.hpDamage: 0;
    const totalTempDamage = messageDetails.length > 0 ? messageDetails[0].damageItem.tempDamage: 0;
    const damageIntercepted = workflow.damageTotal;

    let hpIntercepted = 0;
    let tempIntercepted = 0;
    if (totalHpDamage > 0 || totalTempDamage  > 0) {
        hpIntercepted = Math.min(totalHpDamage, damageIntercepted);
        if(hpIntercepted < damageIntercepted) {
           let remaining = damageIntercepted - hpIntercepted;
           tempIntercepted = Math.min(totalTempDamage , remaining);
        }
        workflow.damageRoll = await (new Roll(`${hpIntercepted }[healing]+${tempIntercepted}[temphp]`)).roll();
        workflow.damageTotal = hpIntercepted + tempIntercepted ;
        workflow.damageRollHTML = await workflow.damageRoll.render();
    }
    else {
        console.log("No need to adjust interception Damage")
    }
}