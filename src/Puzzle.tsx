import {ArrowBack, ArrowForward} from "@suid/icons-material";
import {Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, ToggleButton, Toolbar, useTheme} from "@suid/material";
import {For, Index, Show, createEffect, createSignal, onCleanup, onMount} from "solid-js";
import {COLOURS, HIGHLIGHT_COLOURS} from "./colours";
import {Board, Group, PuzzleData, serialise, validatePuzzleSolution} from "./puzzle";
import CheatWorker from "./workers/cheatWorker?worker";

const PATTERNS = ["semi-transparent", "ur", "dr", "x"];

interface PuzzleViewProps {
    board: Board;
    groups: Group[];
    startHighlight: (x: number, y: number) => void;
    highlightSquare: (x: number, y: number) => void;
    puzzleColours: "rgb" | "cmy" | "rby";
    puzzleSeed?: number;
}
export function PuzzleView(props: PuzzleViewProps) {
    const theme = useTheme();
    let colours = () => COLOURS[theme.palette.mode][props.puzzleColours];
    return <svg viewBox={`0 0 ${50 * props.board[0].length} ${50 * props.board.length}`} style={{
        "max-height": "800px",
    }}>
        <defs>
            <For each={HIGHLIGHT_COLOURS}>{colour => <>
                <pattern
                    id={`shade-${colour}-ur`}
                    width="20"
                    height="20"
                    patternContentUnits="userSpaceOnUse"
                    patternUnits="userSpaceOnUse"
                >
                    <line x1="-10" y1="10" x2="10" y2="-10" stroke={colour} stroke-width="2" />
                    <line x1="-10" y1="30" x2="30" y2="-10" stroke={colour} stroke-width="2" />
                    <line x1="10" y1="30" x2="30" y2="10" stroke={colour} stroke-width="2" />
                </pattern>
                <pattern
                    id={`shade-${colour}-dr`}
                    width="20"
                    height="20"
                    patternContentUnits="userSpaceOnUse"
                    patternUnits="userSpaceOnUse"
                >
                    <line x1="-10" y1="10" x2="10" y2="30" stroke={colour} stroke-width="2" />
                    <line x1="-10" y1="-10" x2="30" y2="30" stroke={colour} stroke-width="2" />
                    <line x1="10" y1="-10" x2="30" y2="10" stroke={colour} stroke-width="2" />
                </pattern>
                <pattern
                    id={`shade-${colour}-x`}
                    width="20"
                    height="20"
                    patternContentUnits="userSpaceOnUse"
                    patternUnits="userSpaceOnUse"
                >
                    <line x1="-10" y1="10" x2="10" y2="-10" stroke={colour} stroke-width="2" />
                    <line x1="-10" y1="30" x2="30" y2="-10" stroke={colour} stroke-width="2" />
                    <line x1="10" y1="30" x2="30" y2="10" stroke={colour} stroke-width="2" />
                    <line x1="-10" y1="10" x2="10" y2="30" stroke={colour} stroke-width="2" />
                    <line x1="-10" y1="-10" x2="30" y2="30" stroke={colour} stroke-width="2" />
                    <line x1="10" y1="-10" x2="30" y2="10" stroke={colour} stroke-width="2" />
                </pattern>
                <pattern
                    id={`shade-${colour}-semi-transparent`}
                    width="20"
                    height="20"
                    patternContentUnits="userSpaceOnUse"
                    patternUnits="userSpaceOnUse"
                >
                    <rect width="20" height="20" fill={colour} fill-opacity="0.3" />
                </pattern>
            </>}</For>
            <Index each={props.groups}>{(group, i) => <>
                <path id={`path-${i}`} d={generatePathForGroup(group())} />
                <clipPath id={`clip-${i}`}>
                    <use href={`#path-${i}`} />
                </clipPath>
            </>}</Index>
        </defs>
        <Index each={props.board}>{(row, y) => (
            <Index each={row()}>{(cell, x) => (
                <rect
                    x={50 * x}
                    y={50 * y}
                    width="50"
                    height="50"
                    fill={colours()[cell()]}
                    stroke="black"
                    stroke-width="1"
                    onMouseDown={() => {
                        props.startHighlight(x, y);
                        props.highlightSquare(x, y);
                    }}
                    onMouseEnter={event => {
                        if (event.buttons & 1) {
                            props.highlightSquare(x, y);
                        }
                    }}
                />
            )}</Index>
        )}</Index>
        <Index each={props.groups}>{(_, i) => (
            <use
                href={`#path-${i}`}
                fill={`url(#shade-${HIGHLIGHT_COLOURS[i % HIGHLIGHT_COLOURS.length]}-${PATTERNS[Math.floor(i / HIGHLIGHT_COLOURS.length) % PATTERNS.length]})`}
                stroke={HIGHLIGHT_COLOURS[i % HIGHLIGHT_COLOURS.length]}
                stroke-width="10"
                clip-path={`url(#clip-${i})`}
                pointer-events="none"
            />
        )}</Index>
    </svg>;
}

function generatePathForGroup(group: Group): string {
    let edges: [string, string][] = [];
    for (const [x, y] of group) {
        edges = [
            ...edges,
            [`${x * 50} ${y * 50}`, `${x * 50 + 50} ${y * 50}`],
            [`${x * 50 + 50} ${y * 50}`, `${x * 50 + 50} ${y * 50 + 50}`],
            [`${x * 50 + 50} ${y * 50 + 50}`, `${x * 50} ${y * 50 + 50}`],
            [`${x * 50} ${y * 50 + 50}`, `${x * 50} ${y * 50}`],
        ];
    }
    for (let i = edges.length; i-- > 0;) {
        let [a, b] = edges[i];
        let idx = edges.findIndex(([c, d]) => c == b && d == a);
        if (idx != -1) {
            edges.splice(i, 1);
            edges.splice(idx, 1);
            i--;
        }
    }
    if (!edges.length) {
        return "";
    }
    let path = [];
    let [start, end] = edges.pop()!;
    path.push("M", start);
    while (edges.length) {
        if (end == start) {
            path.push('Z');
            [start, end] = edges.pop()!;
            path.push('M', start);
        } else {
            path.push('L', end);
            [, end] = edges.splice(edges.findIndex(([a,]) => a == end), 1)[0];
        }
    }
    if (end != start) {
        throw new Error("Invalid group");
    }
    path.push('Z');

    return path.join(' ');
}

const worker = new CheatWorker();

export async function CHEAT(board: Board): Promise<Group[]> {
    return new Promise((resolve, reject) => {
        const nonce = Math.random();
        worker.onmessage = (event: MessageEvent<{
            solution: Group[];
            nonce: number;
        }>) => {
            if (event.data.nonce != nonce) {
                return;
            }
            resolve(event.data.solution);
        };
        worker.postMessage([board, nonce]);
    });
}

interface CheatDialogueProps {
    open: boolean;
    onClose: (shouldCheat: boolean) => void;
}
function CheatDialogue(props: CheatDialogueProps) {
    return <Dialog open={props.open} onClose={() => props.onClose(false)}>
        <DialogTitle>Reveal answer?</DialogTitle>
        <DialogContent>
            <DialogContentText>
                Are you sure you want to reveal the answer to this puzzle? This
                will not count as a completion, and will reset your daily solve
                streak.
            </DialogContentText>
        </DialogContent>
        <DialogActions>
            <Button onClick={() => props.onClose(true)} color="error">
                Solve
            </Button>
            <Button onClick={() => props.onClose(false)} color="primary">
                Cancel
            </Button>
        </DialogActions>
    </Dialog>;
}

interface PlayPuzzleProps {
    data: PuzzleData;
    setError: (error: string) => void;
    isCustomPuzzle: boolean;
    puzzleColours: "rgb" | "cmy" | "rby";
    onComplete: () => void;
    onCheat: () => void;
}
export function PlayPuzzle(props: PlayPuzzleProps) {
    let saveSlot = () => "GM_" + (props.data.isDaily ? props.data.randomSeed.toString() : serialise(props.data.board));
    let savedGroups: Group[] = JSON.parse(window.localStorage[saveSlot()] || "null");
    if (
        !Array.isArray(savedGroups)
        || savedGroups.some((group: any) => !Array.isArray(group))
        || savedGroups.some((group: any) => group.some((cell: any) => (
            !Array.isArray(cell)
            || cell.length != 2
            || typeof cell[0] != "number" || cell[0] != cell[0]
            || typeof cell[1] != "number" || cell[1] != cell[1]
            || cell[0] < 0 || cell[0] >= props.data.board[0].length
            || cell[1] < 0 || cell[1] >= props.data.board.length
        )))
    ) {
        savedGroups = [];
        if (window.localStorage[saveSlot()]) {
            props.setError("Save data for this puzzle is corrupted, resetting");
        }
    }
    const [groups, setGroups] = createSignal<Group[]>(
        savedGroups,
    );
    createEffect(() => {
        window.localStorage[saveSlot()] = JSON.stringify(groups());
    });
    const [won, setWon] = createSignal(window.localStorage[saveSlot() + "won"] === "true");
    createEffect(() => {
        if (won()) {
            window.localStorage[saveSlot() + "won"] = "true";
        }
    });
    createEffect(() => {
        if (validatePuzzleSolution(
            groups().filter(group => group.length > 0),
            props.data.board
        ) && !won()) {
            setWon(true);
            props.onComplete();
        }
    });

    const [processingCheat, setProcessingCheat] = createSignal(false);

    const cheat = () => {
        setProcessingCheat(true);
        CHEAT(props.data.board).then(answer => {
            setWon(true);
            setGroups(answer);
            setProcessingCheat(false);
        });
    };

    const [highlightMode, setHighlightMode] = createSignal<'erase' | 'draw'>('draw');

    const [cheatOpen, setCheatOpen] = createSignal(false);

    const maybeCheat = (shouldCheat: boolean) => {
        setCheatOpen(false);
        if (shouldCheat) {
            props.onCheat();
            cheat();
        }
    };

    const maybeConfirmCheat = () => {
        if (won() || !props.data.isDaily) {
            cheat();
        } else {
            setCheatOpen(true);
        }
    };

    const [activeGroup, setActiveGroup] = createSignal<number>(0);
    createEffect(() => {
        if (activeGroup() >= groups().length) {
            setGroups(groups => [
                ...groups,
                ...Array(80 - groups.length).fill(0).map(() => []),
            ]);
        }
    });

    return <>
        <CheatDialogue open={cheatOpen()} onClose={maybeCheat} />
        <Show when={won()}>
            <Alert sx={{mb: 1}} severity="success" variant="filled">You have completed this puzzle!</Alert>
        </Show>
        <Box sx={{
            display: "flex",
            flexDirection: {
                xs: "column",
                md: "row",
            },
            maxWidth: {
                xs: "100%",
                md: 620,
                lg: 800,
                xl: 1200,
            },
            padding: {
                xs: 2,
                sm: 4,
                md: 2,
            },
            width: '100%',
            justifyContent: "center",
            alignItems: "center",
            gap: 4,
        }}>
            <PuzzleView
                board={props.data.board}
                groups={groups()}
                puzzleColours={props.puzzleColours}
                startHighlight={(x, y) => {
                    setHighlightMode(
                        groups()[activeGroup()].some(([gx, gy]) => gx == x && gy == y) ? 'erase' : 'draw'
                    );
                }}
                highlightSquare={(x, y) => {
                    setGroups(groups => groups.map((group, i) => (
                        highlightMode() == 'erase' || i != activeGroup()
                            ? group.filter(([gx, gy]) => gx != x || gy != y)
                            : [...group.filter(([gx, gy]) => gx != x || gy != y), [x, y]]
                    )));
                }}
                puzzleSeed={props.data.generatedFromSeed ? props.data.randomSeed : undefined}
            />
            <GroupSelector
                activeGroup={activeGroup()}
                setGroup={setActiveGroup}
                cellsInGroups={groups().map(group => group.length)}
            />
        </Box>
        <Toolbar sx={{gap: 2}}>
            <Button
                onClick={() => setGroups([])}
                variant="contained"
            >
                Clear all
            </Button>
            <Show when={false}>
                <Button
                    onClick={maybeConfirmCheat}
                    variant="contained"
                    color={!won() ? "error" : "primary"}
                    disabled={processingCheat()}
                    ref={(el) => {
                        setTimeout(() => {
                            el.style.minWidth = el.clientWidth + "px";
                            el.style.minHeight = el.clientHeight + "px";
                        }, 0);
                    }}
                >
                    <Show when={processingCheat()} fallback="Reveal answer">
                        <CircularProgress variant="indeterminate" size={24} />
                    </Show>
                </Button>
            </Show>
        </Toolbar>
    </>;
}

interface GroupSelectorProps {
    activeGroup: number;
    cellsInGroups: number[];
    setGroup: (group: number) => void;
}
function GroupSelector(props: GroupSelectorProps) {
    const [page, setPage] = createSignal(Math.floor(props.activeGroup / 10));

    const keyListener = (event: KeyboardEvent) => {
        if (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].includes(event.key.toUpperCase())) {
            setPage('ABCDEFGH'.indexOf(event.key.toUpperCase()));
        } else if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].includes(event.key)) {
            props.setGroup(page() * 10 + '1234567890'.indexOf(event.key));
        }
    };
    onMount(() => {
        document.addEventListener("keydown", keyListener);
    });
    onCleanup(() => {
        document.removeEventListener("keydown", keyListener);
    });
    return <Card sx={{minWidth: 192}} raised>
        <Box sx={{
            display: "grid",
            padding: 2,
            gap: 1,
            gridTemplateColumns: "repeat(3, 1fr)",
        }}>
            <IconButton
                disabled={page() == 0}
                onClick={() => setPage(page => --page)}
            >
                <Show when={page() > 0}>
                    <ArrowBack />
                </Show>
            </IconButton>
            <Box sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}>
                {'ABCDEFGH'[page()]}
            </Box>
            <IconButton
                disabled={page() == 7}
                onClick={() => setPage(page => ++page)}
            >
                <Show when={page() < 7}>
                    <ArrowForward />
                </Show>
            </IconButton>
            <For each={[0, 1, 2, 3, 4, 5, 6, 7, 8, null, 9]}>{(i) => (
                <Show when={i !== null} fallback={<IconButton disabled />}>
                    <ToggleButton
                        value={i! + page() * 10}
                        selected={i! + page() * 10 == props.activeGroup}
                        onChange={() => props.setGroup(page() * 10 + i!)}
                    >
                        <HighlightPreview id={i! + page() * 10} cellsInGroup={props.cellsInGroups[i! + page() * 10]} />
                    </ToggleButton>
                </Show>
            )}</For>
        </Box>
    </Card>;
}

function HighlightPreview(props: {id: number; cellsInGroup: number;}) {
    return <svg viewBox="-25 -25 100 100" style={{
        width: "48px",
        margin: "-12px",
    }}>
        <rect
            x="0"
            y="0"
            width="50"
            height="50"
            fill={`url(#shade-${HIGHLIGHT_COLOURS[props.id % HIGHLIGHT_COLOURS.length]}-${PATTERNS[Math.floor(props.id / HIGHLIGHT_COLOURS.length) % PATTERNS.length]})`}
            stroke={HIGHLIGHT_COLOURS[props.id % HIGHLIGHT_COLOURS.length]}
            stroke-width="3"
        />
        <text
            x="25" y="25"
            dominant-baseline="central"
            text-anchor="middle"
            fill="white"
            font-size="35"
        >
            {props.cellsInGroup}
        </text>
        <text
            x="60" y="-5"
            dominant-baseline="central"
            text-anchor="middle"
            fill="white"
            fill-opacity="0.7"
            font-size="25"
        >
            {(props.id + 1) % 10}
        </text>
    </svg>;
}
