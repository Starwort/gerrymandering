import {BarChart, Share} from "@suid/icons-material";
import {Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography} from "@suid/material";
import {Accessor, JSXElement, Show, createEffect, createResource, createSignal} from "solid-js";
import {PlayPuzzle} from "../Puzzle";
import {PuzzleData, puzzleDifficulty, serialise} from "../puzzle";
import {loadNumFromStorage} from "../util";
import PuzzleGenWorker from "../workers/puzzleGenWorker?worker";
import {PageProps} from "./PageProps";

const worker = new PuzzleGenWorker();

export function Play(props: PageProps<{
    toolbarButtons: JSXElement[];
}> & {
    puzzleColours: "rgb" | "cmy" | "rby";
    setLastDailySolved: (value: number) => void;
    lastDailySolved: number;
    query: Accessor<URLSearchParams>;
}) {
    const [statisticModalOpen, setStatisticModalOpen] = createSignal(false);

    const [data] = createResource<PuzzleData, URLSearchParams>(
        props.query,
        (query) => new Promise((resolve) => {
            worker.onmessage = (event: MessageEvent<{
                kind: 'complete';
                puzzle: PuzzleData;
            } | {
                kind: 'error';
                error: string;
            }>) => {
                if (event.data.kind == 'complete') {
                    resolve(event.data.puzzle);
                } else {
                    props.setError(event.data.error);
                }
            };
            worker.postMessage(query.toString());
        }),
    );
    const seed = () => {
        const query = props.query();
        let randomSeed: number;
        if (query.has("seed")) {
            randomSeed = parseInt(query.get("seed")!);
            if (isNaN(randomSeed)) {
                postMessage({kind: 'error', error: "Invalid seed"});
                window.history.replaceState(null, "", window.location.pathname);
                randomSeed = Math.floor(new Date() as any / 8.64e7);
            }
        } else {
            randomSeed = Math.floor(new Date() as any / 8.64e7);
        }
        return randomSeed;
    };
    const [dailiesSolved, setDailiesSolved] = createSignal<number>(
        loadNumFromStorage("GM_dailiesSolved", 0)
    );
    createEffect(() => {
        window.localStorage.GM_dailiesSolved = dailiesSolved().toString();
    });
    const [dailyStreak, setDailyStreak] = createSignal<number>(
        loadNumFromStorage("GM_dailyStreak", 0)
    );
    createEffect(() => {
        if (data.latest && data.latest.isDaily && props.lastDailySolved + 1 < data.latest.randomSeed) {
            setDailyStreak(0);
        }
        window.localStorage.GM_dailyStreak = dailyStreak().toString();
    });
    const [bestDailyStreak, setBestDailyStreak] = createSignal<number>(
        loadNumFromStorage("GM_bestDailyStreak", 0)
    );
    createEffect(() => {
        if (dailyStreak() > bestDailyStreak()) {
            setBestDailyStreak(dailyStreak());
            window.localStorage.GM_bestDailyStreak = bestDailyStreak().toString();
        }
    });
    props.ref({
        toolbarButtons: [
            <Show when={data.latest?.isDaily}>
                <IconButton
                    color="inherit"
                    onClick={() => setStatisticModalOpen(true)}
                    title="Statistics"
                >
                    <BarChart />
                </IconButton>
            </Show>,
            <IconButton
                color="inherit"
                onClick={() => {
                    const urlObj = new URL(location.origin + location.pathname);
                    if (data.latest!.generatedFromSeed) {
                        urlObj.searchParams.set("seed", data.latest!.randomSeed.toString());
                    } else {
                        urlObj.searchParams.set("puzzle", serialise(data.latest!.board));
                    }
                    let url = decodeURIComponent(urlObj.href);
                    if (
                        "share" in navigator
                        && (!("canShare" in navigator) || navigator.canShare({url}))
                    ) {
                        navigator.share({url});
                    } else {
                        navigator.clipboard.writeText(url);
                    }
                }}
                title="Share this puzzle"
                disabled={data.loading}
            >
                <Share />
            </IconButton>
        ]
    });
    return <>
        <Dialog open={statisticModalOpen()} onClose={() => setStatisticModalOpen(false)}>
            <DialogTitle>Statistics</DialogTitle>
            <DialogContent>
                <Typography>
                    Daily puzzles completed: {dailiesSolved()}
                </Typography>
                <Typography>
                    Current daily puzzle streak: {dailyStreak()}
                </Typography>
                <Typography>
                    Longest daily puzzle streak: {bestDailyStreak()}
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setStatisticModalOpen(false)}>Close</Button>
            </DialogActions>
        </Dialog>
        <Show
            when={!data.loading}
            fallback={<Box sx={{
                width: "100%",
                display: "flex",
                flexDirection: 'column',
                alignItems: "center",
                paddingTop: 16,
                gap: 2,
            }}>
                Generating {puzzleDifficulty(seed())} puzzle... (may take a while for larger puzzles)
                <CircularProgress variant="indeterminate" />
            </Box>}
        >
            <PlayPuzzle
                data={data()!}
                setError={props.setError}
                onComplete={() => {
                    if (data.latest!.isDaily) {
                        setDailiesSolved(dailiesSolved => dailiesSolved + 1);
                        props.setLastDailySolved(data.latest!.randomSeed);
                        setDailyStreak(dailyStreak => dailyStreak + 1);
                        setStatisticModalOpen(true);
                    }
                }}
                isCustomPuzzle={!data()!.generatedFromSeed}
                puzzleColours={props.puzzleColours}
                onCheat={data.latest!.isDaily ? () => {
                    if (!data.latest!.isDaily) {
                        return;
                    }
                    props.setLastDailySolved(data.latest!.randomSeed);
                    setDailyStreak(0);
                    setStatisticModalOpen(true);
                } : () => {}}
            />
        </Show>
    </>;
}