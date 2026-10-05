set -euo pipefail
cd /root/PROJETOS/exito/EXITOHUB

if [ -n "$(git status --porcelain)" ]; then
  echo "ABORTADO: há alteração local. Resolva antes (commit, stash ou revert manual)."
  git status -sb
  exit 1
fi

echo "== antes =="
git log -1 --oneline

git fetch origin
git pull --ff-only origin main

echo "== depois =="
git log -1 --oneline
git status -sb

echo "== npm ci =="
npm ci

echo "== migrate-conci =="
npm run migrate-conci

echo "== NCM Prisma + build =="
cd NCM/fiscal
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env ] && grep -q '^DATABASE_URL=' .env 2>/dev/null; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  elif [ -f ../../.env ]; then
    NCM_URL="$(grep -E '^NCM_DATABASE_URL=' ../../.env | head -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
    if [ -z "$NCM_URL" ]; then
      echo "ABORTADO: defina DATABASE_URL ou NCM_DATABASE_URL no .env da raiz."
      exit 1
    fi
    export DATABASE_URL="$NCM_URL"
  else
    echo "ABORTADO: defina DATABASE_URL ou NCM_DATABASE_URL no .env da raiz."
    exit 1
  fi
fi
npx prisma generate
npm run db:migrate
NODE_OPTIONS=--max-old-space-size=4096 npm run build:hub
cd ../..

echo "== pm2 =="
pm2 restart exito-hub --update-env
pm2 describe exito-hub | sed -n '1,22p'
echo DEPLOY_OK
