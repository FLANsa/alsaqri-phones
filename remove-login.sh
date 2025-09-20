#!/bin/bash

# Script to remove all login functionality from HTML files

files=(
  "dashboard.html"
  "limited_dashboard.html"
  "add_new_phone.html"
  "add_used_phone.html"
  "add_accessory.html"
  "create_sale.html"
  "edit_phone.html"
  "inventory_summary.html"
  "list_accessories_simple.html"
  "list_sales.html"
  "search.html"
  "view_sale.html"
  "scan_barcode.html"
  "print_barcode.html"
)

for file in "${files[@]}"; do
  echo "Removing login from $file..."
  
  # Remove login check functions
  sed -i '' '/function checkLogin/,/^[[:space:]]*}/d' "$file"
  
  # Remove current_user checks
  sed -i '' '/const currentUser = localStorage.getItem.*current_user/d' "$file"
  sed -i '' '/if (currentUser)/d' "$file"
  sed -i '' '/if (!currentUser)/d' "$file"
  sed -i '' '/localStorage.removeItem.*current_user/d' "$file"
  sed -i '' '/localStorage.setItem.*current_user/d' "$file"
  
  # Remove role-based navigation functions
  sed -i '' '/function updateNavigationForUser/,/^[[:space:]]*}/d' "$file"
  sed -i '' '/updateNavigationForUser()/d' "$file"
  
  # Remove logout function calls
  sed -i '' '/onclick="logout()"/d' "$file"
  
  # Remove Firebase Auth scripts
  sed -i '' '/logout-utils.js/d' "$file"
  
  echo "✅ Updated $file"
done

echo "🎉 All login functionality removed!"
