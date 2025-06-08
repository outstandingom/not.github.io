// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCsJR-aYy0VGSPvb7pXHaK3EmGsJWcvdDo",
    authDomain: "login-fa2eb.firebaseapp.com",
    projectId: "login-fa2eb",
    storageBucket: "login-fa2eb.appspot.com",
    messagingSenderId: "1093052500996",
    appId: "1:1093052500996:web:05a13485172c455e93b951",
    measurementId: "G-9TC2J0YQ3R"
};

firebase.initializeApp(firebaseConfig);

// Initialize Supabase
const supabaseUrl = 'https://xwjalnofppcadadjxnaj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3amFsbm9mcHBjYWRhZGp4bmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMTU0MDksImV4cCI6MjA2NDg5MTQwOX0.e6tpjy9YdaKD7dxGZkFy_gmFtol4VhZ2bMddwU2M8wA';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('merchantRegistrationForm');
    const registerBtn = document.getElementById('registerMerchantBtn');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerBtn.disabled = true;
        
        try {
            // Get current Firebase user
            const firebaseUser = firebase.auth().currentUser;
            if (!firebaseUser) {
                showToast('User not authenticated. Please log in.', 'error');
                registerBtn.disabled = false;
                return;
            }
            
            // Collect services
            const services = [];
            document.querySelectorAll('.service-item').forEach(item => {
                if (!item.classList.contains('alert')) {
                    const name = item.querySelector('.service-name')?.textContent;
                    const price = parseFloat(item.querySelector('.service-price')?.textContent.replace('$', ''));
                    if (name && !isNaN(price)) {
                        services.push({ name, price });
                    }
                }
            });
            
            // Prepare salon data
            const salonData = {
                user_uid: firebaseUser.uid,
                salon_name: document.getElementById('salonName').value,
                description: document.getElementById('salonDescription').value,
                address: document.getElementById('salonAddress').value,
                city: document.getElementById('salonCity').value,
                map_link: document.getElementById('mapLink').value,
                salon_image_url: document.getElementById('salonImageUrl').value,
                contact_person: document.getElementById('contactName').value,
                contact_phone: document.getElementById('contactPhone').value,
                contact_email: document.getElementById('contactEmail').value,
                opening_time: document.getElementById('openingTime').value,
                closing_time: document.getElementById('closingTime').value,
                closed_on_sunday: document.getElementById('sundayClosed').checked,
                services: services,
                created_at: new Date().toISOString()
            };
            
            // Step 1: Insert salon data
            const { error: salonError } = await supabase
                .from('salons')
                .insert([salonData]);
            
            if (salonError) throw salonError;
            
            // Step 2: Update user role
            const { error: profileError } = await supabase
                .from('users')
                .update({ role: 'merchant' })
                .eq('uid', firebaseUser.uid);
            
            if (profileError) throw profileError;
            
            // Show success
            document.getElementById('successModal').classList.add('active');
        } catch (error) {
            console.error('Registration error:', error);
            showToast(`Registration failed: ${error.message}`, 'error');
            registerBtn.disabled = false;
        }
    });

    // Continue button handler
    document.getElementById('continueBtn').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });

    // Service management logic
    const addServiceBtn = document.getElementById('addServiceBtn');
    const serviceInputForm = document.getElementById('serviceInputForm');
    const saveServiceBtn = document.getElementById('saveServiceBtn');
    const servicesList = document.getElementById('servicesList');
    
    addServiceBtn.addEventListener('click', () => {
        serviceInputForm.style.display = 'block';
        addServiceBtn.style.display = 'none';
    });
    
    saveServiceBtn.addEventListener('click', () => {
        const name = document.getElementById('serviceNameInput').value;
        const price = parseFloat(document.getElementById('servicePriceInput').value);
        
        if (name && !isNaN(price) && price > 0) {
            // Remove initial alert if present
            if (servicesList.querySelector('.alert')) {
                servicesList.innerHTML = '';
            }
            
            const serviceItem = document.createElement('div');
            serviceItem.className = 'service-item';
            serviceItem.innerHTML = `
                <div class="service-details">
                    <div class="service-name">${name}</div>
                    <div class="service-price">$${price.toFixed(2)}</div>
                </div>
                <i class="fas fa-times remove-service"></i>
            `;
            servicesList.appendChild(serviceItem);
            
            // Add remove handler
            serviceItem.querySelector('.remove-service').addEventListener('click', () => {
                serviceItem.remove();
                if (servicesList.children.length === 0) {
                    servicesList.innerHTML = `
                        <div class="alert alert-info">
                            No services added yet. Click "Add Service" to get started.
                        </div>
                    `;
                }
            });
            
            // Reset form
            document.getElementById('serviceNameInput').value = '';
            document.getElementById('servicePriceInput').value = '';
            serviceInputForm.style.display = 'none';
            addServiceBtn.style.display = 'block';
        }
    });

    // Image preview
    document.getElementById('salonImageUrl').addEventListener('input', function() {
        const preview = document.getElementById('salonImagePreview');
        if (this.value) {
            preview.src = this.value;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    });
});

// Toast notification function
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    toast.innerHTML = `<div class="toast-body">${message}</div>`;
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.remove(), 5000);
}
