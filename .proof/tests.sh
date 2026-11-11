set -u
fails=0
run() { echo "=== $*"; "$@"; local c=$?; echo "--> exit $c"; [[ $c == 0 ]] || fails=$((fails+1)); }
run python3 -m unittest -q tests.test_cargo_locks
run python3 -m unittest -q -k cargo tests.test_cmux_next_prepush_gate
run python3 -m unittest -q tests.test_cmux_next_base_autofix_finishes
run bash scripts/cmux-next/tests/pr-autofix.test.sh
run bash scripts/cmux-next/tests/base-autofix.test.sh
run bash scripts/cmux-next/tests/base-autofix-push.test.sh
for t in test_ci_workflow_path_filter_parity test_ci_workflow_paths_cover_inputs test_ci_actionlint_covers_every_workflow test_ci_rust_cache_runner_cargo_home test_cmux_next_prepush_workflow_yaml; do
  [[ -f tests/$t.py ]] && run python3 -m unittest -q tests.$t
done
[[ -f tests/test_setup_cmux_tui_rust_cargo_home.sh ]] && run bash tests/test_setup_cmux_tui_rust_cargo_home.sh
echo "TEST FAILS=$fails"; exit $fails
