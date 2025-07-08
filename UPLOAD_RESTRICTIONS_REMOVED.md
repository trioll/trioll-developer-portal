# Upload Restrictions Removed - July 8, 2025

## Changes Made to Developer Portal

### 1. File Upload Method
- **Before**: Required folder selection with `webkitdirectory`
- **After**: Accepts individual file selection with `multiple` attribute
- **Benefit**: Users can now upload individual HTML and asset files without organizing them in a folder

### 2. File Size Limit
- **Before**: 50MB per file
- **After**: 1GB per file
- **Benefit**: Supports larger games and asset files

### 3. UI Text Updates
- **Label**: Changed from "Game Files (select folder with index.html) *" to "Game Files (HTML and assets) *"
- **Button**: Changed from "Select Folder" to "Select Files"
- **Instructions**: Changed from "Drop your game folder here" to "Drop your game files here"

### 4. Validation Logic
- Still requires at least one HTML file (any HTML file, not just index.html)
- Still validates file types (HTML, JS, CSS, images, audio, fonts)
- Size limit increased to 1GB per file

## Git Commit Details
- **Commit Message**: "Remove upload restrictions: allow individual files, increase size limit to 1GB"
- **Commit Hash**: e63e648
- **Pushed to**: https://github.com/trioll/trioll-developer-portal.git

## Deployment
- Vercel should automatically deploy from the GitHub repository
- The changes will be live at: https://trioll-developer-portal-new.vercel.app
- No build process required (static HTML site)

## Testing
To test the updated portal:
1. Visit https://trioll-developer-portal-new.vercel.app
2. Enter PIN: 477235
3. Navigate to Upload section
4. Try uploading individual files (like robot-soccer-html.html and download.png)
5. Verify no folder selection is required
6. Test with files larger than 50MB

## Rollback
If needed, the original version is saved as `index.html.backup` in the repository.