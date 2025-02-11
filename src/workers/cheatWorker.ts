import {Board, CHEAT, Group, solveBoard} from "../puzzle";
onmessage = (event: MessageEvent<[number | Board, number]>) => {
    const [board, nonce] = event.data;
    try {
        let solution: Group[];
        if (typeof board == "number") {
            solution = CHEAT(board);
        } else {
            solution = solveBoard(board);
        }
        postMessage({solution, nonce});
    } catch (error) {
        postMessage({solution: [], nonce});
    }
};