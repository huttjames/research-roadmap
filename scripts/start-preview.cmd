@echo off
cd /d "%~dp0.."
start "" "C:\Program Files\nodejs\node.exe" "scripts\static-preview.mjs" > "artifacts\preview-out.log" 2> "artifacts\preview-err.log"
