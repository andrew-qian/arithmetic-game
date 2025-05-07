let sessionPlaytimeTotal = 0;

const firebaseConfig = {
  apiKey: "AIzaSyBIScAendwuujYUWGU-gOiOK9dfo8rZFL8",
  authDomain: "arithmetic-game-bfedc.firebaseapp.com",
  databaseURL: "https://arithmetic-game-bfedc-default-rtdb.firebaseio.com",
  projectId: "arithmetic-game-bfedc",
  storageBucket: "arithmetic-game-bfedc.firebasestorage.app",
  messagingSenderId: "825999301683",
  appId: "1:825999301683:web:216b4bdc17990315069746",
  measurementId: "G-5R42L56XTH"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Game state variables
let currentUser = null;
let currentScore = 0;
let timeLeft = 120; // seconds
let timer = null;
let currentProblem = null;
let scoreChart = null; // Reference to Chart.js chart

// DOM elements for pages
const pages = {
  signIn: document.getElementById('sign-in-page'),
  createAccount: document.getElementById('create-account-page'),
  menu: document.getElementById('menu-page'),
  game: document.getElementById('game-page'),
  gameOver: document.getElementById('game-over-page'),
  leaderboard: document.getElementById('leaderboard-page'),
  stats: document.getElementById('stats-page')
};

// Helper function to show one page and hide the others
function showPage(pageId) {
  Object.values(pages).forEach(page => page.classList.add('hidden'));
  document.getElementById(pageId).classList.remove('hidden');
  
  if (pageId === 'game-page') {
    document.getElementById('answer-input').focus();
  }
}

// Add this helper function to ensure consistent date formatting
function formatDateMMDDYYYY(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  
  const month = date.getMonth() + 1; // getMonth() is zero-indexed
  const day = date.getDate();
  const year = date.getFullYear();
  
  // Format as MM/DD/YYYY with leading zeros where needed
  return `${month < 10 ? '0' + month : month}/${day < 10 ? '0' + day : day}/${year}`;
}

// Initialize event listeners
function initializeEventListeners() {
  // Sign In Page
  document.getElementById('sign-in-button').addEventListener('click', handleSignIn);
  document.getElementById('create-account-button').addEventListener('click', () => showPage('create-account-page'));
  
  // Create Account Page
  document.getElementById('submit-account-button').addEventListener('click', handleCreateAccount);
  document.getElementById('back-to-signin-button').addEventListener('click', () => showPage('sign-in-page'));
  
  // Menu Page
  document.getElementById('start-game-button').addEventListener('click', startGame);
  document.getElementById('view-leaderboard-button').addEventListener('click', () => {
    populateLeaderboard();
    showPage('leaderboard-page');
  });
  document.getElementById('view-stats-button').addEventListener('click', () => {
    populateUserStats();  // Your existing summary and lifetime chart function
    showPage('stats-page');
    setTimeout(() => {
      populateLifetimeChart();
      populateDailyUsageChart(); // Call our new function here
    }, 100);
  });
  
  
  document.getElementById('sign-out-button').addEventListener('click', handleSignOut);
  
  // Game Page: Check answer input
  document.getElementById('answer-input').addEventListener('input', function() {
    const userInput = this.value.trim();
    if (userInput.length > 0) {
      const userAnswer = parseInt(userInput);
      if (!isNaN(userAnswer) && userAnswer === currentProblem.answer) {
        // Correct answer
        currentScore++;
        document.getElementById('current-score').textContent = currentScore;
        
        // Update user stats in the database
        const userStatsRef = db.ref('users/' + currentUser.uid + '/stats');
        userStatsRef.once('value').then(snapshot => {
          let stats = snapshot.val() || { totalProblems: 0, correctAnswers: 0 };
          stats.totalProblems++;
          stats.correctAnswers++;
          userStatsRef.set(stats);
        });
        
        // Clear input and generate new problem
        this.value = '';
        generateProblem();
      }
    }
  });
  
  // Game Over Page
  document.getElementById('play-again-button').addEventListener('click', startGame);
  document.getElementById('back-to-menu-button').addEventListener('click', () => showPage('menu-page'));
  
  // Leaderboard Page
  document.getElementById('leaderboard-back-button').addEventListener('click', () => showPage('menu-page'));
  
  // Stats Page
  document.getElementById('stats-back-button').addEventListener('click', () => showPage('menu-page'));
}

// Authentication functions using Firebase Auth
function handleSignIn() {
  const email = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorElement = document.getElementById('sign-in-error');
  
  if (!email || !password) {
    errorElement.textContent = "Please enter both email and password";
    errorElement.classList.remove('hidden');
    return;
  }
  
  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      currentUser = userCredential.user;
      // Retrieve the username from the database
      db.ref('users/' + currentUser.uid + '/username').once('value').then(snapshot => {
        document.getElementById('user-welcome').textContent = snapshot.val() || currentUser.email;
      });
      errorElement.classList.add('hidden');
      document.getElementById('username').value = '';
      document.getElementById('password').value = '';
      showPage('menu-page');
    })
    .catch(error => {
      errorElement.textContent = error.message;
      errorElement.classList.remove('hidden');
    });
}

function handleCreateAccount() {
  const username = document.getElementById('username-input').value.trim();
  const email = document.getElementById('new-email').value.trim();
  const password = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  const errorElement = document.getElementById('create-account-error');
  
  if (!username || !email || !password) {
    errorElement.textContent = "Please enter username, email and password";
    errorElement.classList.remove('hidden');
    return;
  }
  
  if (password !== confirmPassword) {
    errorElement.textContent = "Passwords do not match";
    errorElement.classList.remove('hidden');
    return;
  }
  
  auth.createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      currentUser = userCredential.user;
      document.getElementById('user-welcome').textContent = username;
      errorElement.classList.add('hidden');
      // Clear the input fields
      document.getElementById('username-input').value = '';
      document.getElementById('new-email').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('confirm-password').value = '';
      
      // Initialize user stats and store the username in the database
      db.ref('users/' + currentUser.uid).set({
        email: currentUser.email,
        username: username,
        stats: { totalProblems: 0, correctAnswers: 0 },
        scores: {}
      });
      
      showPage('menu-page');
    })
    .catch(error => {
      errorElement.textContent = error.message;
      errorElement.classList.remove('hidden');
    });
}

function handleSignOut() {
  auth.signOut().then(() => {
    currentUser = null;
    showPage('sign-in-page');
  });
}

// Listen for auth state changes
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    db.ref('users/' + currentUser.uid + '/username').once('value').then(snapshot => {
      document.getElementById('user-welcome').textContent = snapshot.val() || currentUser.email;
    });
    showPage('menu-page');
  } else {
    currentUser = null;
    showPage('sign-in-page');
  }
});

// Game functions
function startGame() {
  currentScore = 0;
  timeLeft = 120;
  document.getElementById('current-score').textContent = currentScore;
  document.getElementById('timer').textContent = timeLeft;
  document.getElementById('answer-input').value = '';
  
  generateProblem();
  
  if (timer) clearInterval(timer);
  timer = setInterval(updateTimer, 1000);
  
  showPage('game-page');
  document.getElementById('answer-input').focus();
}

function updateTimer() {
  timeLeft--;
  document.getElementById('timer').textContent = timeLeft;
  if (timeLeft <= 0) {
    endGame();
  }
}

function generateProblem() {
  const problemTypes = ['addition', 'subtraction', 'multiplication', 'division'];
  const type = problemTypes[Math.floor(Math.random() * problemTypes.length)];
  let num1, num2, answer, problemText;
  
  switch (type) {
    case 'addition':
      num1 = Math.floor(Math.random() * 99) + 2;
      num2 = Math.floor(Math.random() * 99) + 2;
      answer = num1 + num2;
      problemText = `${num1} + ${num2} =`;
      break;
    case 'subtraction':
      num1 = Math.floor(Math.random() * 99) + 2;
      num2 = Math.floor(Math.random() * 99) + 2;
      num3 = num1 + num2
      answer = num1;
      problemText = `${num3} - ${num2} =`;
      break;
    case 'multiplication':
      num1 = Math.floor(Math.random() * 11) + 2;
      num2 = Math.floor(Math.random() * 99) + 2;
      answer = num1 * num2;
      problemText = `${num1} × ${num2} =`;
      break;
    case 'division':
      num1 = Math.floor(Math.random() * 11) + 2;
      num2 = Math.floor(Math.random() * 99) + 2;
      num3 = num1 * num2;
      answer = num2
      problemText = `${num3} ÷ ${num1} =`;
      break;
  }
  
  currentProblem = { text: problemText, answer: answer, type: type };
  document.getElementById('problem-text').textContent = problemText;
}

// Helper function to format seconds into hours, minutes, seconds
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  // return `${hrs}h ${mins}m ${secs}s`;
  return `${hrs}h ${mins}m`
}


function endGame() {
  clearInterval(timer);
  
  const currentDate = new Date();
  const formattedDate = formatDateMMDDYYYY(currentDate);
  const currentGameDuration = 120 - timeLeft; // current game duration in seconds
  sessionPlaytimeTotal += currentGameDuration;
  
  // Save game score
  const scoreRef = db.ref('users/' + currentUser.uid + '/scores').push();
  scoreRef.set({ score: currentScore, date: formattedDate });
  
  // Add to global leaderboard
  const leaderboardRef = db.ref('leaderboard').push();
  leaderboardRef.set({ 
    uid: currentUser.uid, 
    username: document.getElementById('user-welcome').textContent, 
    score: currentScore, 
    date: formattedDate 
  });
  
  // Update user's total playtime in Firebase
  const userRef = db.ref('users/' + currentUser.uid);
  userRef.child('totalPlaytime').once('value').then(snapshot => {
    const previousPlaytime = snapshot.val() || 0;
    const newTotalPlaytime = previousPlaytime + currentGameDuration;
    userRef.update({ totalPlaytime: newTotalPlaytime });
    
    // Update playtime info in the fixed container within the game over page
    document.getElementById('playtime-info').innerHTML = `
      <p>Session Playtime: ${formatTime(sessionPlaytimeTotal)}</p>
      <p>Total Playtime: ${formatTime(newTotalPlaytime)}</p>
    `;
  });
  
  document.getElementById('final-score').textContent = currentScore;
  populateUserChart();
  populateGlobalLeaderboard();
  
  showPage('game-over-page');
}


function populateUserChart() {
  const canvas = document.getElementById('scoreChart');
  if (!canvas) {
    console.error("Canvas element with id 'scoreChart' not found.");
    return;
  }
  const ctx = canvas.getContext('2d');
  
  db.ref('users/' + currentUser.uid + '/scores').once('value', snapshot => {
    const scoresObj = snapshot.val() || {};
    let scoresArray = Object.values(scoresObj);
    
    // Get the last 10 scores (if there are less than 10, use all)
    scoresArray = scoresArray.slice(-10);
    
    // Extract labels (dates) and data (scores)
    // Normalize any inconsistent date formats
    const labels = scoresArray.map(score => {
      if (score.date && score.date.includes('-')) {
        // Convert YYYY-MM-DD to MM/DD/YYYY
        const parts = score.date.split('-');
        if (parts.length === 3) {
          return `${parts[1]}/${parts[2]}/${parts[0]}`;
        }
      }
      return score.date;
    });
    const data = scoresArray.map(score => score.score);
    
    // Rest of function remains the same...
    // Compute the all-time high score from all available scores
    const allScores = Object.values(scoresObj).map(score => score.score);
    const highScore = allScores.length ? Math.max(...allScores) : 0;
    
    // Compute a fixed maximum for the y-axis.
    const fixedMax = Math.max(10, Math.ceil(highScore / 10) * 10);
    
    // Check for dark mode
    const darkMode = document.body.classList.contains('dark');
    
    // Set colors based on mode:
    const datasetBorderColor = darkMode ? 'rgba(173,216,230,1)' : 'blue';
    const datasetBackgroundColor = darkMode ? 'rgba(173,216,230,0.3)' : 'rgba(0, 0, 255, 0.1)';
    const annotationBorderColor = darkMode ? 'rgba(255,160,122,1)' : 'red';
    
    if (scoreChart) {
      scoreChart.destroy();
    }
    
    scoreChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Score',
          data: data,
          borderColor: datasetBorderColor,
          backgroundColor: datasetBackgroundColor,
          fill: true,
          tension: 0.2,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: 'Lifetime Score Progression',
            font: { size: 18 },
            color: darkMode ? '#000' : '#333'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const score = context.parsed.y;
                const date = context.label;
                return [`Score: ${score}`, `Date: ${date}`];
              }
            }
          },
          annotation: {
            annotations: {
              highScoreLine: {
                type: 'line',
                yMin: highScore,
                yMax: highScore,
                borderColor: annotationBorderColor,
                borderWidth: 2,
                label: {
                  enabled: true,
                  content: 'All-Time High',
                  position: 'end',
                  backgroundColor: darkMode ? 'rgba(255,160,122,0.7)' : 'rgba(255, 0, 0, 0.7)',
                  font: { style: 'bold', color: darkMode ? '#000' : '#fff' }
                }
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { display: false },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            min: 0,
            max: fixedMax
          }
        },
        maintainAspectRatio: false
      }
    });
  });
}


// New function to populate the global leaderboard for the game over screen
function populateGlobalLeaderboard() {
  const container = document.getElementById('global-leaderboard-container');
  container.innerHTML = '';
  
  db.ref('leaderboard')
    .once('value', snapshot => {
      let userScores = {};
      
      // Process all entries to keep only the highest score per user
      snapshot.forEach(childSnapshot => {
        const entry = childSnapshot.val();
        const userId = entry.uid;
        
        // If this user isn't in our map yet, or if this score is higher than their previous best
        if (!userScores[userId] || entry.score > userScores[userId].score) {
          userScores[userId] = entry;
        }
      });
      
      // Convert to array and sort by score (descending)
      let entries = Object.values(userScores);
      entries.sort((a, b) => b.score - a.score);
      
      // Build an HTML table for the top 5 entries
      let html = '<table class="leaderboard"><thead><tr><th>Rank</th><th>Player</th><th>Score</th><th>Date</th></tr></thead><tbody>';
      entries.slice(0, 5).forEach((entry, index) => {
        html += `<tr>
                   <td>${index + 1}</td>
                   <td>${entry.username}</td>
                   <td>${entry.score}</td>
                   <td>${entry.date}</td>
                 </tr>`;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    });
}

// Populate full leaderboard
function populateLeaderboard() {
  const leaderboardBody = document.getElementById('full-leaderboard-body');
  leaderboardBody.innerHTML = '';
  
  db.ref('leaderboard')
    .once('value', snapshot => {
      let userScores = {};
      
      // Process all entries to keep only the highest score per user
      snapshot.forEach(childSnapshot => {
        const entry = childSnapshot.val();
        const userId = entry.uid;
        
        // If this user isn't in our map yet, or if this score is higher than their previous best
        if (!userScores[userId] || entry.score > userScores[userId].score) {
          userScores[userId] = entry;
        }
      });
      
      // Convert to array and sort by score (descending)
      let entries = Object.values(userScores);
      entries.sort((a, b) => b.score - a.score);
      
      // Display the top 10 unique users
      entries.slice(0, 10).forEach((entry, index) => {
        leaderboardBody.innerHTML += `
          <tr>
            <td>${index + 1}</td>
            <td>${entry.username}</td>
            <td>${entry.score}</td>
            <td>${entry.date}</td>
          </tr>
        `;
      });
    });
}

// New global variable for the lifetime chart instance
let lifetimeChart = null;

// New function to populate a chart on the Stats page that shows the user's lifetime scores.
function populateLifetimeChart() {
  const canvas = document.getElementById('lifetimeChart');
  if (!canvas) {
    console.error("Canvas element with id 'lifetimeChart' not found.");
    return;
  }
  const ctx = canvas.getContext('2d');
  
  db.ref('users/' + currentUser.uid + '/scores').once('value', snapshot => {
    const scoresObj = snapshot.val() || {};
    const scoresArray = Object.values(scoresObj);
    
    // For the x-axis, use blank labels while storing dates for tooltips.
    const xLabels = scoresArray.map(() => ""); 
    const data = scoresArray.map(score => score.score);
    
    // Normalize date formats for tooltips
    const tooltipDates = scoresArray.map(score => {
      if (score.date && score.date.includes('-')) {
        // Convert YYYY-MM-DD to MM/DD/YYYY
        const parts = score.date.split('-');
        if (parts.length === 3) {
          return `${parts[1]}/${parts[2]}/${parts[0]}`;
        }
      }
      return score.date;
    });
    
    // Rest of function remains the same...
    // Compute fixed y-axis maximum
    const highScore = scoresArray.length ? Math.max(...scoresArray.map(s => s.score)) : 0;
    const fixedMax = Math.max(10, Math.ceil(highScore / 10) * 10);
    
    if (lifetimeChart) {
      lifetimeChart.destroy();
    }
    
    lifetimeChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: xLabels,
        datasets: [{
          label: 'Score',
          data: data,
          borderColor: 'green',
          backgroundColor: 'rgba(0, 255, 0, 0.1)',
          fill: true,
          tension: 0.2,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: 'Lifetime Score Progression',
            font: {
              size: 18
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const score = context.parsed.y;
                const index = context.dataIndex;
                const date = tooltipDates[index];
                return [`Score: ${score}`, `Date: ${date}`];
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { display: false },
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            min: 0,
            max: fixedMax
          }
        },
        maintainAspectRatio: false
      }
    });
  });
}

function populateUserStats() {
  const statsContainer = document.getElementById('detailed-stats');
  statsContainer.innerHTML = '<p>Loading...</p>';
  
  db.ref('users/' + currentUser.uid).once('value', snapshot => {
    const userData = snapshot.val();
    if (!userData) {
      statsContainer.innerHTML = '<p>No user data found.</p>';
      return;
    }
    const scoresObj = userData.scores || {};
    const scoresArray = Object.values(scoresObj);
    let bestScore = 0, totalScore = 0;
    scoresArray.forEach(s => {
      bestScore = Math.max(bestScore, s.score);
      totalScore += s.score;
    });
    const averageScore = scoresArray.length ? (totalScore / scoresArray.length).toFixed(1) : 0;
    const totalProblems = userData.stats ? userData.stats.totalProblems : 0;
    const correctAnswers = userData.stats ? userData.stats.correctAnswers : 0;
    const accuracy = totalProblems ? ((correctAnswers / totalProblems) * 100).toFixed(1) : 0;
    const totalPlaytime = userData.totalPlaytime || 0;
    
    // Build the summary HTML, then add a container for the chart.
    let html = `
      <h3>Summary</h3>
      <p>Games Played: ${scoresArray.length}</p>
      <p>Best Score: ${bestScore}</p>
      <p>Average Score: ${averageScore}</p>
      <p>Total Problems Attempted: ${totalProblems}</p>
      <p>Total Playtime: ${formatTime(totalPlaytime)}</p>
      <div class="chart-section" style="padding-top: 20px;">
        <canvas id="lifetimeChart"></canvas>
      </div>
    `;
    statsContainer.innerHTML = html;
    
    // Ensure the stats page is visible, then populate the lifetime chart.
    showPage('stats-page');
    populateLifetimeChart();
  });
}

// In app.js
document.addEventListener('DOMContentLoaded', () => {
  const darkToggle = document.getElementById('darkModeToggle');
  // Initial icon (moon for light mode)
  darkToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  
  darkToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    // Update icon based on the mode:
    if (document.body.classList.contains('dark')) {
      // Sun icon for dark mode
      darkToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    } else {
      // Moon icon for light mode
      darkToggle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    }
  });
});

function populateDailyUsageChart() {
  // Get the parent container for stats
  const detailedStats = document.getElementById('detailed-stats');
  if (!detailedStats) {
    console.error("Parent element 'detailed-stats' not found.");
    return;
  }
  
  // Remove any existing usage chart elements
  const existingTitle = document.getElementById('dailyUsageTitle');
  if (existingTitle) existingTitle.remove();
  
  const existingWrapper = document.getElementById('dailyUsageWrapper');
  if (existingWrapper) existingWrapper.remove();
  
  const existingLabels = document.getElementById('dailyUsageLabels');
  if (existingLabels) existingLabels.remove();
  
  const existingChart = document.getElementById('dailyUsageChart');
  if (existingChart) existingChart.remove();
  
  // Create title
  const title = document.createElement('h3');
  title.id = 'dailyUsageTitle';
  title.textContent = 'Daily Usage Over Last 6 Months';
  title.style.textAlign = 'center';
  title.style.marginTop = '30px';
  detailedStats.appendChild(title);
  
  // Create a wrapper div that will center its contents
  const wrapperDiv = document.createElement('div');
  wrapperDiv.id = 'dailyUsageWrapper';
  wrapperDiv.style.display = 'flex';
  wrapperDiv.style.flexDirection = 'column';
  wrapperDiv.style.alignItems = 'center';
  wrapperDiv.style.width = '100%';
  wrapperDiv.style.margin = '10px 0 30px 0';
  detailedStats.appendChild(wrapperDiv);
  
  // Create label container first (to be displayed above the chart)
  const labelContainer = document.createElement('div');
  labelContainer.id = 'dailyUsageLabels';
  labelContainer.style.display = 'grid';
  labelContainer.style.textAlign = 'center';
  labelContainer.style.fontSize = '14px';
  labelContainer.style.color = '#666';
  labelContainer.style.marginBottom = '4px';
  labelContainer.style.maxWidth = 'fit-content'; // Ensure it doesn't exceed needed width
  wrapperDiv.appendChild(labelContainer);
  
  // Create the chart container
  const container = document.createElement('div');
  container.id = 'dailyUsageChart';
  container.style.display = 'grid';
  container.style.gridAutoFlow = 'column';
  container.style.gridTemplateRows = 'repeat(7, 20px)';
  container.style.gap = '5px';
  container.style.maxWidth = 'fit-content'; // Ensure it doesn't exceed needed width
  wrapperDiv.appendChild(container);
  
  // Define the time period: last 6 months
  const today = new Date();
  const startDate = new Date(today);
  startDate.setMonth(startDate.getMonth() - 6);
  // Adjust startDate to the previous Sunday (for week alignment)
  startDate.setDate(startDate.getDate() - startDate.getDay());
  
  // Build an array of dates from startDate to today (inclusive)
  const dates = [];
  let currentDate = new Date(startDate);
  while (currentDate <= today) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Group the dates into weeks (each week is 7 days)
  const weeks = [];
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }
  
  // Set up the label container with one column per week
  labelContainer.style.gridTemplateColumns = `repeat(${weeks.length}, 1fr)`;
  
  // For uniform spacing, decide on a step (e.g., every 4 weeks)
  const labelStep = 4;
  weeks.forEach((week, index) => {
    const labelDiv = document.createElement('div');
    labelDiv.style.width = '100%';
    // If index is 0 or a multiple of labelStep, display the month abbreviation
    if (index === 0 || index % labelStep === 0) {
      labelDiv.textContent = week[0].toLocaleString('default', { month: 'short' });
    } else {
      labelDiv.textContent = '';
    }
    labelContainer.appendChild(labelDiv);
  });
  
  // Retrieve scores from Firebase (group by date)
  db.ref('users/' + currentUser.uid + '/scores').once('value')
    .then(snapshot => {
      const scoresObj = snapshot.val() || {};
      const usageData = {};
      
      // For each score entry, increment the count for that day
      Object.values(scoresObj).forEach(entry => {
        let dateKey;
        
        if (entry.date && entry.date.includes('-')) {
          // Convert YYYY-MM-DD to a Date object
          const parts = entry.date.split('-');
          if (parts.length === 3) {
            const date = new Date(parts[0], parts[1]-1, parts[2]);
            dateKey = date.toLocaleDateString();
          } else {
            dateKey = new Date(entry.date).toLocaleDateString();
          }
        } else {
          // Use toLocaleDateString to match our dates array
          dateKey = new Date(entry.date).toLocaleDateString();
        }
        
        usageData[dateKey] = (usageData[dateKey] || 0) + 1;
      });
      
      // Rest of function remains the same...
      // Determine the maximum usage (for color scaling)
      const allCounts = Object.values(usageData);
      const maxUsage = allCounts.length ? Math.max(...allCounts) : 1;
      
      // For each week (each column), add 7 cells (one per day)
      weeks.forEach(week => {
        week.forEach(date => {
          const cell = document.createElement('div');
          cell.className = 'daily-usage-box';
          // Get the date key for this cell
          const dateKey = date.toLocaleDateString();
          const count = usageData[dateKey] || 0;
          
          if (count > 0) {
            // Compute intensity (0 to 1)
            const intensity = count / maxUsage;
            // Map intensity to a shade of green: HSL with hue 120, saturation 70%,
            // and lightness from 90% (for 0 tests) to 50% (for max tests)
            const lightness = 90 - intensity * 40;
            cell.style.backgroundColor = `hsl(120, 70%, ${lightness}%)`;
          } else {
            cell.style.backgroundColor = '#eee';
          }
          
          cell.title = count > 0 ? `${count} tests on ${dateKey}` : `No tests on ${dateKey}`;
          container.appendChild(cell);
        });
      });
    })
    .catch(error => {
      console.error("Error fetching scores data: ", error);
  });
}




document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  showPage('sign-in-page');
});
