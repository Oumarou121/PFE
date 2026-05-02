#!/bin/bash

echo "🚀 Installation de l'application Angular Professional Template"
echo "============================================================"

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Vérifier si npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Installer Angular CLI globalement si pas déjà installé
if ! command -v ng &> /dev/null; then
    echo "📦 Installation d'Angular CLI..."
    npm install -g @angular/cli
else
    echo "✅ Angular CLI déjà installé: $(ng version --version)"
fi

# Installer les dépendances du projet
echo "📦 Installation des dépendances du projet..."
npm install

echo ""
echo "🎉 Installation terminée avec succès !"
echo ""
echo "📋 Prochaines étapes :"
echo "1. Lancer l'API mock: npm run api"
echo "2. Dans un autre terminal, lancer Angular: npm start"
echo "3. Ou lancer les deux: npm run dev"
echo ""
echo "🌐 L'application sera disponible sur: http://localhost:4200"
echo "🔑 Compte de test: admin@test.com / admin123"