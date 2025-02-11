export type Random = () => number;

export function makeRandom(a: number) {
    return function () {
        a |= 0; a = a + 0x9e3779b9 | 0;
        var t = a ^ a >>> 16; t = Math.imul(t, 0x21f0aaad);
        t = t ^ t >>> 15; t = Math.imul(t, 0x735a2d97);
        return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
    };
}

export function shuffle<T>(array: T[], random: Random) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(random() * (i + 1));
        if (i !== j) {
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

export function select<T>(array: T[], random: Random): T {
    return array[Math.floor(random() * array.length)];
}

export function weightedChoice(weights: number[], random: Random): number {
    let totalWeight = weights.reduce((a, b) => a + b, 0);
    let choice = random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
        choice -= weights[i];
        if (choice <= 0) {
            return i;
        }
    }
    return weights.length - 1;
}

