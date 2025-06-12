// Initialize Supabase client
const supabaseUrl = 'https://xwjalnofppcadadjxnaj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3amFsbm9mcHBjYWRhZGp4bmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMTU0MDksImV4cCI6MjA2NDg5MTQwOX0.e6tpjy9YdaKD7dxGZkFy_gmFtol4VhZ2bMddwU2M8wA';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

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
    const icon = toggleElement.querySelector('i');
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
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
    
    // Phone number validation
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(phoneInput.value.replace(/\D/g, ''))) {
        showError('phoneError', 'Please enter a valid phone number (10-15 digits)');
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

// Supabase registration
registerForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    // Show loading state
    registerLoader.style.display = 'inline-block';
    registerText.textContent = 'Creating Account...';
    registerButton.disabled = true;
    
    const fullName = fullNameInput.value.trim();
    const phone = phoneInput.value.replace(/\D/g, ''); // Remove non-digits for storage
    const email = emailInput.value;
    const password = passwordInput.value;
    
    try {
        // Create user with Supabase Authentication
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName,
                    phone: phone
                }
            }
        });
        
        if (authError) {
            throw authError;
        }
        
        // Save additional user data to Supabase database
        const { data: userData, error: userError } = await supabase
            .from('users')
            .insert([
                { 
                    id: authData.user.id,
                    email: email,
                    full_name: fullName,
                    phone: phone,
                    created_at: new Date().toISOString(),
                    role: 'customer'
                }
            ]);
        
        if (userError) {
            throw userError;
        }
        
        // Show success message
        successMessage.textContent = 'Account created successfully! Please check your email to verify your account.';
        successMessage.style.display = 'block';
        firebaseError.style.display = 'none';
        
        // Reset form
        registerForm.reset();
        
        // Redirect to login page after 3 seconds
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);
        
    } catch (error) {
        console.error('Registration error:', error);
        firebaseError.textContent = getSupabaseErrorMessage(error.message);
        firebaseError.style.display = 'block';
        successMessage.style.display = 'none';
    } finally {
        // Reset loading state
        registerLoader.style.display = 'none';
        registerText.textContent = 'Create Account';
        registerButton.disabled = false;
    }
});

// Google sign-in with Supabase
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
        firebaseError.textContent = getSupabaseErrorMessage(error.message);
        firebaseError.style.display = 'block';
        successMessage.style.display = 'none';
    }
});

// Helper function to translate Supabase error messages
function getSupabaseErrorMessage(errorMessage) {
    if (errorMessage.includes('User already registered')) {
        return 'This email is already registered. Please sign in or use a different email.';
    } else if (errorMessage.includes('Invalid email')) {
        return 'The email address is not valid.';
    } else if (errorMessage.includes('Password should be at least')) {
        return 'Password should be at least 8 characters.';
    } else if (errorMessage.includes('OAuth')) {
        return 'Google sign-in was canceled or failed.';
    } else if (errorMessage.includes('Network')) {
        return 'Network error. Please check your internet connection.';
    } else {
        return 'An error occurred. Please try again.';
    }
                  }
