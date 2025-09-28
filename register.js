const SUPABASE_URL = 'https://bdsveayfvgnluxajbwio.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc3ZlYXlmdmdubHV4YWpid2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNDczMzIsImV4cCI6MjA3MzkyMzMzMn0.HHSFl6zkRmk2KuBZPrZsgrJ2C0xU8McQCWvDFzNhgw';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM elements
const registerForm = document.getElementById('registerForm');
const fullNameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const accountTypeSelect = document.getElementById('accountType');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');

// Validation functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    // Basic phone validation - accepts 10 digits, optional country code
    const phoneRegex = /^(\+\d{1,3})?\d{10}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

function isValidPassword(password) {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
}

function showError(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
    }
}

function showSuccess(message) {
    if (successMessage) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    }
}

function clearMessages() {
    if (errorMessage) errorMessage.style.display = 'none';
    if (successMessage) successMessage.style.display = 'none';
}

// Real-time validation
if (emailInput) {
    emailInput.addEventListener('blur', () => {
        if (emailInput.value && !isValidEmail(emailInput.value)) {
            emailInput.style.borderColor = 'red';
        } else {
            emailInput.style.borderColor = '';
        }
    });
}

if (phoneInput) {
    phoneInput.addEventListener('blur', () => {
        if (phoneInput.value && !isValidPhone(phoneInput.value)) {
            phoneInput.style.borderColor = 'red';
        } else {
            phoneInput.style.borderColor = '';
        }
    });
}

if (passwordInput) {
    passwordInput.addEventListener('blur', () => {
        if (passwordInput.value && !isValidPassword(passwordInput.value)) {
            passwordInput.style.borderColor = 'red';
        } else {
            passwordInput.style.borderColor = '';
        }
    });
}

if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('blur', () => {
        if (confirmPasswordInput.value && confirmPasswordInput.value !== passwordInput.value) {
            confirmPasswordInput.style.borderColor = 'red';
        } else {
            confirmPasswordInput.style.borderColor = '';
        }
    });
}

// Main registration function
async function registerUser(userData) {
    try {
        clearMessages();

        // Validate required fields
        if (!userData.full_name || !userData.email || !userData.password) {
            throw new Error('Full name, email, and password are required');
        }

        // Validate email format
        if (!isValidEmail(userData.email)) {
            throw new Error('Please enter a valid email address');
        }

        // Validate phone if provided
        if (userData.phone && !isValidPhone(userData.phone)) {
            throw new Error('Please enter a valid phone number');
        }

        // Validate password strength
        if (!isValidPassword(userData.password)) {
            throw new Error('Password must be at least 8 characters with uppercase, lowercase, and numbers');
        }

        // Validate password confirmation
        if (userData.password !== userData.confirmPassword) {
            throw new Error('Passwords do not match');
        }

        // Step 1: Sign up with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
                data: {
                    full_name: userData.full_name,
                    phone: userData.phone,
                    account_type: userData.account_type
                }
            }
        });

        if (authError) {
            throw new Error(authError.message);
        }

        if (!authData.user) {
            throw new Error('Registration failed - no user data returned');
        }

        // Step 2: Create user record in the users table
        const { data: userRecord, error: userError } = await supabase
            .from('users')
            .insert([
                {
                    auth_uid: authData.user.id,
                    full_name: userData.full_name,
                    email: userData.email,
                    phone: userData.phone,
                    role: userData.account_type === 'salon_owner' ? 'salon_owner' : 'customer',
                    account_type: userData.account_type || 'customer'
                }
            ])
            .select();

        if (userError) {
            // If user record creation fails, we should handle it appropriately
            console.error('Error creating user record:', userError);
            
            // You might want to delete the auth user if profile creation fails
            // await supabase.auth.admin.deleteUser(authData.user.id);
            
            throw new Error('Registration completed but profile setup failed. Please contact support.');
        }

        showSuccess('Registration successful! Please check your email for verification.');
        
        // Optional: Redirect to login page after 3 seconds
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 3000);

        return { authData, userRecord };

    } catch (error) {
        console.error('Registration error:', error);
        showError(error.message);
        throw error;
    }
}

// Form submission handler
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            full_name: fullNameInput.value.trim(),
            email: emailInput.value.trim(),
            phone: phoneInput.value.trim(),
            password: passwordInput.value,
            confirmPassword: confirmPasswordInput.value,
            account_type: accountTypeSelect ? accountTypeSelect.value : 'customer'
        };

        try {
            await registerUser(formData);
        } catch (error) {
            // Error is already handled in registerUser function
            console.error('Registration failed:', error);
        }
    });
}

// Optional: Check if user is already logged in
async function checkAuthStatus() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = 'profile.html';
    }
}

// Initialize auth check when page loads
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
});

// Export functions for use in other modules (if needed)
window.registerModule = {
    registerUser,
    isValidEmail,
    isValidPhone,
    isValidPassword
};
