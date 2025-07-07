# Deployment Instructions

## Option 1: GitHub Pages (Recommended for Static Sites)

1. **Create a GitHub Repository**:
   - Go to https://github.com/new
   - Name it: `trioll-developer-portal`
   - Make it Public
   - Don't initialize with README (we already have one)
   - Click "Create repository"

2. **Push Your Code**:
   ```bash
   cd "/Users/frederickcaplin/desktop/Freddie New Web"
   git remote add origin https://github.com/YOUR_USERNAME/trioll-developer-portal.git
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: main
   - Folder: / (root)
   - Save

Your site will be live at: `https://YOUR_USERNAME.github.io/trioll-developer-portal/`

## Option 2: Vercel Deployment

1. **Push to GitHub first** (follow steps 1-2 above)

2. **Deploy to Vercel**:
   - Go to https://vercel.com
   - Sign in with GitHub
   - Click "New Project"
   - Import your `trioll-developer-portal` repository
   - Click "Deploy"

Your site will be live at: `https://trioll-developer-portal.vercel.app`

## Option 3: Quick Deploy with Git

If you already have a GitHub account set up on your machine:

```bash
cd "/Users/frederickcaplin/desktop/Freddie New Web"

# Create repo using GitHub CLI (if authenticated)
gh auth login  # Follow prompts
gh repo create trioll-developer-portal --public --source=. --remote=origin --push

# Or manually add remote and push
git remote add origin https://github.com/YOUR_USERNAME/trioll-developer-portal.git
git push -u origin main
```

## Important Notes

- Replace `YOUR_USERNAME` with your actual GitHub username
- The site includes AWS integration - ensure CORS is configured on your S3 buckets
- The PIN code is: 477235
- For production, consider implementing proper authentication instead of hardcoded PIN