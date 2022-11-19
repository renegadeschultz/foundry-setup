// Actor On Use Macro - Return a damage bonus
const favoredFoe = async (args) => {
    //make sure, we have a hit Target
    if (!args[0].hitTargets.length) {
        return;
    }
    let target = args[0].hitTargets[0];
    const isFavoredFoe = await game.dfreds.effectInterface.hasEffectApplied('Favored Foe', target.actor.uuid);

    if (!isFavoredFoe) {
        return;
    }
    // Get damage formula
    let damageDie = args[0].actor.system.scale?.ranger && args[0].actor.system.scale?.ranger["favored-foe"] ?
        args[0].actor.system.scale?.ranger["favored-foe"] : "1d6";
    let damageBonusFormula = new Roll(damageDie);
    if (args[0].isCritical) {
        damageBonusFormula.alter(2);
    }

    new Sequence()
        .effect()
        .file("jb2a.hunters_mark.pulse.01.green")
        .atLocation(target)
        .scaleToObject()
        .scale(0.5)
        .play();

    return { damageRoll: damageBonusFormula.formula, flavor: "Favored Foe" };
}