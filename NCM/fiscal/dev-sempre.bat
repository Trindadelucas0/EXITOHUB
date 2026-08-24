@echo off
cd /d "%~dp0"
title Auditor Fiscal — porta 3000
set PORT=3000
echo Auditor Fiscal sempre no ar na porta 3000
echo Abra: http://localhost:3000
echo Feche esta janela so se quiser desligar.
echo.
node scripts\keep-next.mjs 3000
