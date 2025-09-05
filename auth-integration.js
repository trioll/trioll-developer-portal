// Authentication Integration Script
// This updates the existing unlock flow to show auth screen instead of main content

// Initialize auth screen starfield
let authStarfield = null;

function initAuthStarfield() {
    const authCanvas = document.getElementById('authStarfieldCanvas');
    if (authCanvas && typeof StarfieldSystem !== 'undefined') {
        authStarfield = new StarfieldSystem(authCanvas);
        authStarfield.animate();
    }
}

// Override the unlock function to show auth screen
const originalUnlock = LockScreen.prototype.unlock;
LockScreen.prototype.unlock = function() {
    const lockScreen = document.getElementById('lockScreen');
    const authScreen = document.getElementById('authScreen');
    
    lockScreen.classList.add('hidden');
    
    setTimeout(() => {
        lockScreen.style.display = 'none';
        // Initialize starfield if not already done
        if (!authStarfield) {
            initAuthStarfield();
        }
        // Show auth screen instead of main content
        authScreen.classList.add('active');
    }, 500);
};

// Authentication UI Functions
function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
}

function showSignup() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
}

function showAuthScreen() {
    document.getElementById('authScreen').classList.add('active');
    document.getElementById('mainContent').classList.remove('visible');
    document.getElementById('navigation').classList.remove('visible');
}

function hideAuthScreen() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('mainContent').classList.add('visible');
    document.getElementById('navigation').classList.add('visible');
    
    // Initialize AWS after successful auth
    if (typeof initializeAWS === 'function') {
        initializeAWS();
    }
    
    // Update developer badge
    if (auth && auth.developerInfo) {
        auth.updateDeveloperBadge();
    }
}

// Handle Login
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');
    
    // Show loading state
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;
    loginBtn.textContent = '';
    loginError.classList.remove('show');
    
    try {
        console.log('[AUTH] Starting login process...');
        console.log('[AUTH] Email:', email);
        console.log('[AUTH] Remember Me:', rememberMe);
        
        const result = await auth.login(email, password, rememberMe);
        console.log('[AUTH] Login result:', result);
        
        if (result && result.success) {
            console.log('[AUTH] Login successful, checking token storage...');
            const storedToken = localStorage.getItem('developerToken') || sessionStorage.getItem('developerToken');
            console.log('[AUTH] Token stored:', storedToken ? 'YES' : 'NO');
            console.log('[AUTH] Token preview:', storedToken ? storedToken.substring(0, 50) + '...' : 'N/A');
            
            // Hide auth screen and show main content
            try {
                hideAuthScreen();
                console.log('[AUTH] Auth screen hidden successfully');
            } catch (hideError) {
                console.error('[AUTH] Error hiding auth screen:', hideError);
            }
            
            // Populate developer info in upload form
            if (auth.isAuthenticated()) {
                console.log('[AUTH] Auth service reports authenticated');
                try {
                    auth.populateUploadForm();
                    console.log('[AUTH] Upload form populated');
                } catch (populateError) {
                    console.error('[AUTH] Error populating upload form:', populateError);
                }
            } else {
                console.error('[AUTH] Auth service reports NOT authenticated despite successful login');
            }
            
            // Force re-check of token after a brief delay
            setTimeout(() => {
                const tokenAfterDelay = localStorage.getItem('developerToken') || sessionStorage.getItem('developerToken');
                console.log('[AUTH] Token check after 500ms:', tokenAfterDelay ? 'YES' : 'NO');
            }, 500);
        } else {
            const errorMsg = result?.message || 'Login failed - no response from server';
            console.error('[AUTH] Login failed:', errorMsg);
            loginError.textContent = errorMsg;
            loginError.classList.add('show');
        }
    } catch (error) {
        console.error('[AUTH] Login exception:', error);
        console.error('[AUTH] Stack trace:', error.stack);
        loginError.textContent = 'An unexpected error occurred. Please try again.';
        loginError.classList.add('show');
    } finally {
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
    }
}

// Handle Signup
async function handleSignup(event) {
    event.preventDefault();
    
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const companyName = document.getElementById('companyName').value;
    const signupBtn = document.getElementById('signupBtn');
    const signupError = document.getElementById('signupError');
    const signupSuccess = document.getElementById('signupSuccess');
    
    // Show loading state
    signupBtn.classList.add('loading');
    signupBtn.disabled = true;
    signupBtn.textContent = '';
    signupError.classList.remove('show');
    signupSuccess.classList.remove('show');
    
    try {
        const result = await auth.signup(email, password, companyName);
        
        if (result.success) {
            // Show success message
            signupSuccess.textContent = 'Account created successfully! You can now log in.';
            signupSuccess.classList.add('show');
            
            // Auto-switch to login form after 2 seconds
            setTimeout(() => {
                showLogin();
                // Pre-fill the email
                document.getElementById('loginEmail').value = email;
                // Show a message on the login form
                const loginError = document.getElementById('loginError');
                loginError.textContent = 'Please log in with your new account.';
                loginError.style.color = '#10b981';
                loginError.classList.add('show');
            }, 2000);
        } else {
            signupError.textContent = result.message;
            signupError.classList.add('show');
        }
    } catch (error) {
        signupError.textContent = 'An unexpected error occurred. Please try again.';
        signupError.classList.add('show');
    } finally {
        signupBtn.classList.remove('loading');
        signupBtn.disabled = false;
        signupBtn.textContent = 'Create Account';
    }
}

// Handle Email Verification
async function handleVerification(event) {
    event.preventDefault();
    
    const code = document.getElementById('verificationCode').value;
    const email = sessionStorage.getItem('verificationEmail') || sessionStorage.getItem('pendingEmail');
    const verificationError = document.getElementById('verificationError');
    
    verificationError.classList.remove('show');
    
    try {
        const result = await auth.verifyEmail(email, code);
        
        if (result.success) {
            // Close verification modal
            document.getElementById('verificationModal').classList.remove('active');
            
            if (result.autoLoggedIn) {
                // Auto-logged in after verification
                hideAuthScreen();
                
                // Populate developer info
                if (auth.isAuthenticated()) {
                    auth.populateUploadForm();
                }
            } else {
                // Show login form with success message
                showLogin();
                const loginError = document.getElementById('loginError');
                loginError.textContent = 'Email verified! Please login.';
                loginError.style.color = '#10b981';
                loginError.classList.add('show');
            }
        } else {
            verificationError.textContent = result.message;
            verificationError.classList.add('show');
        }
    } catch (error) {
        verificationError.textContent = 'Verification failed. Please try again.';
        verificationError.classList.add('show');
    }
}

// Resend Verification Code
async function resendVerificationCode() {
    const email = sessionStorage.getItem('verificationEmail') || sessionStorage.getItem('pendingEmail');
    const verificationError = document.getElementById('verificationError');
    
    try {
        const result = await auth.resendVerificationCode(email);
        
        if (result.success) {
            verificationError.textContent = 'Verification code sent!';
            verificationError.style.color = '#10b981';
            verificationError.classList.add('show');
            
            setTimeout(() => {
                verificationError.classList.remove('show');
                verificationError.style.color = '';
            }, 3000);
        } else {
            verificationError.textContent = result.message;
            verificationError.classList.add('show');
        }
    } catch (error) {
        verificationError.textContent = 'Failed to resend code.';
        verificationError.classList.add('show');
    }
}

// Handle Logout
function handleLogout() {
    auth.logout();
    
    // Clear developer info from upload form
    const developerNameInput = document.getElementById('developerName');
    if (developerNameInput) {
        developerNameInput.value = '';
        developerNameInput.disabled = false;
    }
    
    // Remove developer info badge from upload section
    const uploadInfo = document.getElementById('uploadDeveloperInfo');
    if (uploadInfo) {
        uploadInfo.innerHTML = '';
    }
}

// We'll override saveGameToDatabase after DOM loads to ensure it exists
// Remove this code block as it causes errors

// Check authentication on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize auth starfield if auth screen is visible
    const authScreen = document.getElementById('authScreen');
    if (authScreen && authScreen.classList.contains('active')) {
        initAuthStarfield();
    }
    
    // If user is already authenticated, skip auth screen
    if (auth.isAuthenticated()) {
        const lockScreen = document.getElementById('lockScreen');
        const mainContent = document.getElementById('mainContent');
        const navigation = document.getElementById('navigation');
        
        // Check if we're past the lock screen
        if (lockScreen && lockScreen.classList.contains('hidden')) {
            // User is authenticated and past lock screen
            auth.updateDeveloperBadge();
            auth.populateUploadForm();
            
            // Make sure main content is visible
            mainContent.classList.add('visible');
            navigation.classList.add('visible');
        }
    }
});