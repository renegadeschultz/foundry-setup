// Goblin Assassin - Backstab
const backstab = async (args) => {
    //make sure, we have a hit Target
    if (!args[0].hitTargets.length || !args[0].advantage) {
        return;
    }

    let target = args[0].hitTargets[0];

    //check for invalid target type 
    let targetType = target.actor.type === "character" ? target.actor.system.details.race : target.actor.system.details.type.value;
    let invalid = ["undead", "construct"].some(i => targetType.toLowerCase().includes(i));
    if (invalid) return;

    // Get damage formula and apply wound
    const damageBonusFormula = args[0].isCritical ? "2d6" : "1d6";
    game.dfreds.effectInterface.addEffect({ effectName: "Bleeding Wound", uuid: target.actor.uuid });

    return { damageRoll: damageBonusFormula, flavor: "Backstab" };
}

// Goblin Assassin - Summon Shadows
const summonShadows = async  () => {
    const createHook = async (tile) => {
        const flags = { 
          "perfect-vision": { 
             enabled: true, 
             globalLight: {enabled: false}, 
             visionLimitation: {enabled: true, sight: 0, detection: {basicSight: 0} }
           }
         };
    
         await game.macros.getName('DrawCircle').execute({
          shrink: 40, 
          diameter: 20, 
          x: tile.x, 
          y: tile.y, 
          text: tile.id,
          flags: flags
         });
      ui.notifications.info('Tiles have been setup');
    }
    
    Hooks.once("createTile", createHook);
    
    const deleteHook = async (tile) => {
       const drawing = [...canvas.scene.drawings].find(x => x.text === tile.id);
       if(drawing) {
         await canvas.scene.deleteEmbeddedDocuments("Drawing", [drawing.id]);
         Hooks.off("deleteTile", deleteHook);   
       }
    }
    
    Hooks.on("deleteTile", deleteHook);
}

// Goblin Cursespitter - To Me
const toMe = async (args) => {
    let targets = args[0].targets;

    let teleportToken = async (target) => {

        let position = await warpgate.crosshairs.show({
            size: 1,
            tag: randomID(),
            label: "Teleport to",
            drawOutline: false,
            drawIcon: false
        }, {
            show: async (crosshair) => {

                new Sequence()
                    .effect()
                    .from(target)
                    .attachTo(crosshair)
                    .persist()
                    .opacity(0.5)
                    .play();

            }
        })
        new Sequence()
            .effect()
            .file("jb2a.misty_step.01.dark_red")
            .atLocation(target)
            .scaleToObject()
            .waitUntilFinished()
            .animation()
            .on(target)
            .teleportTo(position)
            .snapToGrid()
            .waitUntilFinished()
            .effect()
            .file("jb2a.misty_step.01.dark_red")
            .atLocation({ x: position.x, y: position.y })
            .scaleToObject()
            .play();
    }


    if (targets.length > 0) {
        await teleportToken(targets[0]);
    }

    if (targets.length > 1) {
        await teleportToken(targets[1]);
    }
}

// Goblin Sniper - Sniper
const sniper = async (args) => {
    //make sure we have a hit Target with advantage
    if (!args[0].hitTargets.length || !args[0].advantage) {
        return;
    }

    // Get damage formula and apply wound
    const damageBonusFormula = args[0].isCritical ? "2d6" : "1d6";

    return { damageRoll: damageBonusFormula, flavor: "Snipe" };
}

// Goblin Minion - Dagger(Group Attack)
const minionGroupAttack = async () => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    // Before Check Hits
    if (workflow.minions === undefined) {
        await Dialog.prompt({
            content: `
                  <div class="form-group">
                      <label for="minions">How many minions?</label>
                      <input type="number" name="minions" value="1">
                  </div>`,
            callback: async (html) => {
                let minions = html.find('[name="minions"]').val();
                workflow.attackRoll = await new Roll(`${workflow.attackRoll.formula}+${minions - 1}`);
                workflow.attackTotal = workflow.attackRoll.total;
                workflow.attackRollHTML = await workflow.attackRoll.render();
                workflow.minions = minions;
            }
        });
    }
    // Return a Damage Bonus
    else {
        return { damageRoll: `${workflow.minions - 1}`, flavor: "More Minions" }
    }
}

// Goblon Minion - Tiny Stabs
const minionTinyStabs = async () => {
    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    console.log(workflow);
    let damageBonus;
    await Dialog.prompt({
        content: `
              <div class="form-group">
                  <label for="minions">How many minions?</label>
                  <input type="number" name="minions" value="1">
              </div>`,
        callback: async (html) => {
            let minions = parseInt(html.find('[name="minions"]').val());
            const [target] = game.user.targets;
            const saveMod = target.actor.system.abilities.dex.save;
            const save = await new Roll(`1d20+${saveMod}`).roll();
            await save.toMessage({ speaker: ChatMessage.getSpeaker({ actor: target.actor }), flavor: `DC ${10 + minions} Dexterity Saving Throw` });
            if (save.total < 10 + minions) {
                damageBonus = { damageRoll: `${minions}[piercing]`, flavor: "Tiny Stabs" };
            }
        }
    });
    return damageBonus;
}

// Queen Bargnot - Get In Here
const getInHere = async () => {
    const actorName = "Goblin Minion";
    const count = await new Roll("1d4").roll();
    await count.toMessage({ speaker: ChatMessage.getSpeaker({ actor: canvas.tokens.controlled[0].actor }), flavor: "Getting Minions" });
    for (i = 0; i < count.total; i++) {
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
        const minion = canvas.tokens.get(tokenId[0]);

        new Sequence()
            .animation()
            .on(minion)
            .opacity(0)
            .effect()
            .file("jb2a.misty_step.02.grey")
            .atLocation(minion)
            .scaleToObject()
            .wait(1000)
            .animation()
            .on(minion)
            .opacity(1)
            .play();
    }
}


export {
    backstab,
    sniper,
    summonShadows,
    toMe,
    minionGroupAttack,
    minionTinyStabs,
    getInHere
}