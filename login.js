   // Supabase configuration
        const SUPABASE_URL = 'https://bdsveayfvgnluxajbwio.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc3ZlYXlmdmdubHV4YWpid2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNDczMzIsImV4cCI6MjA3MzkyMzMzMn0.HHSFl6zkRmk2KuBZPrZsgrJ2C0xUu8McQCWvDFzNhgw';

        // Initialize Supabase
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // DOM Elements
        const loginForm = document.getElementById('loginForm');
        const emailInput = document.getElementById('loginEmail');
        const passwordInput = document.getElementById('loginPassword');
        const loginButton = document.getElementById('loginButton');
        const loginLoader = document.getElementById('loginLoader');
        const loginText = document.getElementById('loginText');
        const googleSignInBtn = document.getElementById('googleSignIn');
        const successMessage = document.getElementById('successMessage');
        const supabaseError = document.getElementById('supabaseError');
        const passwordToggle = document.getElementById('passwordToggle');
        const rememberMeCheckbox = document.getElementById('rememberMe');

        // Toggle password visibility
        passwordToggle.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const icon = this.querySelector('i');
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
        });

        // Form validation
        function validateForm() {
            let isValid = true;
            hideAllErrors();
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailInput.value)) {
                showError('emailError', 'Please enter a valid email address');
                emailInput.classList.add('error');
                isValid = false;
            } else {
                emailInput.classList.remove('error');
            }
            
            if (!passwordInput.value) {
                showError('passwordError', 'Please enter your password');
                passwordInput.classList.add('error');
                isValid = false;
            } else {
                passwordInput.classList.remove('error');
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

        // Supabase login
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!validateForm()) return;
            
            // Show loading state
            loginLoader.style.display = 'inline-block';
            loginText.textContent = 'Signing In...';
            loginButton.disabled = true;
            
            const email = emailInput.value;
            const password = passwordInput.value;
            
            try {
                // Sign in user with Supabase Auth
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) throw error;

                // Show success message
                successMessage.textContent = 'Login successful! Redirecting...';
                successMessage.style.display = 'block';
                supabaseError.style.display = 'none';
                
                // Redirect to profile page after 2 seconds
                setTimeout(() => {
                    window.location.href = 'profile.html';
                }, 2000);
                
            } catch (error) {
                console.error('Login error:', error);
                supabaseError.textContent = getSupabaseErrorMessage(error.message);
                supabaseError.style.display = 'block';
                successMessage.style.display = 'none';
            } finally {
                // Reset loading state
                loginLoader.style.display = 'none';
                loginText.textContent = 'Sign In';
                loginButton.disabled = false;
            }
        });

        // Google sign-in
        googleSignInBtn.addEventListener('click', async function() {
            try {
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: window.location.origin + '/profile.html'
                    }
                });

                if (error) throw error;

            } catch (error) {
                console.error('Google sign-in error:', error);
                supabaseError.textContent = getSupabaseErrorMessage(error.message);
                supabaseError.style.display = 'block';
            }
        });

        // Helper function to translate Supabase error messages
        function getSupabaseErrorMessage(message) {
            if (message.includes('Invalid login credentials')) {
                return 'Invalid email or password. Please try again.';
            }
            if (message.includes('Email not confirmed')) {
                return 'Please verify your email address before signing in.';
            }
            if (message.includes('Email rate limit exceeded')) {
                return 'Too many login attempts. Please try again later.';
            }
            return message || 'An error occurred. Please try again.';
        }

        // Check if user is already logged in
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                window.location.href = 'profile.html';
            }
        });

        // Forgot password functionality
        document.querySelector('.forgot-password').addEventListener('click', function(e) {
            e.preventDefault();
            const email = prompt('Please enter your email address to reset your password:');
            if (email) {
                supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/reset-password.html'
                }).then(({ error }) => {
                    if (error) {
                        alert('Error sending reset email: ' + error.message);
                    } else {
                        alert('Password reset email sent! Check your inbox.');
                    }
                });
            }
        });
  
