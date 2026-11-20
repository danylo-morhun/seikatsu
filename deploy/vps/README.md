# VPS deploy (cyber_Folks, Ubuntu 24.04)

seikatsu runs on the same VPS as Well Botany (`ssh wb-vps`), isolated from it. Kept here so it can be rebuilt.

- User `seikatsu` (system user). It owns `/srv/seikatsu`, can restart only `seikatsu.service` (`sudoers` → `/etc/sudoers.d/seikatsu`) and logs in over SSH only with the GitHub Actions key (`AllowUsers deploy seikatsu` in `/etc/ssh/sshd_config.d/00-hardening.conf`).
- `sk-deploy` → `/usr/local/bin/sk-deploy` (run as `seikatsu`). Releases live in `/srv/seikatsu/releases/<sha>` (git worktrees of `/srv/seikatsu/repo`), `current` / `previous` are symlinks, env is `/srv/seikatsu/shared/.env.production.local` (600), hashed assets pile up in `/srv/seikatsu/shared/static` (served by nginx). Builds run with `nice`/`ionice` so the shop keeps its CPU.
- `sk-deploy-ssh` → `/usr/local/bin/sk-deploy-ssh`, forced command of the Actions key in `~seikatsu/.ssh/authorized_keys` (`command="…",restrict`).
- systemd (`/etc/systemd/system/`):
  - `seikatsu.service`: `next start` from `current/apps/web` on 127.0.0.1:3100. `CPUWeight=50` (half the shop's), `CPUQuota=150%`, `MemoryMax=1536M`, read-only system except `/srv/seikatsu`.
  - `sk-cron@.service` + timers: `sk-cron-notify.timer` (every 15 min → `/api/cron/notify`), `sk-cron-recurring.timer` (00:15 UTC), `sk-cron-sync-banks.timer` (06:00 UTC). Each calls the local app with `CRON_SECRET`.
  - `sk-pg-backup.timer` (03:45 Warsaw) → `sk-pg-backup`: `pg_dump` → `/var/backups/seikatsu` (14 days) → B2 via the shop's rclone crypt remote, folder `seikatsu`.
- Postgres 18 (shared cluster): database `seikatsu` owned by role `seikatsu`. `CONNECT` is revoked from `PUBLIC` on both `seikatsu` and `wellbotany`, so neither app's role can open the other's database. Connection string: `/root/seikatsu-db-url` and `DATABASE_URL` in the env file.
- nginx: `seikatsu.nginx-common.conf` → `/etc/nginx/conf.d/20-seikatsu.conf` (upstream + auth rate limit), `seikatsu.nginx.conf` → `/etc/nginx/sites-enabled/seikatsu`. TLS: certbot webroot, cert name `seikatsu`, renew hook reloads nginx.
- DNS: `seikatsu.danylomorhun.com` A `178.250.47.2`, DNS only (Cloudflare).

Install or update a file: copy it to the path above, then `sudo systemctl daemon-reload` (units) or `sudo nginx -t && sudo systemctl reload nginx` (nginx).

Deploys: `.github/workflows/deploy.yml` (nightly / by hand). By hand on the box: `sudo -u seikatsu -H sk-deploy deploy <sha>`. Rollback: `sudo -u seikatsu -H sk-deploy rollback`.

Restore a backup: `sudo -u postgres pg_restore --clean --if-exists --no-owner --role=seikatsu -d seikatsu /var/backups/seikatsu/seikatsu-YYYY-MM-DD.dump` (stop `seikatsu.service` first).
