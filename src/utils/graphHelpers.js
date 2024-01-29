/**
 * @param {any} id1
 * @param {any} id2
 */
function createPairKey(id1, id2) {
    return `${id1}_${id2}`;
}

/**
 * @param {string} pairKey
 */
function reversePairKey(pairKey) {
    const [id1, id2] = pairKey.split('_');
    return `${id2}_${id1}`;
}

export {
    createPairKey,
    reversePairKey
}