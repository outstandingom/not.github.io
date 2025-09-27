 // Supabase configuration
        const SUPABASE_URL = 'https://bdsveayfvgnluxajbwio.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc3ZlYXlmdmdubHV4YWpid2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNDczMzIsImV4cCI6MjA3MzkyMzMzMn0.HHSFl6zkRmk2KuBZPrZsgrJ2C0xUu8McQCWvDFzNhgw';

        // Initialize Supabase
        let supabase;
        try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('Supabase client initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
        }

        // DOM elements
        const progressBar = document.getElementById('progressBar');
        const toastContainer = document.getElementById('toastContainer');
        const form = document.getElementById('merchantRegistrationForm');
        const addServiceBtn = document.getElementById('addServiceBtn');
        const servicesList = document.getElementById('servicesList');
        const salonImageUrl = document.getElementById('salonImageUrl');
        const salonImagePreview = document.getElementById('salonImagePreview');
        const mapLink = document.getElementById('mapLink');
        const mapPreview = document.getElementById('mapPreview');
        const successModal = document.getElementById('successModal');
        const continueBtn = document.getElementById('continueBtn');
        const servicesError = document.getElementById('servicesError');
        const backButton = document.getElementById('backButton');
        const loadingOverlay = document.getElementById('loadingOverlay');

        // Add UPI validation function
function validateUPI(upi) {
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,49}@[a-zA-Z]{2,}$/;
    return upiRegex.test(upi);
}

// Update form validation to include UPI check
function validateForm() {
    // ... existing validation ...
    
    // Validate UPI ID
    const upiId = document.getElementById('upi_id').value.trim();
    if (!upiId || !validateUPI(upiId)) {
        document.getElementById('upi_id').classList.add('is-invalid');
        isValid = false;
    }
    
    return isValid;
}

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
                delay: 5000
            });
            bsToast.show();
            
            // Remove toast after it hides
            toast.addEventListener('hidden.bs.toast', () => {
                toast.remove();
            });
        }

        // Update progress bar
        function updateProgress(percent) {
            if (progressBar) {
                progressBar.style.width = `${percent}%`;
            }
        }

        // Show/hide loading overlay
        function setLoading(loading) {
            if (loadingOverlay) {
                loadingOverlay.style.display = loading ? 'flex' : 'none';
            }
        }

        // Validate service inputs
        function validateServiceInputs() {
            const name = document.getElementById('serviceNameInput').value.trim();
            const price = document.getElementById('servicePriceInput').value;
            const time = document.getElementById('serviceTimeInput').value;
            
            if (!name) {
                showToast('Please enter a service name', true);
                return false;
            }
            
            if (!price || parseFloat(price) <= 0) {
                showToast('Please enter a valid price', true);
                return false;
            }
            
            if (!time || parseInt(time) < 5 || parseInt(time) > 480) {
                showToast('Please enter a time between 5 and 480 minutes', true);
                return false;
            }
            
            return true;
        }

        // Add service to list
        addServiceBtn.addEventListener('click', () => {
            if (!validateServiceInputs()) return;
            
            const name = document.getElementById('serviceNameInput').value.trim();
            const price = parseFloat(document.getElementById('servicePriceInput').value);
            const time = parseInt(document.getElementById('serviceTimeInput').value);
            
            // Create service object
            const service = {
                id: Date.now().toString(),
                name: name,
                price: price,
                estimated_time_minutes: time
            };
            
            // Add to services array
            services.push(service);
            
            // Update services list
            renderServices();
            
            // Reset form
            document.getElementById('serviceNameInput').value = '';
            document.getElementById('servicePriceInput').value = '';
            document.getElementById('serviceTimeInput').value = '';
            
            // Hide services error
            servicesError.style.display = 'none';
            
            showToast('Service added successfully');
        });

        // Render services list
        function renderServices() {
            if (!servicesList) return;
            
            if (services.length === 0) {
                servicesList.innerHTML = '<div class="alert alert-info">No services added yet. Add your first service below.</div>';
                return;
            }
            
            servicesList.innerHTML = '';
            
            services.forEach(service => {
                const serviceItem = document.createElement('div');
                serviceItem.className = 'service-item';
                serviceItem.innerHTML = `
                    <div class="service-details">
                        <div class="fw-bold">${service.name}</div>
                        <div>₹${service.price.toFixed(2)} • ${service.estimated_time_minutes} mins</div>
                    </div>
                    <i class="fas fa-times remove-service" data-id="${service.id}"></i>
                `;
                servicesList.appendChild(serviceItem);
                
                // Add event listener to remove button
                const removeBtn = serviceItem.querySelector('.remove-service');
                if (removeBtn) {
                    removeBtn.addEventListener('click', (e) => {
                        const id = e.target.getAttribute('data-id');
                        services = services.filter(s => s.id !== id);
                        renderServices();
                        showToast('Service removed');
                    });
                }
            });
        }

        // Preview salon image with error handling
        if (salonImageUrl) {
            salonImageUrl.addEventListener('input', () => {
                const url = salonImageUrl.value.trim();
                if (url) {
                    salonImagePreview.src = url;
                    salonImagePreview.style.display = 'block';
                } else {
                    salonImagePreview.style.display = 'none';
                }
            });
            
            // Handle image loading errors
            salonImagePreview.onerror = function() {
                this.style.display = 'none';
                showToast('Failed to load image from the provided URL', true);
            };
        }

        // Preview map location
        if (mapLink && mapPreview) {
            mapLink.addEventListener('input', () => {
                const url = mapLink.value.trim();
                if (url) {
                    // Basic URL validation
                    if (url.startsWith('http://') || url.startsWith('https://')) {
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
                    }
                } else {
                    mapPreview.innerHTML = `
                        <div class="text-center">
                            <i class="fas fa-map-marked-alt"></i>
                            <p class="mt-2">Map preview will appear here</p>
                        </div>
                    `;
                }
            });
        }

        // Custom form validation
        function validateForm() {
            let isValid = true;
            
            // Check required fields
            const requiredFields = form.querySelectorAll('[required]');
            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    field.classList.add('is-invalid');
                    isValid = false;
                } else {
                    field.classList.remove('is-invalid');
                }
            });
            
            // Check services
            if (services.length === 0) {
                servicesError.style.display = 'block';
                isValid = false;
            } else {
                servicesError.style.display = 'none';
            }
            
            return isValid;
        }

        // Form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Add Bootstrap validation classes
            form.classList.add('was-validated');
            
            // Validate form
            if (!validateForm()) {
                showToast('Please fill in all required fields correctly', true);
                return;
            }
            
            if (!document.getElementById('termsAgree').checked) {
                showToast('Please agree to the Terms & Conditions', true);
                return;
            }
            
            if (services.length === 0) {
                servicesError.style.display = 'block';
                showToast('Please add at least one service', true);
                return;
            }
            
            // Show loading
            setLoading(true);
            updateProgress(10);
            
            // Get current user
            let user;
            try {
                const { data: authData, error: authError } = await supabase.auth.getUser();
                if (authError || !authData.user) {
                    throw new Error('Authentication failed: ' + (authError?.message || 'No user found'));
                }
                user = authData.user;
            } catch (error) {
                showToast('You need to be logged in to register as a merchant', true);
                console.error('Auth error:', error);
                setLoading(false);
                updateProgress(0);
                return;
            }
            
            // Get form data
            const salonData = {
                name: document.getElementById('salonName').value.trim(),
                description: document.getElementById('salonDescription').value.trim(),
                address: document.getElementById('salonAddress').value.trim(),
                city: document.getElementById('salonCity').value.trim(),
                upi_id:document.getElementById('upi_id').value.trim(),
                map_link: document.getElementById('mapLink').value.trim() || null,
                image_url: document.getElementById('salonImageUrl').value.trim() || null,
                contact_name: document.getElementById('contactName').value.trim(),
                contact_phone: document.getElementById('contactPhone').value.trim(),
                contact_email: document.getElementById('contactEmail').value.trim(),
                opening_time: document.getElementById('openingTime').value + ':00',
                closing_time: document.getElementById('closingTime').value + ':00',
                closed_on_sunday: document.getElementById('sundayClosed').checked,
                status: 'pending'
            };
            
            // Show loading state
            const submitBtn = document.getElementById('registerMerchantBtn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Registering...';
            }
            
            updateProgress(30);
            
            try {
                // First, get the user's record from the users table
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('auth_uid', user.id)
                    .single();
                
                if (userError) {
                    throw new Error('User record not found: ' + userError.message);
                }
                
                // Add user_id to salon data
                salonData.user_id = userData.id;
                
                updateProgress(50);
                
                // Insert salon data
                const { data: salon, error: salonError } = await supabase
                    .from('salons')
                    .insert(salonData)
                    .select()
                    .single();
                
                if (salonError) {
                    throw new Error('Failed to create salon: ' + salonError.message);
                }
                
                updateProgress(70);
                
                // Insert services
                const servicesData = services.map(service => ({
                    salon_id: salon.id,
                    service_name: service.name,
                    price: service.price,
                    estimated_time_minutes: service.estimated_time_minutes
                }));
                
                const { error: servicesError } = await supabase
                    .from('salon_services')
                    .insert(servicesData);
                
                if (servicesError) {
                    throw new Error('Failed to add services: ' + servicesError.message);
                }
                
                updateProgress(90);
                
                // Update user role to partner/merchant
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ 
                        role: 'partner',
                        account_type: 'merchant',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userData.id);
                
                if (updateError) {
                    console.warn('User role update warning:', updateError.message);
                    // Continue anyway as this is not critical
                }
                
                updateProgress(100);
                
                // Show success modal
                if (successModal) {
                    successModal.classList.add('active');
                }
                
            } catch (error) {
                console.error('Error during registration:', error);
                showToast('Registration failed: ' + error.message, true);
            } finally {
                setLoading(false);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Register as Merchant';
                }
                updateProgress(0);
            }
        });

        // Continue to dashboard
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        // Back button
        if (backButton) {
            backButton.addEventListener('click', () => {
                window.history.back();
            });
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', async () => {
            console.log('Page loaded, initializing...');
            
            // Render services
            renderServices();
            
            // Check authentication status
            try {
                const { data: { user } } = await supabase.auth.getUser();
                
                if (!user) {
                    showToast('You need to be logged in to register as a merchant', true);
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                    return;
                }
                
                // Pre-fill email if available
                const contactEmail = document.getElementById('contactEmail');
                if (contactEmail && user.email) {
                    contactEmail.value = user.email;
                }
                
                // Check if user is already a partner
                const { data: userData, error } = await supabase
                    .from('users')
                    .select('role, account_type')
                    .eq('auth_uid', user.id)
                    .single();
                
                if (!error && userData && (userData.role === 'partner' || userData.account_type === 'merchant')) {
                    showToast('You are already registered as a merchant', true);
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                }
                
            } catch (error) {
                console.error('Initialization error:', error);
                showToast('Error initializing application', true);
            }
        });
   
