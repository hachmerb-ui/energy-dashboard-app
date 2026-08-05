#!/bin/bash
# ============================================================
# Energy Dashboard – macOS Setup (ohne Docker!)
# Dieses Script richtet alles auf deinem iMac ein.
# ============================================================
set -e

# Homebrew nicht bei jedem Aufruf aktualisieren (spart mehrere Minuten)
export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_ENV_HINTS=1

echo "⚡ Energy Dashboard – macOS Setup"
echo "=================================="
echo ""

# 1. Prüfe/installiere Voraussetzungen
echo "🔍 Prüfe Voraussetzungen..."

# Homebrew nur in die PATH laden, falls vorhanden.
# /opt/homebrew = Apple Silicon, /usr/local = Intel (iMac 2019)
# Homebrew ist NICHT zwingend – auf aelterem macOS uebersetzt es Pakete
# stundenlang aus dem Quellcode, deshalb wird es hier moeglichst gemieden.
for BREW_BIN in /opt/homebrew/bin/brew /usr/local/bin/brew; do
  if [ -x "$BREW_BIN" ]; then
    eval "$("$BREW_BIN" shellenv)"
    if ! grep -q "$BREW_BIN shellenv" ~/.zprofile 2>/dev/null; then
      echo "eval \"\$($BREW_BIN shellenv)\"" >> ~/.zprofile
    fi
    break
  fi
done

export PATH="$HOME/.local/bin:$HOME/.local/node/bin:$PATH"

# Git – auf macOS Teil der Xcode Command Line Tools
if ! command -v git &> /dev/null; then
  echo "📦 Installiere Git (Command Line Tools)..."
  xcode-select --install
  echo "Bitte die Installation im Fenster bestaetigen und das Script danach erneut starten."
  exit 1
fi

# Node.js – fertiges Paket von nodejs.org, kein Quellcode-Build
if ! command -v node &> /dev/null; then
  echo "📦 Installiere Node.js..."
  NODE_VERSION="v22.14.0"
  case "$(uname -m)" in
    arm64) NODE_ARCH="darwin-arm64" ;;
    *)     NODE_ARCH="darwin-x64" ;;
  esac
  mkdir -p "$HOME/.local/node"
  curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-${NODE_ARCH}.tar.gz" \
    | tar -xz -C "$HOME/.local/node" --strip-components=1
  if ! grep -q '.local/node/bin' ~/.zprofile 2>/dev/null; then
    echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zprofile
  fi
fi

# pnpm – NICHT ueber Homebrew: das wuerde node und cmake aus dem Quellcode
# uebersetzen. corepack liegt Node bereits bei.
if ! command -v pnpm &> /dev/null; then
  echo "📦 Installiere pnpm..."
  if command -v corepack &> /dev/null; then
    corepack enable pnpm 2>/dev/null || true
    corepack prepare pnpm@latest --activate 2>/dev/null || true
  fi
  if ! command -v pnpm &> /dev/null; then
    npm install -g pnpm
  fi
fi

# Python wird nicht separat installiert – uv bringt bei Bedarf eine eigene
# Version mit (schneller als ein Quellcode-Build via Homebrew).

# uv (Python package manager)
if ! command -v uv &> /dev/null; then
  echo "📦 Installiere uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# uv liegt in ~/.local/bin – dauerhaft in die PATH aufnehmen
export PATH="$HOME/.local/bin:$PATH"
if ! grep -q '.local/bin' ~/.zprofile 2>/dev/null; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zprofile
fi

echo "✅ Alle Voraussetzungen erfüllt!"
echo ""

# 2. Klone die Projekte
# Ueberschreibbar:  ENERGY_PROJECTS_DIR=~/Projects ./setup-mac.sh
PROJECTS_DIR="${ENERGY_PROJECTS_DIR:-$HOME/Projects/energy}"
mkdir -p "$PROJECTS_DIR"
cd "$PROJECTS_DIR"

echo "📁 Projektordner: $PROJECTS_DIR"
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
  # Kein git pull: dieses Script liegt selbst in dem Ordner. Waehrend es
  # laeuft, wuerde bash eine geaenderte Datei weiterlesen und abstuerzen.
  echo "   energy-dashboard-app bereits vorhanden."
fi

echo ""

# 3. Installiere Projekt-Abhängigkeiten
echo "📦 Installiere Abhängigkeiten..."

# pnpm 11 bricht ab, wenn Pakete ungenutzte Build-Skripte mitbringen
# (ERR_PNPM_IGNORED_BUILDS). Fuer unsere Zwecke ist das unkritisch.
export PNPM_CONFIG_STRICT_DEP_BUILDS=false

pnpm_install() {
  pnpm install --config.strictDepBuilds=false \
    || pnpm install \
    || { echo "❌ pnpm install fehlgeschlagen in $(pwd)"; exit 1; }
}

echo "   → alphaess/backend..."
cd "$PROJECTS_DIR/alphaess/backend" && uv sync

echo "   → alphaess/bff..."
cd "$PROJECTS_DIR/alphaess/bff" && pnpm_install

echo "   → alphaess/frontend..."
cd "$PROJECTS_DIR/alphaess/frontend" && pnpm_install

echo "   → zappi-dashboard/backend..."
cd "$PROJECTS_DIR/zappi-dashboard/backend" && uv sync

echo "   → zappi-dashboard/frontend..."
cd "$PROJECTS_DIR/zappi-dashboard/frontend" && npm install

echo ""

# 3b. Lege Standard-.env-Dateien an (Demo-Modus, damit die App sofort laeuft)
echo "⚙️  Pruefe Konfiguration..."

if [ ! -f "$PROJECTS_DIR/alphaess/backend/.env" ]; then
  echo "DEMO_MODE=true" > "$PROJECTS_DIR/alphaess/backend/.env"
  echo "   → alphaess/backend/.env angelegt (Demo-Modus)"
fi

if [ ! -f "$PROJECTS_DIR/zappi-dashboard/backend/.env" ]; then
  echo "ZAPPI_MODE=fake" > "$PROJECTS_DIR/zappi-dashboard/backend/.env"
  echo "   → zappi-dashboard/backend/.env angelegt (Demo-Modus)"
fi

echo ""

# 4. Baue die Desktop-App und installiere sie in den Programme-Ordner
echo "🔨 Baue die Desktop-App..."
cd "$PROJECTS_DIR/energy-dashboard-app"
npm install
npm run build

APP_BUNDLE="$(find dist -maxdepth 2 -name "*.app" -type d | head -n 1)"

if [ -z "$APP_BUNDLE" ]; then
  echo "❌ Build fehlgeschlagen – keine .app gefunden."
  exit 1
fi

echo "📲 Installiere nach /Applications..."
rm -rf "/Applications/Energy Dashboard.app"
cp -R "$APP_BUNDLE" "/Applications/Energy Dashboard.app"

# Gatekeeper-Quarantaene entfernen, damit kein "nicht verifizierter Entwickler" kommt
xattr -cr "/Applications/Energy Dashboard.app" 2>/dev/null || true

echo ""
echo "============================================================"
echo "✅ FERTIG!"
echo ""
echo "Die App liegt jetzt im Programme-Ordner:"
echo "   Energy Dashboard"
echo ""
echo "So startest du sie:"
echo "   Launchpad öffnen → 'Energy Dashboard' anklicken"
echo "   (oder Finder → Programme → Energy Dashboard)"
echo ""
echo "In der App: '▶ Starten' klicken, kurz warten, dann '🌐 Öffnen'."
echo ""
echo "Die App startet mit Beispieldaten (Demo-Modus)."
echo "Für echte Daten in der App auf '⚙️ Zugangsdaten' klicken,"
echo "Haken bei 'Demo-Modus' entfernen und die Logins eintragen."
echo "============================================================"
