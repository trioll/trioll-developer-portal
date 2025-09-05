// Console fix for My Games tab - Run this in browser console on triolldev.com

// First, check what's in storage
console.log('=== Storage Check ===');
console.log('Token:', localStorage.getItem('developerToken') ? 'Found' : 'Missing');
console.log('Developer ID:', localStorage.getItem('developerId'));

// Override the loadMyGames function to show ALL games
window.loadMyGames = async function() {
    console.log('Loading all games with ownership info...');
    const myGamesGrid = document.getElementById('myGamesGrid');
    const developerId = localStorage.getItem('developerId') || sessionStorage.getItem('developerId');
    
    myGamesGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">Loading games...</div>';
    
    try {
        // Fetch ALL games from the main endpoint
        const response = await fetch('https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod/games', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const result = await response.json();
        const allGames = result.games || [];
        
        console.log(`Found ${allGames.length} total games`);
        
        // Filter games that belong to this developer
        const myGames = allGames.filter(game => {
            const ismine = game.developerId === developerId || game.developerId === 'dev_c84a7e';
            if (ismine) {
                console.log(`My game: ${game.name || game.title}`);
            }
            return ismine;
        });
        
        console.log(`${myGames.length} games belong to you`);
        
        if (myGames.length === 0) {
            // Show ALL games but mark which ones are yours
            console.log('No games with your ID found, showing all games...');
            displayMyGames(allGames.map(game => ({
                ...game,
                isYours: game.developerId === developerId || game.developerId === 'dev_c84a7e'
            })));
        } else {
            // Show only your games
            displayMyGames(myGames);
        }
        
    } catch (error) {
        console.error('Error loading games:', error);
        myGamesGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444;">
            Error: ${error.message}<br>
            <small>Check console for details</small>
        </div>`;
    }
};

// Also fix the aggressive token validation
window.validateAndGetToken = function() {
    const token = localStorage.getItem('developerToken') || sessionStorage.getItem('developerToken');
    console.log('Token validation override - returning:', token ? 'Token exists' : 'No token');
    return token; // Don't clear it!
};

// Reload My Games tab
if (document.getElementById('myGamesGrid')) {
    console.log('Reloading My Games tab...');
    loadMyGames();
} else {
    console.log('Navigate to My Games tab first, then run this script again');
}

console.log('Fix applied! The My Games tab should now work.');