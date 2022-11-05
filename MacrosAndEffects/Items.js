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
        await damage.toMessage({ speaker: ChatMessage.getSpeaker({ actor: workflow.actor }), flavor: "CRICITAL FUMBLE: Razored Edge Shield slashes its wielder!" });
    }
}