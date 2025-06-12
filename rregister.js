// Supabase configuration
const supabaseUrl = 'https://xwjalnofppcadadjxnaj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3amFsbm9mcHBjYWRhZGp4bmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMTU0MDksImV4cCI6MjA2NDg5MTQwOX0.e6tpjy9YdaKD7dxGZkFy_gmFtol4VhZ2bMddwU2M8wA';

// Initialize Supabase
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

// Toggle password visibility - FIXED
function togglePasswordVisibility(inputElement, toggleElement) {
    const type = inputElement.type === 'password' ? 'text' : 'password';
    inputElement.type = type;
    const icon = toggleElement.querySelector('i');
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
}

passwordToggle.addEventListener('click', () => togglePasswordVisibility(passwordInput, passwordToggle));
confirmPasswordToggle.addEventListener('click', () => togglePasswordVisibility(confirmPasswordInput, confirmPasswordToggle));

// Password strength calculation
passwordInput.addEventListener('input', function() {
    const password = this.value;
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
    
    strength = Math.min(strength, 3);
    const level = strengthLevels[strength];
    
    passwordStrengthBar.style.width = level.width;
    passwordStrengthBar.style.backgroundColor = level.color;
    passwordStrengthText.textContent = level.text;
    passwordStrengthText.className = "password-strength-text";
    
    if (strength === 0) passwordStrengthText.classList.add("strength-weak");
    else if (strength === 1) passwordStrengthText.classList.add("strength-medium");
    else passwordStrengthText.classList.add("strength-strong");
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
    }
    
    // Phone number validation
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(phoneInput.value.replace(/\D/g, ''))) {
        showError('phoneError', 'Please enter a valid phone number (10-15 digits)');
        phoneInput.classList.add('error');
        isValid = false;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.value)) {
        showError('emailError', 'Please enter a valid email address');
        emailInput.classList.add('error');
        isValid = false;
    }
    
    // Password validation
    if (passwordInput.value.length < 8) {
        showError('passwordError', 'Password must be at least 8 characters');
        passwordInput.classList.add('error');
        isValid = false;
    }
    
    // Confirm password validation
    if (passwordInput.value !== confirmPasswordInput.value) {
        showError('confirmPasswordError', 'Passwords do not match');
        confirmPasswordInput.classList.add('error');
        isValid = false;
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
    document.querySelectorAll('.error-message').forEach(error => {
        error.style.display = 'none';
    });
    document.querySelectorAll('.form-control').forEach(input => {
        input.classList.remove('error');
    });
}

// Supabase registration - FULLY WORKING VERSION
registerForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    // Show loading state
    registerLoader.style.display = 'inline-block';
    registerText.textContent = 'Creating Account...';
    registerButton.disabled = true;
    
    const fullName = fullNameInput.value.trim();
    const phone = phoneInput.value.replace(/\D/g, '');
    const email = emailInput.value;
    const password = passwordInput.value;
    
    try {
        // 1. Sign up user with email/password
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
        
        if (authError) throw authError;
        
        // 2. Insert user data into public.users table
        const { error: dbError } = await supabase
            .from('users')
            .insert([
                { 
                    id: authData.user.id,
                    full_name: fullName,
                    phone: phone,
                    email: email,
                    role: 'customer'
                }
            ]);
        
        if (dbError) throw dbError;
        
        // Show success message
        successMessage.textContent = 'Account created successfully! Please check your email to verify your account.';
        successMessage.style.display = 'block';
        firebaseError.style.display = 'none';
        
        // Clear form
        registerForm.reset();
        
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

// Google sign-in with Supabase - WORKING VERSION
googleSignInBtn.addEventListener('click', async function() {
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + 'profile.html'
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

// Improved error message handling
function getSupabaseErrorMessage(message) {
    if (!message) return 'An unknown error occurred. Please try again.';
    
    if (message.includes('User already registered')) {
        return 'This email is already registered. Please sign in or use a different email.';
    } else if (message.includes('Invalid email')) {
        return 'The email address is not valid.';
    } else if (message.includes('Password should be at least')) {
        return 'Password should be at least 8 characters.';
    } else if (message.includes('OAuth')) {
        return 'Google sign-in was canceled or failed. Please try again.';
    } else if (message.includes('Network')) {
        return 'Network error. Please check your internet connection.';
    } else if (message.includes('duplicate key value violates unique constraint')) {
        return 'This email is already registered. Please sign in.';
    } else {
        return message.length > 100 ? 'An error occurred. Please try again.' : message;
    }
}

// Check if user is already logged in
async function checkAuthState() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) window.location.href = 'profile.html';
}

// Initialize
document.addEventListener('DOMContentLoaded', checkAuthState);
