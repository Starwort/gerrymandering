import {Board, solveBoard} from "../puzzle";
onmessage = (event: MessageEvent<[Board, number]>) => {
    const [board, nonce] = event.data;
    try {
        const solution = solveBoard(board);
        postMessage({solution, nonce});
    } catch (error) {
        postMessage({solution: [], nonce});
    }
};