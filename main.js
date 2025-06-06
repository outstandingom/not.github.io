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
        const db = firebase.firestore();
        
        // DOM Elements
        const registerForm = document.getElementById('registerForm');
        const fullNameInput = document.getElementById('fullName');
        const phoneInput = document.getElementById('phoneNumber');
        const emailInput = document.getElementById('registerEmail');
        const passwordInput = document.getElementById('registerPassword');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const termsCheckbox = document.getElementById('termsAgree');
        const registerButton = document.getElementById('registerButton');
        const registerLoader = document.getElementById('registerLoader');
        const registerText = document.getElementById('registerText');
        const googleSignInBtn = document.getElementById('googleSignIn');
        const successMessage = document.getElementById('successMessage');
        const firebaseError = document.getElementById('firebaseError');
        const passwordToggle = document.getElementById('registerPasswordToggle');
        const confirmPasswordToggle = document.getElementById('confirmPasswordToggle');
        const passwordStrengthBar = document.getElementById('passwordStrengthBar');
        const passwordStrengthText = document.getElementById('passwordStrengthText');

        // Password strength levels
        const strengthLevels = {
            0: {text: "Very Weak", color: "#d32f2f", width: "25%"},
            1: {text: "Weak", color: "#ff9800", width: "50%"},
            2: {text: "Medium", color: "#ffc107", width: "75%"},
            3: {text: "Strong", color: "#4caf50", width: "100%"}
        };

        // Toggle password visibility
        passwordToggle.addEventListener('click', function() {
            togglePasswordVisibility(passwordInput, this);
        });

        confirmPasswordToggle.addEventListener('click', function() {
            togglePasswordVisibility(confirmPasswordInput, this);
        });

        function togglePasswordVisibility(inputElement, toggleElement) {
            const type = inputElement.getAttribute('type') ==='password' ? 'text' : 'password';
            inputElement.setAttribute('type', type);
            toggleElement.querySelector('i').classList.toggle('fa-eye');
            toggleElement.querySelector('i').classList.toggle('fa-eye-slash');
        }

        // Password strength calculation
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            let strength = 0;
            
            // Check password length
            if (password.length >= 8) strength++;
            
            // Check for uppercase letters
            if (/[A-Z]/.test(password)) strength++;
            
            // Check for numbers
            if (/\d/.test(password)) strength++;
            
            // Check for special characters
            if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
            
            // Limit strength to 3
            strength = Math.min(strength, 3);
            
            // Update strength indicator
            const level = strengthLevels[strength];
            passwordStrengthBar.style.width = level.width;
            passwordStrengthBar.style.backgroundColor = level.color;
            passwordStrengthText.textContent = level.text;
            passwordStrengthText.className = "password-strength-text";
            
            if (strength === 0) {
                passwordStrengthText.classList.add("strength-weak");
            } else if (strength === 1) {
                passwordStrengthText.classList.add("strength-medium");
            } else {
                passwordStrengthText.classList.add("strength-strong");
            }
        });

        // Form validation
        function validateForm() {
            let isValid = true;
            hideAllErrors();
            
            // Full name validation
            if (!fullNameInput.value.trim()) {
                showError('nameError', 'Full name is required');
                fullNameInput.classList.add('error');
                isValid = false;
            } else {
                fullNameInput.classList.remove('error');
            }
            
            // Phone number validation (simple version)
            const phoneRegex = /^[0-9]{10,15}$/;
            if (!phoneRegex.test(phoneInput.value.replace(/\D/g, ''))) {
                showError('phoneError', 'Please enter a valid phone number');
                phoneInput.classList.add('error');
                isValid = false;
            } else {
                phoneInput.classList.remove('error');
            }
            
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailInput.value)) {
                showError('emailError', 'Please enter a valid email address');
                emailInput.classList.add('error');
                isValid = false;
            } else {
                emailInput.classList.remove('error');
            }
            
            // Password validation
            if (passwordInput.value.length < 8) {
                showError('passwordError', 'Password must be at least 8 characters');
                passwordInput.classList.add('error');
                isValid = false;
            } else {
                passwordInput.classList.remove('error');
            }
            
            // Confirm password validation
            if (passwordInput.value !== confirmPasswordInput.value) {
                showError('confirmPasswordError', 'Passwords do not match');
                confirmPasswordInput.classList.add('error');
                isValid = false;
            } else {
                confirmPasswordInput.classList.remove('error');
            }
            
            // Terms agreement validation
            if (!termsCheckbox.checked) {
                showError('termsError', 'You must agree to the terms');
                isValid = false;
            }
            
            return isValid;
        }

        function showError(elementId, message) {
            const errorElement = document.getElementById(elementId);
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }

        function hideAllErrors() {
            const errors = document.querySelectorAll('.error-message');
            errors.forEach(error => {
                error.style.display = 'none';
            });
        }

        // Firebase registration
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!validateForm()) return;
            
            // Show loading state
            registerLoader.style.display = 'inline-block';
            registerText.textContent = 'Creating Account...';
            registerButton.disabled = true;
            
            const fullName = fullNameInput.value.trim();
            const phone = phoneInput.value;
            const email = emailInput.value;
            const password = passwordInput.value;
            
            try {
                // Create user with Firebase Authentication
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Save additional user data to Firestore
                await db.collection('users').doc(user.uid).set({
                    fullName: fullName,
                    phone: phone,
                    email: email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    role: 'customer'
                });
                
                // Show success message
                successMessage.textContent = 'Account created successfully! Redirecting to your profile...';
                successMessage.style.display = 'block';
                
                // Redirect to profile page after 2 seconds
                setTimeout(() => {
                    window.location.href = 'profile.html';
                }, 2000);
                
            } catch (error) {
                console.error('Registration error:', error);
                firebaseError.textContent = getFirebaseErrorMessage(error.code);
                firebaseError.style.display = 'block';
            } finally {
                // Reset loading state
                registerLoader.style.display = 'none';
                registerText.textContent = 'Create Account';
                registerButton.disabled = false;
            }
        });

        // Google sign-in
        googleSignInBtn.addEventListener('click', async function() {
            const provider = new firebase.auth.GoogleAuthProvider();
            
            try {
                const result = await auth.signInWithPopup(provider);
                const user = result.user;
                
                // Check if user already exists in Firestore
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (!userDoc.exists) {
                    // Save new user to Firestore
                    await db.collection('users').doc(user.uid).set({
                        fullName: user.displayName || 'Google User',
                        email: user.email,
                        phone: user.phoneNumber || '',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        role: 'customer'
                    });
                }
                
                // Redirect to profile page
                window.location.href = 'profile.html';
                
            } catch (error) {
                console.error('Google sign-in error:', error);
                firebaseError.textContent = getFirebaseErrorMessage(error.code);
                firebaseError.style.display = 'block';
            }
        });

        // Helper function to translate Firebase error codes
        function getFirebaseErrorMessage(code) {
            switch(code) {
                case 'auth/email-already-in-use':
                    return 'This email is already registered. Please sign in or use a different email.';
                case 'auth/invalid-email':
                    return 'The email address is not valid.';
                case 'auth/weak-password':
                    return 'Password should be at least 6 characters.';
                case 'auth/popup-closed-by-user':
                    return 'Google sign-in was canceled.';
                case 'auth/network-request-failed':
                    return 'Network error. Please check your internet connection.';
                default:
                    return 'An error occurred. Please try again.';
            }
        }
