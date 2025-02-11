import {Check, Launch} from "@suid/icons-material";
import {Card, CardHeader, List, ListItem, ListItemButton, ListItemIcon, ListItemText, ListSubheader} from "@suid/material";
import {Show} from "solid-js";
import {PageProps} from "./PageProps";

const CUSTOM_PUZZLES: Record<string, [string, string][]> = {
    "Deckard's 2-Colour Puzzles": [
        ["Example (5×10)", "2;5x10;00111;00111;00111;00111;00111;00111;00111;00111;00111;00111"],
        ["3×3", "2;3x3;110;010;101"],
        ["6×4", "2;6x4;101101;010110;101101;011010"],
        ["7×5", "2;7x5;0111111;1101001;1110110;1000101;0111101"],
        ["7×7", "2;7x7;1010001;1101110;1110111;0111011;1011010;1111101;0101110"],
        ["10×5", "2;10x5;0111000111;1111000000;1111110101;1011100110;0111111101"],
        ["9×6", "2;9x6;110110111;101000110;011101110;010111110;111100111;111010111"],
        ["14×14", "2;14x14;11111111110101;11011011001011;11110011111000;11111001100001;10111001111101;00111110111101;01111101111100;10111011111111;11010010111011;11001101100011;11111101010000;10011100010111;10101111011010;01111011110111"],
    ],
    "Deckard's 3-Colour Puzzles": [
        ["7×7 #1", "3;7x7;2221110;2221120;2220210;2120222;1020222;1222220;1101121"],
        ["7×7 #2", "3;7x7;1110211;2220222;2200112;2200222;2121211;2220112;2200212"],
        ["7×7 #3", "3;7x7;0222221;2201122;2111112;2102102;2012112;2201022;0222220"],
        ["7×7 #4", "3;7x7;0022221;2222221;2201021;2210121;1201022;1222220;1211210"],
        ["7×7 #5", "3;7x7;0021222;2121022;2201222;1110111;2221022;2201212;2221200"],
        ["7×7 #6", "3;7x7;1220022;1220112;1120221;1210221;2220121;2220121;2200222"],
        ["7×7 #7", "3;7x7;2222112;2122101;2221021;0222222;1012002;1010022;1112222"],
        ["7×7 #8", "3;7x7;2220110;2220111;2220121;2220222;1210222;1110222;0110222"],
        ["7×7 #9", "3;7x7;2212222;0122002;1122222;1212222;1202112;1010210;2221010"],
        ["7×7 #10", "3;7x7;2022121;0201212;1222212;2020102;0122222;2110012;2122121"],
        ["7×7 #11", "3;7x7;2222112;1020012;2221221;1121221;2212201;0121222;0022002"],
        ["7×7 #12", "3;7x7;2112202;1220221;2212120;2220222;1202201;0211122;2011021"],
        ["7×7 #13", "3;7x7;2101212;1222221;0201222;0222021;2121022;2211210;2022110"],
        ["7×7 #14", "3;7x7;0021210;1212220;2221121;2220122;1221122;0212212;0221200"],
        ["7×7 #15", "3;7x7;2212121;2212002;1221111;1202202;2220222;2211202;0120120"],
        ["7×7 #16", "3;7x7;0122212;2022212;1220212;1211022;2121220;0202122;1201120"],
        ["10×10", "3;10x10;0020222000;1122022221;1012112212;2111212222;1202121201;2102011002;0222111212;2221222221;2221222112;2222021122"]
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
                                    when={localStorage["GM_" + puzzleDesc + "won"] == "true"}
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