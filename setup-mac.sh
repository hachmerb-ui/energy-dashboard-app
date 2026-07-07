#!/bin/bash
# ============================================================
# Energy Dashboard – macOS Setup
# Dieses Script richtet alles auf deinem iMac ein.
# ============================================================
set -e

echo "⚡ Energy Dashboard – macOS Setup"
echo "=================================="
echo ""

# 1. Prüfe Voraussetzungen
echo "🔍 Prüfe Voraussetzungen..."

# Homebrew
if ! command -v brew &> /dev/null; then
  echo "📦 Installiere Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Git
if ! command -v git &> /dev/null; then
  echo "📦 Installiere Git..."
  brew install git
fi

# Node.js
if ! command -v node &> /dev/null; then
  echo "📦 Installiere Node.js..."
  brew install node
fi

# Docker Desktop
if ! command -v docker &> /dev/null; then
  echo "📦 Installiere Docker Desktop..."
  brew install --cask docker
  echo ""
  echo "⚠️  Bitte starte Docker Desktop einmal manuell aus dem Applications-Ordner!"
  echo "   Danach dieses Script erneut ausführen."
  open /Applications/Docker.app
  exit 0
fi

echo "✅ Alle Voraussetzungen erfüllt!"
echo ""

# 2. Klone die Projekte
PROJECTS_DIR="$HOME/Projects/energy"
mkdir -p "$PROJECTS_DIR"
cd "$PROJECTS_DIR"

echo "📥 Klone Projekte..."

if [ ! -d "alphaess" ]; then
  git clone https://github.com/hachmerb-ui/alphaess.git
else
  echo "   alphaess bereits vorhanden, aktualisiere..."
  cd alphaess && git pull && cd ..
fi

if [ ! -d "zappi-dashboard" ]; then
  git clone https://github.com/hachmerb-ui/zappi-dashboard.git
else
  echo "   zappi-dashboard bereits vorhanden, aktualisiere..."
  cd zappi-dashboard && git pull && cd ..
fi

if [ ! -d "energy-dashboard-app" ]; then
  git clone https://github.com/hachmerb-ui/energy-dashboard-app.git
else
  echo "   energy-dashboard-app bereits vorhanden, aktualisiere..."
  cd energy-dashboard-app && git pull && cd ..
fi

echo ""

# 3. Installiere App-Dependencies und baue die App
echo "🔨 Baue die Desktop-App..."
cd energy-dashboard-app
npm install
npm run build

echo ""
echo "============================================================"
echo "✅ FERTIG!"
echo ""
echo "Die App findest du unter:"
echo "   $PROJECTS_DIR/energy-dashboard-app/dist/"
echo ""
echo "📝 Vergiss nicht die .env-Dateien einzutragen:"
echo "   $PROJECTS_DIR/alphaess/backend/.env"
echo "   $PROJECTS_DIR/alphaess/bff/.env"
echo "   $PROJECTS_DIR/alphaess/frontend/.env"
echo "   $PROJECTS_DIR/zappi-dashboard/backend/.env"
echo ""
echo "Danach die App starten und auf '▶ Starten' klicken!"
echo "============================================================"
