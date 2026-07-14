#!/bin/bash
# ============================================================
# Energy Dashboard – macOS Setup (ohne Docker!)
# Dieses Script richtet alles auf deinem iMac ein.
# ============================================================
set -e

echo "⚡ Energy Dashboard – macOS Setup"
echo "=================================="
echo ""

# 1. Prüfe/installiere Voraussetzungen
echo "🔍 Prüfe Voraussetzungen..."

# Homebrew
if ! command -v brew &> /dev/null; then
  echo "📦 Installiere Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add Homebrew to PATH for Apple Silicon
  if [ -f "/opt/homebrew/bin/brew" ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
  fi
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

# pnpm
if ! command -v pnpm &> /dev/null; then
  echo "📦 Installiere pnpm..."
  brew install pnpm
fi

# Python
if ! command -v python3 &> /dev/null; then
  echo "📦 Installiere Python..."
  brew install python@3.12
fi

# uv (Python package manager)
if ! command -v uv &> /dev/null; then
  echo "📦 Installiere uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
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

# 3. Installiere Projekt-Abhängigkeiten
echo "📦 Installiere Abhängigkeiten..."

echo "   → alphaess/backend..."
cd "$PROJECTS_DIR/alphaess/backend" && uv sync

echo "   → alphaess/bff..."
cd "$PROJECTS_DIR/alphaess/bff" && pnpm install

echo "   → alphaess/frontend..."
cd "$PROJECTS_DIR/alphaess/frontend" && pnpm install

echo "   → zappi-dashboard/backend..."
cd "$PROJECTS_DIR/zappi-dashboard/backend" && uv sync

echo "   → zappi-dashboard/frontend..."
cd "$PROJECTS_DIR/zappi-dashboard/frontend" && npm install

echo ""

# 4. Baue die Desktop-App
echo "🔨 Baue die Desktop-App..."
cd "$PROJECTS_DIR/energy-dashboard-app"
npm install
npm run build

echo ""
echo "============================================================"
echo "✅ FERTIG!"
echo ""
echo "Die App findest du unter:"
echo "   $PROJECTS_DIR/energy-dashboard-app/dist/"
echo ""
echo "Doppelklick auf die .dmg Datei → App in Applications ziehen."
echo ""
echo "📝 Vergiss nicht die .env-Dateien einzutragen:"
echo "   $PROJECTS_DIR/alphaess/backend/.env"
echo "   $PROJECTS_DIR/alphaess/bff/.env"
echo "   $PROJECTS_DIR/alphaess/frontend/.env"
echo "   $PROJECTS_DIR/zappi-dashboard/backend/.env"
echo ""
echo "Dann App starten → '▶ Starten' klicken → '🌐 Öffnen'!"
echo "============================================================"
