#![recursion_limit = "256"]
#![feature(ascii_char)]
use std::borrow::Cow;
use std::cell::RefCell;
use std::collections::HashSet;
use std::fmt::Debug;
use std::hash::Hash;
use std::iter::{empty, once};
use std::ops::{
    BitAnd,
    BitOr,
    BitOrAssign,
    Index,
    IndexMut,
    Shl,
    ShlAssign,
    Shr,
    SubAssign,
};
use std::rc::Rc;
use std::usize;

use either::Either;
use num::{BigUint, Integer};
use serde_wasm_bindgen::Error;
use wasm_bindgen::prelude::*;

type Result<T, E = Error> = std::result::Result<T, E>;

trait BitBoard:
    Integer
    + Clone
    + for<'a> BitOr<&'a Self, Output = Self>
    + BitOr<Output = Self>
    + BitOrAssign
    + for<'a> BitOrAssign<&'a Self>
    + for<'a> BitAnd<&'a Self, Output = Self>
    + BitAnd<Output = Self>
    + SubAssign
    + for<'a> SubAssign<&'a Self>
    + Shl<usize, Output = Self>
    + ShlAssign<usize>
    + Shr<usize, Output = Self>
    + Hash
    + Debug
{
    fn bits() -> usize;
    fn count_ones(&self) -> usize;
}
impl BitBoard for u32 {
    fn bits() -> usize {
        32
    }

    fn count_ones(&self) -> usize {
        Self::count_ones(*self) as usize
    }
}
impl BitBoard for u64 {
    fn bits() -> usize {
        64
    }

    fn count_ones(&self) -> usize {
        Self::count_ones(*self) as usize
    }
}
impl BitBoard for u128 {
    fn bits() -> usize {
        128
    }

    fn count_ones(&self) -> usize {
        Self::count_ones(*self) as usize
    }
}
impl BitBoard for BigUint {
    fn bits() -> usize {
        usize::MAX
    }

    fn count_ones(&self) -> usize {
        Self::count_ones(&self) as usize
    }
}

type Group<B: BitBoard> = B;

trait ErasedBoard {
    fn solve(&self) -> Result<Vec<Vec<Vec<(usize, usize)>>>>;
}
struct Board<B: BitBoard> {
    width: usize,
    height: usize,
    n_colours: usize,
    boards: [B; 6],
}
impl<B: BitBoard> Index<usize> for Board<B> {
    type Output = B;

    fn index(&self, idx: usize) -> &Self::Output {
        &self.boards[idx]
    }
}
impl<B: BitBoard> IndexMut<usize> for Board<B> {
    fn index_mut(&mut self, idx: usize) -> &mut Self::Output {
        &mut self.boards[idx]
    }
}
impl<B: BitBoard> Board<B> {
    fn parse_with_known_size(
        width: usize,
        height: usize,
        n_colours: usize,
        serialised_board: &[&str],
    ) -> Result<Self> {
        assert!((width + 1) * height <= B::bits());
        assert!(n_colours <= 6);
        let cell_width = (n_colours as f64 + 1f64).log10().ceil() as usize;
        let mut rv = Self {
            width,
            height,
            n_colours,
            boards: [
                B::zero(),
                B::zero(),
                B::zero(),
                B::zero(),
                B::zero(),
                B::zero(),
            ],
        };
        for (y, serialised_row) in serialised_board.into_iter().enumerate() {
            if y > height {
                return Err(Error::new("Invalid board data"));
            }
            for (x, serialised_cell) in serialised_row
                .as_ascii()
                .ok_or_else(|| Error::new("Invalid cell value"))?
                .chunks(cell_width)
                .enumerate()
            {
                if x > width || serialised_cell.len() != cell_width {
                    return Err(Error::new("Invalid row data"));
                }
                let cell = serialised_cell
                    .as_str()
                    .parse::<usize>()
                    .map_err(|_| Error::new("Invalid cell value"))?;
                if cell >= n_colours {
                    return Err(Error::new("Invalid cell colour"));
                }
                rv[cell] |= B::one() << (y * (width + 1) + x);
            }
        }
        Ok(rv)
    }

    fn winner_for(&self, group: &Group<B>) -> Option<usize> {
        let mut scores = vec![0; self.n_colours];
        for (score, board) in scores.iter_mut().zip(self.boards.iter()) {
            *score += (board.clone() & group).count_ones();
        }
        winner(&scores)
    }

    fn validate_candidate_solution(&self, groups: &[Group<B>]) -> bool {
        if groups.is_empty()
            || groups.iter().any(|group| {
                group == &B::zero()
                    || group.count_ones() != groups[0].count_ones()
                    || &((group.clone() << 1
                        | group.clone() >> 1
                        | group.clone() << (self.width + 1)
                        | group.clone() >> (self.width + 1))
                        & group)
                        != group
            })
            || groups
                .iter()
                .fold(B::zero(), |acc, group| acc | group)
                .count_ones()
                != self.width * self.height
        {
            return false;
        }
        let mut scores = vec![0; self.n_colours];
        for group in groups {
            let Some(winner) = self.winner_for(group) else {
                return false;
            };
            scores[winner] += 1;
        }
        winner(&scores) == Some(0)
    }

    fn solve_with_groups(
        &self,
        groups: usize,
        cells_per_group: usize,
    ) -> impl Iterator<Item = Vec<Group<B>>> {
        /// Recursively try to solve the board with the given configuration.
        fn solve_with_partial_groups<'a, B: BitBoard>(
            board: &'a Board<B>,
            groups: usize,
            cells_per_group: usize,
            cache: Rc<RefCell<HashSet<(Vec<Group<B>>, Group<B>)>>>,
            formed_groups: Cow<'a, [Group<B>]>,
            active_group: Group<B>,
        ) -> impl Iterator<Item = Vec<Group<B>>> + 'a {
            // Cache check - if present, we've already done this
            let val = (formed_groups.to_vec(), active_group.clone());
            if !cache.borrow_mut().insert(val) {
                return Either::Right(Either::Right(empty()));
            }

            if active_group.count_ones() == cells_per_group {
                // If the active group is finished, make sure there's a winner
                if board.winner_for(&active_group).is_none() {
                    return Either::Right(Either::Right(empty()));
                }
                // then add it to the list of formed groups
                let next_groups = {
                    let mut groups = formed_groups;
                    groups.to_mut().push(active_group);
                    groups
                };
                if next_groups.len() == groups {
                    // If we've successfully partitioned the board, we can return
                    // either Some(solution) or None if the solution wasn't valid
                    if board.validate_candidate_solution(&next_groups) {
                        return Either::Right(Either::Left(once(
                            next_groups.into_owned(),
                        )));
                    } else {
                        return Either::Right(Either::Right(empty()));
                    }
                } else {
                    // Otherwise, check if it's still possible for colour 0 to win
                    // - colour 0 must have at least as many votes as the runner-up
                    // + the number of remaining groups
                    let remaining_votes = groups - next_groups.len();
                    let mut votes = vec![0; board.n_colours];
                    for group in &*next_groups {
                        votes[board.winner_for(group).unwrap()] += 1;
                    }
                    let minority = votes.remove(0);
                    if votes.into_iter().any(|v| v > minority + remaining_votes) {
                        // If any group has already beaten colour 0, we can prune
                        // this branch
                        return Either::Right(Either::Right(empty()));
                    }
                }
                Either::Left(Box::new(solve_with_partial_groups(
                    board,
                    groups,
                    cells_per_group,
                    cache,
                    next_groups,
                    B::zero(),
                )) as Box<dyn Iterator<Item = _>>)
            } else if active_group == B::zero() {
                // If this is a new group, find the first free cell (WLoG) and
                // start a new group from there
                let used = formed_groups
                    .iter()
                    .fold(B::zero(), |acc, group| acc | group);
                for y in 0..board.height {
                    for x in 0..board.width {
                        if (B::one() << (y * (board.width + 1) + x)) & &used
                            == B::zero()
                        {
                            let mut active_group = active_group;
                            active_group |= B::one() << (y * (board.width + 1) + x);
                            return Either::Left(Box::new(solve_with_partial_groups(
                                board,
                                groups,
                                cells_per_group,
                                cache,
                                formed_groups,
                                active_group,
                            )));
                        }
                    }
                }
                unreachable!()
            } else {
                // Otherwise, we've got a partially-filled group - determine all
                // possible next cells and recurse on them
                let adjacent_cells = active_group.clone() << 1
                    | active_group.clone() >> 1
                    | active_group.clone() << board.width
                    | active_group.clone() >> board.width;
                let mut next_groups = Vec::new();
                let used = formed_groups
                    .iter()
                    .fold(active_group.clone(), |acc, group| acc | group);
                for y in 0..board.height {
                    for x in 0..board.width {
                        let mask = B::one() << (y * (board.width + 1) + x);
                        if mask.clone() & &used == B::zero()
                            && mask.clone() & &adjacent_cells != B::zero()
                        {
                            next_groups.push(mask | &active_group);
                        }
                    }
                }
                Either::Left(Box::new(next_groups.into_iter().flat_map(move |group| {
                    solve_with_partial_groups(
                        board,
                        groups,
                        cells_per_group,
                        Rc::clone(&cache),
                        formed_groups.clone(),
                        group,
                    )
                })))
            }
        }
        solve_with_partial_groups(
            self,
            groups,
            cells_per_group,
            Rc::new(RefCell::new(HashSet::new())),
            Cow::Owned(vec![]),
            B::zero(),
        )
    }
}
fn parse_board(board: &str) -> Result<Box<dyn ErasedBoard>> {
    let parts = board.split(';').collect::<Vec<_>>();
    let [n_colours, size, serialised_board @ ..] = &parts[..] else {
        return Err(Error::new("Invalid puzzle data"));
    };
    let n_colours = n_colours
        .parse::<usize>()
        .map_err(|_| Error::new("Invalid number of colours"))?;
    if n_colours < 2 {
        return Err(Error::new("Invalid number of colours"));
    }
    let Ok(&[w, h]) = size
        .split('x')
        .map(|v| v.parse::<usize>())
        .collect::<Result<Vec<usize>, _>>()
        .as_deref()
    else {
        return Err(Error::new("Invalid puzzle size"));
    };
    if (w + 1) * h <= 32 {
        Ok(Box::new(Board::<u32>::parse_with_known_size(
            w,
            h,
            n_colours,
            serialised_board,
        )?))
    } else if (w + 1) * h <= 64 {
        Ok(Box::new(Board::<u64>::parse_with_known_size(
            w,
            h,
            n_colours,
            serialised_board,
        )?))
    } else if (w + 1) * h <= 128 {
        Ok(Box::new(Board::<u128>::parse_with_known_size(
            w,
            h,
            n_colours,
            serialised_board,
        )?))
    } else {
        Ok(Box::new(Board::<BigUint>::parse_with_known_size(
            w,
            h,
            n_colours,
            serialised_board,
        )?))
    }
}
impl<B: BitBoard> ErasedBoard for Board<B> {
    fn solve(&self) -> Result<Vec<Vec<Vec<(usize, usize)>>>> {
        let result = factor_pairs(self.width * self.height)
            .flat_map(|(a, b)| {
                self.solve_with_groups(a, b).chain(
                    if a != b {
                        Either::Left(self.solve_with_groups(b, a))
                    } else {
                        Either::Right(empty())
                    },
                )
            })
            .map(|groups| {
                groups
                    .into_iter()
                    .map(|group| {
                        let mut cells = Vec::with_capacity(group.count_ones());
                        for y in 0..self.height {
                            for x in 0..self.width {
                                if (B::one() << (y * (self.width + 1) + x)) & &group
                                    != B::zero()
                                {
                                    cells.push((x, y));
                                }
                            }
                        }
                        cells
                    })
                    .collect()
            })
            .collect::<Vec<_>>();
        if result.is_empty() {
            Err(Error::new("Board is unsolvable"))
        } else {
            Ok(result)
        }
    }
}

fn winner(scores: &[usize]) -> Option<usize> {
    let (winner, best_score) = scores.iter().enumerate().max_by_key(|(_, i)| *i)?;
    if scores.iter().filter(|&score| score == best_score).count() == 1 {
        Some(winner)
    } else {
        None
    }
}

fn factor_pairs(n: usize) -> impl Iterator<Item = (usize, usize)> {
    (1..)
        .take_while(move |i| i * i <= n)
        .filter(move |i| n % i == 0)
        .map(move |i| (i, n / i))
}

#[wasm_bindgen(js_name = solvePuzzle)]
pub fn solve_puzzle(puzzle_desc: String) -> Result<JsValue> {
    serde_wasm_bindgen::to_value(&parse_board(&puzzle_desc)?.solve()?)
}

#[cfg(test)]
mod test {
    macro_rules! bitboard {
        ($($bits:tt)*) => {{
            [$($bits),*]
                .into_iter()
                .enumerate()
                .map(|(i, bit)| bit << i)
                .fold(0, |acc, bit| acc | bit)
        }};
    }

    use super::*;

    #[test]
    fn test_parse_board() {
        let board = Board::<u64>::parse_with_known_size(7, 7, 3, &[
            "2221110", "2221120", "2220210", "2120222", "1020222", "1222220", "1101121",
        ])
        .unwrap();
        assert_eq!(board.width, 7);
        assert_eq!(board.height, 7);
        assert_eq!(board.boards, [
            bitboard!(
                0 0 0 0 0 0 1 0
                0 0 0 0 0 0 1 0
                0 0 0 1 0 0 1 0
                0 0 0 1 0 0 0 0
                0 1 0 1 0 0 0 0
                0 0 0 0 0 0 1 0
                0 0 1 0 0 0 0 0
            ),
            bitboard!(
                0 0 0 1 1 1 0 0
                0 0 0 1 1 0 0 0
                0 0 0 0 0 1 0 0
                0 1 0 0 0 0 0 0
                1 0 0 0 0 0 0 0
                1 0 0 0 0 0 0 0
                1 1 0 1 1 0 1 0
            ),
            bitboard!(
                1 1 1 0 0 0 0 0
                1 1 1 0 0 1 0 0
                1 1 1 0 1 0 0 0
                1 0 1 0 1 1 1 0
                0 0 1 0 1 1 1 0
                0 1 1 1 1 1 0 0
                0 0 0 0 0 1 0 0
            ),
            0,
            0,
            0
        ])
    }

    fn js_groups_to_groups<const N: usize, const M: usize, B: BitBoard>(
        js_groups: [[[usize; 2]; N]; M],
    ) -> Vec<Group<B>> {
        js_groups
            .into_iter()
            .map(|group| {
                group
                    .into_iter()
                    .map(|[x, y]| B::one() << (y * (N + 1) + x))
                    .fold(B::zero(), |acc, bit| acc | bit)
            })
            .collect()
    }

    #[test]
    fn test_solution_accepted() {
        let board = Board::<u64>::parse_with_known_size(7, 7, 3, &[
            "2221110", "2221120", "2220210", "2120222", "1020222", "1222220", "1101121",
        ])
        .unwrap();
        let groups = js_groups_to_groups([
            [[6, 0], [5, 0], [5, 1], [4, 2], [3, 2], [4, 1], [3, 3]],
            [[5, 2], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [6, 6]],
            [[4, 5], [4, 4], [4, 3], [5, 3], [5, 4], [5, 5], [5, 6]],
            [[1, 4], [2, 4], [3, 4], [3, 5], [2, 6], [3, 6], [4, 6]],
            [[2, 5], [1, 5], [1, 6], [0, 6], [0, 5], [0, 4], [0, 3]],
            [[1, 3], [2, 3], [2, 2], [2, 1], [3, 1], [3, 0], [4, 0]],
            [[2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [1, 2], [1, 1]],
        ]);
        assert_eq!(&groups, &[
            bitboard!(
                0 0 0 0 0 1 1 0
                0 0 0 0 1 1 0 0
                0 0 0 1 1 0 0 0
                0 0 0 1 0 0 0 0
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
            ),
            bitboard!(
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 1 0
                0 0 0 0 0 1 1 0
                0 0 0 0 0 0 1 0
                0 0 0 0 0 0 1 0
                0 0 0 0 0 0 1 0
                0 0 0 0 0 0 1 0
            ),
            bitboard!(
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
                0 0 0 0 1 1 0 0
                0 0 0 0 1 1 0 0
                0 0 0 0 1 1 0 0
                0 0 0 0 0 1 0 0
            ),
            bitboard!(
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
                0 1 1 1 0 0 0 0
                0 0 0 1 0 0 0 0
                0 0 1 1 1 0 0 0
            ),
            bitboard!(
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
                1 0 0 0 0 0 0 0
                1 0 0 0 0 0 0 0
                1 1 1 0 0 0 0 0
                1 1 0 0 0 0 0 0
            ),
            bitboard!(
                0 0 0 1 1 0 0 0
                0 0 1 1 0 0 0 0
                0 0 1 0 0 0 0 0
                0 1 1 0 0 0 0 0
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
            ),
            bitboard!(
                1 1 1 0 0 0 0 0
                1 1 0 0 0 0 0 0
                1 1 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
                0 0 0 0 0 0 0 0
            ),
        ]);
        assert!(board.validate_candidate_solution(&groups));
    }
    #[test]
    fn test_any_sol_found() {
        let board = Board::<u64>::parse_with_known_size(7, 7, 3, &[
            "2221110", "2221120", "2220210", "2120222", "1020222", "1222220", "1101121",
        ])
        .unwrap();
        let groups = board.solve_with_groups(7, 7).next();
        assert!(groups.is_some());
    }
    #[test]
    fn test_sol_found() {
        let board = parse_board(
            "3;7x7;2221110;2221120;2220210;2120222;1020222;1222220;1101121",
        )
        .unwrap();
        let groups = board.solve();
        assert!(groups.is_ok());
    }
}
