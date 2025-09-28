// Supabase configuration
const SUPABASE_URL = 'https://bdsveayfvgnluxajbwio.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc3ZlYXlmdmdubHV4YWpid2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNDczMzIsImV4cCI6MjA3MzkyMzMzMn0.HHSFl6zkRmk2KuBZPrZsgrJ2C0xUu8McQCWvDFzNhgw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', function() {
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
    const successMessage = document.getElementById('successMessage');
    const supabaseError = document.getElementById('supabaseError');
    
    // Password toggle elements
    const registerPasswordToggle = document.getElementById('registerPasswordToggle');
    const confirmPasswordToggle = document.getElementById('confirmPasswordToggle');
    
    // Password strength elements
    const passwordStrengthBar = document.getElementById('passwordStrengthBar');
    const passwordStrengthText = document.getElementById('passwordStrengthText');

    // Validation patterns
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^[6-9]\d{9}$/; // Indian phone number format
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    // Password toggle functionality
    registerPasswordToggle.addEventListener('click', function() {
        togglePasswordVisibility(passwordInput, this);
    });

    confirmPasswordToggle.addEventListener('click', function() {
        togglePasswordVisibility(confirmPasswordInput, this);
    });

    function togglePasswordVisibility(input, toggle) {
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        toggle.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    }

    // Real-time validation
    fullNameInput.addEventListener('blur', validateFullName);
    phoneInput.addEventListener('blur', validatePhone);
    emailInput.addEventListener('blur', validateEmail);
    passwordInput.addEventListener('input', validatePassword);
    confirmPasswordInput.addEventListener('blur', validateConfirmPassword);
    termsCheckbox.addEventListener('change', validateTerms);

    // Password strength indicator
    passwordInput.addEventListener('input', updatePasswordStrength);

    function validateFullName() {
        const name = fullNameInput.value.trim();
        const nameError = document.getElementById('nameError');
        
        if (!name) {
            showError(fullNameInput, nameError, 'Please enter your full name');
            return false;
        }
        
        if (name.length < 2) {
            showError(fullNameInput, nameError, 'Name must be at least 2 characters long');
            return false;
        }
        
        showSuccess(fullNameInput, nameError);
        return true;
    }

    function validatePhone() {
        const phone = phoneInput.value.trim();
        const phoneError = document.getElementById('phoneError');
        
        if (!phone) {
            showError(phoneInput, phoneError, 'Please enter your phone number');
            return false;
        }
        
        if (!phonePattern.test(phone)) {
            showError(phoneInput, phoneError, 'Please enter a valid 10-digit phone number');
            return false;
        }
        
        showSuccess(phoneInput, phoneError);
        return true;
    }

    function validateEmail() {
        const email = emailInput.value.trim();
        const emailError = document.getElementById('emailError');
        
        if (!email) {
            showError(emailInput, emailError, 'Please enter your email address');
            return false;
        }
        
        if (!emailPattern.test(email)) {
            showError(emailInput, emailError, 'Please enter a valid email address');
            return false;
        }
        
        showSuccess(emailInput, emailError);
        return true;
    }

    function validatePassword() {
        const password = passwordInput.value;
        const passwordError = document.getElementById('passwordError');
        
        if (!password) {
            showError(passwordInput, passwordError, 'Please enter a password');
            return false;
        }
        
        if (!passwordPattern.test(password)) {
            showError(passwordInput, passwordError, 'Password must contain at least 8 characters, one uppercase letter, one number, and one special character');
            return false;
        }
        
        showSuccess(passwordInput, passwordError);
        return true;
    }

    function validateConfirmPassword() {
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const confirmPasswordError = document.getElementById('confirmPasswordError');
        
        if (!confirmPassword) {
            showError(confirmPasswordInput, confirmPasswordError, 'Please confirm your password');
            return false;
        }
        
        if (password !== confirmPassword) {
            showError(confirmPasswordInput, confirmPasswordError, 'Passwords do not match');
            return false;
        }
        
        showSuccess(confirmPasswordInput, confirmPasswordError);
        return true;
    }

    function validateTerms() {
        const termsError = document.getElementById('termsError');
        
        if (!termsCheckbox.checked) {
            showError(termsCheckbox, termsError, 'You must agree to the terms and conditions');
            return false;
        }
        
        showSuccess(termsCheckbox, termsError);
        return true;
    }

    function updatePasswordStrength() {
        const password = passwordInput.value;
        let strength = 0;
        let text = '';
        let color = '';
        
        if (password.length >= 8) strength += 25;
        if (/[a-z]/.test(password)) strength += 25;
        if (/[A-Z]/.test(password)) strength += 25;
        if (/[0-9]/.test(password)) strength += 15;
        if (/[@$!%*?&]/.test(password)) strength += 10;
        
        strength = Math.min(strength, 100);
        
        if (strength < 40) {
            text = 'Weak';
            color = '#d32f2f';
        } else if (strength < 70) {
            text = 'Medium';
            color = '#ff9800';
        } else {
            text = 'Strong';
            color = '#4caf50';
        }
        
        passwordStrengthBar.style.width = strength + '%';
        passwordStrengthBar.style.background = color;
        passwordStrengthText.textContent = text;
        passwordStrengthText.className = 'password-strength-text strength-' + text.toLowerCase();
    }

    function showError(input, errorElement, message) {
        input.classList.remove('success');
        input.classList.add('error');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    function showSuccess(input, errorElement) {
        input.classList.remove('error');
        input.classList.add('success');
        errorElement.style.display = 'none';
    }

    function hideAllErrors() {
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(element => {
            element.style.display = 'none';
        });
        
        const inputs = document.querySelectorAll('.form-control');
        inputs.forEach(input => {
            input.classList.remove('error', 'success');
        });
    }

    function showSupabaseError(message) {
        supabaseError.textContent = message;
        supabaseError.style.display = 'block';
        setTimeout(() => {
            supabaseError.style.display = 'none';
        }, 5000);
    }

    function showSuccessMessage(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 5000);
    }

    function setLoadingState(loading) {
        if (loading) {
            registerButton.disabled = true;
            registerLoader.style.display = 'inline-block';
            registerText.textContent = 'Creating Account...';
        } else {
            registerButton.disabled = false;
            registerLoader.style.display = 'none';
            registerText.textContent = 'Create Account';
        }
    }

    // Google Sign In
    document.getElementById('googleSignIn').addEventListener('click', async function() {
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/dashboard.html'
                }
            });
            
            if (error) throw error;
        } catch (error) {
            console.error('Google sign in error:', error);
            showSupabaseError('Failed to sign in with Google: ' + error.message);
        }
    });

    // Form submission
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validate all fields
        const isNameValid = validateFullName();
        const isPhoneValid = validatePhone();
        const isEmailValid = validateEmail();
        const isPasswordValid = validatePassword();
        const isConfirmPasswordValid = validateConfirmPassword();
        const isTermsValid = validateTerms();
        
        if (!isNameValid || !isPhoneValid || !isEmailValid || !isPasswordValid || !isConfirmPasswordValid || !isTermsValid) {
            showSupabaseError('Please fix the errors above before submitting');
            return;
        }
        
        setLoadingState(true);
        hideAllErrors();
        
        try {
            const userData = {
                full_name: fullNameInput.value.trim(),
                phone: phoneInput.value.trim(),
                email: emailInput.value.trim(),
                password: passwordInput.value
            };
            
            // Step 1: Sign up with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: {
                    data: {
                        full_name: userData.full_name,
                        phone: userData.phone
                    }
                }
            });
            
            if (authError) throw authError;
            
            if (authData.user) {
                // Step 2: Create user record in the users table
                const { data: userRecord, error: userError } = await supabase
                    .from('users')
                    .insert([
                        {
                            auth_uid: authData.user.id,
                            full_name: userData.full_name,
                            email: userData.email,
                            phone: userData.phone,
                            role: 'customer',
                            account_type: 'customer'
                        }
                    ])
                    .select();
                
                if (userError) {
                    // If user record creation fails, we might want to delete the auth user
                    // But for now, just throw the error
                    throw userError;
                }
                
                // Success!
                showSuccessMessage('Account created successfully! Please check your email for verification.');
                registerForm.reset();
                
                // Redirect to login page after 3 seconds
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 3000);
            }
            
        } catch (error) {
            console.error('Registration error:', error);
            
            // Handle specific error cases
            if (error.message.includes('User already registered')) {
                showSupabaseError('An account with this email already exists. Please try logging in.');
            } else if (error.message.includes('invalid_email')) {
                showSupabaseError('Please enter a valid email address.');
            } else if (error.message.includes('weak_password')) {
                showSupabaseError('Password is too weak. Please choose a stronger password.');
            } else {
                showSupabaseError('Registration failed: ' + error.message);
            }
        } finally {
            setLoadingState(false);
        }
    });

    // Real-time form validation as user types
    const inputs = [fullNameInput, phoneInput, emailInput, passwordInput, confirmPasswordInput];
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            // Clear error when user starts typing
            const errorElement = document.getElementById(input.id + 'Error');
            if (errorElement) {
                errorElement.style.display = 'none';
                input.classList.remove('error');
            }
        });
    });
});
