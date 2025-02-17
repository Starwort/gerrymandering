import {Random, makeRandom, select, shuffle, weightedChoice} from "./random";

const sizesByDifficulty = [
    // very easy
    [3, 4],
    // easy
    [4, 5, 6],
    // medium
    [6, 7, 8],
    // hard
    [8, 9, 10],
    // very hard
    [10, 12, 14],
];

const colourWeightsByDifficulty = [
    // very easy
    [0, 10, 1, 0, 0, 0],
    // easy
    [0, 5, 1, 0, 0, 0],
    // medium
    [0, 1, 10, 3, 0, 0],
    // hard
    [0, 0, 5, 2, 1, 0],
    // very hard
    [0, 0, 5, 5, 2, 1],
];
const difficultyWeights = [
    1, 2, 3, 2, 1,
];

export function puzzleDifficulty(seed: number): string {
    const random = makeRandom(seed);
    const difficulty = weightedChoice(difficultyWeights, random);
    const sizeX = select(sizesByDifficulty[difficulty], random);
    const sizeY = select(sizesByDifficulty[difficulty], random);
    const nColours = weightedChoice(colourWeightsByDifficulty[difficulty], random) + 1;
    return [
        "a Very Easy",
        "an Easy",
        "a Medium",
        "a Hard",
        "a Very Hard",
    ][difficulty] + ` (${sizeX}×${sizeY}, ${nColours} colours)`;
}

function choosePuzzleParams(random: Random): [[number, number], number] {
    // todo: different difficulties
    const difficulty = weightedChoice(difficultyWeights, random);
    const sizeX = select(sizesByDifficulty[difficulty], random);
    const sizeY = select(sizesByDifficulty[difficulty], random);
    const nColours = weightedChoice(colourWeightsByDifficulty[difficulty], random) + 1;
    return [[sizeX, sizeY], nColours];
}

function generateGroups(x: number, y: number, nGroups: number, cellsPerGroup: number, random: Random): Group[] {
    let usedMatrix = Array(y).fill(0).map(() => Array(x).fill(false));
    const flood = (currentGroups: Group[], activeGroup: Group): Group[] => {
        if (activeGroup.length == cellsPerGroup) {
            currentGroups = [...currentGroups, activeGroup];
            if (currentGroups.length == nGroups) {
                return currentGroups;
            }
            activeGroup = [];
        }
        let expandPositions = [];
        if (activeGroup.length) {
            const [x, y] = activeGroup[activeGroup.length - 1];
            expandPositions = [
                [x - 1, y],
                [x + 1, y],
                [x, y - 1],
                [x, y + 1],
            ].filter(([x, y]) => (
                x >= 0 && x < usedMatrix[0].length
                && y >= 0 && y < usedMatrix.length
                && !usedMatrix[y][x]
            ));
        } else {
            outer: for (let y = 0; y < usedMatrix.length; y++) {
                for (let x = 0; x < usedMatrix[y].length; x++) {
                    if (!usedMatrix[y][x]) {
                        expandPositions.push([x, y]);
                        break outer;
                    }
                }
            }
        }
        shuffle(expandPositions, random);
        for (let [x, y] of expandPositions) {
            usedMatrix[y][x] = true;
            let newGroup = [...activeGroup, [x, y] as [number, number]];
            let solution = flood(currentGroups, newGroup);
            if (solution.length) {
                return solution;
            }
            usedMatrix[y][x] = false;
        }
        return [];
    };
    return flood([], []);
}

function minToWin(objects: number, nColours: number): number {
    return Math.ceil((objects - 1) / nColours) + 1;
}

function fillGroups(groups: Group[], board: Board, nColours: number, random: Random, baseNo = 0): void {
    shuffle(groups, random);
    // We check baseNo here to ensure that for cyan, we always guarantee enough
    // groups for a majority (e.g. in a 2-colour, 8-group board, cyan needs 5
    // groups) - but for the other colours, we *don't* apply this overcorrection
    // (e.g. in a 7-group game, after allocating cyan 3 groups we mustn't
    // accidentally allocate magenta 3 groups)
    let minMinorityGroups = baseNo == 0
        ? minToWin(groups.length, nColours)
        : Math.ceil(groups.length / nColours);
    let minorityGroups = groups.splice(0, minMinorityGroups);
    for (let group of minorityGroups) {
        let minCellsToWinGroup = minToWin(group.length, nColours);
        let remainingVotes = group.length - minCellsToWinGroup;
        let eachMajorityVotes = Math.floor(remainingVotes / (nColours - 1));
        let leftoverVotes = remainingVotes % (nColours - 1);
        let votes = Array(nColours).fill(0);
        for (let i = 0; i < leftoverVotes; i++) {
            votes[Math.floor(random() * nColours)]++;
        }
        shuffle(votes, random);
        votes[0] += minCellsToWinGroup;
        for (let i = 1; i < nColours; i++) {
            votes[i] += eachMajorityVotes;
        }
        shuffle(group, random);
        for (let [x, y] of group) {
            let colour = votes.indexOf(Math.max(...votes));
            votes[colour]--;
            board[y][x] = colour + baseNo;
        }
    }
    if (nColours > 1) {
        fillGroups(groups, board, nColours - 1, random, baseNo + 1);
    }
}

export function CHEAT(seed: number) {
    const random = makeRandom(seed);
    const [[x, y], nColours] = choosePuzzleParams(random);
    const [nGroups, cellsPerGroup] = optimiseMinorityCells(x * y, nColours);
    return generateGroups(x, y, nGroups, cellsPerGroup, random);
}

function generatePuzzle([x, y]: [number, number], nGroups: number, nColours: number, cellsPerGroup: number, random: Random): Board {
    let board = Array(y).fill(0).map(() => Array(x).fill(-1));
    let groups = generateGroups(x, y, nGroups, cellsPerGroup, random);
    fillGroups(groups, board, nColours, random);
    return board;
}

function* factorPairs(n: number): Generator<[number, number]> {
    for (let i = 1; i * i <= n; i++) {
        if (n % i === 0) {
            yield [i, n / i];
        }
    }
}

function optimiseMinorityCellsForGroups(groups: number, cellsPerGroup: number, nColours: number): number[] {
    if (groups == 0 || nColours == 0) {
        return [];
    }
    let minGroupsToWin = minToWin(groups, nColours);
    let minCellsToWinGroup = minToWin(cellsPerGroup, nColours);
    let rest = optimiseMinorityCellsForGroups(groups - minGroupsToWin, cellsPerGroup, nColours - 1);
    let cellsLeftToAlloc = cellsPerGroup - minCellsToWinGroup;
    for (let i = 1; i < nColours; i++) {
        let cellsToAlloc = Math.ceil(cellsLeftToAlloc / (nColours - i));
        cellsLeftToAlloc -= cellsToAlloc;
        rest[rest.length - i] += cellsToAlloc * minGroupsToWin;
    }
    return [
        minGroupsToWin * minCellsToWinGroup,
        ...rest,
    ];
}
function optimiseMinorityCells(totalCells: number, nColours: number): [number, number, number[]] {
    let minMinorityCells = Array(nColours).fill(Infinity);
    let groups = 0, cellsPerGroup = 0;
    for (let [a, b] of factorPairs(totalCells)) {
        let minorityCells = optimiseMinorityCellsForGroups(a, b, nColours);
        for (let i = 0; i < nColours; i++) {
            if (minorityCells[i] < minMinorityCells[i]) {
                minMinorityCells = minorityCells;
                groups = a;
                cellsPerGroup = b;
                break;
            } else if (minorityCells[i] > minMinorityCells[i]) {
                break;
            }
        }
        minorityCells = optimiseMinorityCellsForGroups(b, a, nColours);
        for (let i = 0; i < nColours; i++) {
            if (minorityCells[i] < minMinorityCells[i]) {
                minMinorityCells = minorityCells;
                groups = b;
                cellsPerGroup = a;
                break;
            } else if (minorityCells[i] > minMinorityCells[i]) {
                break;
            }
        }
    }
    return [groups, cellsPerGroup, minMinorityCells];
}

export function generateFullPuzzleFromSeed(seed: number, isDaily: boolean): PuzzleData {
    const random = makeRandom(seed);
    const [size, nColours] = choosePuzzleParams(random);
    const [nGroups, cellsPerGroup] = optimiseMinorityCells(size[0] * size[1], nColours);
    const board = generatePuzzle(size, nGroups, nColours, cellsPerGroup, random);
    return {
        board,
        generatedFromSeed: true,
        randomSeed: seed,
        isDaily,
    };
}

export function puzzleFromString(input: string): PuzzleData {
    const parts = input.split(";");
    if (parts.length < 3) {
        throw new Error("Invalid puzzle data");
    }
    const [nColours_, size, ...serialisedBoard] = parts;
    const nColours = +nColours_;
    if (nColours != nColours || nColours < 2) {
        throw new Error("Invalid number of colours");
    }
    const cellWidth = Math.ceil(Math.log10(nColours + 1));
    const [w, h] = size.split("x").map(Number);
    if (w != w || h != h) {
        throw new Error("Invalid puzzle size");
    }
    let board = [];
    for (const serialisedRow of serialisedBoard) {
        let row = [];
        for (let i = 0; i < serialisedRow.length; i += cellWidth) {
            let cell = +serialisedRow.slice(i, i + cellWidth);
            if (cell != cell || cell < 0 || cell >= nColours) {
                throw new Error("Invalid cell value");
            }
            row.push(cell);
        }
        board.push(row);
    }

    return {
        board,
        generatedFromSeed: false,
        isDaily: false,
    };
}

export function validatePuzzleSolution(groups: Group[], board: Board): boolean {
    if (
        !groups.length
        || groups.some(group => group.length != groups[0].length)
        || groups.some(group => !group.every(([x, y]) => (
            group.some(([x2, y2]) => x2 == x - 1 && y2 == y)
            || group.some(([x2, y2]) => x2 == x + 1 && y2 == y)
            || group.some(([x2, y2]) => x2 == x && y2 == y - 1)
            || group.some(([x2, y2]) => x2 == x && y2 == y + 1)
        )))
        || groups.reduce((acc, group) => acc + group.length, 0) != board.length * board[0].length
    ) {
        return false;
    }
    let scores = Array(Math.max(...board.flat()) + 1).fill(0);
    for (let group of groups) {
        let winner = winnerFor(board, group);
        if (winner == null) {
            return false;
        }
        scores[winner]++;
    }
    let winningScore = Math.max(...scores);
    let winners = scores.filter(score => score == winningScore).length;
    if (winners != 1) {
        return false;
    }
    return scores[0] == winningScore;
}

export function serialise(board: Board): string {
    let nColours = Math.max(...board.flat()) + 1;
    let cellWidth = Math.ceil(Math.log10(nColours + 1));
    let w = board[0].length;
    let h = board.length;
    return [
        nColours.toString(),
        `${w}x${h}`,
        ...board.map(row => row.map(cell => cell.toString().padStart(cellWidth, "0")).join("")),
    ].join(";");
}

export type PuzzleData = {
    board: Board;
} & ({
    generatedFromSeed: false;
    isDaily: false;
} | {
    generatedFromSeed: true;
    randomSeed: number;
    isDaily: boolean;
});

export function solveBoard(board: Board): Group[] {
    let totalCells = board.length * board[0].length;
    for (const [x, y] of factorPairs(totalCells)) {
        if (x == 1 || x == 2) {
            // a valid solution is impossible when x is 1 or 2:
            // when x is 1, it's just a majority vote (which will always be an
            // invalid solution as by construction the objective is to make the
            // minority win), and when x is 2, because ties are disallowed, each
            // group must be unanimous, which reduces to the same problem as x
            // being 1.
            continue;
        }
        let solution = trySolveBoardWithKnownGroups(board, x, y);
        if (solution.length) {
            return solution;
        }
        if (x != y) {
            solution = trySolveBoardWithKnownGroups(board, y, x);
            if (solution.length) {
                return solution;
            }
        }
    }
    throw new Error("Board is unsolvable");
}

export type Group = [number, number][];
export type Board = number[][];

function trySolveBoardWithKnownGroups(board: Board, groups: number, cellsPerGroup: number): Group[] {
    let usedMatrix = board.map(row => row.map(() => false));
    const trySolve = (currentGroups: Group[], activeGroup: Group): Group[] => {
        // console.log("Trying to solve\n" + usedMatrix.map((row, y) => row.map((used, x) => {
        //     let found = currentGroups.map(group => group.some(([x2, y2]) => x2 == x && y2 == y)).indexOf(true);
        //     let start = used ? '[' : ' ';
        //     let end = used ? ']' : ' ';
        //     if (found != -1) {
        //         return start + found.toString().padStart(2, "0") + end;
        //     } else if (activeGroup.some(([x2, y2]) => x2 == x && y2 == y)) {
        //         return start + currentGroups.length.toString().padStart(2, "0") + end;
        //     } else {
        //         return start + '-1' + end;
        //     }
        // }).join(' ')).join("\n"),
        //     'known groups', groups, cellsPerGroup,
        //     'activeGroup', [...activeGroup],
        //     'currentGroups', currentGroups.map(group => [...group]),
        // );
        if (activeGroup.length == cellsPerGroup) {
            // if this group is tied for the majority, we can skip adding it
            if (winnerFor(board, activeGroup) == null) {
                return [];
            }
            currentGroups = [...currentGroups, activeGroup];
            if (currentGroups.length == groups) {
                if (validatePuzzleSolution(currentGroups, board)) {
                    return currentGroups;
                } else {
                    return [];
                }
            } else {
                let remainingVotes = groups - currentGroups.length;
                let votes = Array(Math.max(...board.flat()) + 1).fill(0);
                for (let group of currentGroups) {
                    votes[winnerFor(board, group)!]++;
                }
                let [minority, ...rest] = votes;
                if (rest.some(votes => votes > minority + remainingVotes)) {
                    return [];
                }
            }
            activeGroup = [];
        }
        let expandPositions = [];
        if (activeGroup.length) {
            const [x, y] = activeGroup[activeGroup.length - 1];
            expandPositions = [
                [x - 1, y],
                [x + 1, y],
                [x, y - 1],
                [x, y + 1],
            ].filter(([x, y]) => x >= 0 && x < board[0].length && y >= 0 && y < board.length && !usedMatrix[y][x]);
        } else {
            outer: for (let y = 0; y < board.length; y++) {
                for (let x = 0; x < board[y].length; x++) {
                    if (!usedMatrix[y][x]) {
                        expandPositions.push([x, y]);
                        break outer;
                    }
                }
            }
        }
        for (let [x, y] of expandPositions) {
            usedMatrix[y][x] = true;
            let newGroup = [...activeGroup, [x, y] as [number, number]];
            let solution = trySolve(currentGroups, newGroup);
            if (solution.length) {
                return solution;
            }
            usedMatrix[y][x] = false;
        }
        return [];
    };
    return trySolve([], []);
}

export function winnerFor(board: Board, group: Group): number | null {
    let votes = Array(Math.max(...board.flat()) + 1).fill(0);
    for (let [x, y] of group) {
        votes[board[y][x]]++;
    }
    let winningScore = Math.max(...votes);
    let winners = votes.filter(score => score == winningScore).length;
    if (winners != 1) {
        return null;
    }
    return votes.indexOf(winningScore);
}
