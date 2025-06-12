// Initialize Supabase client
const supabaseUrl = 'https://xwjalnofppcadadjxnaj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3amFsbm9mcHBjYWRhZGp4bmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMTU0MDksImV4cCI6MjA2NDg5MTQwOX0.e6tpjy9YdaKD7dxGZkFy_gmFtol4VhZ2bMddwU2M8wA';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const registerForm = document.getElementById('registerForm');
    const registerButton = document.getElementById('registerButton');
    const registerLoader = document.getElementById('registerLoader');
    const registerText = document.getElementById('registerText');
    const firebaseError = document.getElementById('firebaseError');
    
    // Password toggle functionality
    const passwordToggle = document.getElementById('registerPasswordToggle');
    const confirmPasswordToggle = document.getElementById('confirmPasswordToggle');
    const registerPassword = document.getElementById('registerPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    
    // Password strength indicators
    const passwordStrengthBar = document.getElementById('passwordStrengthBar');
    const passwordStrengthText = document.getElementById('passwordStrengthText');
    
    // Error message elements
    const nameError = document.getElementById('nameError');
    const phoneError = document.getElementById('phoneError');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const termsError = document.getElementById('termsError');
    const successMessage = document.getElementById('successMessage');
    
    // Password toggle event listeners
    passwordToggle.addEventListener('click', function() {
        togglePasswordVisibility(registerPassword, this);
    });
    
    confirmPasswordToggle.addEventListener('click', function() {
        togglePasswordVisibility(confirmPassword, this);
    });
    
    // Password strength checker
    registerPassword.addEventListener('input', function() {
        checkPasswordStrength(this.value);
    });
    
    // Form submission
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Reset error messages
        resetErrorMessages();
        firebaseError.style.display = 'none';
        
        // Get form values
        const fullName = document.getElementById('fullName').value.trim();
        const phoneNumber = document.getElementById('phoneNumber').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = registerPassword.value;
        const confirmPass = confirmPassword.value;
        const termsAgreed = document.getElementById('termsAgree').checked;
        
        // Validate form
        let isValid = true;
        
        if (!fullName) {
            showError(nameError, 'Please enter your full name');
            isValid = false;
        }
        
        if (!phoneNumber || !validatePhoneNumber(phoneNumber)) {
            showError(phoneError, 'Please enter a valid phone number');
            isValid = false;
        }
        
        if (!email || !validateEmail(email)) {
            showError(emailError, 'Please enter a valid email address');
            isValid = false;
        }
        
        if (!password || password.length < 8) {
            showError(passwordError, 'Password must be at least 8 characters');
            isValid = false;
        } else if (!validatePassword(password)) {
            showError(passwordError, 'Password must include uppercase, number, and special character');
            isValid = false;
        }
        
        if (password !== confirmPass) {
            showError(confirmPasswordError, 'Passwords do not match');
            isValid = false;
        }
        
        if (!termsAgreed) {
            showError(termsError, 'You must agree to the terms');
            isValid = false;
        }
        
        if (!isValid) return;
        
        // Show loading state
        registerButton.disabled = true;
        registerLoader.style.display = 'inline-block';
        registerText.textContent = 'Creating Account...';
        
        try {
            // Sign up with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName,
                        phone_number: phoneNumber
                    }
                }
            });
            
            if (authError) {
                throw authError;
            }
            
            // Store additional user data in a separate table
            const { data: userData, error: userError } = await supabase
                .from('users')
                .insert([
                    { 
                        id: authData.user.id,
                        email: email,
                        full_name: fullName,
                        phone_number: phoneNumber,
                        created_at: new Date().toISOString()
                    }
                ]);
            
            if (userError) {
                throw userError;
            }
            
            // Show success message
            successMessage.textContent = 'Registration successful! Please check your email to verify your account.';
            successMessage.style.display = 'block';
            
            // Reset form
            registerForm.reset();
            
            // Redirect to login page after 3 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 3000);
            
        } catch (error) {
            console.error('Registration error:', error);
            showFirebaseError(error.message);
        } finally {
            // Reset button state
            registerButton.disabled = false;
            registerLoader.style.display = 'none';
            registerText.textContent = 'Create Account';
        }
    });
    
    // Google Sign In
    document.getElementById('googleSignIn').addEventListener('click', async function() {
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/success.html' // Create this page
                }
            });
            
            if (error) throw error;
            
        } catch (error) {
            console.error('Google sign-in error:', error);
            showFirebaseError(error.message);
        }
    });
    
    // Helper Functions
    function togglePasswordVisibility(passwordField, toggleElement) {
        const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordField.setAttribute('type', type);
        
        // Toggle eye icon
        const icon = toggleElement.querySelector('i');
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    }
    
    function checkPasswordStrength(password) {
        // Reset strength indicators
        passwordStrengthBar.style.width = '0%';
        passwordStrengthText.textContent = '';
        
        if (!password) return;
        
        // Calculate strength (simple version)
        let strength = 0;
        
        // Length check
        if (password.length >= 8) strength += 1;
        if (password.length >= 12) strength += 1;
        
        // Character type checks
        if (/[A-Z]/.test(password)) strength += 1;
        if (/[0-9]/.test(password)) strength += 1;
        if (/[^A-Za-z0-9]/.test(password)) strength += 1;
        
        // Update UI
        let width = 0;
        let text = '';
        let color = '';
        
        if (strength <= 2) {
            width = 33;
            text = 'Weak';
            color = '#d32f2f';
        } else if (strength <= 4) {
            width = 66;
            text = 'Medium';
            color = '#ff9800';
        } else {
            width = 100;
            text = 'Strong';
            color = '#4caf50';
        }
        
        passwordStrengthBar.style.width = width + '%';
        passwordStrengthBar.style.backgroundColor = color;
        passwordStrengthText.textContent = text;
        passwordStrengthText.className = 'password-strength-text strength-' + text.toLowerCase();
    }
    
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    function validatePhoneNumber(phone) {
        const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
        return re.test(phone);
    }
    
    function validatePassword(password) {
        // At least 8 chars, 1 uppercase, 1 number, 1 special char
        const re = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/;
        return re.test(password);
    }
    
    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
    }
    
    function resetErrorMessages() {
        const errorMessages = document.querySelectorAll('.error-message');
        errorMessages.forEach(msg => {
            msg.style.display = 'none';
        });
    }
    
    function showFirebaseError(message) {
        firebaseError.textContent = message;
        firebaseError.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            firebaseError.style.display = 'none';
        }, 5000);
    }
});
