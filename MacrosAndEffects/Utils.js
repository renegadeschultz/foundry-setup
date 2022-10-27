
// Change the damage of a given workflow using the given new damage and new crit damage
const adjustDamage = async (args) => {
    let workflow = args[0];
    let newDamage = args[1];
    let newCritDamage = args[2];
    if (workflow.isCritical) {
        workflow.damageRoll = await new Roll(newCritDamage).roll();
    }
    else {
        workflow.damageRoll = await new Roll(newDamage).roll();
    }
    workflow.damageTotal = workflow.damageRoll.total;
    workflow.damageRollHTML = await workflow.damageRoll.render();
    return workflow;
}

// Move targets tokens away from the source token a given number of squares
const knockback =async  (args) => {
    const source = args[0];
    const targets = args[1];
    const squares = args[2];

    const knockbackPixels = canvas.grid.size * squares;
    const sourceToken = source;


    for (let targetToken of targets) {
        const ray = new Ray(sourceToken.center, targetToken.center);
        let newCenter = ray.project((ray.distance + knockbackPixels) / ray.distance);
        newCenter = canvas.grid.getSnappedPosition(newCenter.x - targetToken.w / 2, newCenter.y - targetToken.h / 2, 1);
        const mutationData = { token: { x: newCenter.x, y: newCenter.y } };
        await warpgate.mutate(targetToken.document, mutationData, {}, { permanent: true });
    }
}

// Check if a location ({x: x, y: y}) is within the current canvas
const withinCanvas = async (args) => {
    const location = args[0];
    const boundaries = {
        xZero: canvas.dimensions.sceneRect.x + canvas.grid.grid.w,
        yZero: canvas.dimensions.sceneRect.y + canvas.grid.grid.w,
        xMax: canvas.dimensions.sceneRect.x + canvas.dimensions.sceneRect.width - (canvas.grid.grid.w),
        yMax: canvas.dimensions.sceneRect.y + canvas.dimensions.sceneRect.height - (canvas.grid.grid.w)
    }
    return location.x > boundaries.xZero
        && location.x < boundaries.xMax
        && location.y > boundaries.yZero
        && location.y < boundaries.yMax;
}

export {
    adjustDamage,
    knockback,
    withinCanvas
}