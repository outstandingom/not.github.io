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
                .then((userCredential) => {
                    // Signed in
                    const user = userCredential.user;
                    showNotification(`Welcome back, ${user.email}!`, true);
                    // Redirect to dashboard after 2 seconds
                    setTimeout(() => {
                        window.location.href = 'index.html.html';
                    }, 2000);
                })
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
                    }
                    
                    showNotification(errorMessage, false);
                });
        });
        
        // Google Sign-In
        googleSignIn.addEventListener('click', function() {
            const provider = new firebase.auth.GoogleAuthProvider();
            
            auth.signInWithPopup(provider)
                .then((result) => {
                    // This gives you a Google Access Token
                    const credential = firebase.auth.GoogleAuthProvider.credentialFromResult(result);
                    const token = credential.accessToken;
                    // The signed-in user info
                    const user = result.user;
                    
                    showNotification(`Welcome, ${user.displayName}!`, true);
                    // Redirect to dashboard after 2 seconds
                    setTimeout(() => {
                        window.location.href = 'profile.html';
                    }, 2000);
                }).catch((error) => {
                    const errorCode = error.code;
                    const errorMessage = error.message;
                    const email = error.email;
                    
                    let displayMessage = 'Google sign-in failed. Please try again.';
                    if (errorCode === 'auth/account-exists-with-different-credential') {
                        displayMessage = 'This email is already registered with another method.';
                    }
                    
                    showNotification(displayMessage, false);
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
        
        // Check if user is already logged in
        auth.onAuthStateChanged((user) => {
            if (user) {
                // User is signed in
                showNotification(`Welcome back, ${user.email || user.displayName}! Redirecting...`, true);
                setTimeout(() => {
                    window.location.href = 'profile.html';
                }, 2000);
            }
        });
