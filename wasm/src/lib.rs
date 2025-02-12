#![feature(ascii_char)]
use std::collections::HashSet;
use std::sync::RwLock;

use ndarray::Array2;
use rayon::prelude::*;
use serde_wasm_bindgen::Error;
use wasm_bindgen::prelude::*;
pub use wasm_bindgen_rayon::init_thread_pool;

type Result<T, E = Error> = std::result::Result<T, E>;

type Group = Vec<(usize, usize)>;

type Board = Array2<usize>;

fn parse_board(board: &str) -> Result<Board> {
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
    let cell_width = (n_colours as f64 + 1f64).log10().ceil() as usize;
    let Ok(&[w, h]) = size
        .split('x')
        .map(|v| v.parse::<usize>())
        .collect::<Result<Vec<usize>, _>>()
        .as_deref()
    else {
        return Err(Error::new("Invalid puzzle size"));
    };
    let mut result = Array2::zeros([h, w]);
    for (y, serialised_row) in serialised_board.into_iter().enumerate() {
        if y > result.shape()[0] {
            return Err(Error::new("Invalid board data"));
        }
        for (x, serialised_cell) in serialised_row
            .as_ascii()
            .ok_or_else(|| Error::new("Invalid cell value"))?
            .chunks(cell_width)
            .enumerate()
        {
            if x > result.shape()[1] || serialised_cell.len() != cell_width {
                return Err(Error::new("Invalid row data"));
            }
            let cell = serialised_cell
                .as_str()
                .parse::<usize>()
                .map_err(|_| Error::new("Invalid cell value"))?;
            if cell >= n_colours {
                return Err(Error::new("Invalid cell colour"));
            }
            result[[y, x]] = cell;
        }
    }
    Ok(result)
}

fn winner_for(board: &Board, group: &Group, n_colours: usize) -> Option<usize> {
    let mut scores = vec![0; n_colours];
    for &(x, y) in group {
        scores[board[[y, x]]] += 1;
    }
    winner(&scores)
}

fn winner(scores: &[usize]) -> Option<usize> {
    let (winner, best_score) = scores.iter().enumerate().max_by_key(|(_, i)| *i)?;
    if scores.iter().filter(|&score| score == best_score).count() == 1 {
        Some(winner)
    } else {
        None
    }
}

fn validate_candidate_solution(board: &Board, groups: &[Group]) -> bool {
    if groups.is_empty()
        || groups.iter().any(|group| {
            group.is_empty()
                || group.len() != groups[0].len()
                || !group.iter().all(|&(x, y)| {
                    x > 0 && group.contains(&(x - 1, y))
                        || group.contains(&(x + 1, y))
                        || y > 0 && group.contains(&(x, y - 1))
                        || group.contains(&(x, y + 1))
                })
        })
        || groups.iter().map(|g| g.len()).sum::<usize>() != board.len()
    {
        return false;
    }
    let mut scores = vec![0; board.iter().max().unwrap() + 1];
    for group in groups {
        let Some(winner) = winner_for(&board, group, scores.len()) else {
            return false;
        };
        scores[winner] += 1;
    }
    winner(&scores) == Some(0)
}

fn factor_pairs(n: usize) -> impl Iterator<Item = (usize, usize)> {
    (1..)
        .take_while(move |i| i * i <= n)
        .filter(move |i| n % i == 0)
        .map(move |i| (i, n / i))
}

fn solve_board(board: &Board) -> Result<Vec<Group>> {
    let (h, w) = board.dim();
    for (a, b) in factor_pairs(h * w) {
        if a == 1 || a == 2 {
            // a valid solution is impossible when x is 1 or 2:
            // when x is 1, it's just a majority vote (which will always be an
            // invalid solution as by construction the objective is to make the
            // minority win), and when x is 2, because ties are disallowed, each
            // group must be unanimous, which reduces to the same problem as x
            // being 1.
            continue;
        }
        if let Some(solution) = try_solve_board_with_groups(board, a, b).or_else(|| {
            if a != b {
                try_solve_board_with_groups(board, b, a)
            } else {
                None
            }
        }) {
            return Ok(solution);
        }
    }
    Err(Error::new("Board is unsolvable"))
}

pub(crate) fn try_solve_board_with_groups(
    board: &Board,
    groups: usize,
    cells_per_group: usize,
) -> Option<Vec<Group>> {
    fn solve_with_partial_groups(
        board: &Board,
        groups: usize,
        cells_per_group: usize,
        cache: &RwLock<HashSet<(Vec<Group>, Group)>>,
        n_colours: usize,
        formed_groups: &Vec<Group>,
        active_group: Group,
    ) -> Option<Vec<Group>> {
        let val = (formed_groups.clone(), active_group.clone());
        if cache.read().unwrap().contains(&val) {
            return None;
        }
        cache.write().unwrap().insert(val);
        if active_group.len() == cells_per_group {
            winner_for(board, &active_group, n_colours)?;
            let next_groups = {
                let mut groups = formed_groups.clone();
                groups.push(active_group);
                groups
            };
            if next_groups.len() == groups {
                if validate_candidate_solution(board, &next_groups) {
                    return Some(next_groups);
                } else {
                    return None;
                }
            } else {
                let remaining_votes = groups - next_groups.len();
                let mut votes = vec![0; n_colours];
                for group in &*next_groups {
                    votes[winner_for(board, group, n_colours).unwrap()] += 1;
                }
                let minority = votes.remove(0);
                if votes.into_iter().any(|v| v > minority + remaining_votes) {
                    return None;
                }
            }
            solve_with_partial_groups(
                board,
                groups,
                cells_per_group,
                cache,
                n_colours,
                &next_groups,
                vec![],
            )
        } else if active_group.is_empty() {
            for y in 0..board.shape()[0] {
                for x in 0..board.shape()[1] {
                    if !formed_groups.iter().any(|group| group.contains(&(x, y))) {
                        let mut active_group = active_group;
                        active_group.push((x, y));
                        return solve_with_partial_groups(
                            board,
                            groups,
                            cells_per_group,
                            cache,
                            n_colours,
                            formed_groups,
                            active_group,
                        );
                    }
                }
            }
            unreachable!()
        } else {
            active_group
                .iter()
                .flat_map(|&(x, y)| {
                    [(usize::MAX, 0), (1, 0), (0, usize::MAX), (0, 1)]
                        .into_iter()
                        .map(move |(dx, dy)| (x.wrapping_add(dx), y.wrapping_add(dy)))
                        .filter(|&(dx, dy)| {
                            dx < board.shape()[1] && dy < board.shape()[0]
                        })
                })
                .collect::<Vec<_>>()
                .into_par_iter()
                .find_map_any(|(x, y)| {
                    let mut new_group = active_group.clone();
                    new_group.push((x, y));
                    new_group.sort();
                    solve_with_partial_groups(
                        board,
                        groups,
                        cells_per_group,
                        cache,
                        n_colours,
                        formed_groups,
                        new_group,
                    )
                })
        }
    }
    let n_colours = board.iter().max().unwrap() + 1;
    let cache = RwLock::new(HashSet::new());
    solve_with_partial_groups(
        board,
        groups,
        cells_per_group,
        &cache,
        n_colours,
        &vec![],
        vec![],
    )
}

#[wasm_bindgen(js_name = solvePuzzle)]
pub fn solve_puzzle(puzzle_desc: String) -> Result<JsValue> {
    serde_wasm_bindgen::to_value(&solve_board(&parse_board(&puzzle_desc)?)?)
}

#[cfg(test)]
mod test {
    use ndarray::array;

    use super::*;

    #[test]
    fn test_parse_board() {
        let board = parse_board(
            "3;7x7;2221110;2221120;2220210;2120222;1020222;1222220;1101121",
        )
        .unwrap();
        assert_eq!(board.shape(), [7, 7]);
        assert_eq!(board, array![
            [2, 2, 2, 1, 1, 1, 0],
            [2, 2, 2, 1, 1, 2, 0],
            [2, 2, 2, 0, 2, 1, 0],
            [2, 1, 2, 0, 2, 2, 2],
            [1, 0, 2, 0, 2, 2, 2],
            [1, 2, 2, 2, 2, 2, 0],
            [1, 1, 0, 1, 1, 2, 1]
        ])
    }

    fn js_groups_to_groups<const N: usize, const M: usize>(
        js_groups: [[[usize; 2]; N]; M],
    ) -> Vec<Group> {
        js_groups
            .into_iter()
            .map(|group| group.into_iter().map(|[x, y]| (x, y)).collect())
            .collect()
    }

    #[test]
    fn test_solution_accepted() {
        let board = parse_board(
            "3;7x7;2221110;2221120;2220210;2120222;1020222;1222220;1101121",
        )
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
        assert!(validate_candidate_solution(&board, &groups));
    }
    #[test]
    fn test_sol_found() {
        let board = parse_board(
            "3;7x7;2221110;2221120;2220210;2120222;1020222;1222220;1101121",
        )
        .unwrap();
        // let solution = js_groups_to_groups([
        //     [[6, 0], [5, 0], [5, 1], [4, 2], [3, 2], [4, 1], [3, 3]],
        //     [[5, 2], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [6, 6]],
        //     [[4, 5], [4, 4], [4, 3], [5, 3], [5, 4], [5, 5], [5, 6]],
        //     [[1, 4], [2, 4], [3, 4], [3, 5], [2, 6], [3, 6], [4, 6]],
        //     [[2, 5], [1, 5], [1, 6], [0, 6], [0, 5], [0, 4], [0, 3]],
        //     [[1, 3], [2, 3], [2, 2], [2, 1], [3, 1], [3, 0], [4, 0]],
        //     [[2, 0], [1, 0], [0, 0], [0, 1], [0, 2], [1, 2], [1, 1]],
        // ]);
        let groups = try_solve_board_with_groups(&board, 7, 7);
        assert!(groups.is_some());
    }
}
