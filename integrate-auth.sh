#!/bin/bash

# Script to integrate authentication into index.html

echo "🔧 Integrating Authentication into Developer Portal..."

# Create backup
cp index.html index.html.backup-$(date +%Y%m%d-%H%M%S)

# Create temporary file for modifications
cp index.html index-temp.html

# 1. Add auth service script reference before closing body tag
sed -i '' '/<\/body>/i\
    <!-- Authentication Service -->\
    <script src="auth-service.js"></script>\
    <script src="auth-integration.js"></script>' index-temp.html

# 2. Add CSS for auth components before closing style tag
# Find the last </style> tag and insert before it
awk '
/<\/style>/ && !done {
    print "        /* Authentication Styles */"
    print "        .auth-screen {"
    print "            position: fixed;"
    print "            top: 0;"
    print "            left: 0;"
    print "            width: 100%;"
    print "            height: 100%;"
    print "            display: flex;"
    print "            align-items: center;"
    print "            justify-content: center;"
    print "            z-index: 999;"
    print "            background-color: rgba(0, 0, 0, 0.95);"
    print "            opacity: 0;"
    print "            visibility: hidden;"
    print "            transition: opacity 0.5s ease-out, visibility 0.5s;"
    print "        }"
    print ""
    print "        .auth-screen.active {"
    print "            opacity: 1;"
    print "            visibility: visible;"
    print "        }"
    print ""
    print "        /* Add remaining auth styles here */"
    done = 1
}
{ print }
' index-temp.html > index-temp2.html
mv index-temp2.html index-temp.html

# 3. Insert auth HTML after lock screen div
awk '
/<\/div>.*<!-- Navigation -->/ {
    print $0
    print ""
    print "    <!-- Authentication Screen -->"
    print "    <div id=\"authScreen\" class=\"auth-screen\">"
    print "        <!-- Auth UI will be inserted here -->"
    print "    </div>"
    print ""
    print "    <!-- Developer Info Badge -->"
    print "    <div id=\"developerBadge\" class=\"developer-info-badge\">"
    print "        <div class=\"company-name\" id=\"badgeCompanyName\">Loading...</div>"
    print "        <div class=\"developer-id\" id=\"badgeDeveloperId\">ID: ...</div>"
    print "        <button class=\"logout-btn\" onclick=\"handleLogout()\">Logout</button>"
    print "    </div>"
    next
}
{ print }
' index-temp.html > index-temp2.html
mv index-temp2.html index-temp.html

# 4. Add developer info placeholder in upload section
sed -i '' '/id="uploadForm"/a\
                        <div id="uploadDeveloperInfo"></div>' index-temp.html

# 5. Update AWS config to include new client ID
sed -i '' "s/clientId: 'bft50gui77sdq2n4lcio4onql'/clientId: '5joogquqr4jgukp7mncgp3g23h'/g" index-temp.html

# Move temp file to final
mv index-temp.html index.html

echo "✅ Authentication integration complete!"
echo ""
echo "Next steps:"
echo "1. Copy auth-ui-components.html content into the authScreen div"
echo "2. Test the flow: PIN -> Auth -> Upload"
echo "3. Verify developer info is populated in upload form"