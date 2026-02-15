// Maintain ordered useful data map akin to requestContext in template

export function initUsefulDataContext() {
    return {
        flatUsefulDataMap: new Map(),
        usefulDataArray: [],
    };
}

export function serializeUsefulDataInOrder(context) {
    if (!context || !context.usefulDataArray || context.usefulDataArray.length === 0) return '{}';
    const ordered = context.usefulDataArray
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((item) => [item.key, item.data]);
    return JSON.stringify(Object.fromEntries(ordered), null, 2);
}

export function recordUsefulData(context, key, data) {
    if (!context) return;
    const isNew = !context.flatUsefulDataMap.has(key);
    context.flatUsefulDataMap.set(key, data);
    if (isNew) {
        context.usefulDataArray.push({ key, data, timestamp: Date.now() });
    } else {
        const idx = context.usefulDataArray.findIndex((i) => i.key === key);
        if (idx >= 0) {
            context.usefulDataArray[idx].data = data;
            context.usefulDataArray[idx].timestamp = Date.now();
        }
    }
}
