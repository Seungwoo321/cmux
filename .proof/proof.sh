set -u
fails=0
step() { echo; echo "=== $*"; }
expect() { # expect CODE CMD...
  local want=$1; shift; "$@"; local got=$?
  echo "--> exit $got (want $want)"; [[ $got == "$want" ]] || fails=$((fails+1))
}
git config user.email p@p; git config user.name proof
step "A. current feat-cmux-next tree (after the 5af8bd4e61b revert): red, naming the two FFI locks"
expect 1 python3 scripts/cmux-next/cargo-locks.py check
step "B. with #40898 (c196251c) applied: the fixed base is green"
git apply .proof/fix.patch && expect 0 python3 scripts/cmux-next/cargo-locks.py check
git add -A -- cmux-tui && git commit -qm "fixed base" -- cmux-tui
step "C. eb4f3eb1d94 repeated (rusqlite cache feature, cmux-tui/Cargo.lock only): red"
git apply .proof/break.patch && git diff --stat
expect 1 python3 scripts/cmux-next/cargo-locks.py check
step "D. base-autofix.sh --locks repairs it: only the two FFI locks change, then green"
git add -A -- cmux-tui && git commit -qm "eb4f3eb1 repeated" -- cmux-tui
bash scripts/cmux-next/base-autofix.sh --no-fmt --locks "$PWD"
git status --porcelain -- . ':!.proof' ':!.fast-checks*'
expect 0 python3 scripts/cmux-next/cargo-locks.py check
git checkout -q -- cmux-tui
step "E. tests"
expect 0 python3 -m pytest -q tests/test_cargo_locks.py
expect 0 python3 -m pytest -q tests/test_cmux_next_prepush_gate.py -k "cargo"
expect 0 bash scripts/cmux-next/tests/pr-autofix.test.sh
expect 0 bash scripts/cmux-next/tests/base-autofix.test.sh
expect 0 python3 .github/scripts/test_rust_workspaces.py
for t in tests/test_ci_workflow_path_filter_parity.py tests/test_ci_workflow_paths_cover_inputs.py tests/test_ci_actionlint_covers_every_workflow.py tests/test_ci_rust_cache_runner_cargo_home.py tests/test_cmux_next_base_autofix_finishes.py; do
  [[ -f $t ]] && expect 0 python3 -m pytest -q "$t"
done
echo; echo "PROOF FAILS=$fails"
exit $fails
