import {Launch, Share} from "@suid/icons-material";
import {Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, TextField, ToggleButton, useTheme} from "@suid/material";
import {For, JSXElement, Match, Show, Switch, createResource, createSignal, onCleanup, onMount} from "solid-js";
import {PuzzleView, loadGroupsFromStorage} from "../Puzzle";
import {COLOURS} from "../colours";
import {Board, Group, serialise, validatePuzzleSolution} from "../puzzle";
import {PageProps} from "./PageProps";

function swap<T>(arr: T[], i: number, j: number): T[] {
    let out = [...arr];
    out[i] = arr[j];
    out[j] = arr[i];
    return out;
}

export function PuzzleDesigner(props: PageProps<{
    toolbarButtons: JSXElement[];
}> & {
    puzzleColours: "rgb" | "cmy" | "rby";
}) {
    const [confirmReset, setConfirmReset] = createSignal(false);
    const [board, setBoard] = createSignal<Board>(Array(7).fill(0).map(() => Array(7).fill(1)));
    const cellsByColour = () => Array(6).fill(0).map((_, i) => board().flat().filter(cell => cell === i).length);
    const isValidByColourQty = () => {
        let cells = cellsByColour();
        let n = cells[0];
        for (let val of cells) {
            if (val < n && val != 0) {
                return false;
            } else {
                n = val;
            }
        }
        return true;
    };

    const [x, setX] = createSignal(7);
    const [y, setY] = createSignal(7);
    // const debouncedCheat = debounce((board: Board, cb: (v: Group[]) => void) => {
    //     if (!isValidByColourQty()) {
    //         return cb([]);
    //     }
    //     if (validatePuzzleSolution(validationResult.latest, board)) {
    //         // don't bother recalculating if the previous solution is still valid
    //         return cb(validationResult.latest);
    //     }
    //     CHEAT(board).then(cb);
    // }, 500);
    // const [validationResult] = createResource<Group[]>(board, (board: Board) => new Promise(resolve => debouncedCheat(board, resolve)), {initialValue: []});
    const [validationResult, {refetch}] = createResource<Group[]>(board, async (board: Board) => {
        let slot = "GM_" + serialise(board);
        let savedGroups: Group[] = [];
        try {
            savedGroups = loadGroupsFromStorage(board, slot);
        } catch (e) {
            console.error(e);
        }
        if (validatePuzzleSolution(savedGroups.filter(g => g.length != 0), board)) {
            return savedGroups;
        } else {
            return [];
        }
    }, {initialValue: []});
    const url = () => {
        const urlObj = new URL(location.origin + location.pathname);
        urlObj.searchParams.set("puzzle", serialise(board()));
        let url = decodeURIComponent(urlObj.href);
        return url;
    };
    props.ref({
        toolbarButtons: [
            <IconButton
                color="inherit"
                onClick={() => {
                    if (
                        "share" in navigator
                        && (!("canShare" in navigator)
                            || navigator.canShare({url: url()}))
                    ) {
                        navigator.share({url: url()});
                    } else {
                        navigator.clipboard.writeText(url());
                    }
                }}
                title="Share this puzzle"
            >
                <Share />
            </IconButton>
        ]
    });
    const [activeColour, setActiveColour] = createSignal(0);
    const isResize = () => x() != board()[0].length || y() != board().length;
    return <>
        <Box sx={{
            display: "flex",
            flexDirection: "row",
            width: '100%',
            justifyContent: "center",
            alignItems: "center",
            gap: 2,
            mb: 1,
        }}>
            <Alert
                severity={validationResult.loading
                    ? 'warning'
                    : validationResult().length
                        ? "success"
                        : "error"}
                variant="outlined"
                icon={validationResult.loading ? <CircularProgress
                    size={24}
                    variant="indeterminate"
                /> : undefined}
            >
                <Switch>
                    <Match when={!isValidByColourQty()}>
                        Cell colours are invalid
                    </Match>
                    {/* <Match when={validationResult.loading}>
                        Validating puzzle...
                    </Match> */}
                    <Match when={validationResult().length}>
                        Puzzle looks good!
                    </Match>
                    <Match when={true}>
                        Puzzle has not yet been validated.
                    </Match>
                </Switch>
            </Alert>
            <Show when={!isValidByColourQty()}>
                <Button variant="contained" onClick={() => {
                    const cellQtys = cellsByColour();
                    const ordered = [...cellQtys].sort((a, b) => a == 0 ? Infinity : b == 0 ? -Infinity : a - b);
                    for (let i = 0; i < 6; i++) {
                        ordered[i] = cellQtys.indexOf(ordered[i]);
                        cellQtys[ordered[i]] = -1;
                    }
                    setBoard(board => board.map(row => row.map(cell => ordered.indexOf(cell))));
                }}>
                    Fix it
                </Button>
            </Show>
            <Show when={isValidByColourQty() && !validationResult.loading && !validationResult().length}>
                <Button variant="contained" onClick={() => {
                    refetch();
                }}>
                    Check for puzzle solution
                </Button>
            </Show>
        </Box>
        <Dialog open={confirmReset()} onClose={() => setConfirmReset(false)}>
            <DialogTitle>Replace puzzle contents?</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    <Show when={isResize()} fallback="Are you sure you want to reset the puzzle?">
                        Are you sure you want to resize the puzzle?
                    </Show>
                    <br />
                    All previous work will be lost.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
                <Button
                    color="error"
                    onClick={() => {
                        setConfirmReset(false);
                        setBoard(Array(y()).fill(0).map(() => Array(x()).fill(1)));
                    }}
                >
                    <Show when={isResize()} fallback="Reset puzzle">
                        Resize puzzle
                    </Show>
                </Button>
            </DialogActions>
        </Dialog>
        <Box sx={{
            display: "flex",
            flexDirection: "row",
            maxWidth: {
                xs: "100%",
                md: 620,
                lg: 800,
                xl: 1200,
            },
            px: {
                xs: 2,
                sm: 4,
                md: 2,
            },
            width: '100%',
            justifyContent: "center",
            alignItems: "center",
            gap: 2,
        }}>
            <TextField
                type="number"
                value={x()}
                onChange={e => {
                    const val = +e.target.value;
                    if (val >= 0 && val % 1 == 0) {
                        setX(val);
                    }
                }}
                sx={{width: 100}}
                size="small"
            />
            ×
            <TextField
                type="number"
                value={y()}
                onChange={e => {
                    const val = +e.target.value;
                    if (val >= 0 && val % 1 == 0) {
                        setY(val);
                    }
                }}
                sx={{width: 100}}
                size="small"
            />
            <Button variant="contained" onClick={() => setConfirmReset(true)}>
                <Show when={isResize()} fallback="Reset puzzle">
                    Resize puzzle
                </Show>
            </Button>
        </Box>
        <Box sx={{
            display: "flex",
            flexDirection: "row",
            maxWidth: {
                xs: "100%",
                md: 620,
                lg: 800,
                xl: 1200,
            },
            px: {
                xs: 2,
                sm: 4,
                md: 2,
            },
            my: 2,
            width: '100%',
            justifyContent: "center",
            alignItems: "center",
            gap: 2,
        }}>
            <Button
                variant="contained"
                component="a"
                href={`https://github.com/Starwort/gerrymandering/issues/new?assignees=Starwort&labels=puzzle-submission&projects=&template=puzzle.yml&title=%5BCustom+puzzle%5D+&puzzle-url=${encodeURIComponent(url())}`}
                target="_blank"
                endIcon={<Launch />}
                disabled={!validationResult().length}
            >
                Submit this puzzle
            </Button>
            <Button
                variant="contained"
                component="a"
                href={url()}
                target="_blank"
                endIcon={<Launch />}
            >
                Try this puzzle
            </Button>
        </Box>
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
            px: {
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
                board={board()}
                puzzleColours={props.puzzleColours}
                startHighlight={() => {}}
                highlightSquare={(x, y) => {
                    setBoard(board => board.map((row, i) => row.map((cell, j) => i === y && j === x ? activeColour() : cell)));
                }}
                groups={validationResult() ?? []}
            />
            <GroupSelector
                activeColour={activeColour()}
                cellsByColour={cellsByColour()}
                setColour={setActiveColour}
                puzzleColours={props.puzzleColours}
            />
        </Box>
    </>;
}

interface GroupSelectorProps {
    activeColour: number;
    cellsByColour: number[];
    setColour: (group: number) => void;
    puzzleColours: "rgb" | "cmy" | "rby";
}
function GroupSelector(props: GroupSelectorProps) {
    const keyListener = (event: KeyboardEvent) => {
        if (['1', '2', '3', '4', '5', '6'].includes(event.key)) {
            props.setColour('123456'.indexOf(event.key));
        }
    };
    onMount(() => {
        document.addEventListener("keydown", keyListener);
    });
    onCleanup(() => {
        document.removeEventListener("keydown", keyListener);
    });
    const theme = useTheme();
    return <Card sx={{minWidth: 192}} raised>
        <Box sx={{
            display: "grid",
            padding: 2,
            gap: 1,
            gridTemplateColumns: "repeat(3, 1fr)",
        }}>
            <For each={COLOURS[theme.palette.mode][props.puzzleColours]}>{(colour, i) => (
                <ToggleButton
                    value={colour}
                    selected={i() == props.activeColour}
                    onChange={() => props.setColour(i())}
                >
                    <HighlightPreview colour={colour} key={i() + 1} cellsOfColour={props.cellsByColour[i()]} />
                </ToggleButton>
            )}</For>
        </Box>
    </Card>;
}

function HighlightPreview(props: {colour: string; key: number; cellsOfColour: number;}) {
    return <svg viewBox="-25 -25 100 100" style={{
        width: "48px",
        margin: "-12px",
    }}>
        <rect
            x="0"
            y="0"
            width="50"
            height="50"
            fill={props.colour}
        />
        <text
            x="25" y="25"
            dominant-baseline="central"
            text-anchor="middle"
            fill="black"
            font-size="35"
        >
            {props.cellsOfColour}
        </text>
        <text
            x="60" y="-5"
            dominant-baseline="central"
            text-anchor="middle"
            fill="white"
            fill-opacity="0.7"
            font-size="25"
        >
            {props.key}
        </text>
    </svg>;
}
