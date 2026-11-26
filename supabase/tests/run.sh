#!/bin/sh
# Twodo · tries the database's rules on a throwaway Postgres (16 or newer): the Supabase pieces they need
# (supabase_stub.sql), every migration in order, then rls_test.sql (an attacker with a normal account).
# Needs Postgres's server programs (initdb, pg_ctl, psql). Run as yourself, or as root (it uses the postgres user).
#   sh supabase/tests/run.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd); root=$(cd "$here/../.." && pwd)
bin=${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}
[ -x "$bin/initdb" ] || { echo "Postgres server programs not found (set PG_BIN)"; exit 1; }
dir=$(mktemp -d); port=${PG_PORT:-54329}
as() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$dir"
cleanup() { as "$bin/pg_ctl" -D "$dir/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$dir"; }
trap cleanup EXIT
as "$bin/initdb" -D "$dir/db" -U postgres -A trust >/dev/null
as "$bin/pg_ctl" -D "$dir/db" -o "-p $port -k $dir -c listen_addresses=''" -l "$dir/log" -w start >/dev/null
q() { as "$bin/psql" -X -q -h "$dir" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
q -f "$here/supabase_stub.sql" >/dev/null
for m in $(ls "$root"/supabase/migrations/*.sql | sort); do q -f "$m" >/dev/null; done
cp "$here/rls_test.sql" "$dir/t.sql"; [ "$(id -u)" = 0 ] && chown postgres "$dir/t.sql"
ok=0; q -o /dev/null -f "$dir/t.sql" > "$dir/out" 2>&1 || ok=$?
sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //' -e 's/^psql:[^ ]* ERROR:  //' "$dir/out"
[ "$ok" = 0 ] || exit $ok
# a race: two people with the same invitation join at the same moment; only one of them gets in
S3=3333333333333333333333333333333333333333 T=abababababababababababababababababababababababababababababababab
q -o /dev/null -c "insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002'), ('00000000-0000-0000-0000-000000000003')" \
  -c "set role authenticated" -c "select t.as_('1')" -c "select public.create_space('$S3', t.h('$T'), 'a')"
join() { q -o /dev/null -c "set role authenticated" -c "select t.as_('$1')" -c "begin" -c "select public.join_space('$S3', '$T', 'b')" -c "select pg_sleep(1)" -c "commit" >/dev/null 2>&1 || true; }
join 2 & join 3 & wait
n=$(q -At -c "select count(*) from public.space_members where space_id = '$S3'")
[ "$n" = 2 ] && echo "ok - two people joining with one invitation at the same moment: only one gets in" || { echo "not ok - race: $n members"; exit 1; }
echo "ALL CHECKS PASSED ($(grep -c "NOTICE:  ok - " "$dir/out") + 1)"
