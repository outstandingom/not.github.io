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

// Initialize Supabase
const supabase = supabase.createClient(
    'https://xwjalnofppcadadjxnaj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3amFsbm9mcHBjYWRhZGp4bmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMTU0MDksImV4cCI6MjA2NDg5MTQwOX0.e6tpjy9YdaKD7dxGZkFy_gmFtol4VhZ2bMddwU2M8wA'
);

// DOM elements
const progressBar = document.getElementById('progressBar');
const toastContainer = document.getElementById('toastContainer');
const form = document.getElementById('merchantRegistrationForm');
const addServiceBtn = document.getElementById('addServiceBtn');
const saveServiceBtn = document.getElementById('saveServiceBtn');
const serviceInputForm = document.getElementById('serviceInputForm');
const servicesList = document.getElementById('servicesList');
const salonImageUrl = document.getElementById('salonImageUrl');
const salonImagePreview = document.getElementById('salonImagePreview');
const mapLink = document.getElementById('mapLink');
const mapPreview = document.getElementById('mapPreview');
const successModal = document.getElementById('successModal');
const continueBtn = document.getElementById('continueBtn');

// Services array
let services = [];

// Show toast notification
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast align-items-center ${isError ? 'error' : ''}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'} me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Initialize Bootstrap toast
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 3000
    });
    bsToast.show();
    
    // Remove toast after it hides
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

// Update progress bar
function updateProgress(percent) {
    progressBar.style.width = `${percent}%`;
}

// Toggle service form
addServiceBtn.addEventListener('click', () => {
    serviceInputForm.style.display = 'block';
    addServiceBtn.style.display = 'none';
    document.getElementById('serviceNameInput').focus();
});

// Save service
saveServiceBtn.addEventListener('click', () => {
    const name = document.getElementById('serviceNameInput').value.trim();
    const price = document.getElementById('servicePriceInput').value;
    
    if (!name || !price) {
        showToast('Please fill in both service name and price', true);
        return;
    }
    
    // Create service object
    const service = {
        id: Date.now().toString(),
        name: name,
        price: parseFloat(price)
    };
    
    // Add to services array
    services.push(service);
    
    // Update services list
    renderServices();
    
    // Reset form
    document.getElementById('serviceNameInput').value = '';
    document.getElementById('servicePriceInput').value = '';
    serviceInputForm.style.display = 'none';
    addServiceBtn.style.display = 'block';
});

// Render services list
function renderServices() {
    if (services.length === 0) {
        servicesList.innerHTML = '<div class="alert alert-info">No services added yet. Click "Add Service" to get started.</div>';
        return;
    }
    
    servicesList.innerHTML = '';
    
    services.forEach(service => {
        const serviceItem = document.createElement('div');
        serviceItem.className = 'service-item';
        serviceItem.innerHTML = `
            <div class="service-details">
                <div class="fw-bold">${service.name}</div>
                <div>₹${service.price.toFixed(2)}</div>
            </div>
            <i class="fas fa-times remove-service" data-id="${service.id}"></i>
        `;
        servicesList.appendChild(serviceItem);
        
        // Add event listener to remove button
        serviceItem.querySelector('.remove-service').addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            services = services.filter(s => s.id !== id);
            renderServices();
        });
    });
}

// Preview salon image
salonImageUrl.addEventListener('input', () => {
    const url = salonImageUrl.value.trim();
    if (url) {
        salonImagePreview.src = url;
        salonImagePreview.style.display = 'block';
    } else {
        salonImagePreview.style.display = 'none';
    }
});

// Preview map location
mapLink.addEventListener('input', () => {
    const url = mapLink.value.trim();
    if (url) {
        mapPreview.innerHTML = `
            <iframe 
                src="https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed" 
                width="100%" 
                height="100%" 
                style="border:0; border-radius: 8px;" 
                allowfullscreen="" 
                loading="lazy">
            </iframe>
        `;
    } else {
        mapPreview.innerHTML = `
            <div class="text-center">
                <i class="fas fa-map-marked-alt"></i>
                <p class="mt-2">Map preview will appear here</p>
            </div>
        `;
    }
});

// Form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Show progress
    updateProgress(10);
    
    // Validate form
    if (!document.getElementById('termsAgree').checked) {
        showToast('Please agree to the Terms & Conditions', true);
        updateProgress(0);
        return;
    }
    
    if (services.length === 0) {
        showToast('Please add at least one service', true);
        updateProgress(0);
        return;
    }
    
    // Get current user
    const user = auth.currentUser;
    if (!user) {
        showToast('You need to be logged in to register as a merchant', true);
        updateProgress(0);
        return;
    }
    
    // Get form data
    const salonData = {
        name: document.getElementById('salonName').value,
        description: document.getElementById('salonDescription').value,
        address: document.getElementById('salonAddress').value,
        city: document.getElementById('salonCity').value,
        map_link: document.getElementById('mapLink').value,
        image_url: document.getElementById('salonImageUrl').value,
        contact_name: document.getElementById('contactName').value,
        contact_phone: document.getElementById('contactPhone').value,
        contact_email: document.getElementById('contactEmail').value,
        opening_time: document.getElementById('openingTime').value,
        closing_time: document.getElementById('closingTime').value,
        closed_on_sunday: document.getElementById('sundayClosed').checked,
        services: services,
        owner_id: user.uid,
        owner_email: user.email,
        status: 'active',
        created_at: new Date().toISOString()
    };
    
    // Generate searchable terms
    const searchTerms = [
        salonData.name.toLowerCase(),
        salonData.city.toLowerCase(),
        ...salonData.services.map(s => s.name.toLowerCase())
    ];
    
    // Show loading state
    const submitBtn = document.getElementById('registerMerchantBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Registering...';
    
    updateProgress(30);
    
    try {
        // Step 1: Insert salon data into Supabase
        const { data, error: insertError } = await supabase
            .from('salons')
            .insert([{ ...salonData, search_terms: searchTerms }]);
        
        if (insertError) throw insertError;
        
        updateProgress(60);
        
        // Step 2: Update user role in Supabase
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: user.uid,
                email: user.email,
                role: 'merchant',
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'id'
            });
        
        if (profileError) throw profileError;
        
        updateProgress(100);
        showToast('Registration successful!');
        
        // Show success modal
        successModal.classList.add('active');
        
    } catch (error) {
        console.error('Registration error:', error);
        showToast(`Error: ${error.message}`, true);
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Register as Merchant';
        updateProgress(0);
    }
});

// Continue to dashboard button
continueBtn.addEventListener('click', () => {
    window.location.href = 'merchantdashboard.html';
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is logged in
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            showToast('You need to be logged in to register as a merchant', true);
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            // Pre-fill email if available
            document.getElementById('contactEmail').value = user.email || '';
            
            // Check if user is already a merchant in Supabase
            try {
                const { data: profile, error } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.uid)
                    .single();
                
                if (error) throw error;
                
                if (profile && profile.role === 'merchant') {
                    showToast('You are already registered as a merchant', true);
                    setTimeout(() => {
                        window.location.href = 'merchantdashboard.html';
                    }, 2000);
                }
            } catch (error) {
                console.error('Profile check error:', error);
            }
        }
    });
    
    // Render services
    renderServices();
});
