   
        // Supabase config
        const SUPABASE_URL = 'https://bdsveayfvgnluxajbwio.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc3ZlYXlmdmdubHV4YWpid2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNDczMzIsImV4cCI6MjA3MzkyMzMzMn0.HHSFl6zkRmk2KuBZPrZsgrJ2C0xUu8McQCWvDFzNhgw';
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // Global variables
        let currentSalonId = null;
        let currentSalon = null;
        let selectedBarber = null;
        let selectedDate = null;
        let selectedTime = null;
        let selectedServices = [];
        let availableTimeSlots = [];
        let existingBookings = [];
        let currentUser = null;

        // Function to check if user is logged in and get user data
        async function checkUserLogin() {
            try {
                // Get current user session
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                
                if (sessionError) {
                    throw sessionError;
                }
                
                if (!session) {
                    // Redirect to login if no session
                    window.location.href = 'login.html';
                    return false;
                }
                
                // Get user data from users table
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('auth_uid', session.user.id)
                    .single();
                
                if (userError) {
                    throw userError;
                }
                
                return {
                    session: session,
                    user: session.user,
                    userData: userData
                };
                
            } catch (error) {
                console.error('Error checking user login:', error);
                window.location.href = 'login.html';
                return false;
            }
        }

        // Load all salons on page load
        document.addEventListener('DOMContentLoaded', async function() {
            // Check if user is logged in
            const userInfo = await checkUserLogin();
            if (!userInfo) {
                return; // Redirected to login page
            }
            
            currentUser = userInfo.userData;
            
            loadAllSalons();
            
            // Add event listener for search input
            document.getElementById('searchInput').addEventListener('input', function() {
                if (this.value.trim() === '') {
                    loadAllSalons();
                } else {
                    searchSalons();
                }
            });
            
            // Set minimum date for booking to today
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('bookingDate').min = today;
            document.getElementById('bookingDate').value = today;
            selectedDate = today;
            
            // Booking panel navigation
            document.getElementById('nextToStep2').addEventListener('click', function() {
                if (!selectedBarber) {
                    showToast('Please select a barber', 'error');
                    return;
                }
                navigateToStep(2);
            });
            
            document.getElementById('backToStep1').addEventListener('click', function() {
                navigateToStep(1);
            });
            
            document.getElementById('nextToStep3').addEventListener('click', function() {
                if (selectedServices.length === 0) {
                    showToast('Please select at least one service', 'error');
                    return;
                }
                navigateToStep(3);
            });
            
            document.getElementById('backToStep2').addEventListener('click', function() {
                navigateToStep(2);
            });
            
            document.getElementById('nextToStep4').addEventListener('click', function() {
                if (!selectedDate || !selectedTime) {
                    showToast('Please select a date and time', 'error');
                    return;
                }
                navigateToStep(4);
            });
            
            document.getElementById('backToStep3').addEventListener('click', function() {
                navigateToStep(3);
            });
            
            document.getElementById('confirmBooking').addEventListener('click', function() {
                // Validate form
                const utr = document.getElementById('customerUTR').value.trim();
                
                if (!utr) {
                    showToast('Please fill in the UTR field', 'error');
                    return;
                }
                
                createBooking();
            });
            
            // Close booking panel
            document.getElementById('closeBookingPanel').addEventListener('click', function() {
                closeBookingPanel();
            });
            
            document.getElementById('bookingOverlay').addEventListener('click', function() {
                closeBookingPanel();
            });
            
            // Date change handler
            document.getElementById('bookingDate').addEventListener('change', function() {
                selectedDate = this.value;
                loadTimeSlots();
            });
            
            // Mobile touch improvements
            improveMobileTouch();
        });

        function improveMobileTouch() {
            // Improve touch experience for mobile
            document.querySelectorAll('.barber-card, .time-slot:not(.booked), .btn, .service-checkbox').forEach(element => {
                element.style.cursor = 'pointer';
                element.addEventListener('touchstart', function() {
                    this.style.transform = 'scale(0.98)';
                });
                element.addEventListener('touchend', function() {
                    this.style.transform = 'scale(1)';
                });
            });
        }

        async function searchSalons() {
            const query = document.getElementById("searchInput").value.trim();
            const resultsDiv = document.getElementById("results");
            
            // Show loading spinner
            resultsDiv.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner-border text-secondary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Searching for salons...</p>
                </div>
            `;

            let { data, error } = await supabase
                .from("salons")
                .select("*")
                .or(`name.ilike.%${query}%,address.ilike.%${query}%,city.ilike.%${query}%`);

            if (error) {
                showToast('Error searching salons: ' + error.message, 'error');
                return;
            }

            if (!data || data.length === 0) {
                resultsDiv.innerHTML = `
                    <div class="no-results">
                        <i class="fas fa-search"></i>
                        <h4>No salons found</h4>
                        <p>Try adjusting your search terms or browse all salons</p>
                        <button class="btn btn-primary mt-2" onclick="loadAllSalons()">Browse All Salons</button>
                    </div>
                `;
                return;
            }

            displaySalons(data);
        }

        async function loadAllSalons() {
            const resultsDiv = document.getElementById("results");
            
            resultsDiv.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner-border text-secondary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading salons...</p>
                </div>
            `;

            let { data, error } = await supabase
                .from("salons")
                .select("*");

            if (error) {
                showToast('Error loading salons: ' + error.message, 'error');
                return;
            }

            displaySalons(data);
        }

        function displaySalons(salons) {
            const resultsDiv = document.getElementById("results");
            
            if (!salons || salons.length === 0) {
                resultsDiv.innerHTML = `
                    <div class="no-results">
                        <i class="fas fa-store-slash"></i>
                        <h4>No salons available</h4>
                        <p>There are no salons registered in the system yet.</p>
                    </div>
                `;
                return;
            }
            
            resultsDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h5>Found ${salons.length} Salon(s)</h5>
                </div>
                <div class="row" id="salonList">
            `;

            salons.forEach(salon => {
                const isOpen = checkIfOpen(salon);
                
                const salonCard = document.createElement("div");
                salonCard.className = "col-md-6";
                salonCard.innerHTML = `
                    <div class="salon-card">
                        <img src="${salon.image_url || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'}" 
                             class="salon-image" alt="${salon.name}" loading="lazy">
                        <div class="salon-info">
                            <h5 class="salon-name">${salon.name}</h5>
                            <p class="salon-location">
                                <i class="fas fa-map-marker-alt me-1"></i>
                                ${salon.address}, ${salon.city}
                            </p>
                            <div class="salon-hours">
                                <span class="status-badge ${isOpen ? 'status-open' : 'status-closed'}">
                                    ${isOpen ? 'Open Now' : 'Closed'}
                                </span>
                                <span>${formatTime(salon.opening_time)} - ${formatTime(salon.closing_time)}</span>
                            </div>
                            <p class="salon-contact">
                                <i class="fas fa-phone me-1"></i> ${salon.contact_phone}
                            </p>
                            <div class="row">
                                <div class="col-6">
                                    <button class="btn btn-outline" onclick="viewSalonDetails('${salon.id}')">
                                        Details
                                    </button>
                                </div>
                                <div class="col-6">
                                    <button class="btn btn-primary" onclick="openBookingPanel('${salon.id}')">
                                        Book Now
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                document.getElementById("salonList").appendChild(salonCard);
            });
            
            resultsDiv.innerHTML += `</div>`;
        }

        async function viewSalonDetails(salonId) {
            // Fetch salon details
            let { data: salon, error } = await supabase
                .from("salons")
                .select("*")
                .eq("id", salonId)
                .single();

            if (error) {
                showToast('Error fetching salon details: ' + error.message, 'error');
                return;
            }

            // Fetch salon services
            let { data: services, error: servicesError } = await supabase
                .from("salon_services")
                .select("*")
                .eq("salon_id", salonId);

            if (servicesError) {
                console.error("Error fetching services: ", servicesError);
            }

            const isOpen = checkIfOpen(salon);
            
            // Populate modal with salon details
            document.getElementById('salonModalLabel').textContent = salon.name;
            document.getElementById('salonDetails').innerHTML = `
                <div class="salon-details">
                    <div class="row">
                        <div class="col-md-6">
                            <img src="${salon.image_url || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'}" 
                                 class="img-fluid rounded mb-3" alt="${salon.name}" loading="lazy">
                            <div class="d-flex mb-3">
                                <span class="status-badge ${isOpen ? 'status-open' : 'status-closed'} me-2">
                                    ${isOpen ? 'Open Now' : 'Closed'}
                                </span>
                                <span class="badge bg-secondary">${salon.status}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <h6>Contact Information</h6>
                            <div class="detail-item">
                                <div class="detail-icon"><i class="fas fa-user"></i></div>
                                <div>${salon.contact_name}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-icon"><i class="fas fa-phone"></i></div>
                                <div>${salon.contact_phone}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-icon"><i class="fas fa-envelope"></i></div>
                                <div>${salon.contact_email}</div>
                            </div>
                            
                            <h6 class="mt-4">Business Hours</h6>
                            <div class="detail-item">
                                <div class="detail-icon"><i class="fas fa-clock"></i></div>
                                <div>${formatTime(salon.opening_time)} - ${formatTime(salon.closing_time)}</div>
                            </div>
                            ${salon.closed_on_sunday ? 
                                '<div class="detail-item"><div class="detail-icon"><i class="fas fa-calendar-times"></i></div><div>Closed on Sundays</div></div>' : 
                                ''}
                        </div>
                    </div>
                    
                    ${salon.description ? `
                        <div class="mt-3">
                            <h6>Description</h6>
                            <p>${salon.description}</p>
                        </div>
                    ` : ''}
                    
                    <div class="mt-3">
                        <h6>Location</h6>
                        <p><i class="fas fa-map-marker-alt me-2"></i> ${salon.address}, ${salon.city}</p>
                        ${salon.map_link ? `
                            <div class="map-preview">
                                <div class="text-center">
                                    <i class="fas fa-map-marked-alt"></i>
                                    <p class="mt-2">Map Location Available</p>
                                    <a href="${salon.map_link}" target="_blank" class="btn btn-outline btn-sm mt-2">View on Map</a>
                                </div>
                            </div>
                        ` : `
                            <div class="map-preview">
                                <div class="text-center">
                                    <i class="fas fa-map-marked-alt"></i>
                                    <p class="mt-2">No map location provided</p>
                                </div>
                            </div>
                        `}
                    </div>
                    
                    ${services && services.length > 0 ? `
                        <div class="mt-4">
                            <h6>Services Offered</h6>
                            ${services.map(service => `
                                <div class="service-item">
                                    <div>
                                        <div class="service-name">${service.service_name}</div>
                                        <div class="service-time">${service.estimated_time_minutes} minutes</div>
                                    </div>
                                    <div class="service-price">₹${service.price}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="text-muted mt-3">No services listed for this salon.</p>'}
                </div>
            `;
            
            // Set current salon ID for booking
            currentSalonId = salonId;
            
            // Show the modal
            const salonModal = new bootstrap.Modal(document.getElementById('salonModal'));
            salonModal.show();
        }

        async function openBookingPanel(salonId) {
            currentSalonId = salonId;
            
            // Fetch salon details
            let { data: salon, error } = await supabase
                .from("salons")
                .select("*")
                .eq("id", salonId)
                .single();

            if (error) {
                showToast('Error fetching salon details: ' + error.message, 'error');
                return;
            }
            
            currentSalon = salon;
            
            // Fetch barbers for this salon
            let { data: barbers, error: barbersError } = await supabase
                .from("barbers")
                .select("*")
                .eq("salon_id", salonId)
                .eq("is_active", true);

            if (barbersError) {
                console.error("Error fetching barbers: ", barbersError);
                barbers = [];
            }
            
            // Fetch services for this salon
            let { data: services, error: servicesError } = await supabase
                .from("salon_services")
                .select("*")
                .eq("salon_id", salonId);

            if (servicesError) {
                console.error("Error fetching services: ", servicesError);
                services = [];
            }
            
            // Display barbers
            const barbersList = document.getElementById('barbersList');
            barbersList.innerHTML = '';
            
            if (barbers.length === 0) {
                barbersList.innerHTML = '<p class="text-muted">No barbers available for this salon.</p>';
            } else {
                barbers.forEach(barber => {
                    const barberCard = document.createElement('div');
                    barberCard.className = 'barber-card';
                    barberCard.innerHTML = `
                        <div class="d-flex align-items-center">
                            <img src="${barber.image_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80'}" 
                                 class="barber-image" alt="${barber.name}" loading="lazy">
                            <div>
                                <h6 class="mb-1">${barber.name}</h6>
                                <p class="mb-1 text-muted">${barber.experience_years} years experience</p>
                                <p class="mb-0 text-muted">${barber.specialization || 'General Barber'}</p>
                            </div>
                        </div>
                    `;
                    
                    barberCard.addEventListener('click', function() {
                        // Remove selected class from all barber cards
                        document.querySelectorAll('.barber-card').forEach(card => {
                            card.classList.remove('selected');
                        });
                        
                        // Add selected class to clicked barber card
                        this.classList.add('selected');
                        selectedBarber = barber;
                    });
                    
                    barbersList.appendChild(barberCard);
                });
            }
            
            // Display services
            const servicesList = document.getElementById('servicesList');
            servicesList.innerHTML = '';
            
            if (services.length === 0) {
                servicesList.innerHTML = '<p class="text-muted">No services available for this salon.</p>';
            } else {
                services.forEach(service => {
                    const serviceCheckbox = document.createElement('div');
                    serviceCheckbox.className = 'service-checkbox';
                    serviceCheckbox.innerHTML = `
                        <input type="checkbox" id="service-${service.id}" value="${service.id}">
                        <div class="service-info">
                            <div class="service-name">${service.service_name}</div>
                            <div class="service-duration">${service.estimated_time_minutes} minutes</div>
                        </div>
                        <div class="service-price-display">₹${service.price}</div>
                    `;
                    
                    serviceCheckbox.addEventListener('click', function() {
                        const checkbox = this.querySelector('input');
                        checkbox.checked = !checkbox.checked;
                        
                        if (checkbox.checked) {
                            // Check if we've reached the maximum of 10 services
                            if (selectedServices.length >= 10) {
                                showToast('Maximum 10 services allowed per booking', 'error');
                                checkbox.checked = false;
                                return;
                            }
                            
                            this.classList.add('selected');
                            selectedServices.push(service);
                        } else {
                            this.classList.remove('selected');
                            selectedServices = selectedServices.filter(s => s.id !== service.id);
                        }
                        
                        // Update service count display
                        updateServiceCount();
                    });
                    
                    servicesList.appendChild(serviceCheckbox);
                });
            }
            
            // Pre-fill user details
            document.getElementById('customerName').value = currentUser.full_name || '';
            document.getElementById('customerPhone').value = currentUser.phone || '';
            document.getElementById('customerEmail').value = currentUser.email || '';
            
            // Reset booking form
            resetBookingForm();
            
            // Load time slots for today
            loadTimeSlots();
            
            // Show booking panel
            document.getElementById('bookingPanel').classList.add('active');
            document.getElementById('bookingOverlay').classList.add('active');
        }

        function updateServiceCount() {
            const serviceCount = selectedServices.length;
            const maxServices = 10;
            const serviceCountElement = document.querySelector('#step2 p.text-muted');
            
            if (serviceCountElement) {
                serviceCountElement.textContent = `Choose the services you want (${serviceCount}/${maxServices} selected)`;
            }
        }

        function closeBookingPanel() {
            document.getElementById('bookingPanel').classList.remove('active');
            document.getElementById('bookingOverlay').classList.remove('active');
            resetBookingForm();
        }

        function resetBookingForm() {
            // Reset all selections
            selectedBarber = null;
            selectedServices = [];
            selectedTime = null;
            
            // Reset form fields (except user details which are pre-filled)
            document.getElementById('customerUTR').value = '';
            document.getElementById('specialInstructions').value = '';
            
            // Reset UI
            document.querySelectorAll('.barber-card').forEach(card => {
                card.classList.remove('selected');
            });
            
            document.querySelectorAll('.service-checkbox').forEach(checkbox => {
                checkbox.classList.remove('selected');
                checkbox.querySelector('input').checked = false;
            });
            
            document.querySelectorAll('.time-slot').forEach(slot => {
                slot.classList.remove('selected');
            });
            
            // Reset service count
            updateServiceCount();
            
            // Go back to step 1
            navigateToStep(1);
        }

        function navigateToStep(stepNumber) {
            // Update steps
            document.querySelectorAll('.step').forEach(step => {
                step.classList.remove('active');
            });
            
            document.querySelector(`.step[data-step="${stepNumber}"]`).classList.add('active');
            
            // Update step content
            document.querySelectorAll('.step-content').forEach(content => {
                content.classList.remove('active');
            });
            
            document.getElementById(`step${stepNumber}`).classList.add('active');
            
            // Load time slots if navigating to step 3
            if (stepNumber === 3) {
                loadTimeSlots();
            }
        }

        async function loadTimeSlots() {
            if (!selectedDate) return;
            
            // Calculate total service time
            const totalServiceTime = selectedServices.reduce((total, service) => {
                return total + service.estimated_time_minutes;
            }, 0);
            
            // Generate time slots based on salon hours and service duration
            const openingTime = timeToMinutes(currentSalon.opening_time);
            const closingTime = timeToMinutes(currentSalon.closing_time);
            const slotDuration = 30; // 30 minutes per slot
            
            availableTimeSlots = [];
            
            for (let time = openingTime; time <= closingTime - totalServiceTime; time += slotDuration) {
                const hours = Math.floor(time / 60);
                const minutes = time % 60;
                const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                availableTimeSlots.push(timeString);
            }
            
            // Fetch existing bookings for the selected date
            if (selectedBarber) {
                let { data: bookings, error } = await supabase
                    .from("bookings")
                    .select("booking_time, total_duration_minutes")
                    .eq("salon_id", currentSalonId)
                    .eq("barber_id", selectedBarber.id)
                    .eq("booking_date", selectedDate)
                    .eq("status", "confirmed");
                
                if (error) {
                    console.error("Error fetching bookings: ", error);
                    existingBookings = [];
                } else {
                    existingBookings = bookings;
                }
            }
            
            // Display time slots
            const timeSlotsContainer = document.getElementById('timeSlots');
            timeSlotsContainer.innerHTML = '';
            
            availableTimeSlots.forEach(slot => {
                // Check if this time slot conflicts with existing bookings
                const slotStartTime = timeToMinutes(slot);
                const slotEndTime = slotStartTime + totalServiceTime;
                
                let isBooked = false;
                
                for (const booking of existingBookings) {
                    const bookingStartTime = timeToMinutes(booking.booking_time);
                    const bookingEndTime = bookingStartTime + booking.total_duration_minutes;
                    
                    // Check for time conflict
                    if ((slotStartTime >= bookingStartTime && slotStartTime < bookingEndTime) ||
                        (slotEndTime > bookingStartTime && slotEndTime <= bookingEndTime) ||
                        (slotStartTime <= bookingStartTime && slotEndTime >= bookingEndTime)) {
                        isBooked = true;
                        break;
                    }
                }
                
                const timeSlot = document.createElement('span');
                timeSlot.className = `time-slot ${isBooked ? 'booked' : ''}`;
                timeSlot.textContent = formatTime(slot);
                
                if (!isBooked) {
                    timeSlot.addEventListener('click', function() {
                        // Remove selected class from all time slots
                        document.querySelectorAll('.time-slot').forEach(slot => {
                            slot.classList.remove('selected');
                        });
                        
                        // Add selected class to clicked time slot
                        this.classList.add('selected');
                        selectedTime = slot;
                    });
                }
                
                timeSlotsContainer.appendChild(timeSlot);
            });
        }

        async function createBooking() {
            // Get customer details
            const customerUTR = document.getElementById('customerUTR').value.trim();
            const specialInstructions = document.getElementById('specialInstructions').value.trim();
            
            // Validate required fields
            if (!customerUTR) {
                showToast('Please fill in the UTR field', 'error');
                return;
            }
            
            // Calculate total amount and duration
            let totalAmount = 0;
            let totalDuration = 0;
            
            selectedServices.forEach(service => {
                totalAmount += parseFloat(service.price);
                totalDuration += service.estimated_time_minutes;
            });
            
            // Token amount (20% of total)
            const tokenAmount = totalAmount * 0.2;
            
            try {
                // Create booking
                const { data: booking, error } = await supabase
                    .from("bookings")
                    .insert([
                        {
                            salon_id: currentSalonId,
                            barber_id: selectedBarber.id,
                            customer_id: currentUser.id,
                            booking_date: selectedDate,
                            booking_time: selectedTime,
                            total_amount: totalAmount,
                            token_amount: tokenAmount,
                            token_utr: customerUTR,
                            total_duration_minutes: totalDuration,
                            status: 'pending',
                            customer_name: currentUser.full_name,
                            customer_phone: currentUser.phone,
                            customer_email: currentUser.email || null,
                            special_instructions: specialInstructions || null
                        }
                    ])
                    .select();
                
                if (error) {
                    console.error('Booking creation error:', error);
                    throw new Error('Error creating booking: ' + error.message);
                }
                
                // Create booking services
                if (booking && booking.length > 0) {
                    const bookingId = booking[0].id;
                    
                    const bookingServices = selectedServices.map(service => ({
                        booking_id: bookingId,
                        service_id: service.id,
                        quantity: 1,
                        price: service.price
                    }));
                    
                    const { error: servicesError } = await supabase
                        .from("booking_services")
                        .insert(bookingServices);
                    
                    if (servicesError) {
                        console.error('Booking services error:', servicesError);
                        throw new Error('Error adding services to booking: ' + servicesError.message);
                    }
                }
                
                showToast('Booking created successfully!', 'success');
                closeBookingPanel();
                resetBookingForm();
                
            } catch (error) {
                showToast(error.message, 'error');
                console.error('Booking error:', error);
            }
        }

        function checkIfOpen(salon) {
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const openingTime = timeToMinutes(salon.opening_time);
            const closingTime = timeToMinutes(salon.closing_time);
            
            // Check if today is Sunday and salon is closed on Sundays
            if (salon.closed_on_sunday && now.getDay() === 0) {
                return false;
            }
            
            return currentTime >= openingTime && currentTime <= closingTime;
        }

        function timeToMinutes(timeStr) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        }

        function formatTime(timeStr) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const period = hours >= 12 ? 'PM' : 'AM';
            const formattedHours = hours % 12 || 12;
            return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
        }

        function showToast(message, type = 'success') {
            const toastContainer = document.getElementById('toastContainer');
            const toastId = 'toast-' + Date.now();
            
            const toast = document.createElement('div');
            toast.className = `toast ${type === 'error' ? 'error' : ''}`;
            toast.setAttribute('role', 'alert');
            toast.innerHTML = `
                <div class="toast-body d-flex justify-content-between">
                    <div>
                        <i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : 'fa-check-circle'} me-2"></i>
                        ${message}
                    </div>
                    <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                </div>
            `;
            
            toastContainer.appendChild(toast);
            const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 5000 });
            bsToast.show();
            
            // Remove toast from DOM after it's hidden
            toast.addEventListener('hidden.bs.toast', function() {
                toast.remove();
            });
        }

        // Set up book now button in modal
        document.getElementById('bookNowBtn').addEventListener('click', function() {
            if (currentSalonId) {
                openBookingPanel(currentSalonId);
                // Close the modal
                const salonModal = bootstrap.Modal.getInstance(document.getElementById('salonModal'));
                salonModal.hide();
            }
        });
    
