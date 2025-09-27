// Supabase configuration
        const SUPABASE_URL = 'https://bdsveayfvgnluxajbwio.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc3ZlYXlmdmdubHV4YWpid2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNDczMzIsImV4cCI6MjA3MzkyMzMzMn0.HHSFl6zkRmk2KuBZPrZsgrJ2C0xUu8McQCWvDFzNhgw';

        // Initialize Supabase
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // DOM Elements
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const profileFullName = document.getElementById('profileFullName');
        const profileEmailDetail = document.getElementById('profileEmailDetail');
        const profilePhone = document.getElementById('profilePhone');
        const profileJoinDate = document.getElementById('profileJoinDate');
        const profileAccountType = document.getElementById('profileAccountType');
        const profileImage = document.getElementById('profileImage');
         
        const merchantBadge = document.getElementById('merchantBadge');
        const logoutBtn = document.getElementById('logoutBtn');
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        const registerSalonBtn = document.getElementById('registerSalonBtn');
        const registerSalonCard = document.getElementById('registerSalonCard');
        const profileNavItems = document.querySelectorAll('.profile-nav-item');
        const salonTabNav = document.getElementById('salonTabNav');
        const profileTab = document.getElementById('profileTab');
        const salonTab = document.getElementById('salonTab');
        const settingsTab = document.getElementById('settingsTab');
        const salonServicesList = document.getElementById('salonServicesList');
        const addServiceBtn = document.getElementById('addServiceBtn');
        const manageServicesBtn = document.getElementById('manageServicesBtn');
        const salonImage = document.getElementById('salonImage');
        const salonName = document.getElementById('salonName');
        const salonDescription = document.getElementById('salonDescription');
        const salonAddress = document.getElementById('salonAddress');
        const salonCity = document.getElementById('salonCity');
        const salonRating = document.getElementById('salonRating');
        const salonHours = document.getElementById('salonHours');
        const salonContact = document.getElementById('salonContact');
        const mapPreview = document.getElementById('mapPreview');
        const toastContainer = document.getElementById('toastContainer');
        
        // Barber elements
        const barbersList = document.getElementById('barbersList');
        const addBarberBtn = document.getElementById('addBarberBtn');
        const barberNameInput = document.getElementById('barberNameInput');
        const barberExperienceInput = document.getElementById('barberExperienceInput');
        const barberSpecializationInput = document.getElementById('barberSpecializationInput');
        const barberRatingInput = document.getElementById('barberRatingInput');
        const barberImageInput = document.getElementById('barberImageInput');

        // Global variables
        let currentUser = null;
        let userSalon = null;
        let userSalonServices = [];
        let salonBarbers = [];

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

        // Tab switching functionality
        profileNavItems.forEach(item => {
            item.addEventListener('click', function() {
                // Remove active class from all items
                profileNavItems.forEach(navItem => {
                    navItem.classList.remove('active');
                });
                
                // Add active class to clicked item
                this.classList.add('active');
                
                // Show the corresponding tab
                const tabId = this.getAttribute('data-tab');
                
                // Hide all tabs
                profileTab.style.display = 'none';
                salonTab.style.display = 'none';
                settingsTab.style.display = 'none';
                
                // Show selected tab
                document.getElementById(tabId).style.display = 'block';
                
                // Load data for specific tabs when they're selected
                if (tabId === 'salonTab' && userSalon) {
                    loadSalonBarbers();
                }
            });
        });

        // Load user profile data
        async function loadUserProfile() {
            try {
                // Get current user session
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                
                if (sessionError) {
                    throw sessionError;
                }
                
                if (!session) {
                    // Redirect to login if no session
                    window.location.href = 'login.html';
                    return;
                }
                
                currentUser = session.user;
                
                // Get user data from users table
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('auth_uid', session.user.id)
                    .single();
                
                if (userError) {
                    throw userError;
                }
                
                // Update profile information
                profileName.textContent = userData.full_name || 'User';
                profileEmail.textContent = session.user.email;
                profileFullName.textContent = userData.full_name || 'Not provided';
                profileEmailDetail.textContent = session.user.email;
                profilePhone.textContent = userData.phone || 'Not provided';
                
                // Format and display join date
                if (userData.created_at) {
                    const joinDate = new Date(userData.created_at);
                    profileJoinDate.textContent = joinDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                } else {
                    profileJoinDate.textContent = 'Unknown';
                }
                
                // Check if user is a merchant/salon owner
                if (userData.role === 'partner' || userData.account_type === 'merchant') {
                    profileAccountType.textContent = 'Merchant / Salon Owner';
                    merchantBadge.style.display = 'inline-block';
                    registerSalonCard.style.display = 'none';
                    
                    // Show salon tab
                    salonTabNav.style.display = 'block';
                    
                    // Load salon information
                    await loadSalonInfo(userData.id);
                } else {
                    profileAccountType.textContent = 'Regular User';
                    merchantBadge.style.display = 'none';
                    registerSalonCard.style.display = 'block';
                    salonTabNav.style.display = 'none';
                }
                
            } catch (error) {
                console.error('Error loading profile:', error);
                profileName.textContent = 'Error loading profile';
                profileEmail.textContent = 'Please try again later';
                showToast('Error loading profile data', true);
            }
        }

        // Load salon information for merchants
        async function loadSalonInfo(userId) {
            try {
                const { data: salonData, error: salonError } = await supabase
                    .from('salons')
                    .select('*')
                    .eq('user_id', userId)
                    .single();
                
                if (salonError) {
                    if (salonError.code === 'PGRST116') {
                        // No salon found for this user
                        console.log('No salon found for this user');
                        return;
                    }
                    throw salonError;
                }
                
                userSalon = salonData;
                
                // Update salon information in the UI
                if (salonData.image_url) {
                    salonImage.src = salonData.image_url;
                } else {
                    salonImage.style.display = 'none';
                }
                
                salonName.textContent = salonData.name || 'Not provided';
                salonDescription.textContent = salonData.description || 'No description provided';
                salonAddress.textContent = salonData.address || 'Not provided';
                   
                salonCity.textContent = salonData.city || 'Not provided';
                salonRating.textContent = salonData.rating ? `${salonData.rating} ⭐` : 'Not rated yet';
                
                // Format business hours
                const openingTime = salonData.opening_time ? salonData.opening_time.substring(0, 5) : '10:00';
                const closingTime = salonData.closing_time ? salonData.closing_time.substring(0, 5) : '20:00';
                const closedOnSunday = salonData.closed_on_sunday ? ' (Closed on Sundays)' : '';
                salonHours.textContent = `${openingTime} - ${closingTime}${closedOnSunday}`;
                
                // Format contact information
                salonContact.textContent = `${salonData.contact_name || 'Not provided'} | ${salonData.contact_phone || 'Not provided'} | ${salonData.contact_email || 'Not provided'}`;
                
                // Update map preview if available
                if (salonData.map_link) {
                    mapPreview.innerHTML = `
                        <iframe 
                            src="https://maps.google.com/maps?q=${encodeURIComponent(salonData.map_link)}&output=embed" 
                            width="100%" 
                            height="100%" 
                            style="border:0; border-radius: 8px;" 
                            allowfullscreen="" 
                            loading="lazy">
                        </iframe>
                    `;
                }
                
                // Load salon services
                await loadSalonServices(salonData.id);
                
            } catch (error) {
                console.error('Error loading salon info:', error);
                showToast('Error loading salon information', true);
            }
        }

        // Load salon services
        async function loadSalonServices(salonId) {
            try {
                const { data: services, error: servicesError } = await supabase
                    .from('salon_services')
                    .select('*')
                    .eq('salon_id', salonId)
                    .order('service_name');
                
                if (servicesError) {
                    throw servicesError;
                }
                
                userSalonServices = services || [];
                renderSalonServices();
                
            } catch (error) {
                console.error('Error loading salon services:', error);
                showToast('Error loading salon services', true);
            }
        }

        // Render salon services
        function renderSalonServices() {
            if (!salonServicesList) return;
            
            if (userSalonServices.length === 0) {
                salonServicesList.innerHTML = '<div class="alert alert-info">No services added yet. Add your first service above.</div>';
                return;
            }
            
            salonServicesList.innerHTML = '';
            
            userSalonServices.forEach(service => {
                const serviceItem = document.createElement('div');
                serviceItem.className = 'service-item';
                serviceItem.innerHTML = `
                    <div class="service-details">
                        <div class="fw-bold">${service.service_name}</div>
                        <div>₹${service.price.toFixed(2)} • ${service.estimated_time_minutes} mins</div>
                    </div>
                    <i class="fas fa-times remove-service" data-id="${service.id}"></i>
                `;
                salonServicesList.appendChild(serviceItem);
                
                // Add event listener to remove button
                const removeBtn = serviceItem.querySelector('.remove-service');
                if (removeBtn) {
                    removeBtn.addEventListener('click', async (e) => {
                        const id = e.target.getAttribute('data-id');
                        await removeService(id);
                    });
                }
            });
        }

        // Add a new service
        addServiceBtn.addEventListener('click', async () => {
            if (!userSalon) {
                showToast('You need to have a salon registered to add services', true);
                return;
            }
            
            const name = document.getElementById('serviceNameInput').value.trim();
            const price = parseFloat(document.getElementById('servicePriceInput').value);
            const time = parseInt(document.getElementById('serviceTimeInput').value);
            
            if (!name) {
                showToast('Please enter a service name', true);
                return;
            }
            
            if (!price || price <= 0) {
                showToast('Please enter a valid price', true);
                return;
            }
            
            if (!time || time < 5 || time > 480) {
                showToast('Please enter a time between 5 and 480 minutes', true);
                return;
            }
            
            try {
                const { data, error } = await supabase
                    .from('salon_services')
                    .insert({
                        salon_id: userSalon.id,
                        service_name: name,
                        price: price,
                        estimated_time_minutes: time
                    })
                    .select();
                
                if (error) {
                    throw error;
                }
                
                // Refresh services list
                await loadSalonServices(userSalon.id);
                
                // Reset form
                document.getElementById('serviceNameInput').value = '';
                document.getElementById('servicePriceInput').value = '';
                document.getElementById('serviceTimeInput').value = '';
                
                showToast('Service added successfully');
                
            } catch (error) {
                console.error('Error adding service:', error);
                showToast('Error adding service: ' + error.message, true);
            }
        });

        // Remove a service
        async function removeService(serviceId) {
            try {
                const { error } = await supabase
                    .from('salon_services')
                    .delete()
                    .eq('id', serviceId);
                
                if (error) {
                    throw error;
                }
                
                // Refresh services list
                await loadSalonServices(userSalon.id);
                showToast('Service removed successfully');
                
            } catch (error) {
                console.error('Error removing service:', error);
                showToast('Error removing service: ' + error.message, true);
            }
        }

        // Load salon barbers
        async function loadSalonBarbers() {
            try {
                if (!userSalon) return;
                
                const { data: barbers, error: barbersError } = await supabase
                    .from('barbers')
                    .select('*')
                    .eq('salon_id', userSalon.id)
                    .order('name');
                
                if (barbersError) {
                    throw barbersError;
                }
                
                salonBarbers = barbers || [];
                renderSalonBarbers();
                
            } catch (error) {
                console.error('Error loading barbers:', error);
                barbersList.innerHTML = '<div class="alert alert-danger">Error loading barbers</div>';
            }
        }

        // Render salon barbers
        function renderSalonBarbers() {
            if (!barbersList) return;
            
            if (salonBarbers.length === 0) {
                barbersList.innerHTML = '<div class="alert alert-info">No barbers added yet. Add your first barber above.</div>';
                return;
            }
            
            barbersList.innerHTML = '';
            
            salonBarbers.forEach(barber => {
                const barberCard = document.createElement('div');
                barberCard.className = 'barber-card';
                barberCard.innerHTML = `
                    <div class="d-flex align-items-center">
                        <img src="${barber.image_url || 'https://via.placeholder.com/80'}" class="barber-image" alt="${barber.name}">
                        <div class="barber-info">
                            <h6 class="mb-1">${barber.name}</h6>
                            <div class="d-flex align-items-center mb-1">
                                <span class="barber-rating me-2">
                                    ${'★'.repeat(Math.floor(barber.rating))}${barber.rating % 1 >= 0.5 ? '½' : ''}
                                </span>
                                <span class="text-muted">${barber.rating.toFixed(1)}</span>
                            </div>
                            <div class="d-flex align-items-center">
                                <span class="barber-experience me-2">${barber.experience_years} years</span>
                                <span class="text-muted">${barber.specialization || 'General'}</span>
                            </div>
                        </div>
                        <i class="fas fa-times remove-barber text-danger" data-id="${barber.id}" style="cursor: pointer;"></i>
                    </div>
                `;
                barbersList.appendChild(barberCard);
                
                // Add event listener to remove button
                const removeBtn = barberCard.querySelector('.remove-barber');
                if (removeBtn) {
                    removeBtn.addEventListener('click', async (e) => {
                        const id = e.target.getAttribute('data-id');
                        await removeBarber(id);
                    });
                }
            });
        }

        // Add a new barber
        addBarberBtn.addEventListener('click', async () => {
            if (!userSalon) {
                showToast('You need to have a salon registered to add barbers', true);
                return;
            }
            
            const name = barberNameInput.value.trim();
            const experience = parseInt(barberExperienceInput.value);
            const specialization = barberSpecializationInput.value.trim();
            const rating = parseFloat(barberRatingInput.value);
            const imageUrl = barberImageInput.value.trim();
            
            if (!name) {
                showToast('Please enter a barber name', true);
                return;
            }
            
            if (!experience || experience < 0) {
                showToast('Please enter valid experience years', true);
                return;
            }
            
            if (!rating || rating < 0 || rating > 5) {
                showToast('Please enter a rating between 0 and 5', true);
                return;
            }
            
            try {
                const { data, error } = await supabase
                    .from('barbers')
                    .insert({
                        salon_id: userSalon.id,
                        name: name,
                        experience_years: experience,
                        specialization: specialization || 'General',
                        rating: rating,
                        image_url: imageUrl || null
                    })
                    .select();
                
                if (error) {
                    throw error;
                }
                
                // Refresh barbers list
                await loadSalonBarbers();
                
                // Reset form
                barberNameInput.value = '';
                barberExperienceInput.value = '';
                barberSpecializationInput.value = '';
                barberRatingInput.value = '';
                barberImageInput.value = '';
                
                showToast('Barber added successfully');
                
            } catch (error) {
                console.error('Error adding barber:', error);
                showToast('Error adding barber: ' + error.message, true);
            }
        });

        // Remove a barber
        async function removeBarber(barberId) {
            try {
                const { error } = await supabase
                    .from('barbers')
                    .delete()
                    .eq('id', barberId);
                
                if (error) {
                    throw error;
                }
                
                // Refresh barbers list
                await loadSalonBarbers();
                showToast('Barber removed successfully');
                
            } catch (error) {
                console.error('Error removing barber:', error);
                showToast('Error removing barber: ' + error.message, true);
            }
        }

        // Logout function
        logoutBtn.addEventListener('click', async function() {
            try {
                const { error } = await supabase.auth.signOut();
                
                if (error) {
                    throw error;
                }
                
                // Redirect to login page after logout
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error logging out:', error);
                showToast('Error logging out. Please try again.', true);
            }
        });

        // Change password function
        changePasswordBtn.addEventListener('click', function() {
            showToast('Password change functionality would be implemented here.');
            // In a real implementation, you would show a modal or redirect to a password change page
        });

        // Register salon function
        registerSalonBtn.addEventListener('click', function() {
            window.location.href = 'merchantregister.html';
        });

        // Initialize the page when DOM is loaded
        document.addEventListener('DOMContentLoaded', function() {
            loadUserProfile();
            
            // Listen for auth state changes
            supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT') {
                    window.location.href = 'login.html';
                } else if (event === 'SIGNED_IN') {
                    // Reload profile if user signs in
                    loadUserProfile();
                }
            });
        });
   
