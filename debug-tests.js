// Trioll Developer Portal - Advanced Debug Tests
// Version: 1.0.0
// Last Updated: October 10, 2024

window.TriollDebugTests = {
    version: '1.0.0',
    
    // Check for browser caching issues
    checkCacheStatus: function() {
        console.log('=== Cache Status Check ===');
        console.log('Debug Tests Version:', this.version);
        console.log('Page loaded at:', new Date().toISOString());
        
        // Check script modification times
        const scripts = Array.from(document.getElementsByTagName('script'));
        scripts.forEach((script, idx) => {
            if (script.src) {
                console.log(`Script ${idx}: ${script.src}`);
            }
        });
        
        // Check for AWS references
        console.log('\n=== AWS References ===');
        console.log('typeof AWS:', typeof AWS);
        console.log('typeof window.AWS:', typeof window.AWS);
        console.log('awsInitialized:', typeof awsInitialized !== 'undefined' ? awsInitialized : 'undefined');
        console.log('window.useAPIUploads:', window.useAPIUploads);
        
        return {
            version: this.version,
            awsLoaded: typeof AWS !== 'undefined',
            timestamp: new Date().toISOString()
        };
    },
    
    // Trace error origins
    traceErrorOrigin: function() {
        console.log('=== Installing Error Tracer ===');
        
        // Override common error display methods
        const originalAlert = window.alert;
        window.alert = function(message) {
            if (message && message.includes('AWS not initialized')) {
                console.error('ALERT TRIGGERED:', message);
                console.trace();
            }
            return originalAlert.apply(this, arguments);
        };
        
        // Check showAlert function
        if (typeof window.showAlert === 'function') {
            const originalShowAlert = window.showAlert;
            window.showAlert = function(message, type) {
                if (message && message.includes('AWS not initialized')) {
                    console.error('SHOWALERT TRIGGERED:', message);
                    console.trace();
                    
                    // Log to debug console if available
                    if (typeof logToDebugConsole === 'function') {
                        logToDebugConsole('ERROR INTERCEPTED: ' + message, 'error');
                        const stack = new Error().stack;
                        logToDebugConsole('Stack trace: ' + stack, 'error');
                    }
                }
                return originalShowAlert.apply(this, arguments);
            };
        }
        
        console.log('Error tracer installed. Now try uploading a game.');
    },
    
    // Find all functions containing AWS checks
    findAWSChecks: function() {
        console.log('=== Searching for AWS Checks ===');
        const results = [];
        
        // Search global functions
        for (let key in window) {
            if (typeof window[key] === 'function') {
                const funcStr = window[key].toString();
                if (funcStr.includes('awsInitialized') || 
                    funcStr.includes('AWS not initialized') ||
                    funcStr.includes('initializeAWS')) {
                    results.push({
                        name: key,
                        hasAWSCheck: funcStr.includes('awsInitialized'),
                        hasErrorMsg: funcStr.includes('AWS not initialized'),
                        hasInitCall: funcStr.includes('initializeAWS')
                    });
                }
            }
        }
        
        console.table(results);
        return results;
    },
    
    // Test upload form directly
    testUploadFormSubmit: function() {
        console.log('=== Testing Upload Form Submit ===');
        
        const form = document.getElementById('uploadForm');
        if (!form) {
            console.error('Upload form not found!');
            return;
        }
        
        // Get form submit handler
        const submitHandlers = form.onsubmit ? [form.onsubmit] : [];
        
        // Check event listeners
        console.log('Form element:', form);
        console.log('Form onsubmit:', form.onsubmit);
        
        // Try to trigger submit programmatically with test data
        const testEvent = new Event('submit', {
            bubbles: true,
            cancelable: true
        });
        
        console.log('Dispatching test submit event...');
        const prevented = !form.dispatchEvent(testEvent);
        console.log('Submit prevented:', prevented);
    },
    
    // Check all upload-related functions
    analyzeUploadFlow: function() {
        console.log('=== Analyzing Upload Flow ===');
        
        // Check if APIGameUploader exists
        console.log('APIGameUploader exists:', typeof APIGameUploader !== 'undefined');
        if (typeof APIGameUploader !== 'undefined') {
            console.log('APIGameUploader:', APIGameUploader.toString().substring(0, 200) + '...');
        }
        
        // Check if S3GameUploader exists
        console.log('S3GameUploader exists:', typeof S3GameUploader !== 'undefined');
        if (typeof S3GameUploader !== 'undefined') {
            console.log('S3GameUploader:', S3GameUploader.toString().substring(0, 200) + '...');
        }
        
        // Check upload form handler
        const form = document.getElementById('uploadForm');
        if (form) {
            const handlers = getEventListeners ? getEventListeners(form) : null;
            console.log('Form event listeners:', handlers);
        }
    },
    
    // Force reload with cache bypass
    forceReload: function() {
        const timestamp = Date.now();
        const url = window.location.href.split('?')[0] + '?v=' + timestamp + '&nocache=true';
        console.log('Reloading with cache bypass:', url);
        window.location.href = url;
    },
    
    // Run all tests
    runAll: function() {
        console.clear();
        console.log('🚀 TRIOLL DEBUG TESTS v' + this.version);
        console.log('=' .repeat(50));
        
        this.checkCacheStatus();
        console.log('\n');
        
        this.findAWSChecks();
        console.log('\n');
        
        this.analyzeUploadFlow();
        console.log('\n');
        
        this.traceErrorOrigin();
        console.log('\n');
        
        console.log('=' .repeat(50));
        console.log('✅ All tests complete. Try uploading now to capture errors.');
    }
};

// Auto-run on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Debug tests ready. Run TriollDebugTests.runAll() in console.');
    });
} else {
    console.log('Debug tests ready. Run TriollDebugTests.runAll() in console.');
}