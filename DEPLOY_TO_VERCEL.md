# How to Deploy to Vercel

## Option 1: Vercel Dashboard (Recommended)

1. **Login to Vercel**:
   - Go to https://vercel.com
   - Login with your account

2. **Find Your Project**:
   - Look for "trioll-developer-portal"
   - Or the project linked to triolldev.com

3. **Check Deployment Status**:
   - Look for recent deployments
   - Check if auto-deploy from GitHub is enabled

4. **Manual Deploy** (if needed):
   - Click "Redeploy"
   - Select "main" branch
   - Click "Deploy"

## Option 2: Vercel CLI

1. **Install Vercel CLI** (if not installed):
   ```bash
   npm install -g vercel
   ```

2. **Login**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   cd /Users/frederickcaplin/Desktop/trioll-developer-portal
   vercel --prod
   ```

## Option 3: Enable Auto-Deploy from GitHub

1. **In Vercel Dashboard**:
   - Go to Project Settings
   - Navigate to "Git"
   - Connect GitHub repository (trioll/trioll-developer-portal)
   - Enable "Auto-deploy on push"
   - Set branch to "main"

## Verify Deployment

After deployment completes (usually 1-2 minutes):

1. **Check deployment URL**:
   ```bash
   curl -I https://www.triolldev.com | grep x-vercel
   ```

2. **Verify latest changes**:
   ```bash
   # Should show our flexible filename text
   curl -s https://www.triolldev.com/index.html | grep "can be any"
   ```

3. **Test in browser**:
   - Open https://www.triolldev.com
   - Check if upload instructions show flexible filenames
   - Try uploading with horror_pong_game.html

## Current Status

- ✅ Latest code in GitHub (commit: 14427ea)
- ✅ Vercel configuration present
- ❌ Latest changes NOT deployed yet
- ⏳ Need to trigger deployment

## Quick Deploy Commands

```bash
# Option A: Deploy via CLI (fastest)
cd /Users/frederickcaplin/Desktop/trioll-developer-portal
vercel --prod

# Option B: Force deploy specific commit
vercel --prod --force

# Option C: Check deployment status
vercel ls
```

## After Deployment

Once deployed, test upload with your files:
- horror_pong_game.html
- Horror Pong Thumbnail.png

The "Failed to fetch" error should be debuggable using:
https://www.triolldev.com/debug-upload.html