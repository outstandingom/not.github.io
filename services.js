// services.js
document.addEventListener('DOMContentLoaded', function() {
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
    
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // Reference to services container
    const servicesContainer = document.getElementById('services-container');

    // Function to create service card
    function createServiceCard(service) {
        return `
        <div class="col-md-6 col-lg-4">
            <div class="service-card">
                <div class="service-img">
                    <img src="${service.image}" alt="${service.name}">
                    <div class="category-tag">${service.category}</div>
                </div>
                <div class="p-4">
                    <h5>${service.name}</h5>
                    <p class="text-muted small mb-3">${service.description}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="text-warning">
                            <i class="fas fa-star"></i> ${service.rating} <span class="text-muted">(${service.reviews})</span>
                        </div>
                        <div>
                            ${service.discountPrice ? 
                              `<span class="text-muted text-decoration-line-through me-2">₹${service.price}</span>
                               <strong class="h5">₹${service.discountPrice}</strong>`
                             : 
                              `<strong class="h5">₹${service.price}</strong>`
                            }
                        </div>
                    </div>
                    <button class="btn btn-primary w-100 mt-3" data-id="${service.id}">Book Appointment</button>
                </div>
            </div>
        </div>
        `;
    }

    // Fetch services from Firestore
    function fetchServices() {
        db.collection("salonServices").get()
            .then((querySnapshot) => {
                servicesContainer.innerHTML = '';
                querySnapshot.forEach((doc) => {
                    const service = {
                        id: doc.id,
                        ...doc.data()
                    };
                    servicesContainer.innerHTML += createServiceCard(service);
                });
                
                // Add event listeners to book buttons
                document.querySelectorAll('.btn-primary').forEach(button => {
                    button.addEventListener('click', function() {
                        const serviceId = this.getAttribute('data-id');
                        bookService(serviceId);
                    });
                });
            })
            .catch((error) => {
                console.error("Error getting documents: ", error);
                servicesContainer.innerHTML = '<p class="text-center">Error loading services. Please try again later.</p>';
            });
    }

    // Book service function
    function bookService(serviceId) {
        db.collection("salonServices").doc(serviceId).get()
            .then((doc) => {
                if (doc.exists) {
                    const service = doc.data();
                    alert(`Booking confirmed for: ${service.name}\nPrice: ₹${service.discountPrice || service.price}`);
                    // Here you would typically redirect to booking page or open modal
                }
            })
            .catch((error) => {
                console.error("Error booking service: ", error);
                alert('Error processing booking. Please try again.');
            });
    }

    // Initial fetch
    fetchServices();
});
