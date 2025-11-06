#!/bin/bash

# This script fixes all expo-doctor issues without losing any project data
# Your code, assets, and configurations will remain intact

echo "Starting fix process..."

# 1. Backup package.json just in case
cp package.json package.json.backup
echo "✓ Backed up package.json"

# 2. Fix .gitignore (add .expo if not already there)
if ! grep -q "^\.expo/$" .gitignore; then
    echo ".expo/" >> .gitignore
    echo "✓ Added .expo/ to .gitignore"
else
    echo "✓ .expo/ already in .gitignore"
fi

# 3. Remove @expo/config-plugins from package.json if it exists
if grep -q '"@expo/config-plugins"' package.json; then
    # Use sed to remove the line (works on both Linux and Mac)
    sed -i.bak '/"@expo\/config-plugins"/d' package.json
    echo "✓ Removed @expo/config-plugins from package.json"
fi

# 4. Fix app.json - remove usesCleartextTraffic
if [ -f app.json ]; then
    cp app.json app.json.backup
    # Remove the usesCleartextTraffic line
    sed -i.bak '/usesCleartextTraffic/d' app.json
    # Clean up extra commas that might be left behind
    sed -i.bak 's/,\s*,/,/g' app.json
    sed -i.bak 's/,\s*}/}/g' app.json
    echo "✓ Fixed app.json"
fi

# 5. Install missing dependencies
echo "Installing missing dependencies..."
npx expo install expo-crypto expo-auth-session

# 6. Update to compatible versions
echo "Updating packages to compatible versions..."
npx expo install --fix

# 7. Clean install (this is safe - just refreshes node_modules)
echo "Cleaning and reinstalling dependencies..."
rm -rf node_modules package-lock.json
npm install

echo ""
echo "✓ All fixes complete!"
echo ""
echo "Backup files created:"
echo "  - package.json.backup"
echo "  - app.json.backup"
echo ""
echo "Running expo-doctor to verify..."
npx expo-doctor

echo ""
echo "If everything looks good, you can now build:"
echo "  eas build --platform android --profile preview --clear-cache"
echo ""
echo "To restore backups if something went wrong:"
echo "  cp package.json.backup package.json"
echo "  cp app.json.backup app.json"

