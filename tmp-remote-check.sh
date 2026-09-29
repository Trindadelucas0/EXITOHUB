#!/bin/bash
set -e
echo "=== hub cwd ==="
pm2 describe exito-hub | sed -n '1,25p'
echo "=== conci cwd ==="
pm2 describe exito-conci | sed -n '1,25p'
echo "=== grep hub tree ==="
grep -n last_empresa_id /root/PROJETOS/exito/EXITOHUB/CONCI/CONCI/conciliação/src/services/authService.js /root/PROJETOS/exito/EXITOHUB/CONCI/CONCI/conciliação/src/db/bootstrap.js || true
echo "=== pm2 error tail hub ==="
pm2 logs exito-hub --nostream --lines 40 --err | tail -n 50
echo "=== pm2 error tail conci ==="
pm2 logs exito-conci --nostream --lines 40 --err | tail -n 50
