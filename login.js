// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCsJR-aYy0VGSPvb7pXHaK3EmGsJWcvdDo",
    authDomain: "login-fa2eb.firebaseapp.com",
    projectId: "login-fa2eb",
    storageBucket: "login-fa2eb.appspot.com",
    messagingSenderId: "1093052500996",
    appId: "1:1093052500996:web:05a13485172c455e93b951",
    measurementId: "G-9TC2J0YQ3R"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginPasswordToggle = document.getElementById('loginPasswordToggle');
const googleSignIn = document.getElementById('googleSignIn');
const forgotPassword = document.getElementById('forgotPassword');
const signUpLink = document.getElementById('signUpLink');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notificationText');

// Toggle password visibility
loginPasswordToggle.addEventListener('click', function() {
    const type = loginPassword.getAttribute('type') === 'password' ? 'text' : 'password';
    loginPassword.setAttribute('type', type);
    this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
});

// Show notification
function showNotification(message, isSuccess = true) {
    notification.className = 'notification';
    notification.classList.add(isSuccess ? 'success' : 'error');
    notification.classList.add('show');
    notificationText.textContent = message;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Handle form submission
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = loginEmail.value;
    const password = loginPassword.value;
    
    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => {
            const errorCode = error.code;
            let errorMessage = 'An error occurred. Please try again.';
            
            switch(errorCode) {
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many attempts. Try again later or reset password.';
                    break;
            }
            
            showNotification(errorMessage, false);
        });
});

// Google Sign-In - Fixed with enhanced error handling
googleSignIn.addEventListener('click', function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    
    auth.signInWithPopup(provider)
        .catch((error) => {
            const errorCode = error.code;
            let errorMessage = 'Google sign-in failed. Please try again.';
            
            // Handle specific Google sign-in errors
            switch(errorCode) {
                case 'auth/account-exists-with-different-credential':
                    errorMessage = 'This email is already registered with another method.';
                    break;
                case 'auth/popup-closed-by-user':
                    errorMessage = 'Sign-in window was closed before completing.';
                    break;
                case 'auth/popup-blocked':
                    errorMessage = 'Popup blocked by browser. Allow popups and try again.';
                    break;
                case 'auth/cancelled-popup-request':
                    errorMessage = 'Multiple sign-in attempts detected.';
                    break;
                case 'auth/unauthorized-domain':
                    errorMessage = 'Unauthorized domain (check Firebase config).';
                    break;
                default:
                    errorMessage = `${error.message} (Code: ${errorCode})`;
            }
            
            console.error('Google Sign-In Error:', error);
            showNotification(errorMessage, false);
        });
});

// Forgot password
forgotPassword.addEventListener('click', function(e) {
    e.preventDefault();
    const email = prompt('Please enter your email address:');
    
    if (email) {
        auth.sendPasswordResetEmail(email)
            .then(() => {
                showNotification('Password reset email sent. Check your inbox.', true);
            })
            .catch((error) => {
                showNotification('Error sending reset email. Please try again.', false);
            });
    }
});

// Sign up link
signUpLink.addEventListener('click', function(e) {
    e.preventDefault();
    showNotification('Redirecting to sign up page...', true);
    setTimeout(() => {
        window.location.href = 'register.html';
    }, 1500);
});

// Auth state handler (manages redirects and notifications)
auth.onAuthStateChanged((user) => {
    if (user) {
        const userName = user.displayName || user.email.split('@')[0];
        showNotification(`Welcome ${userName}! Redirecting...`, true);
        
        setTimeout(() => {
            window.location.href = 'profile.html';
        }, 2000);
    }
});
