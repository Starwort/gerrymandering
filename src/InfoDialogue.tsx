import {Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Link, Typography} from "@suid/material";
import {GitHub, Kofi} from "./extra_icons";

interface InfoDialogueProps {
    open: boolean;
    onClose: () => void;
}
export function InfoDialogue(props: InfoDialogueProps) {
    return <Dialog {...props}>
        <DialogTitle>About</DialogTitle>
        <DialogContent>
            <Typography sx={{mb: 1}}>
                This is a digital version of <Link
                    href="https://www.youtube.com/@v.deckard"
                >Deckard</Link>'s Gerrymandering puzzle as initially described
                in <Typography component={Link} href="https://www.youtube.com/watch?v=WQQrFOgRjDg" sx={{fontStyle: "italic"}}>
                    Let's turn Gerrymandering into a puzzle genre!
                </Typography>.
            </Typography>
            <Typography sx={{mb: 1}}>
                The goal is to divide the grid into equal-size districts, such
                that the minority colour (in the default colour scheme, Cyan)
                wins the majority of the districts.
            </Typography>
            <Typography sx={{mb: 1}}>
                Ties for first place are not allowed; ties for second place or
                below are allowed (and may be required). This is true both at
                district-level and overall.
            </Typography>
            <Typography sx={{mb: 1}}>
                Click and drag to form districts. Click on a cell that is already
                part of the current district colour to remove it from the district.
            </Typography>
            <Typography sx={{mb: 1}}>
                Choose which district to form using the panel of buttons. There
                are eight pages of ten colours (twenty colours and 4 patterns)
                to choose from; pages can be navigated using either the arrow
                buttons or the keys A-H, and colours can be selected by clicking
                their button or using the numbers 0-9.
            </Typography>
            <Typography sx={{mb: 1}}>
                Original puzzle by <Link
                    target="_blank"
                    href="https://www.youtube.com/@v.deckard"
                >Deckard</Link>; check out their two videos <Typography
                    component={Link}
                    href="https://www.youtube.com/watch?v=WQQrFOgRjDg"
                    sx={{fontStyle: "italic"}}
                    target="_blank"
                >
                    Let's turn Gerrymandering into a puzzle genre!
                </Typography> and <Typography
                    component={Link}
                    href="https://www.youtube.com/watch?v=SvdJWcijn4M"
                    sx={{fontStyle: "italic"}}
                    target="_blank"
                >
                    Gerrymandering Math & Puzzles with three colours of districts! (Part 2)
                </Typography>.
            </Typography>
            <Typography>
                Implementation by <Link
                    target="_blank"
                    href="https://github.com/Starwort"
                >Starwort</Link>.
            </Typography>
            <Box sx={{display: "flex", justifyContent: "center", gap: 2, paddingTop: 2}}>
                <Button
                    component="a"
                    href="https://ko-fi.com/starwort"
                    startIcon={<Kofi />}
                    variant="contained"
                    target="_blank"
                >
                    Support me on Ko-fi
                </Button>
                <Button
                    component="a"
                    href="https://github.com/Starwort/gerrymandering/"
                    startIcon={<GitHub />}
                    variant="contained"
                    target="_blank"
                >
                    View source on GitHub
                </Button>
            </Box>
        </DialogContent>
        <DialogActions>
            <Button onclick={props.onClose}>Close</Button>
        </DialogActions>
    </Dialog>;
}

