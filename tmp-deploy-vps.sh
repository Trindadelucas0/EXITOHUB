#!/bin/bash
set -euo pipefail
cd /root/PROJETOS/exito/EXITOHUB

echo "== antes =="
git log -1 --oneline

git checkout -- \
  "CONCI/CONCI/conciliação/src/routes/conciliacao.js" \
  "CONCI/CONCI/conciliação/src/services/parsers/contasPagar.js" \
  "CONCI/CONCI/conciliação/src/services/preCadastroStore.js"

git fetch origin
git pull --ff-only origin main

echo "== depois =="
git log -1 --oneline
git status -sb

echo "== npm ci =="
npm ci

echo "== migrate-conci =="
npm run migrate-conci

echo "== pm2 =="
pm2 restart exito-hub --update-env
pm2 describe exito-hub | sed -n '1,22p'
echo DEPLOY_OK
