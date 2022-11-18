const gatheredSwarm = async (args) => {
    const moveTokenWithSwarm = async (token, distanceAvailable) => {
        let crosshairsDistance = 0;
        const checkDistance = async (crosshairs) => {
            while (crosshairs.inFlight) {
                //wait for initial render
                await warpgate.wait(100);

                const ray = new Ray(token.center, crosshairs);
                const distance = canvas.grid.measureDistances([{ ray }], { gridSpaces: true })[0];

                //only update if the distance has changed
                if (crosshairsDistance !== distance) {
                    crosshairsDistance = distance;
                    if (distance > distanceAvailable) {
                        crosshairs.icon = 'icons/svg/hazard.svg';
                    } else {
                        crosshairs.icon = 'icons/svg/dice-target.svg';
                    }

                    crosshairs.draw();
                    crosshairs.label = `${distance} ft`;
                }
            }
        }

        let location = await warpgate.crosshairs.show(
            {
                // swap between targeting the grid square vs intersection based on token's size
                interval: -1,
                drawIcon: true,
                label: '0 ft.',
            },
            {
                show: checkDistance
            },
        );

        if (location.cancelled) {
            return;
        }
        if (crosshairsDistance > distanceAvailable) {
            ui.notifications.warn(`Move Spot must be within ${distanceAvailable} ft!`);
            location = await moveTokenWithSwarm(token, distanceAvailable)
        }
        return location;

    }

    let option = await new Promise((resolve) => {
        new Dialog({
            title: "Gathered Swarm Option",
            buttons: {
                extraDamage: {
                    label: "Extra Damage",
                    callback: () => { resolve("Extra Damage"); }
                },
                moveTarget: {
                    label: "Move target 15ft",
                    callback: () => { resolve("Move target"); }
                },
                moveSelf: {
                    label: "Move self 5ft",
                    callback: () => { resolve("Move self"); }
                }
            },
            close: () => { resolve(false); }
        }).render(true);
    });

    if (!option) {
        return;
    }

    let workflow = MidiQOL.Workflow.getWorkflow(args[0].uuid);
    const mightySwarmLevel = 11;
    if (option === "Extra Damage") {
        const [target] = workflow.targets;
        const targetToken = canvas.tokens.get(target.id);
        let roll = new Roll(workflow.actor.system.scale.ranger.swarmkeeper ? workflow.actor.system.scale.ranger.swarmkeeper["gathered-swarm"] : "1d6");
        if(workflow.isCritical) {
            roll.alter(2);
        }
        let damageTotal = await roll.roll().total;
        await new MidiQOL.DamageOnlyWorkflow(
            workflow.actor,
            workflow.token,
            damageTotal,
            "piercing",
            [target],
            roll,
            { flavor: `Gathered Swarm attacks ${target.document.name}}!` }
        );
        new Sequence()
                .effect()
                .file('jb2a.particles.inward.blue.01.01')
                .scale(0.5)
                .attachTo(targetToken)
                .play();

    }
    else if (option === "Move target") {
        const [target] = workflow.targets;
        const targetToken = canvas.tokens.get(target.id);
        const targetSpot = await moveTokenWithSwarm(targetToken, 15);

        if (targetSpot) {
            new Sequence()
                .effect()
                .file('jb2a.particles.inward.blue.01.01')
                .scale(0.5)
                .attachTo(targetToken)
                .animation()
                .on(targetToken)
                .moveTowards(targetSpot)
                .snapToGrid()
                .waitUntilFinished()
                .play();
        }
        if (workflow.actor.classes.ranger.system.levels >= mightySwarmLevel) {
            game.dfreds.effectInterface.addEffect({ effectName: 'Prone', uuid: target.actor.uuid });
        }
    }
    else if (option === "Move self") {
        const sourceToken = canvas.tokens.get(workflow.tokenId);
        const sourceSpot = await moveTokenWithSwarm(sourceToken, 5);

        if (sourceSpot) {
            new Sequence()
                .effect()
                .file('jb2a.particles.inward.blue.01.01')
                .scale(0.5)
                .attachTo(sourceToken)
                .animation()
                .on(sourceToken)
                .moveTowards(sourceSpot)
                .snapToGrid()
                .waitUntilFinished()
                .play();
        }
        if (workflow.actor.classes.ranger.system.levels >= mightySwarmLevel) {
            const effectData = game.dfreds.effectInterface.findEffectByName('Cover (Half)').convertToObject();
            effectData.flags["dae"] = {
                specialDuration: ["turnStart"]
            }
            game.dfreds.effectInterface.addEffectWith({ effectData, uuid: workflow.actor.uuid });
        }
    }
}