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

        // DOM elements
        const progressBar = document.getElementById('progressBar');
        const progressPercent = document.getElementById('progressPercent');
        const toastContainer = document.getElementById('toastContainer');
        const form = document.getElementById('merchantRegistrationForm');
        const addServiceBtn = document.getElementById('addServiceBtn');
        const saveServiceBtn = document.getElementById('saveServiceBtn');
        const serviceInputForm = document.querySelector('.service-form');
        const servicesList = document.getElementById('servicesList');
        const salonImageUrl = document.getElementById('salonImageUrl');
        const salonImagePreview = document.getElementById('salonImagePreview');
        const mapLink = document.getElementById('mapLink');
        const mapPreview = document.getElementById('mapPreview');

        // Services array
        let services = [];

        // Show toast notification
        function showToast(message, isError = false) {
            const toast = document.createElement('div');
            toast.className = `toast align-items-center ${isError ? 'bg-danger' : 'bg-success'}`;
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');
            toast.setAttribute('aria-atomic', 'true');
            
            toast.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body text-white">
                        <i class="fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'} me-2"></i>
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
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
            progressBar.setAttribute('aria-valuenow', percent);
            progressPercent.textContent = `${percent}%`;
            
            // Update step indicators
            const steps = document.querySelectorAll('.step');
            if (percent >= 25) steps[0].classList.add('active');
            if (percent >= 50) steps[1].classList.add('active');
            if (percent >= 75) steps[2].classList.add('active');
            if (percent >= 100) steps[3].classList.add('active');
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
                salonImagePreview.src = 'https://via.placeholder.com/300x200?text=Image+Preview';
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
                    <div class="h-100 d-flex flex-column align-items-center justify-content-center text-muted">
                        <i class="fas fa-map-marked-alt fa-3x mb-2"></i>
                        <p>Map preview will appear here</p>
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
                mapLink: document.getElementById('mapLink').value,
                imageUrl: document.getElementById('salonImageUrl').value,
                contact: {
                    name: document.getElementById('contactName').value,
                    phone: document.getElementById('contactPhone').value,
                    email: document.getElementById('contactEmail').value
                },
                hours: {
                    opening: document.getElementById('openingTime').value,
                    closing: document.getElementById('closingTime').value,
                    closedOnSunday: document.getElementById('sundayClosed').checked
                },
                services: services,
                ownerId: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                searchTerms: [
                    document.getElementById('salonName').value.toLowerCase(),
                    document.getElementById('salonCity').value.toLowerCase(),
                    ...services.map(s => s.name.toLowerCase())
                ]
            };
            
            // Show loading state
            const submitBtn = document.getElementById('registerMerchantBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Processing Registration...';
            
            updateProgress(30);
            
            try {
                // Step 1: Upgrade user to merchant
                await db.collection('users').doc(user.uid).update({
                    accountType: 'merchant',
                    merchantInfo: {
                        merchantId: user.uid,
                        businessName: salonData.name
                    }
                });
                
                updateProgress(50);
                showToast('User account upgraded to merchant');
                
                // Step 2: Create merchant document
                const merchantData = {
                    businessName: salonData.name,
                    address: salonData.address,
                    phone: salonData.contact.phone,
                    category: 'Salon',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'active'
                };
                
                await db.collection('merchants').doc(user.uid).set(merchantData);
                
                updateProgress(70);
                showToast('Merchant profile created successfully');
                
                // Step 3: Create salon document
                await db.collection('salons').add(salonData);
                
                updateProgress(100);
                showToast('Salon registered successfully! Redirecting to dashboard...');
                
                // Redirect after delay
                setTimeout(() => {
                    window.location.href = 'merchantdashboard.html';
                }, 2000);
            } catch (error) {
                console.error('Error saving data:', error);
                showToast('Error: ' + error.message, true);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-store me-2"></i>Complete Merchant Registration';
                updateProgress(0);
            }
        });

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            // Check if user is logged in
            auth.onAuthStateChanged(user => {
                if (!user) {
                    showToast('You need to be logged in to register as a merchant', true);
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                } else {
                    // Pre-fill email if available
                    document.getElementById('contactEmail').value = user.email || '';
                    
                    // Show welcome message
                    showToast(`Welcome, ${user.email || 'user'}! Let's set up your merchant account.`);
                }
            });
            
            // Render services
            renderServices();
            
            // Initialize step indicator
            document.querySelectorAll('.step')[0].classList.add('active');
        });
                        
