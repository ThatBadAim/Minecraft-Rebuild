@echo off
echo Starting Minecraft Web Clone Server...
start "" http://localhost:8080/Minecraft/index.html
python -m http.server 8080
