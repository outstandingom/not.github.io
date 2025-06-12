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

// Tab switching functionality
document.querySelectorAll('.profile-nav-item').forEach(tab => {
    tab.addEventListener('click', function() {
        document.querySelectorAll('.profile-nav-item').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Show/hide tabs
        document.getElementById('profileTab').style.display = 'none';
        document.getElementById('settingsTab').style.display = 'none';
        
        if (this.textContent === 'Profile') {
            document.getElementById('profileTab').style.display = 'block';
        } else if (this.textContent === 'Settings') {
            document.getElementById('settingsTab').style.display = 'block';
        }
    });
});

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', function() {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('Logout error:', error);
        alert('Error during logout. Please try again.');
    });
});

// Password reset functionality
document.getElementById('changePasswordBtn').addEventListener('click', function() {
    const user = auth.currentUser;
    if (!user || !user.email) {
        alert('User not authenticated. Please log in again.');
        return;
    }
    
    auth.sendPasswordResetEmail(user.email).then(() => {
        alert('Password reset email sent. Please check your inbox.');
    }).catch((error) => {
        console.error('Password reset error:', error);
        alert('Error sending password reset email. Please try again.');
    });
});

// Load user data when authentication state changes
auth.onAuthStateChanged((user) => {
    if (user) {
        // Fetch additional user data from Firestore
        db.collection('users').doc(user.uid).get().then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                updateProfileUI(user, userData);
            } else {
                console.log("No user data found in Firestore");
                updateProfileUI(user, null);
            }
        }).catch((error) => {
            console.error("Error getting user document:", error);
            updateProfileUI(user, null);
        });
    } else {
        // Redirect to login if no authenticated user
        window.location.href = 'login.html';
    }
});

// Update UI with user data
function updateProfileUI(user, userData) {
    // Basic profile info
    document.getElementById('profileName').textContent = 
        userData?.fullName || user.displayName || 'User';
    
    document.getElementById('profileEmail').textContent = 
        user.email || 'No email';
    
    document.getElementById('profileFullName').textContent = 
        userData?.fullName || user.displayName || 'Not provided';
    
    document.getElementById('profileEmailDetail').textContent = 
        user.email || 'Not provided';
    
    // Profile image (uses auth photoURL if available)
    if (user.photoURL) {
        document.getElementById('profileImage').src = user.photoURL;
    } else if (userData?.photoURL) {
        document.getElementById('profileImage').src = userData.photoURL;
    }
    
    // Account creation date
    if (userData?.createdAt) {
        const joinDate = userData.createdAt.toDate();
        document.getElementById('profileJoinDate').textContent = 
            joinDate.toLocaleDateString('en-US', {
                year: 'numeric', 
                month: 'long', 
                day: 'numeric'
            });
    } else if (user.metadata.creationTime) {
        const joinDate = new Date(user.metadata.creationTime);
        document.getElementById('profileJoinDate').textContent = 
            joinDate.toLocaleDateString('en-US', {
                year: 'numeric', 
                month: 'long', 
                day: 'numeric'
            });
    } else {
        document.getElementById('profileJoinDate').textContent = 'Unknown';
    }
    
    // Phone number (if available in Firestore)
    if (userData?.phone) {
        // Create phone element if doesn't exist
        if (!document.getElementById('profilePhone')) {
            const phoneContainer = document.createElement('div');
            phoneContainer.className = 'profile-detail';
            phoneContainer.innerHTML = `
                <div class="profile-detail-label">Phone</div>
                <div class="profile-detail-value" id="profilePhone"></div>
            `;
            document.querySelector('.profile-card').appendChild(phoneContainer);
        }
        document.getElementById('profilePhone').textContent = userData.phone;
    }
}
