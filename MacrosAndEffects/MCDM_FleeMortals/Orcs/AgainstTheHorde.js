// Set force the initiative values of all tokens in combat to the ones given by the Against the Horde rules
const forceInitiative = async () => {
    const initMap = {
        "Scyza": 20,
        "Dohma Raskovar": 18,
        "Wizard": 17,
        "Orc Garroter": 16,
        "Orc Godcaller": 14,
        "Barbarian": 13,
        "Orc Bloodrunner": 12,
        "Orc Fury": 10,
        "Cleric": 9,
        "Orc Conduit": 8,
        "Orc Rampart": 6,
        "Paladin": 5,
        "Orc Blitzer": 4,
        "Orc Terranova": 2,
        "Mohler": 1.99
    }



    let tokens = canvas.scene.data.tokens;
    await tokens.forEach(async t => {
        let name = t.name;
        let init = initMap[name];
        let combatantId = game.combat.combatants.find(c => c.tokenId === t._id)._id;
        await game.combat.setInitiative(combatantId, init);
    });
}

// Toggle cover(based on size) onto a token when they enter or exit the tranch
const trenchCover = () => {
    let [triggeringToken] = canvas.tokens.controlled;

    console.log(triggeringToken.actor);
    if (triggeringToken.actor.system.traits.size === 'sm') {
        game.dfreds.effectInterface.toggleEffect("Cover (Three-Quarters)")
    }
    else {
        game.dfreds.effectInterface.toggleEffect("Cover (Half)")
    }
}

export {
    forceInitiative,
    trenchCover
}