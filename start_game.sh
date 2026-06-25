#!/bin/bash
echo "Starting Minecraft Web Clone Server..."
# Try to open the browser
if which xdg-open > /dev/null
then
  xdg-open http://localhost:8080/Minecraft/index.html &
elif which open > /dev/null
then
  open http://localhost:8080/Minecraft/index.html &
fi
python3 -m http.server 8080
