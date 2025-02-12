import init, {solve_puzzle} from 'wasm';
import {Board, CHEAT, Group, serialise} from "../puzzle";
await init();
onmessage = (event: MessageEvent<[number | Board, number]>) => {
    const [board, nonce] = event.data;
    try {
        let solution: Group[];
        if (typeof board == "number") {
            solution = CHEAT(board);
        } else {
            solution = solve_puzzle(serialise(board));
        }
        postMessage({solution, nonce});
    } catch (error) {
        postMessage({solution: [], nonce});
    }
};