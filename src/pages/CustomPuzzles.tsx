import {Check, Launch} from "@suid/icons-material";
import {Card, CardHeader, List, ListItem, ListItemButton, ListItemIcon, ListItemText, ListSubheader} from "@suid/material";
import {Show} from "solid-js";
import {PageProps} from "./PageProps";

const CUSTOM_PUZZLES: Record<string, [string, string][]> = {
    "Deckard's 3-Colour Puzzles": [
        ["7×7 #1", "3;7x7;2221110;2221120;2220210;2120222;1020222;1222220;1101121"],

    ],
    "Deckard's 3-Colour No-2×2 Puzzles": [
        ["7×7 #1", "3;7x7;1110211;2220222;2200112;2200222;2121211;2220112;2200212"],
        ["7×7 #2", "3;7x7;0222221;2201122;2111112;2102102;2012112;2201022;0222220"],
        ["7×7 #3", "3;7x7;0022221;2222221;2201021;2210121;1201022;1222220;1211210"],
        ["7×7 #4", "3;7x7;0021222;2121022;2201222;1110111;2221022;2201212;2221200"],
        ["7×7 #5", "3;7x7;1220022;1220112;1120221;1210221;2220121;2220121;2200222"],
        ["7×7 #6", "3;7x7;2222112;2122101;2221021;0222222;1012002;1010022;1112222"],
        ["7×7 #7", "3;7x7;2220110;2220111;2220121;2220222;1210222;1110222;0110222"],
        ["7×7 #8", "3;7x7;2212222;0122002;1122222;1212222;1202112;1010210;2221010"]
    ],
};

export function CustomPuzzles(props: PageProps) {
    return <>
        <Card sx={{
            maxWidth: 600,
            width: "100%",
            textAlign: "center"
        }}>
            <CardHeader
                title="Custom Puzzles"
                subheader="Puzzles made by humans"
            />
            <List>
                {Object.entries(CUSTOM_PUZZLES).map(([category, puzzles]) => (
                    <>
                        <ListSubheader sx={{backgroundColor: "transparent"}}>
                            {category}
                        </ListSubheader>
                        {puzzles.map(([name, puzzleDesc]) => <ListItem disablePadding>
                            <ListItemButton
                                component="a"
                                href={window.location.pathname + "?puzzle=" + puzzleDesc}
                                onClick={event => {
                                    event.preventDefault();
                                    props.setPage("play", "puzzle=" + puzzleDesc);
                                }}
                            >
                                <Show
                                    when={localStorage[puzzleDesc + "won"] == "true"}
                                    fallback={<ListItemText primary={name} inset />}
                                >
                                    <ListItemIcon>
                                        <Check />
                                    </ListItemIcon>
                                    <ListItemText primary={name} />
                                </Show>
                            </ListItemButton>
                        </ListItem>)}
                    </>
                ))}
                <ListItemButton
                    component="a"
                    href={window.location.pathname + "?page=designer"}
                    onClick={event => {
                        event.preventDefault();
                        props.setPage("designer");
                    }}
                >
                    <ListItemIcon>
                        <Launch />
                    </ListItemIcon>
                    <ListItemText primary="Design your own" />
                </ListItemButton>
            </List>
        </Card>
    </>;
}